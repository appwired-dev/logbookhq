/**
 * Plain, JSON-serialisable shapes shared by the import server actions and
 * the wizard UI, plus the pure guards that validate them when the client
 * echoes them back. No "use client"/"use server" here so both sides can import.
 *
 * Runtime imports here land in the client bundle, so only the dependency-free
 * `lib/import/targets` is used — never `@/lib/import` (that index pulls in
 * SheetJS and the Anthropic SDK; see scripts/check-client-graph.ts).
 */
import type {
  Analysis, CanonicalTarget, ColumnAssignment, ColumnMapping, HeaderBand, HeaderPath, MappingSource, ReconcileReport, SkipReason,
} from "@/lib/import";
import { parseTargetKey, targetKey } from "@/lib/import/targets";
import type { ParsedFlight } from "@/lib/csv";

export type ImportMode = "append" | "replace";

export interface SkipCount {
  reason: SkipReason;
  count: number;
}

/** Output of applying a mapping + reconciling — what step 3 renders. */
export interface PreviewData {
  report: ReconcileReport;
  /** Flights that will be inserted. */
  flights: number;
  /** Source rows dropped by apply. */
  skipped: number;
  skippedReasons: SkipCount[];
  /** First few parsed flights, for the sanity-check preview. */
  sampleFlights: ParsedFlight[];
  /** The user's current flight count (replace-mode warning). */
  existingCount: number;
}

export interface AnalyzeData extends PreviewData {
  analysis: Analysis;
}

export interface CommitData {
  inserted: number;
  deleted: number;
  templateSaved: boolean;
}

export type ActionError = { error: string };
export type ActionResult<T> = T | ActionError;

export function isActionError<T>(r: ActionResult<T>): r is ActionError {
  return typeof r === "object" && r !== null && "error" in r && typeof (r as ActionError).error === "string";
}

/**
 * Upload limits — mirrored client-side for instant feedback.
 *
 * next.config.ts caps a server-action body at 25 MB, and that body carries
 * the file *plus* multipart framing and the echoed analysis/mapping JSON
 * (tens of KB for a wide sheet). 23 MB leaves headroom so a file the client
 * accepted is never rejected by the framework with an opaque 413.
 */
export const MAX_FILE_BYTES = 23 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = ["csv", "tsv", "txt", "xlsx", "xls", "numbers"] as const;

export function fileExtension(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

export function isAllowedExtension(name: string): boolean {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

// ---------------------------------------------------------------------------
// Guards for client-echoed JSON
//
// The wizard sends the Analysis and ColumnMapping back to the server on each
// step. Nothing below trusts that JSON: every value the pipeline dereferences
// or forwards to the database is checked, and anything structurally wrong
// yields `null` so the action can answer "Missing analysis or mapping."
// Targets are normalised through parseTargetKey(targetKey(t)) — the same
// round-trip the arbiter and the mapping UI use — so an unknown target
// degrades to `{ kind: "ignore" }` instead of reaching apply/reconcile.
// ---------------------------------------------------------------------------

/** Upper bound on a source-column index; a real sheet is far narrower. */
export const MAX_MAPPING_COLUMNS = 10_000;

const MAPPING_SOURCES: readonly MappingSource[] = ["template", "synonym", "shape", "ai", "user"];
const CONVENTION_KEYS = ["clockTimes", "decimalComma", "dayFirstDates", "blankAircraftIsSim"] as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function isMappingSource(v: unknown): v is MappingSource {
  return typeof v === "string" && (MAPPING_SOURCES as readonly string[]).includes(v);
}

/** A target survives only if it round-trips through its stable key; anything else is "ignore". */
export function normaliseTarget(raw: unknown): CanonicalTarget {
  if (!isPlainObject(raw) || typeof raw.kind !== "string") return { kind: "ignore" };
  // targetKey only reads kind/field/category/condition/role, so a malformed
  // object produces a key parseTargetKey does not recognise → "ignore".
  return parseTargetKey(targetKey(raw as CanonicalTarget));
}

function normaliseConventions(raw: Record<string, unknown> | undefined): ColumnMapping["conventions"] {
  const out: ColumnMapping["conventions"] = {};
  if (!raw) return out;
  for (const k of CONVENTION_KEYS) {
    const v = raw[k];
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

/**
 * Validate + normalise a client-echoed ColumnMapping. Returns `null` when the
 * structure is wrong (no `columns` array, a column index that is not a
 * non-negative integer below MAX_MAPPING_COLUMNS, or a non-object
 * `conventions`). Unknown targets become "ignore"; confidence is clamped to
 * 0..1; an unknown source is treated as a user choice so the arbiter never
 * overrides it.
 */
export function normaliseMapping(raw: unknown): ColumnMapping | null {
  if (!isPlainObject(raw) || !Array.isArray(raw.columns)) return null;
  if (raw.conventions !== undefined && raw.conventions !== null && !isPlainObject(raw.conventions)) return null;
  const columns: ColumnAssignment[] = [];
  for (const c of raw.columns) {
    if (!isPlainObject(c) || !isNonNegativeInt(c.col) || c.col >= MAX_MAPPING_COLUMNS) return null;
    const confidence = typeof c.confidence === "number" && Number.isFinite(c.confidence)
      ? Math.max(0, Math.min(1, c.confidence))
      : 0;
    const assignment: ColumnAssignment = {
      col: c.col,
      target: normaliseTarget(c.target),
      confidence,
      source: isMappingSource(c.source) ? c.source : "user",
    };
    if (typeof c.reason === "string" && c.reason) assignment.reason = c.reason.slice(0, 500);
    columns.push(assignment);
  }
  return { columns, conventions: normaliseConventions(isPlainObject(raw.conventions) ? raw.conventions : undefined) };
}

function normaliseHeaderPath(raw: unknown): HeaderPath | null {
  if (!isPlainObject(raw) || !isNonNegativeInt(raw.col) || raw.col >= MAX_MAPPING_COLUMNS) return null;
  if (!Array.isArray(raw.path) || !raw.path.every((s): s is string => typeof s === "string")) return null;
  const path = raw.path;
  return { col: raw.col, path, label: typeof raw.label === "string" ? raw.label : path.join(" › ") };
}

/** `dataStart` a non-negative integer, `rows` non-negative integers, `paths` well-formed. */
export function normaliseHeaderBand(raw: unknown): HeaderBand | null {
  if (!isPlainObject(raw) || !isNonNegativeInt(raw.dataStart)) return null;
  if (!Array.isArray(raw.rows) || !raw.rows.every(isNonNegativeInt)) return null;
  if (!Array.isArray(raw.paths)) return null;
  const paths: HeaderPath[] = [];
  for (const p of raw.paths) {
    const hp = normaliseHeaderPath(p);
    if (!hp) return null;
    paths.push(hp);
  }
  return { rows: raw.rows, dataStart: raw.dataStart, paths };
}

/**
 * Validate + normalise a client-echoed Analysis. Checks the parts the pipeline
 * dereferences (`sheetIndex`, `header`, `mapping`, `fingerprint`); the rest is
 * carried through as-is and only ever feeds code that runs inside a try/catch.
 */
export function normaliseAnalysis(raw: unknown): Analysis | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.fingerprint !== "string" || !raw.fingerprint || !isNonNegativeInt(raw.sheetIndex)) return null;
  const header = normaliseHeaderBand(raw.header);
  const mapping = normaliseMapping(raw.mapping);
  if (!header || !mapping) return null;
  const rest = raw as unknown as Analysis;
  return {
    ...rest,
    sheetIndex: raw.sheetIndex,
    fingerprint: raw.fingerprint,
    header,
    mapping,
    sample: Array.isArray(rest.sample) ? rest.sample : [],
    declaredTotals: Array.isArray(rest.declaredTotals) ? rest.declaredTotals : [],
    lowConfidenceCols: Array.isArray(rest.lowConfidenceCols) ? rest.lowConfidenceCols.filter(isNonNegativeInt) : [],
    rowCount: isNonNegativeInt(rest.rowCount) ? rest.rowCount : 0,
  };
}
