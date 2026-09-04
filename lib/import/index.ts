/**
 * Import pipeline — public surface. Implemented in ./grid, ./headers,
 * ./mapping, ./apply, ./reconcile, ./templates, ./arbiter (see types.ts for
 * the data contracts). This file only re-exports.
 *
 *   analyzeWorkbook(bytes, filename, { templates })  → Analysis
 *   arbitrateWithClaude(analysis)                    → ColumnMapping (async, env-gated)
 *   applyMapping(bytes, analysis, mapping)           → ApplyResult
 *   reconcile(apply, analysis, mapping)              → ReconcileReport
 *   fingerprint(headerPaths)                         → string
 */
export * from "./types";
export { readWorkbook } from "./grid";
export { detectHeaderBand } from "./headers";
export { mapColumns, CANONICAL_OPTIONS, describeTarget } from "./mapping";
export { applyMapping } from "./apply";
export { reconcile } from "./reconcile";
export { fingerprint } from "./templates";
export { analyzeWorkbook } from "./analyze";
export { arbitrateWithClaude } from "./arbiter";
