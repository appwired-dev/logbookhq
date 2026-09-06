/**
 * Header band detection.
 *
 * The header band is the run of ≤ 4 consecutive text rows directly above the
 * first row that looks like flight data (a date plus either ≥ 2 numeric
 * cells or an aircraft-looking text cell). Title rows (one non-empty cell),
 * blank rows and preambles end the band.
 *
 * Multi-row headers exported from Numbers/Excel lose their merged cells:
 * the group label sits in the first column of the span and the rest are
 * blank. Blank cells are forward-filled horizontally — in the top row from
 * the left neighbour, in lower rows only while the rows above still agree
 * (i.e. the parent group continues). The per-column path is the non-empty
 * cells top→bottom with consecutive repeats collapsed.
 */
import type { Cell, Grid, HeaderBand, HeaderPath } from "./types";
import { cellHeaderText, countKinds, rowIsEmpty } from "./cells";
import { looksLikeExcelSerial } from "./util";

const MAX_HEADER_ROWS = 4;

/** Tail numbers, type codes and make/model strings ("C-GABC", "N12345", "C172", "PA-28", "Cessna 172"). */
const AIRCRAFT_TEXT_RE = /^(?:[A-Z]{1,2}-?[A-Z0-9]{2,5}|\d[A-Z]-?[A-Z0-9]{2,5}|[A-Z]{1,3}-?\d{1,4}[A-Z]{0,3}|[A-Za-z]{3,}\s?-?\s?\d{2,4}[A-Za-z]?)$/;

export function isDateLikeCell(c: Cell): boolean {
  if (c.kind === "date") return true;
  return c.kind === "number" && Number.isInteger(c.value) && looksLikeExcelSerial(c.value);
}

export function looksLikeDataRow(row: Cell[] | undefined): boolean {
  if (!row || rowIsEmpty(row)) return false;
  const hasDate = row.some(isDateLikeCell);
  if (!hasDate) return false;
  const k = countKinds(row);
  if (k.number >= 2) return true;
  return row.some((c) => c.kind === "text" && AIRCRAFT_TEXT_RE.test(c.value));
}

/** True for a row whose non-empty cells are (almost) all text — a header candidate. */
function isTextRow(row: Cell[]): boolean {
  const k = countKinds(row);
  const nonEmpty = k.number + k.date + k.text;
  if (nonEmpty === 0) return false;
  // Allow a stray year ("2024") or numbered column, but not a numeric row.
  return k.text >= Math.ceil(nonEmpty * 0.7) && k.date === 0;
}

function nonEmptyCount(row: Cell[]): number {
  const k = countKinds(row);
  return k.number + k.date + k.text;
}

export function detectHeaderBand(grid: Grid): HeaderBand {
  const rows = grid.rows;
  let firstData = rows.findIndex((r) => looksLikeDataRow(r));

  if (firstData < 0) {
    // No data-looking rows: take the first text row as the header (an
    // empty logbook still gets a mapping table), data starts right after.
    const hdr = rows.findIndex((r) => isTextRow(r) && nonEmptyCount(r) >= 2);
    if (hdr < 0) return { rows: [], dataStart: rows.length, paths: emptyPaths(grid.width) };
    firstData = hdr + 1;
  }

  const bandDesc: number[] = [];
  for (let r = firstData - 1; r >= 0 && bandDesc.length < MAX_HEADER_ROWS; r--) {
    const row = rows[r];
    if (rowIsEmpty(row)) break;
    if (looksLikeDataRow(row)) break;
    const n = nonEmptyCount(row);
    if (n === 1 && bandDesc.length > 0) break; // title row above the band
    if (n === 1 && bandDesc.length === 0) {
      // A one-cell row directly above the data is a title only if the data
      // rows are wide; a one-column sheet has a one-cell header.
      if (grid.width > 2) break;
    }
    if (!isTextRow(row)) break;
    bandDesc.push(r);
  }
  const band = bandDesc.reverse();
  return { rows: band, dataStart: firstData, paths: buildPaths(grid, band) };
}

function emptyPaths(width: number): HeaderPath[] {
  return Array.from({ length: width }, (_, col) => ({ col, path: [], label: "" }));
}

/** Forward-fill merged group cells and build one path per column. */
export function buildPaths(grid: Grid, band: number[]): HeaderPath[] {
  const width = grid.width;
  if (band.length === 0) return emptyPaths(width);
  const text: string[][] = band.map((r) => Array.from({ length: width }, (_, c) => cellHeaderText(grid.rows[r]?.[c])));
  const H = text.length;

  // Which columns carry any header text at all (blank columns never get filled).
  const hasAnyHeader = Array.from({ length: width }, (_, c) => text.some((row) => row[c] !== ""));
  const hasHeaderBelowTop = Array.from({ length: width }, (_, c) => text.slice(1).some((row) => row[c] !== ""));

  // Top row: a blank continues the group to its left when (a) the anchor
  // cell really is a group (it has a sub-header below it — a vertically
  // merged single header like "Total" never spreads) and (b) this column
  // has its own sub-header. A fully blank column ends the span.
  if (H > 1) {
    let anchor: number | null = null;
    for (let c = 0; c < width; c++) {
      if (!hasAnyHeader[c]) { anchor = null; continue; }
      if (text[0][c] !== "") { anchor = c; continue; }
      if (anchor != null && hasHeaderBelowTop[anchor] && hasHeaderBelowTop[c]) text[0][c] = text[0][anchor];
    }
  }
  // Lower rows: a blank group cell continues to the right only while every
  // row above agrees with the left neighbour and a deeper sub-header exists
  // (a leaf is never copied into the next column).
  for (let i = 1; i < H - 1; i++) {
    for (let c = 1; c < width; c++) {
      if (text[i][c] !== "" || text[i][c - 1] === "" || !hasAnyHeader[c]) continue;
      let sameParent = true;
      for (let k = 0; k < i; k++) if (text[k][c] !== text[k][c - 1] || text[k][c] === "") { sameParent = false; break; }
      const hasDeeper = text.slice(i + 1).some((row) => row[c] !== "");
      if (sameParent && hasDeeper) text[i][c] = text[i][c - 1];
    }
  }

  const paths: HeaderPath[] = [];
  for (let c = 0; c < width; c++) {
    const path: string[] = [];
    for (let i = 0; i < H; i++) {
      const t = text[i][c];
      if (!t) continue;
      if (path.length > 0 && path[path.length - 1].toLowerCase() === t.toLowerCase()) continue;
      path.push(t);
    }
    paths.push({ col: c, path, label: path.join(" › ") });
  }
  return paths;
}
