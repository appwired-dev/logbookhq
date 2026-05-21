/**
 * Build the bundled aircraft-registry JSON from TC + FAA public open-data.
 *
 * What it ingests (you supply these CSVs in ./data/raw/):
 *
 *   data/raw/ccarcs.csv
 *     Transport Canada Civil Aircraft Register (CCARCS).
 *     Download (Open Government, ~30k rows):
 *       https://open.canada.ca/data/en/dataset/aaccdde7-9c33-4ddc-bd2d-2caf6a047cce
 *
 *   data/raw/MASTER.txt   data/raw/ACFTREF.txt
 *     FAA Releasable Aircraft Database — two CSVs to join.
 *     Download (~290k rows, refreshed monthly):
 *       https://registry.faa.gov/database/yearly/ReleasableAircraft.zip
 *
 * What it writes:
 *   data/aircraft-registry.json — single object keyed by canonical tail #,
 *   read at runtime by lib/aircraft-registry.ts.
 *
 * Run:
 *   npx tsx scripts/build-aircraft-registry.ts
 *
 * If a source file is missing, that part of the registry is skipped and
 * the script still emits a partial JSON. Re-run after updating CSVs.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const RAW = join(ROOT, "data", "raw");
const OUT = join(ROOT, "data", "aircraft-registry.json");

interface RegistryEntry {
  make: string;
  model: string;
  year?: string;
  owner?: string;
  source: "TC" | "FAA";
}

const registry: Record<string, RegistryEntry> = {};

// ============================================================
// Minimal CSV splitter (handles quoted fields). Sufficient for these files;
// no embedded newlines in either source.
// ============================================================
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { out.push(field); field = ""; }
      else field += c;
    }
  }
  out.push(field);
  return out.map((s) => s.trim());
}

// ============================================================
// Transport Canada (CCARCS)
// Common columns: Mark, Manufacturer Name, Model Name, Year Manufactured, Owner Name
// ============================================================
function ingestTC() {
  const path = join(RAW, "ccarcs.csv");
  if (!existsSync(path)) {
    console.log("  TC:  data/raw/ccarcs.csv not found — skipping");
    return;
  }
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/);
  const headers = splitCsv(lines[0] ?? "").map((h) => h.toLowerCase());
  const ix = {
    mark: headers.findIndex((h) => /\bmark\b|registration/.test(h)),
    make: headers.findIndex((h) => /manufacturer/.test(h)),
    model: headers.findIndex((h) => /model/.test(h)),
    year: headers.findIndex((h) => /year/.test(h)),
    owner: headers.findIndex((h) => /owner/.test(h)),
  };
  let n = 0;
  for (let i = 1; i < lines.length; i++) {
    const row = splitCsv(lines[i]);
    if (row.length < 2) continue;
    const mark = (row[ix.mark] ?? "").trim().toUpperCase();
    if (!mark) continue;
    const key = mark.startsWith("C-") ? mark : `C-${mark}`;
    registry[key] = {
      make: row[ix.make] ?? "",
      model: row[ix.model] ?? "",
      year: row[ix.year] || undefined,
      owner: row[ix.owner] || undefined,
      source: "TC",
    };
    n++;
  }
  console.log(`  TC:  ingested ${n.toLocaleString()} aircraft`);
}

// ============================================================
// FAA — MASTER.txt joined to ACFTREF.txt on MFR MDL CODE
// ============================================================
function ingestFAA() {
  const masterPath = join(RAW, "MASTER.txt");
  const refPath = join(RAW, "ACFTREF.txt");
  if (!existsSync(masterPath) || !existsSync(refPath)) {
    console.log("  FAA: MASTER.txt / ACFTREF.txt not found — skipping");
    return;
  }

  // Build a model lookup from ACFTREF: CODE → { mfr, model }
  const refText = readFileSync(refPath, "utf8");
  const refLines = refText.split(/\r?\n/);
  const refHeaders = splitCsv(refLines[0] ?? "").map((h) => h.toLowerCase().trim());
  const refIx = {
    code: refHeaders.findIndex((h) => /^code$/.test(h)),
    mfr: refHeaders.findIndex((h) => /mfr|manufacturer/.test(h)),
    model: refHeaders.findIndex((h) => /^model$/.test(h)),
  };
  const refMap = new Map<string, { mfr: string; model: string }>();
  for (let i = 1; i < refLines.length; i++) {
    const r = splitCsv(refLines[i]);
    if (r.length < 3) continue;
    const code = (r[refIx.code] ?? "").trim();
    if (!code) continue;
    refMap.set(code, { mfr: (r[refIx.mfr] ?? "").trim(), model: (r[refIx.model] ?? "").trim() });
  }

  // Walk MASTER, join on MFR MDL CODE, key by N-number.
  const masterText = readFileSync(masterPath, "utf8");
  const lines = masterText.split(/\r?\n/);
  const headers = splitCsv(lines[0] ?? "").map((h) => h.toLowerCase().trim());
  const ix = {
    n: headers.findIndex((h) => /n-number|n_number|^n$|nnumber/.test(h)),
    code: headers.findIndex((h) => /mfr.*mdl.*code|^mfr mdl code$/.test(h)),
    year: headers.findIndex((h) => /year mfr|year_mfr/.test(h)),
    owner: headers.findIndex((h) => /name|owner/.test(h)),
  };
  let n = 0;
  for (let i = 1; i < lines.length; i++) {
    const row = splitCsv(lines[i]);
    if (row.length < 3) continue;
    const nNum = (row[ix.n] ?? "").trim().toUpperCase();
    if (!nNum) continue;
    const code = (row[ix.code] ?? "").trim();
    const ref = refMap.get(code);
    if (!ref) continue;
    const key = nNum.startsWith("N") ? nNum : `N${nNum}`;
    registry[key] = {
      make: ref.mfr,
      model: ref.model,
      year: row[ix.year] || undefined,
      owner: row[ix.owner] || undefined,
      source: "FAA",
    };
    n++;
  }
  console.log(`  FAA: ingested ${n.toLocaleString()} aircraft`);
}

console.log("Building aircraft registry...");
ingestTC();
ingestFAA();

if (Object.keys(registry).length === 0) {
  console.log("\nNo data to write. Put ccarcs.csv / MASTER.txt / ACFTREF.txt in data/raw/ and re-run.");
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(registry), "utf8");
const sizeMb = (readFileSync(OUT).length / 1024 / 1024).toFixed(2);
console.log(`\nWrote ${Object.keys(registry).length.toLocaleString()} aircraft → ${OUT} (${sizeMb} MB)`);
