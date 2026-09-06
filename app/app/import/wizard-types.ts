/**
 * Plain, JSON-serialisable shapes shared by the import server actions and
 * the wizard UI. No "use client"/"use server" here so both sides can import.
 */
import type { Analysis, ReconcileReport, SkipReason } from "@/lib/import";
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

/** Upload limits — mirrored client-side for instant feedback. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // matches next.config.ts serverActions.bodySizeLimit
export const ALLOWED_EXTENSIONS = ["csv", "tsv", "txt", "xlsx", "xls"] as const;

export function fileExtension(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

export function isAllowedExtension(name: string): boolean {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}
