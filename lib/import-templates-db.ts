/**
 * Supabase CRUD for `import_templates` (migration 0012).
 *
 * A template is a saved ColumnMapping keyed by the fingerprint of a
 * workbook's header paths. Rows with `user_id = null` are system templates
 * (visible to everyone, never written from here); the rest belong to the
 * calling user. RLS enforces both — every helper here goes through the
 * user's own client, never the service role.
 *
 * The code-level `SYSTEM_TEMPLATES` in lib/import are NOT merged here; the
 * caller (app/app/import/actions.ts) combines them with the DB rows.
 *
 * Server-only: never import from a Client Component.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseTargetKey, targetKey, type ColumnAssignment, type ColumnMapping, type ImportTemplate, type MappingSource } from "@/lib/import";

const TABLE = "import_templates";
const COLUMNS = "id, user_id, fingerprint, name, mapping, header_paths, uses";

// Upper bound on a source-column index; a real sheet is far narrower.
const MAX_TEMPLATE_COLUMNS = 10_000;
const MAPPING_SOURCES: readonly MappingSource[] = ["template", "synonym", "shape", "ai", "user"];
const CONVENTION_KEYS = ["clockTimes", "decimalComma", "dayFirstDates", "blankAircraftIsSim"] as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

/**
 * What actually gets persisted as `mapping`. Every column target is pushed
 * through parseTargetKey(targetKey(t)) — the round-trip the arbiter and the
 * wizard use — so an unknown target is stored as "ignore" rather than as a
 * shape the apply step has never seen; entries without a usable column index
 * are dropped. Positions are not significant here (columns link to
 * `header_paths` by their `col` value), so dropping is safe.
 */
function normaliseMappingForStorage(mapping: ColumnMapping): ColumnMapping {
  const columns: ColumnAssignment[] = [];
  for (const raw of mapping.columns as unknown[]) {
    if (!isPlainObject(raw) || !isNonNegativeInt(raw.col) || raw.col >= MAX_TEMPLATE_COLUMNS) continue;
    const target = isPlainObject(raw.target) && typeof raw.target.kind === "string"
      ? parseTargetKey(targetKey(raw.target as ColumnAssignment["target"]))
      : { kind: "ignore" as const };
    const confidence = typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0;
    const source = typeof raw.source === "string" && (MAPPING_SOURCES as readonly string[]).includes(raw.source)
      ? (raw.source as MappingSource)
      : "user";
    const assignment: ColumnAssignment = { col: raw.col, target, confidence, source };
    if (typeof raw.reason === "string" && raw.reason) assignment.reason = raw.reason.slice(0, 500);
    columns.push(assignment);
  }
  const conventions: ColumnMapping["conventions"] = {};
  const rawConventions: unknown = mapping.conventions;
  if (isPlainObject(rawConventions)) {
    for (const k of CONVENTION_KEYS) {
      const v = rawConventions[k];
      if (typeof v === "boolean") conventions[k] = v;
    }
  }
  return { columns, conventions };
}

/**
 * `header_paths` must be string[][] with one entry per source column — the
 * index IS the column, so a malformed entry becomes an empty path (which the
 * matcher skips) instead of being dropped and shifting everything after it.
 */
function normaliseHeaderPaths(paths: unknown): string[][] {
  if (!Array.isArray(paths)) return [];
  return paths.map((p) => (Array.isArray(p) ? p.filter((s): s is string => typeof s === "string") : []));
}

interface TemplateRow {
  id: string;
  user_id: string | null;
  fingerprint: string;
  name: string;
  mapping: ColumnMapping;
  header_paths: string[][];
  uses: number | null;
}

function rowToTemplate(r: TemplateRow): ImportTemplate {
  return {
    id: r.id,
    fingerprint: r.fingerprint,
    name: r.name,
    source: r.user_id ? "user" : "system",
    mapping: r.mapping,
    headerPaths: Array.isArray(r.header_paths) ? r.header_paths : [],
    uses: r.uses ?? 0,
  };
}

/**
 * System rows + the user's own rows. The user's templates come first, then
 * system templates, each group ordered by most-used — so a first-match
 * consumer prefers what the pilot saved themselves.
 *
 * Never throws: a missing table (migration not applied yet) or a transient
 * error degrades to "no templates" so the wizard still works.
 */
export async function listTemplatesForUser(supabase: SupabaseClient, userId: string): Promise<ImportTemplate[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order("uses", { ascending: false });
  if (error) {
    console.warn("[import-templates] list failed:", error.message);
    return [];
  }
  const rows = (data ?? []) as unknown as TemplateRow[];
  const own = rows.filter((r) => r.user_id === userId).map(rowToTemplate);
  const system = rows.filter((r) => r.user_id === null).map(rowToTemplate);
  return [...own, ...system];
}

/**
 * Save (or refresh) the user's template for a fingerprint. On conflict with
 * an existing (user_id, fingerprint) row the mapping and name are replaced
 * and `uses` is incremented; a brand-new row starts at 1 use (this import).
 *
 * Implemented as select-then-write rather than PostgREST `upsert`: the
 * uniqueness is a *partial* index (`where user_id is not null`) which
 * `ON CONFLICT (user_id, fingerprint)` cannot infer without the predicate.
 */
export async function upsertUserTemplate(
  supabase: SupabaseClient,
  userId: string,
  input: { fingerprint: string; name: string; mapping: ColumnMapping; headerPaths: string[][] },
): Promise<void> {
  const name = input.name.trim().slice(0, 120) || "Untitled layout";
  const mapping = normaliseMappingForStorage(input.mapping);
  const headerPaths = normaliseHeaderPaths(input.headerPaths);
  const { data: existing, error: selErr } = await supabase
    .from(TABLE)
    .select("id, uses")
    .eq("user_id", userId)
    .eq("fingerprint", input.fingerprint)
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);

  if (existing) {
    const { error } = await supabase
      .from(TABLE)
      .update({
        name,
        mapping,
        header_paths: headerPaths,
        uses: ((existing.uses as number | null) ?? 0) + 1,
      })
      .eq("id", existing.id as string)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from(TABLE).insert({
    user_id: userId,
    fingerprint: input.fingerprint,
    name,
    mapping,
    header_paths: headerPaths,
    uses: 1,
  });
  if (error) throw new Error(error.message);
}

/**
 * Increment `uses` on one of the user's templates. System rows and unknown
 * ids are silently ignored (RLS hides them; the update matches zero rows).
 */
export async function bumpTemplateUse(supabase: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await supabase.from(TABLE).select("uses").eq("id", id).maybeSingle();
  if (error || !data) return;
  await supabase
    .from(TABLE)
    .update({ uses: ((data.uses as number | null) ?? 0) + 1 })
    .eq("id", id);
}
