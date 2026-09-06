"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  analyzeWorkbook, applyMapping, arbitrateWithClaude, readWorkbook, reconcile, SYSTEM_TEMPLATES,
  type Analysis, type ApplyResult, type ColumnMapping, type ImportTemplate, type SkipReason,
} from "@/lib/import";
import type { ParsedFlight } from "@/lib/csv";
import { bumpTemplateUse, listTemplatesForUser, upsertUserTemplate } from "@/lib/import-templates-db";
import {
  MAX_FILE_BYTES, isActionError as isError, isAllowedExtension,
  type ActionError, type ActionResult, type AnalyzeData, type CommitData, type ImportMode, type PreviewData, type SkipCount,
} from "./wizard-types";

/*
 * Import wizard server actions. Every action returns a plain serialisable
 * object and reports user-facing failures as `{ error }` — never by throwing.
 *
 * The uploaded file is never persisted server-side: the browser still holds
 * the File, so each step re-sends it under the same `file` field.
 *
 * FormData fields:
 *   analyzeImportAction   file
 *   arbitrateImportAction analysis (JSON), onlyCols (JSON number[], optional)
 *   previewImportAction   file, analysis (JSON), mapping (JSON)
 *   commitImportAction    file, analysis (JSON), mapping (JSON), mode ("append"|"replace"),
 *                         saveTemplate ("1"), templateName
 */

const BATCH = 500;
// Hard cap on parsed rows to prevent OOM on a runaway upload. A 50-year career
// at 1000 hrs/year is ~50,000 flights; anything beyond that is not a logbook.
const MAX_PARSED_FLIGHTS = 50_000;
const SAMPLE_FLIGHTS = 5;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

async function requireUser(): Promise<{ supabase: SupabaseClient; userId: string } | ActionError> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  return { supabase, userId: user.id };
}

async function readUpload(formData: FormData): Promise<{ file: File; bytes: Uint8Array } | ActionError> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Pick a file first." };
  if (file.size > MAX_FILE_BYTES) {
    return { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_FILE_BYTES / 1024 / 1024} MB.` };
  }
  if (!isAllowedExtension(file.name)) {
    return { error: "That file type isn't supported. Use CSV, TSV, TXT, XLSX or XLS." };
  }
  try {
    return { file, bytes: new Uint8Array(await file.arrayBuffer()) };
  } catch (e: unknown) {
    return { error: `Could not read file: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function readJson<T>(formData: FormData, name: string): T | null {
  const raw = formData.get(name);
  if (typeof raw !== "string" || !raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** The client echoes the analysis back as JSON — check the parts we dereference before the pipeline sees it. */
function readAnalysis(formData: FormData): Analysis | null {
  const a = readJson<Analysis>(formData, "analysis");
  if (!a || typeof a !== "object") return null;
  if (!a.header || !Array.isArray(a.header.paths) || !a.mapping || !Array.isArray(a.mapping.columns)) return null;
  if (typeof a.fingerprint !== "string") return null;
  return a;
}

function readMapping(formData: FormData): ColumnMapping | null {
  const m = readJson<ColumnMapping>(formData, "mapping");
  if (!m || typeof m !== "object" || !Array.isArray(m.columns)) return null;
  return { ...m, conventions: m.conventions ?? {} };
}

async function getAugHalfCredit(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("aug_half_credit").eq("id", userId).maybeSingle();
  return Boolean(data?.aug_half_credit);
}

async function countFlights(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count } = await supabase
    .from("flights")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}

/** User templates first (they win a first-match), then DB system rows, then the code-level system set. */
async function loadTemplates(supabase: SupabaseClient, userId: string): Promise<ImportTemplate[]> {
  const fromDb = await listTemplatesForUser(supabase, userId);
  const seen = new Set(fromDb.map((t) => t.fingerprint));
  return [...fromDb, ...SYSTEM_TEMPLATES.filter((t: ImportTemplate) => !seen.has(t.fingerprint))];
}

function tallySkips(skipped: ApplyResult["skipped"]): SkipCount[] {
  const counts = new Map<SkipReason, number>();
  for (const s of skipped) counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1);
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

/** Apply + reconcile in one go — the shared tail of analyze/preview/commit. */
function runPipeline(
  bytes: Uint8Array, filename: string, analysis: Analysis, mapping: ColumnMapping, augHalfCredit: boolean,
): { applied: ApplyResult; preview: Omit<PreviewData, "existingCount"> } | ActionError {
  try {
    const workbook = readWorkbook(bytes, filename);
    const applied = applyMapping(workbook, analysis, mapping);
    const report = reconcile(applied, analysis, mapping, { augHalfCredit });
    return {
      applied,
      preview: {
        report,
        flights: applied.flights.length,
        skipped: applied.skipped.length,
        skippedReasons: tallySkips(applied.skipped),
        sampleFlights: applied.flights.slice(0, SAMPLE_FLIGHTS),
      },
    };
  } catch (e: unknown) {
    return { error: `Could not apply the column mapping: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ---------------------------------------------------------------------------
// Step 1 — analyze
// ---------------------------------------------------------------------------

export async function analyzeImportAction(formData: FormData): Promise<ActionResult<AnalyzeData>> {
  // Auth first so an anonymous caller never gets 25 MB buffered on their behalf.
  const auth = await requireUser();
  if (isError(auth)) return auth;
  const upload = await readUpload(formData);
  if (isError(upload)) return upload;
  const { supabase, userId } = auth;
  const { file, bytes } = upload;

  let analysis: Analysis;
  try {
    const templates = await loadTemplates(supabase, userId);
    analysis = analyzeWorkbook(bytes, file.name, { templates });
  } catch (e: unknown) {
    return { error: `Could not read file: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (analysis.header.paths.length === 0 || analysis.rowCount === 0) {
    return { error: "No flight rows found in this file. Check that the sheet with your flights has a header row." };
  }
  if (analysis.rowCount > MAX_PARSED_FLIGHTS) {
    return { error: `File contains ${analysis.rowCount.toLocaleString()} rows — over the ${MAX_PARSED_FLIGHTS.toLocaleString()} import limit. Split into smaller files.` };
  }

  const augHalfCredit = await getAugHalfCredit(supabase, userId);
  const run = runPipeline(bytes, file.name, analysis, analysis.mapping, augHalfCredit);
  if (isError(run)) return run;
  const existingCount = await countFlights(supabase, userId);
  return { analysis, ...run.preview, existingCount };
}

// ---------------------------------------------------------------------------
// Step 2 — AI arbiter for the unclear columns
// ---------------------------------------------------------------------------

export async function arbitrateImportAction(formData: FormData): Promise<ActionResult<{ mapping: ColumnMapping }>> {
  if (!process.env.ANTHROPIC_API_KEY) return { error: "AI mapping is not enabled on this server" };
  const auth = await requireUser();
  if (isError(auth)) return auth;
  const analysis = readAnalysis(formData);
  if (!analysis) return { error: "Missing analysis." };
  const rawCols = readJson<unknown>(formData, "onlyCols");
  const onlyCols = Array.isArray(rawCols) ? rawCols.filter((c): c is number => Number.isInteger(c)) : undefined;
  try {
    const mapping = await arbitrateWithClaude(analysis, { onlyCols });
    return { mapping };
  } catch (e: unknown) {
    return { error: `AI mapping failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ---------------------------------------------------------------------------
// Step 2 → 3 — preview with the (possibly edited) mapping
// ---------------------------------------------------------------------------

export async function previewImportAction(formData: FormData): Promise<ActionResult<PreviewData>> {
  const auth = await requireUser();
  if (isError(auth)) return auth;
  const upload = await readUpload(formData);
  if (isError(upload)) return upload;
  const analysis = readAnalysis(formData);
  const mapping = readMapping(formData);
  if (!analysis || !mapping) return { error: "Missing analysis or mapping." };

  const { supabase, userId } = auth;
  const augHalfCredit = await getAugHalfCredit(supabase, userId);
  const run = runPipeline(upload.bytes, upload.file.name, analysis, mapping, augHalfCredit);
  if (isError(run)) return run;
  const existingCount = await countFlights(supabase, userId);
  return { ...run.preview, existingCount };
}

// ---------------------------------------------------------------------------
// Step 3 — commit
// ---------------------------------------------------------------------------

export async function commitImportAction(formData: FormData): Promise<ActionResult<CommitData>> {
  const auth = await requireUser();
  if (isError(auth)) return auth;
  const upload = await readUpload(formData);
  if (isError(upload)) return upload;
  const analysis = readAnalysis(formData);
  const mapping = readMapping(formData);
  if (!analysis || !mapping) return { error: "Missing analysis or mapping." };
  const mode: ImportMode = formData.get("mode") === "replace" ? "replace" : "append";
  const saveTemplate = formData.get("saveTemplate") === "1";
  const templateName = String(formData.get("templateName") ?? "").trim();

  const { supabase, userId } = auth;
  const augHalfCredit = await getAugHalfCredit(supabase, userId);
  const run = runPipeline(upload.bytes, upload.file.name, analysis, mapping, augHalfCredit);
  if (isError(run)) return run;
  const flights = run.applied.flights;
  if (flights.length === 0) return { error: "No valid flights to import. Check the mapping — at least a date, an aircraft and a time column are needed." };
  if (flights.length > MAX_PARSED_FLIGHTS) {
    return { error: `File contains ${flights.length.toLocaleString()} flights — over the ${MAX_PARSED_FLIGHTS.toLocaleString()} import limit. Split into smaller files.` };
  }

  const result = await insertFlights(supabase, userId, flights, mode);
  if (isError(result)) return result;

  let templateSaved = false;
  if (saveTemplate) {
    try {
      await upsertUserTemplate(supabase, userId, {
        fingerprint: analysis.fingerprint,
        name: templateName || upload.file.name.replace(/\.[^.]+$/, ""),
        mapping,
        headerPaths: analysis.header.paths.map((p) => p.path),
      });
      templateSaved = true;
    } catch (e: unknown) {
      // The flights are in; a template failure must not read as a failed import.
      console.warn("[import] template save failed:", e instanceof Error ? e.message : String(e));
    }
  } else if (analysis.templateId && /^[0-9a-f-]{36}$/i.test(analysis.templateId)) {
    // A stored template drove this import — count the use (no-op for system rows).
    await bumpTemplateUse(supabase, analysis.templateId);
  }

  revalidatePath("/app");
  revalidatePath("/app/flights");
  return { inserted: result.inserted, deleted: result.deleted, templateSaved };
}

// ---------------------------------------------------------------------------
// Insert (+ replace) — the hard-won safe ordering, unchanged in substance
// ---------------------------------------------------------------------------

/**
 * Insert parsed flights for `userId`. In replace mode the ORIGINAL rows are
 * deleted only after every insert succeeded:
 *   1. Snapshot current flight ids (paginated — see below).
 *   2. Insert new rows in batches. If any batch fails, delete the rows we
 *      just inserted and report the error.
 *   3. Only then delete the snapshot ids.
 * The user briefly sees old + new rows together — an acceptable tradeoff for
 * never losing irreplaceable data on a flaky network.
 */
async function insertFlights(
  supabase: SupabaseClient, userId: string, flights: ParsedFlight[], mode: ImportMode,
): Promise<{ inserted: number; deleted: number } | ActionError> {
  const oldIds: number[] = [];
  if (mode === "replace") {
    // Snapshot in 1000-row pages. PostgREST silently caps a single .select()
    // at 1000 rows (project's db.max_rows) — an unbounded query on a user
    // with more than that returns only the first 1000 ids, so the cleanup
    // step below leaves the rest as stale rows next to the new import.
    // Real incident: a user with 2,644 flights had 644 old rows survive.
    const PAGE = 1000;
    let from = 0;
    for (;;) {
      const { data: page, error: snapErr } = await supabase
        .from("flights")
        .select("id")
        .eq("user_id", userId)
        .order("id")
        .range(from, from + PAGE - 1);
      if (snapErr) return { error: `Snapshot failed: ${snapErr.message}` };
      if (!page || page.length === 0) break;
      for (const r of page) oldIds.push(r.id as number);
      if (page.length < PAGE) break;
      from += PAGE;
      if (from >= 200_000) break; // runaway guard
    }
  }

  // Stamp user_id and batch-insert. Default duty_time to 0 for imports.
  // Capture returned ids so we can roll back if a later batch fails.
  const newIds: number[] = [];
  let inserted = 0;
  for (let i = 0; i < flights.length; i += BATCH) {
    const slice = flights.slice(i, i + BATCH).map((f) => ({ ...f, user_id: userId, duty_time: 0 }));
    const { data: insertedRows, error } = await supabase
      .from("flights")
      .insert(slice)
      .select("id");
    if (error) {
      // Roll back the new rows we already inserted in this run so the user
      // isn't left with a half-import on top of their original data.
      if (newIds.length > 0) {
        await supabase.from("flights").delete().in("id", newIds);
      }
      return { error: `Insert failed at row ${i}: ${error.message}` };
    }
    for (const r of insertedRows ?? []) newIds.push(r.id as number);
    inserted += slice.length;
  }

  // All inserts succeeded — now safe to delete the original rows.
  let deleted = 0;
  if (mode === "replace" && oldIds.length > 0) {
    // Chunk the IN clause so very long id arrays don't blow PostgREST's URL
    // length limits.
    for (let i = 0; i < oldIds.length; i += BATCH) {
      const chunk = oldIds.slice(i, i + BATCH);
      const { error } = await supabase.from("flights").delete().in("id", chunk);
      if (error) {
        // Old rows linger as duplicates. Better than losing the new import;
        // surface the warning so the user can manually clean up.
        return { error: `Imported ${inserted} flights, but cleanup of old rows failed: ${error.message}. Old + new flights both present — delete old manually.` };
      }
      deleted += chunk.length;
    }
  }

  return { inserted, deleted };
}
