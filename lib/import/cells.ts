/**
 * Pure cell helpers — no SheetJS, no Node built-ins. Kept separate from
 * grid.ts so that headers.ts / shape.ts / mapping.ts (which client components
 * import for the mapping UI) never pull `xlsx` into the browser bundle.
 */
import type { Cell } from "./types";
import { collapse } from "./util";

/** Display string for a cell (raw text preferred). */
export function cellDisplay(cell: Cell | undefined): string {
  if (!cell || cell.kind === "empty") return "";
  if (cell.kind === "text") return cell.value;
  if (cell.kind === "date") return cell.raw ?? cell.value;
  return cell.raw ?? String(cell.value);
}
/** Text content of a cell for header purposes (numbers/dates rendered). */
export function cellHeaderText(cell: Cell | undefined): string {
  return collapse(cellDisplay(cell));
}
export function rowIsEmpty(row: Cell[] | undefined): boolean {
  return !row || row.every((c) => c.kind === "empty");
}
export function countKinds(row: Cell[]): { empty: number; number: number; date: number; text: number } {
  const k = { empty: 0, number: 0, date: 0, text: 0 };
  for (const c of row) k[c.kind]++;
  return k;
}
