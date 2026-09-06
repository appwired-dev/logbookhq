/**
 * Column → canonical target scoring.
 *
 *   confidence = 0.7 · synonym + 0.3 · shape
 *
 * The synonym term reads the whole header path through the facet vocabulary
 * in ./synonyms; the shape term looks at the column's data (./shape). A
 * template (matched by header fingerprint) is applied first with confidence
 * 1 and only the gaps are scored. Identity fields (date, aircraft, names,
 * route, remarks, category, role, total, block times, XC flag) get one
 * winning column each; count-like and instrument fields may sum across
 * columns (the founder's sheet has six cross-country columns); any number
 * of columns may be time buckets.
 */
import type {
  CanonicalTarget, ColumnAssignment, ColumnMapping, FieldTarget, Grid, HeaderBand, HeaderPath, ImportTemplate,
  TimeCategory, TimeCondition, TimeRole,
} from "./types";
import { facetsOf, facetsOfPath, isGenericTimeLeaf, type Facets } from "./synonyms";
import { columnStats, shapeScore, type ColumnStats } from "./shape";
import { templateAssignments } from "./templates";
import { TOTAL_ROW_RE } from "./util";
import {
  CATEGORIES, CONDITIONS, FIELDS, IGNORE, ROLES, SUMMABLE_FIELDS, allTargetKeys, field, parseTargetKey, sameTarget, targetKey, time,
} from "./targets";

export { IGNORE, SUMMABLE_FIELDS, allTargetKeys, field, parseTargetKey, sameTarget, targetKey, time };

export const CONFIDENCE_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// Target keys + labels
// ---------------------------------------------------------------------------

const CAT_LABEL: Record<TimeCategory, string> = {
  any: "", se: "Single-engine", me: "Multi-engine", ses: "Single-engine sea", mes: "Multi-engine sea", heli: "Helicopter", sim: "Simulator",
};
const COND_LABEL: Record<TimeCondition, string> = { any: "", day: "Day", night: "Night" };
const ROLE_LABEL: Record<TimeRole, string> = { any: "", dual: "Dual", pic: "PIC", fo: "FO", sic: "SIC / AUG", check: "Check", solo: "Solo" };
const FIELD_LABEL: Record<FieldTarget, string> = {
  date: "Date", make_model: "Aircraft make / model", registration: "Registration", pic: "PIC name", copilot: "Co-pilot / student name",
  third_pilot: "Third pilot name", check_pilot: "Check pilot / examiner name", route: "Route", from: "From (departure)", to: "To (arrival)",
  remarks: "Remarks", category: "Category (SE/ME/SIM…)", role: "Role (PIC/FO/DUAL…)", xc_time: "Cross-country time", xc_flag: "Cross-country flag",
  actual_inst: "Actual instrument", hood_inst: "Hood / simulated instrument", sim_inst: "Simulator time", ifr_approaches: "IFR approaches",
  precision_approaches: "Precision approaches", non_precision_approaches: "Non-precision approaches", holds: "Holds", cfi_time: "Instructor (dual given) time",
  takeoffs_day: "Takeoffs (day)", takeoffs_night: "Takeoffs (night)", landings_day: "Landings (day)", landings_night: "Landings (night)",
  total_time: "Total time (row total)", block_off: "Block off (clock time)", block_on: "Block on (clock time)",
};

export function describeTarget(t: CanonicalTarget): string {
  if (t.kind === "ignore") return "Ignore";
  if (t.kind === "field") return FIELD_LABEL[t.field] ?? t.field;
  const parts = [CAT_LABEL[t.category], COND_LABEL[t.condition], ROLE_LABEL[t.role]].filter(Boolean);
  if (parts.length === 0) return "Flight time (total)";
  return `${parts.join(" · ")} time`;
}

function timeOptions(cat: TimeCategory, full: boolean): { key: string; label: string; target: CanonicalTarget }[] {
  const out: { key: string; label: string; target: CanonicalTarget }[] = [];
  const conds: readonly TimeCondition[] = full ? CONDITIONS : ["any"];
  for (const cond of conds) {
    for (const role of ROLES) {
      const t = time(cat, cond, role);
      out.push({ key: targetKey(t), label: describeTarget(t), target: t });
    }
  }
  if (!full) {
    for (const cond of ["day", "night"] as TimeCondition[]) {
      const t = time(cat, cond, "any");
      out.push({ key: targetKey(t), label: describeTarget(t), target: t });
    }
  }
  return out;
}

function fieldOptions(fields: FieldTarget[]): { key: string; label: string; target: CanonicalTarget }[] {
  return fields.map((f) => ({ key: targetKey(field(f)), label: FIELD_LABEL[f], target: field(f) }));
}

/** Grouped options for the wizard's <select>. */
export const CANONICAL_OPTIONS: { group: string; options: { key: string; label: string; target: CanonicalTarget }[] }[] = [
  { group: "Ignore", options: [{ key: "ignore", label: "Ignore this column", target: IGNORE }] },
  { group: "Flight basics", options: fieldOptions(["date", "make_model", "registration", "route", "from", "to", "remarks"]) },
  { group: "Flight time — any aircraft", options: timeOptions("any", true) },
  { group: "Single-engine time", options: timeOptions("se", true) },
  { group: "Multi-engine time", options: timeOptions("me", true) },
  { group: "Sea / helicopter / simulator time", options: [...timeOptions("ses", false), ...timeOptions("mes", false), ...timeOptions("heli", false), ...timeOptions("sim", false)] },
  { group: "Cross-country & instrument", options: fieldOptions(["xc_time", "xc_flag", "actual_inst", "hood_inst", "sim_inst", "total_time", "cfi_time"]) },
  { group: "Approaches, holds, landings", options: fieldOptions(["ifr_approaches", "precision_approaches", "non_precision_approaches", "holds", "takeoffs_day", "takeoffs_night", "landings_day", "landings_night"]) },
  { group: "Crew & other", options: fieldOptions(["pic", "copilot", "third_pilot", "check_pilot", "category", "role", "block_off", "block_on"]) },
];

// ---------------------------------------------------------------------------
// Candidate generation
// ---------------------------------------------------------------------------

interface Candidate { target: CanonicalTarget; syn: number; reason: string; confidence: number }

interface ColumnContext {
  path: HeaderPath;
  stats: ColumnStats;
  leaf: Facets;
  all: Facets;
  parents: Facets;
  /** Column index of the first mostly-numeric column (name-vs-time tie break). */
  firstNumericCol: number;
}

function cand(target: CanonicalTarget, syn: number, reason: string): Candidate {
  return { target, syn, reason, confidence: 0 };
}

function synonymCandidates(ctx: ColumnContext): Candidate[] {
  const { leaf, all, parents, path } = ctx;
  const out: Candidate[] = [];
  const segs = path.path;
  const leafText = segs[segs.length - 1] ?? "";
  const label = path.label;
  const s = leaf.strength || 0.85;

  if (segs.length === 0) return out;

  if (leaf.ignore) {
    out.push(cand(IGNORE, 0.95, `"${leafText}" is not imported`));
    return out;
  }

  // Cross-country anywhere on the path dominates (XC › Day › PIC is XC time).
  if (all.xc) {
    out.push(cand(field("xc_time"), 0.95, `header "${label}" is cross-country time`));
    out.push(cand(field("xc_flag"), 0.85, `header "${label}" is a cross-country flag`));
    return out;
  }

  if (leaf.field === "cfi_time") out.push(cand(field("cfi_time"), 0.95 * s, `header "${leafText}" is instruction given`));

  // Approaches / holds / landings / takeoffs.
  if (leaf.approach || (parents.approach && !leaf.role && !leaf.cat)) {
    const kind = leaf.approach ?? parents.approach;
    const f: FieldTarget = kind === "precision" ? "precision_approaches" : kind === "non_precision" ? "non_precision_approaches" : "ifr_approaches";
    out.push(cand(field(f), 0.95, `header "${label}" counts approaches`));
    return out;
  }
  if (leaf.holds) { out.push(cand(field("holds"), 0.95, `header "${label}" counts holds`)); return out; }
  if (leaf.landing || (parents.landing && (leaf.cond || isGenericTimeLeaf(leaf)))) {
    out.push(cand(field(all.cond === "night" ? "landings_night" : "landings_day"), 0.95, `header "${label}" counts landings`));
    return out;
  }
  if (leaf.takeoff || (parents.takeoff && (leaf.cond || isGenericTimeLeaf(leaf)))) {
    out.push(cand(field(all.cond === "night" ? "takeoffs_night" : "takeoffs_day"), 0.95, `header "${label}" counts takeoffs`));
    return out;
  }

  // Direct fields on the leaf.
  if (leaf.field && leaf.field !== "cfi_time") {
    const f = leaf.field;
    out.push(cand(field(f), (f === "date" || f === "registration" ? 1 : 0.95) * s, `header "${leafText}" matched ${FIELD_LABEL[f]}`));
    if (f === "make_model") out.push(cand(field("registration"), 0.6, `"${leafText}" could be an identifier`));
    if (f === "registration") out.push(cand(field("make_model"), 0.6, `"${leafText}" could be a type`));
    return out;
  }

  // Instrument fields.
  if (leaf.inst === "hood") { out.push(cand(field("hood_inst"), 0.95 * s, `header "${label}" is hood / simulated instrument`)); return out; }
  if (leaf.inst === "actual" && !leaf.cat) {
    out.push(cand(field("actual_inst"), (leaf.instrumentWord ? 0.85 : 0.95) * s, `header "${label}" is actual instrument`));
    return out;
  }
  if (leaf.cat === "sim") {
    const roleOrCond = parents.role ?? leaf.role ?? parents.cond ?? leaf.cond;
    if (roleOrCond) {
      out.push(cand(time("sim", all.cond ?? "any", all.role ?? "any"), 0.9, `header "${label}" is simulator time by role`));
      out.push(cand(field("sim_inst"), 0.7, `header "${label}" is simulator time`));
    } else {
      out.push(cand(field("sim_inst"), 0.9 * s, `header "${label}" is simulator time`));
      out.push(cand(time("sim", "any", "any"), 0.6, `header "${label}" is simulator time`));
    }
    return out;
  }
  if (parents.inst && isGenericTimeLeaf(leaf)) {
    if (leaf.total) {
      out.push(cand(IGNORE, 0.7, `"${label}" is an instrument subtotal (recomputed on import)`));
      out.push(cand(field("total_time"), 0.5, `"${label}" might be the row total`));
    } else {
      out.push(cand(field(parents.inst === "hood" ? "hood_inst" : "actual_inst"), 0.85, `header "${label}" is instrument time`));
    }
    return out;
  }

  const hasTimeFacet = Boolean(all.cat || all.cond || all.role);
  const leafHasTimeFacet = Boolean(leaf.cat || leaf.cond || leaf.role);

  // "Total" / "Time" / "Hours" leaf.
  if (isGenericTimeLeaf(leaf)) {
    if (hasTimeFacet) {
      out.push(cand(time(all.cat ?? "any", all.cond ?? "any", all.role ?? "any"), 0.9, `"${leafText}" under "${segs.slice(0, -1).join(" › ")}"`));
    } else {
      out.push(cand(field("total_time"), leaf.total ? 0.9 * s : 0.8 * s, `header "${label}" is the row total`));
      out.push(cand(time("any", "any", "any"), 0.6, `header "${label}" could be flight time`));
    }
    return out;
  }

  // Time buckets by category / condition / role.
  if (leafHasTimeFacet || (hasTimeFacet && !leaf.name && !leaf.field)) {
    const target = time(all.cat ?? "any", all.cond ?? "any", all.role ?? "any");
    const syn = leaf.role || leaf.cond ? 0.95 : leaf.cat ? 0.9 : 0.8;
    out.push(cand(target, syn * Math.max(s, 0.85), `header "${label}" → ${describeTarget(target)}`));
    if (leaf.name && !parents.cat && !parents.cond) {
      out.push(cand(field(leaf.name), 0.9 * s, `header "${leafText}" as a crew name`));
    }
    return out;
  }

  // Crew names.
  if (leaf.name) {
    const nameSyn = leaf.name === "pic" && /^(name|names|pilot|instructor|instructor name|cfi name)$/i.test(leafText.trim().toLowerCase()) ? 0.7 : 0.9;
    out.push(cand(field(leaf.name), nameSyn * s, `header "${label}" is a crew name`));
    return out;
  }

  return out;
}

/** Shape-only fallbacks (no or unknown header). Capped below the review threshold. */
function shapeCandidates(ctx: ColumnContext, headerKnown: boolean): Candidate[] {
  const s = ctx.stats;
  const out: Candidate[] = [];
  const cap = headerKnown ? 0.5 : 0.55;
  const add = (t: CanonicalTarget, why: string) => out.push({ target: t, syn: 0, reason: why, confidence: Math.min(cap, shapeScore(t, s) * cap) });
  if (s.n === 0) return out;
  if (s.dateLike / s.n >= 0.8) add(field("date"), "cells look like dates");
  if (s.nText > 0 && s.pair / s.nText >= 0.5) add(field("route"), "cells look like airport pairs");
  if (s.nText > 0 && s.tail / s.nText >= 0.6 && s.avgLen <= 8) add(field("registration"), "cells look like tail numbers");
  if (s.nText > 0 && s.longText / s.nText >= 0.4) add(field("remarks"), "cells look like free text");
  if (!headerKnown && s.nNum / s.n >= 0.8 && s.maxNum <= 24 && (s.hasDecimal || s.clock > 0)) add(time("any", "any", "any"), "cells look like hours");
  if (!headerKnown && s.nNum / s.n >= 0.8 && s.allInt && s.maxNum <= 20 && s.maxNum > 1) add(field("ifr_approaches"), "cells look like small counts");
  if (s.nText > 0 && s.catText / s.n >= 0.6) add(field("category"), "cells look like SE/ME/SIM");
  if (s.nText > 0 && s.roleText / s.n >= 0.6) add(field("role"), "cells look like PIC/FO/DUAL");
  return out;
}

function scoreColumn(ctx: ColumnContext): Candidate[] {
  const headerKnown = ctx.path.path.length > 0;
  const syn = synonymCandidates(ctx);
  for (const c of syn) c.confidence = clamp01(0.7 * c.syn + 0.3 * shapeScore(c.target, ctx.stats));
  const shape = shapeCandidates(ctx, headerKnown);
  const all = [...syn, ...shape];
  if (all.length === 0) {
    all.push({
      target: IGNORE, syn: 0, confidence: headerKnown ? 0.3 : 0.4,
      reason: headerKnown ? `unrecognised header "${ctx.path.label}"` : "no header and no recognisable shape",
    });
  }
  if (ctx.stats.n === 0 && !headerKnown) {
    return [{ target: IGNORE, syn: 1, confidence: 1, reason: "empty column" }];
  }
  return all.sort((a, b) => b.confidence - a.confidence);
}

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)); }

// ---------------------------------------------------------------------------
// mapColumns
// ---------------------------------------------------------------------------

export function mapColumns(
  header: HeaderBand,
  grid: Grid,
  dataStart: number,
  opts: { template?: ImportTemplate | null } = {},
): ColumnMapping {
  const width = Math.max(grid.width, header.paths.length);
  const paths: HeaderPath[] = Array.from({ length: width }, (_, c) => header.paths.find((p) => p.col === c) ?? { col: c, path: [], label: "" });
  const stats = paths.map((p) => columnStats(grid, p.col, dataStart));
  const firstNumericCol = stats.findIndex((s) => s.n > 0 && s.nNum / s.n >= 0.5);

  const contexts: ColumnContext[] = paths.map((p, i) => {
    const segs = p.path;
    const leaf = segs.length ? facetsOf(segs[segs.length - 1]) : facetsOf("");
    return { path: p, stats: stats[i], leaf, all: facetsOfPath(segs), parents: facetsOfPath(segs.slice(0, -1)), firstNumericCol };
  });

  const assigned = new Map<number, ColumnAssignment>();
  const owner = new Map<string, number>(); // unique field → col

  // 1. Template first.
  if (opts.template) {
    for (const a of templateAssignments(opts.template, paths)) {
      assigned.set(a.col, a);
      if (a.target.kind === "field" && !SUMMABLE_FIELDS.has(a.target.field)) owner.set(a.target.field, a.col);
    }
  }

  // 2. Score the rest and resolve greedily by confidence.
  const ranked = contexts.map((ctx) => (assigned.has(ctx.path.col) ? [] : scoreColumn(ctx)));
  // Bare "PIC"/"FO" columns with no data: names if they sit left of the numbers, time otherwise.
  for (let i = 0; i < contexts.length; i++) {
    const ctx = contexts[i];
    if (ctx.stats.n > 0 || ranked[i].length < 2) continue;
    const nameIdx = ranked[i].findIndex((c) => c.target.kind === "field" && ["pic", "copilot", "third_pilot", "check_pilot"].includes(c.target.field));
    const timeIdx = ranked[i].findIndex((c) => c.target.kind === "time");
    if (nameIdx < 0 || timeIdx < 0) continue;
    const preferName = firstNumericCol < 0 || ctx.path.col < firstNumericCol;
    const boost = preferName ? nameIdx : timeIdx;
    ranked[i][boost] = { ...ranked[i][boost], confidence: Math.min(1, ranked[i][boost].confidence + 0.1) };
    ranked[i].sort((a, b) => b.confidence - a.confidence);
  }

  const queue: { col: number; c: Candidate }[] = [];
  ranked.forEach((list, i) => list.forEach((c) => queue.push({ col: paths[i].col, c })));
  queue.sort((a, b) => b.c.confidence - a.c.confidence || a.col - b.col);
  for (const { col, c } of queue) {
    if (assigned.has(col)) continue;
    if (c.target.kind === "field" && !SUMMABLE_FIELDS.has(c.target.field)) {
      if (owner.has(c.target.field)) continue;
      owner.set(c.target.field, col);
    }
    assigned.set(col, { col, target: c.target, confidence: round2(c.confidence), source: c.syn > 0 ? "synonym" : "shape", reason: c.reason });
  }
  for (const p of paths) {
    if (assigned.has(p.col)) continue;
    const best = ranked[p.col]?.[0];
    const takenBy = best && best.target.kind === "field" ? owner.get(best.target.field) : undefined;
    assigned.set(p.col, {
      col: p.col, target: IGNORE, confidence: takenBy != null ? 0.9 : 0.3, source: "synonym",
      reason: takenBy != null ? `${describeTarget(best.target)} already comes from column ${colLetter(takenBy)}` : "no suitable target",
    });
  }

  // 3. Generic "Landings"/"Takeoffs" next to explicit day/night columns double-count — drop them.
  for (const f of ["landings_day", "takeoffs_day"] as const) {
    const claims = [...assigned.values()].filter((a) => a.target.kind === "field" && a.target.field === f && a.source !== "template" && a.source !== "user");
    if (claims.length < 2) continue;
    const specific = claims.filter((a) => contexts[a.col]?.all.cond === "day");
    if (specific.length === 0) continue;
    for (const a of claims) {
      if (contexts[a.col]?.all.cond === "day") continue;
      assigned.set(a.col, { ...a, target: IGNORE, confidence: 0.85, reason: `covered by the day/night ${f.startsWith("land") ? "landings" : "takeoffs"} columns` });
    }
  }

  const columns = [...assigned.values()].sort((a, b) => a.col - b.col);
  return { columns, conventions: detectConventions(columns, grid, dataStart, contexts, opts.template?.mapping.conventions) };
}

function round2(x: number): number { return Math.round(x * 100) / 100; }

export function colLetter(col: number): string {
  let s = "";
  let n = col;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

// ---------------------------------------------------------------------------
// Conventions
// ---------------------------------------------------------------------------

function detectConventions(
  columns: ColumnAssignment[],
  grid: Grid,
  dataStart: number,
  contexts: ColumnContext[],
  fromTemplate?: ColumnMapping["conventions"],
): ColumnMapping["conventions"] {
  const conv: ColumnMapping["conventions"] = { ...(fromTemplate ?? {}) };
  const hourCols = columns.filter((a) => a.target.kind === "time" || (a.target.kind === "field" && ["total_time", "xc_time", "actual_inst", "hood_inst", "sim_inst", "cfi_time"].includes(a.target.field)));
  for (const a of hourCols) {
    const s = contexts[a.col]?.stats;
    if (s?.clockRaw) conv.clockTimes = true;
    if (s?.decimalCommaRaw) conv.decimalComma = true;
  }
  const dateCol = columns.find((a) => a.target.kind === "field" && a.target.field === "date")?.col;
  if (dateCol != null) {
    const df = dayFirstEvidence(grid, dateCol, dataStart);
    if (df != null) conv.dayFirstDates = df;
  }
  const makeCol = columns.find((a) => a.target.kind === "field" && a.target.field === "make_model")?.col;
  const simCols = columns.filter((a) => (a.target.kind === "field" && ["sim_inst", "ifr_approaches"].includes(a.target.field)) || (a.target.kind === "time" && a.target.category === "sim")).map((a) => a.col);
  if (makeCol != null && dateCol != null && simCols.length > 0) {
    let blankSimRows = 0;
    for (let r = dataStart; r < grid.rows.length; r++) {
      const row = grid.rows[r];
      if (!row) continue;
      const first = row.find((c) => c.kind === "text");
      if (first && TOTAL_ROW_RE.test(first.value)) continue;
      const date = row[dateCol];
      if (!date || date.kind === "empty") continue;
      const make = row[makeCol];
      if (make && make.kind !== "empty") continue;
      if (simCols.some((c) => { const cell = row[c]; return cell?.kind === "number" && cell.value > 0; })) blankSimRows++;
    }
    if (blankSimRows > 0) conv.blankAircraftIsSim = true;
  }
  return conv;
}

/** Day-first evidence from the date column's raw text: "27/09/2024" → true, "09/27/2024" → false. */
export function dayFirstEvidence(grid: Grid, col: number, dataStart: number): boolean | undefined {
  let day = 0, month = 0;
  for (let r = dataStart; r < grid.rows.length; r++) {
    const cell = grid.rows[r]?.[col];
    if (!cell || cell.kind !== "date" || !cell.raw) continue;
    const m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/.exec(cell.raw.trim());
    if (!m) continue;
    const a = +m[1], b = +m[2];
    const iso = cell.value;
    const mm = +iso.slice(5, 7), dd = +iso.slice(8, 10);
    if (a === b) continue;
    if (dd === a && mm === b) day++;
    else if (mm === a && dd === b) month++;
  }
  if (day === 0 && month === 0) return undefined;
  return day >= month;
}
