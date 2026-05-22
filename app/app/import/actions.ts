"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { parseAnyLogbook } from "@/lib/import-formats";

const BATCH = 500;
// Hard caps to prevent OOM on a malicious or runaway upload. Files larger
// than this are almost certainly not real pilot logbooks (a 50-year career
// at 1000 hrs/year = 50,000 flights ≈ 8 MB CSV); we cap upload at 10 MB and
// parsed-flight count at 50,000 with headroom for both.
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PARSED_FLIGHTS = 50_000;

/**
 * Normalise uploaded file → CSV text. We accept Excel (.xlsx/.xls), OpenDocument
 * (.ods), and plain CSV/TSV — SheetJS handles all the binary formats; CSV/TSV
 * are read straight as text.
 *
 * For multi-sheet workbooks we pick the sheet with the most non-empty cells.
 * Some pilots put their actual data on Sheet2/Sheet3 and leave Sheet1 as a
 * cover page or summary; "first sheet" was too brittle.
 */
async function fileToCsvText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const isBinary = /\.(xlsx|xls|ods|xlsm|xlsb)$/.test(name);

  if (!isBinary) {
    // .csv, .tsv, .txt — read directly. SheetJS auto-detects delimiter in CSVs
    // but we save a round-trip by just returning the text.
    return await file.text();
  }

  // Binary spreadsheet — parse with SheetJS. Try every sheet, pick the one
  // with the most non-empty rows so we don't get stuck on an empty "Sheet1".
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  if (wb.SheetNames.length === 0) throw new Error("Workbook has no sheets.");

  let bestCsv = "";
  let bestScore = -1;
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet || !sheet["!ref"]) continue;
    // `blankrows: true` preserves empty rows — important for the multi-header
    // Numbers format detector which expects category text in the first row.
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: true });
    // Score: number of lines with at least one non-comma character (i.e. non-empty).
    const nonEmptyLines = csv.split(/\r?\n/).filter((l) => /[^,\s]/.test(l)).length;
    if (nonEmptyLines > bestScore) {
      bestScore = nonEmptyLines;
      bestCsv = csv;
    }
  }
  if (bestScore <= 0) throw new Error("No sheet in the workbook has any data.");
  return bestCsv;
}

export async function importCsvAction(formData: FormData) {
  const file = formData.get("file");
  const replace = formData.get("replace") === "on";
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pick a file first." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_FILE_BYTES / 1024 / 1024} MB.` };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  let text: string;
  try {
    text = await fileToCsvText(file);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Could not read file: ${msg}` };
  }
  let format: string;
  let parsed;
  try {
    const result = parseAnyLogbook(text);
    format = result.format;
    parsed = result.flights;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg || "Failed to parse CSV." };
  }
  if (parsed.length === 0) {
    return { error: `Detected ${format} format but found no valid flights. Check the file isn't empty.` };
  }
  if (parsed.length > MAX_PARSED_FLIGHTS) {
    return { error: `File contains ${parsed.length.toLocaleString()} flights — over the ${MAX_PARSED_FLIGHTS.toLocaleString()} import limit. Split into smaller files.` };
  }

  // Replace-mode safety: previous behaviour deleted everything BEFORE inserting,
  // so a mid-import failure (network, constraint violation) left the user with
  // no flights and an error message. New flow:
  //   1. Snapshot current flight ids.
  //   2. Insert new rows. If any batch fails, delete the rows we just inserted.
  //   3. Only after all inserts succeed do we delete the original ids.
  // The user briefly has both old and new rows visible — acceptable tradeoff
  // for not losing irreplaceable data on a flaky network.
  let oldIds: number[] = [];
  if (replace) {
    const { data: existing, error: snapErr } = await supabase
      .from("flights")
      .select("id")
      .eq("user_id", user.id);
    if (snapErr) return { error: `Snapshot failed: ${snapErr.message}` };
    oldIds = (existing ?? []).map((r) => r.id as number);
  }

  // Stamp user_id and batch-insert. Default duty_time to 0 for imports.
  // Capture returned ids so we can roll back if a later batch fails.
  const newIds: number[] = [];
  let inserted = 0;
  for (let i = 0; i < parsed.length; i += BATCH) {
    const slice = parsed.slice(i, i + BATCH).map((f) => ({ ...f, user_id: user.id, duty_time: 0 }));
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
  if (replace && oldIds.length > 0) {
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
    }
  }

  revalidatePath("/app");
  revalidatePath("/app/flights");
  redirect(`/app?imported=${inserted}&format=${format}`);
}
