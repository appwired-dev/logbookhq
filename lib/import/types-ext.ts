/**
 * Optional extensions to the shared contract in ./types (which is owned by
 * the wizard team and not edited here).
 */
import type { ApplyResult, DeclaredTotal } from "./types";

export interface DeclaredTotalExt extends DeclaredTotal {
  /**
   * Flight-sheet columns the figure belongs to: the column a footer cell sits
   * under, or the column a Totals-sheet line names by its header path
   * ("Cross-Country › Dual", "IFR"). Reconcile reads what they are mapped to
   * when it runs (the user may have remapped them since analyze) and compares
   * a field figure with those columns, not with every column of the field.
   */
  cols?: number[];
}

export interface ApplyResultExt extends ApplyResult {
  /**
   * Per flight (aligned with `flights`): the row's own "Total" cell when a
   * `total_time` column is mapped, else null. Lets reconcile check every row
   * against its bucket sum without re-reading the workbook.
   */
  rowTotals?: (number | null)[];
  /** Per flight: 0-based source row index in the flight sheet. */
  sourceRows?: number[];
}
