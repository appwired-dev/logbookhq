/**
 * Optional extensions to the shared contract in ./types (which is owned by
 * the wizard team and not edited here).
 */
import type { ApplyResult } from "./types";

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
