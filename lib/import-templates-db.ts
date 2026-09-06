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
import type { ColumnMapping, ImportTemplate } from "@/lib/import";

const TABLE = "import_templates";
const COLUMNS = "id, user_id, fingerprint, name, mapping, header_paths, uses";

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
        mapping: input.mapping,
        header_paths: input.headerPaths,
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
    mapping: input.mapping,
    header_paths: input.headerPaths,
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
