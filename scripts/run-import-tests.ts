/**
 * Runs every `scripts/import-*.test.ts` file in one process, in name order.
 * Each test file prints PASS/FAIL lines and sets `process.exitCode = 1` on
 * failure; this runner just sequences them and prints a summary.
 *
 *   npm run test:import
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

async function main(): Promise<void> {
  const files = readdirSync(__dirname)
    .filter((f) => /^import-.*\.test\.ts$/.test(f))
    .sort();
  for (const f of files) {
    console.log(`\n=== ${f} ===`);
    await import(pathToFileURL(join(__dirname, f)).href);
  }
  const code = process.exitCode ?? 0;
  console.log(`\n${files.length} test file(s) run — ${code === 0 ? "ALL PASS" : "FAILURES PRESENT"}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
