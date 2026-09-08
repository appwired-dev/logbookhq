/**
 * Run the import pipeline on a real spreadsheet and print what the wizard
 * would show — mapping, conventions, skips, totals, reconciliation checks.
 *
 *   npx tsx scripts/import-check-file.ts "/path/to/logbook.xlsx" [--aug-half]
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import {
  analyzeWorkbook, applyMapping, readWorkbook, reconcile, targetKey, describeTarget,
} from "../lib/import";

const [, , filePath, ...flags] = process.argv;
if (!filePath) {
  console.error("usage: tsx scripts/import-check-file.ts <file> [--aug-half]");
  process.exit(2);
}
const augHalfCredit = flags.includes("--aug-half");
const bytes = new Uint8Array(readFileSync(filePath));
const filename = basename(filePath);

const t0 = performance.now();
const analysis = analyzeWorkbook(bytes, filename);
const t1 = performance.now();
const wb = readWorkbook(bytes, filename);
const applied = applyMapping(wb, analysis, analysis.mapping);
const t2 = performance.now();
const report = reconcile(applied, analysis, analysis.mapping, { augHalfCredit });
const t3 = performance.now();

console.log(`\n# ${filename}`);
console.log(`sheet: "${analysis.sheetName}" (index ${analysis.sheetIndex}) · header rows ${JSON.stringify(analysis.header.rows)} · data from row ${analysis.header.dataStart} · ${analysis.rowCount} rows`);
console.log(`fingerprint: ${analysis.fingerprint}`);
console.log(`template: ${analysis.templateName ?? "—"} · legacyFormat: ${analysis.legacyFormat ?? "—"}`);
console.log(`conventions: ${JSON.stringify(analysis.mapping.conventions)}`);
console.log(`low-confidence cols: ${JSON.stringify(analysis.lowConfidenceCols)}`);
console.log(`timing: analyze ${(t1 - t0).toFixed(0)} ms · apply ${(t2 - t1).toFixed(0)} ms · reconcile ${(t3 - t2).toFixed(0)} ms`);

console.log("\n## Mapping");
for (const a of analysis.mapping.columns) {
  const p = analysis.header.paths.find((h) => h.col === a.col);
  const label = p?.label ?? "(no header)";
  const key = targetKey(a.target);
  if (a.target.kind === "ignore" && !label.trim()) continue;
  console.log(
    `  [${String(a.col).padStart(2)}] ${label.padEnd(44).slice(0, 44)} → ${key.padEnd(26)} ${a.confidence.toFixed(2)} ${a.source}${a.reason ? "  · " + a.reason : ""}`,
  );
}

console.log("\n## Declared totals");
for (const d of analysis.declaredTotals.slice(0, 40)) {
  console.log(`  ${d.source.padEnd(13)} ${d.label.padEnd(36).slice(0, 36)} ${String(d.value).padStart(9)}  ${d.meaning ? JSON.stringify(d.meaning) : ""}`);
}
if (analysis.declaredTotals.length > 40) console.log(`  … ${analysis.declaredTotals.length - 40} more`);

console.log("\n## Apply");
const skipCounts: Record<string, number> = {};
for (const s of applied.skipped) skipCounts[s.reason] = (skipCounts[s.reason] ?? 0) + 1;
console.log(`  flights: ${applied.flights.length} · skipped: ${applied.skipped.length} ${JSON.stringify(skipCounts)}`);
const sum = (f: (x: (typeof applied.flights)[number]) => number) => applied.flights.reduce((a, x) => a + (f(x) || 0), 0);
const r1 = (n: number) => Math.round(n * 10) / 10;
const byKey = (k: (x: (typeof applied.flights)[number]) => string) => {
  const m: Record<string, number> = {};
  for (const f of applied.flights) m[k(f)] = r1((m[k(f)] ?? 0) + (f.day_time || 0) + (f.night_time || 0));
  return m;
};
console.log(`  day ${r1(sum((f) => f.day_time))} · night ${r1(sum((f) => f.night_time))} · day+night ${r1(sum((f) => f.day_time + f.night_time))}`);
console.log(`  by category: ${JSON.stringify(byKey((f) => f.category))}`);
console.log(`  by role: ${JSON.stringify(byKey((f) => f.role))}`);
console.log(`  xc flights: ${applied.flights.filter((f) => f.is_xcountry).length} · sim aircraft rows: ${applied.flights.filter((f) => f.make_model === "SIM").length}`);
console.log(`  first: ${JSON.stringify(applied.flights[0])}`);
console.log(`  last:  ${JSON.stringify(applied.flights[applied.flights.length - 1])}`);

console.log(`\n## Reconcile (augHalfCredit=${augHalfCredit}) · ok=${report.ok}`);
console.log(`  summary: ${JSON.stringify(report.summary)}`);
for (const c of report.checks) {
  const exp = c.expected == null ? "" : ` expected ${c.expected}`;
  const delta = c.delta == null ? "" : ` Δ ${c.delta}`;
  console.log(`  ${c.status.padEnd(9)} ${c.label}: actual ${c.actual}${exp}${delta}${c.explanation ? "\n            " + c.explanation : ""}${c.suggestion && c.suggestion.kind !== "none" ? "\n            → " + c.suggestion.kind + (c.suggestion.detail ? ": " + c.suggestion.detail : "") : ""}`);
}
void describeTarget;
