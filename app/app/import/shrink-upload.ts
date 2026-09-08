"use client";

/**
 * Make a spreadsheet small enough to send through a server action.
 *
 * Vercel caps a function's request body at 4.5 MB, well under the app's own
 * 25 MB limit. Native Apple Numbers files are big (they carry snapshots and
 * images — the founder's 3,714-row logbook is 8.4 MB), while the same cells
 * written as .xlsx are a few hundred KB. So spreadsheets that are .numbers, or
 * larger than the platform allows, are re-written client-side as a compact
 * .xlsx before upload. The server pipeline is unchanged: it receives an .xlsx
 * with the same cells, header paths and template fingerprint (verified
 * against the founder's file).
 *
 * SheetJS is loaded lazily so it stays out of the initial client bundle
 * (scripts/check-client-graph.ts ignores dynamic imports on purpose).
 */
import { fileExtension } from "./wizard-types";

/** Largest body a Vercel function accepts (4.5 MB) minus multipart + JSON headroom. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type PreparedUpload =
  | { ok: true; file: File; converted: boolean }
  | { ok: false; reason: "too_large" | "unreadable" };

function isSpreadsheet(ext: string): boolean {
  return ext === "numbers" || ext === "xlsx" || ext === "xls";
}

/**
 * Returns the file to upload: the original when it is already small enough
 * (and not a .numbers file), else a compact .xlsx rewrite. `ok: false` when
 * nothing we can do brings it under the limit.
 */
export async function prepareUpload(file: File): Promise<PreparedUpload> {
  const ext = fileExtension(file.name);
  const spreadsheet = isSpreadsheet(ext);
  if (!spreadsheet) {
    return file.size <= MAX_UPLOAD_BYTES ? { ok: true, file, converted: false } : { ok: false, reason: "too_large" };
  }
  if (ext !== "numbers" && file.size <= MAX_UPLOAD_BYTES) return { ok: true, file, converted: false };

  let out: ArrayBuffer;
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, cellNF: true });
    out = XLSX.write(wb, { bookType: "xlsx", type: "array", compression: true }) as ArrayBuffer;
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  if (out.byteLength > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };
  const name = file.name.replace(/\.[^.]+$/, "") + ".xlsx";
  return { ok: true, file: new File([out], name, { type: XLSX_MIME }), converted: true };
}

/** "8.4 MB" / "326 KB" */
export function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
