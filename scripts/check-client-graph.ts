/**
 * Walk the static import graph from one or more entry files and report whether
 * any server-only / heavy module is reachable. Used to keep SheetJS, the
 * Anthropic SDK and node built-ins out of "use client" bundles.
 *
 *   npx tsx scripts/check-client-graph.ts app/app/import/ImportWizard.tsx app/app/import/StepMapping.tsx
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, resolve, join } from "node:path";

const ROOT = resolve(__dirname, "..");
const FORBIDDEN = [/^xlsx$/, /^@anthropic-ai\/sdk$/, /^server-only$/, /^node:/, /^crypto$/, /^fs$/, /^path$/];
const EXTS = [".ts", ".tsx", ".js", ".jsx"];

function resolveImport(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null; // bare package — not walked (checked against FORBIDDEN by caller)
  for (const cand of [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => join(base, "index" + e))]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

function importsOf(file: string): { spec: string; typeOnly: boolean; dynamic: boolean }[] {
  const src = readFileSync(file, "utf8");
  const out: { spec: string; typeOnly: boolean; dynamic: boolean }[] = [];
  for (const m of src.matchAll(IMPORT_RE)) {
    const full = m[0];
    const spec = m[1] ?? m[2];
    if (!spec) continue;
    const typeOnly = /^\s*(?:import|export)\s+type\s/.test(full.trimStart().replace(/^\n/, ""));
    out.push({ spec, typeOnly, dynamic: !!m[2] });
  }
  return out;
}

const entries = process.argv.slice(2);
if (!entries.length) {
  console.error("usage: tsx scripts/check-client-graph.ts <entry files…>");
  process.exit(2);
}

let bad = 0;
for (const entry of entries) {
  const start = resolve(ROOT, entry);
  const seen = new Set<string>();
  const hits: string[] = [];
  const stack: { file: string; chain: string[] }[] = [{ file: start, chain: [entry] }];
  while (stack.length) {
    const { file, chain } = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    // A "use server" module is a boundary: the client only receives action
    // references, so nothing it imports lands in the client bundle.
    if (/^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use server["']/.test(readFileSync(file, "utf8"))) continue;
    for (const imp of importsOf(file)) {
      if (imp.typeOnly) continue; // erased at compile time
      if (imp.dynamic) continue;  // lazy — not in the initial client graph
      if (FORBIDDEN.some((re) => re.test(imp.spec))) {
        hits.push(`${imp.spec}  ←  ${[...chain, imp.spec].join(" → ")}`);
        continue;
      }
      const next = resolveImport(imp.spec, file);
      if (next) stack.push({ file: next, chain: [...chain, imp.spec] });
    }
  }
  console.log(`\n${entry}: walked ${seen.size} module(s)`);
  if (hits.length) {
    bad++;
    for (const h of hits) console.log(`  FORBIDDEN ${h}`);
  } else {
    console.log("  clean — no server-only or heavy modules reachable");
  }
}
process.exit(bad ? 1 : 0);
