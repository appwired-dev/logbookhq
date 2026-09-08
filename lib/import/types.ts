/**
 * Import pipeline — shared contracts.
 *
 * Pipeline:  file → Grid (typed cells) → HeaderPaths (multi-row headers,
 * forward-filled) → ColumnMapping (each column → a canonical target, scored)
 * → ParsedFlight[] (apply) → ReconcileReport (computed totals vs. anything the
 * workbook itself declares) → insert.
 *
 * Everything here is plain data (JSON-serialisable) so it can cross the
 * server-action boundary between the analysis step and the commit step.
 */
import type { ParsedFlight } from "@/lib/csv";

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

/** A typed cell. Dates are normalised to "YYYY-MM-DD" strings with kind "date". */
export type Cell =
  | { kind: "empty" }
  | { kind: "number"; value: number; raw?: string }
  | { kind: "date"; value: string; raw?: string }
  | { kind: "text"; value: string };

export interface Grid {
  /** Sheet name (or "csv"). */
  sheet: string;
  rows: Cell[][];
  /** Max column count across rows. */
  width: number;
  /**
   * Per date column: the day-first decision the reader made and whether the
   * data alone was ambiguous (every value valid both ways). analyze.ts applies
   * priors to ambiguous columns; apply.ts re-parses `raw` when the convention
   * differs from this decision.
   */
  dateCols?: Record<number, { dayFirst: boolean; ambiguous: boolean }>;
}

export interface Workbook {
  filename: string;
  sheets: Grid[];
}

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

export interface HeaderPath {
  col: number;
  /** Qualified path, outermost group first, e.g. ["Multi-Engine Aircraft", "Night", "FO"]. */
  path: string[];
  /** Convenience: path.join(" › "). */
  label: string;
}

export interface HeaderBand {
  /** Row indices (0-based within the grid) that form the header. */
  rows: number[];
  /** First data row index. */
  dataStart: number;
  paths: HeaderPath[];
  /** Date-bearing rows found ABOVE the chosen header band (should be 0; reconcile flags > 0). */
  dateRowsAbove?: number;
}

// ---------------------------------------------------------------------------
// Canonical targets
// ---------------------------------------------------------------------------

export type TimeCategory = "se" | "me" | "ses" | "mes" | "heli" | "sim" | "any";
export type TimeCondition = "day" | "night" | "any";
export type TimeRole = "dual" | "pic" | "fo" | "sic" | "check" | "solo" | "any";

export type FieldTarget =
  | "date" | "make_model" | "registration" | "pic" | "copilot" | "third_pilot" | "check_pilot"
  | "route" | "from" | "to" | "remarks"
  | "category" | "role"
  | "xc_time" | "xc_flag"
  | "actual_inst" | "hood_inst" | "sim_inst"
  | "ifr_approaches" | "precision_approaches" | "non_precision_approaches" | "holds" | "cfi_time"
  | "takeoffs_day" | "takeoffs_night" | "landings_day" | "landings_night"
  | "total_time" | "block_off" | "block_on";

/** What a source column means. */
export type CanonicalTarget =
  | { kind: "time"; category: TimeCategory; condition: TimeCondition; role: TimeRole }
  | { kind: "field"; field: FieldTarget }
  | { kind: "ignore" };

export type MappingSource = "template" | "synonym" | "shape" | "ai" | "user";

export interface ColumnAssignment {
  col: number;
  target: CanonicalTarget;
  /** 0..1 */
  confidence: number;
  source: MappingSource;
  /** Short human-readable reason ("header matched 'Night › FO'", "cells look like ICAO pairs"). */
  reason?: string;
}

export interface ColumnMapping {
  /** One entry per source column (unmapped columns are present with kind "ignore"). */
  columns: ColumnAssignment[];
  /** Conventions the sheet appears to use; surfaced in the wizard and used by apply/reconcile. */
  conventions: {
    /** Hours written as "1:30" instead of 1.5. */
    clockTimes?: boolean;
    /** Decimal comma ("1,5"). */
    decimalComma?: boolean;
    /** Day-first dates ("27/09/2024"). */
    dayFirstDates?: boolean;
    /** Rows with an empty aircraft cell but sim time are sim sessions. */
    blankAircraftIsSim?: boolean;
    /** How `dayFirstDates` was decided: data evidence, a locale/registration prior, the separator default, or the user's toggle. */
    dayFirstSource?: "evidence" | "prior" | "default" | "user";
  };
}

// ---------------------------------------------------------------------------
// Analysis (output of analyzeWorkbook — everything the wizard needs to render)
// ---------------------------------------------------------------------------

export interface DeclaredTotal {
  /** Where it came from: a "Totals" sheet label/value pair, or a row-level total column. */
  source: "totals-sheet" | "total-column" | "footer-row";
  label: string;
  value: number;
  /** Best-effort classification of what the label means, if recognised. */
  meaning?: TotalMeaning;
  /**
   * Set when the label names a composite figure — a bare "Total Instrument
   * Time" is actual + hood + sim, not any single field. Reconcile sums these
   * fields (and picks the closest sensible subset) instead of `meaning.field`.
   */
  composite?: FieldTarget[];
}

export type TotalMeaning =
  | { kind: "time"; category: TimeCategory; condition: TimeCondition; role: TimeRole }
  | { kind: "field"; field: FieldTarget }
  | { kind: "grand_total" };

export interface Analysis {
  filename: string;
  /** Index into workbook.sheets that holds the flight rows. */
  sheetIndex: number;
  sheetName: string;
  header: HeaderBand;
  mapping: ColumnMapping;
  /** First N data rows as display strings, aligned with header.paths (for the mapping review table). */
  sample: string[][];
  rowCount: number;
  /** Stable hash of the normalised header paths — key for import_templates. */
  fingerprint: string;
  /** Template that pre-filled the mapping, if any. */
  templateId?: string | null;
  templateName?: string | null;
  /** Anything the workbook itself declares as a total (Totals sheet, per-row Total column). */
  declaredTotals: DeclaredTotal[];
  /** Columns whose best score was below the confidence threshold — candidates for the AI arbiter / user review. */
  lowConfidenceCols: number[];
  /** Detected legacy exact format (foreflight/logten/myflightbook/logbookhq) when the workbook is one of those. */
  legacyFormat?: string | null;
  /**
   * Per source column (numeric targets only): numeric-looking cells that the
   * spreadsheet stores as text on an otherwise numeric column. A SUM formula
   * skips those cells while the import reads them, so a declared total falls
   * short by exactly `sum` — reconcile uses this to explain such gaps.
   * Absent for CSV input (every cell is text there) and when nothing is mixed.
   */
  textNumberCells?: Record<number, { count: number; sum: number }>;
  /** Other sheets with the same header fingerprint (per-year workbooks); apply imports them too. */
  siblingSheets?: { index: number; name: string; dataStart: number; rowCount: number }[];
  /** Sheets with dated rows in a different layout that were NOT imported (for an info check). */
  otherDatedSheets?: { index: number; name: string; rowCount: number }[];
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export type SkipReason =
  | "no_date" | "bad_date" | "no_aircraft" | "no_time" | "header_or_total_row" | "empty";

export interface ApplyResult {
  flights: ParsedFlight[];
  skipped: { row: number; reason: SkipReason }[];
  /** Per-column sums for numeric columns (used by reconcile). */
  columnSums: Record<number, number>;
  /** Role-column texts the mapper did not recognise (imported as PIC). */
  unknownRoles?: { text: string; count: number }[];
  /** True when the mapped total column looks like a running total and was not used for row hours. */
  cumulativeTotal?: boolean;
  /** Rows whose actual+hood instrument time exceeded flight time and was clamped. */
  instrumentClamped?: number;
  /** Cells with negative hours treated as 0. */
  negativeHours?: number;
  /**
   * Source rows that produced more than one flight because their time hits
   * span several (category, role) buckets — e.g. "ME › Day › FO" 3.0 and
   * "ME › Day › AUG" 2.0 on one line: 0-based row index and the number of
   * flights emitted. Absent (or empty) when no row was split.
   *
   * Alignment: `flights` are emitted in source-row order and a split row
   * contributes `buckets` consecutive flights, primary (largest) bucket
   * first. `skipped`, `rowTotals` and `sourceRows` (ApplyResultExt) carry ONE
   * entry per source row, never per emitted flight, so a split row's Total
   * cell stands against the sum of its flights — `sourceRowGroups` in
   * apply.ts rebuilds the flight ↔ source-row grouping.
   */
  splitRows?: { row: number; buckets: number }[];
}

// ---------------------------------------------------------------------------
// Reconcile
// ---------------------------------------------------------------------------

export type CheckStatus = "match" | "explained" | "mismatch" | "info";

export interface ReconcileCheck {
  id: string;
  label: string;
  expected?: number;
  actual: number;
  delta?: number;
  status: CheckStatus;
  /** Plain-language explanation when status is "explained" or "mismatch". */
  explanation?: string;
  /** Optional suggested action the wizard can offer (e.g. enable the 50% AUG credit setting). */
  suggestion?: { kind: "aug_half_credit" | "review_mapping" | "none"; detail?: string };
  /** Stable id for client-side localisation of fixed checks (declared-total checks keep the sheet's own label). */
  messageKey?: string;
  /** Values referenced by the localised template for `messageKey`. */
  vars?: Record<string, string | number>;
}

export interface ReconcileReport {
  checks: ReconcileCheck[];
  summary: {
    flights: number;
    skipped: number;
    /** Raw sum of day + night hours over the parsed flights (augmenting time in full). */
    totalHours: number;
    /**
     * Hours credited under the account's convention passed to reconcile
     * (`augHalfCredit`: SIC/AUG at 50 %). Equals `totalHours` when the option
     * is off or the logbook has no SIC time.
     */
    creditedHours?: number;
    byRole: Record<string, number>;
    byCategory: Record<string, number>;
  };
  /** True when no check is a hard mismatch. */
  ok: boolean;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export interface ImportTemplate {
  id: string;
  fingerprint: string;
  name: string;
  source: "system" | "user";
  mapping: ColumnMapping;
  headerPaths: string[][];
  uses: number;
}
