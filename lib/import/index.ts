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
export type { ApplyResultExt } from "./types-ext";
export { readWorkbook } from "./grid";
export { detectHeaderBand } from "./headers";
export { mapColumns, CANONICAL_OPTIONS, describeTarget, targetKey, parseTargetKey } from "./mapping";
export { applyMapping } from "./apply";
export { reconcile } from "./reconcile";
export { fingerprint, SYSTEM_TEMPLATES } from "./templates";
export { analyzeWorkbook } from "./analyze";
export { arbitrateWithClaude } from "./arbiter";
