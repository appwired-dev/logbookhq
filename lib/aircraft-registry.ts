/**
 * Public aircraft-registry lookup (TC + FAA).
 *
 * Falls back to `null` when no registry file is bundled. The build script
 * `scripts/build-aircraft-registry.ts` ingests the official open-data CSVs
 * from Transport Canada (CCARCS) + the FAA (Releasable Aircraft Database)
 * and writes a single compact JSON file the server reads on demand.
 *
 * Registry shape:
 *   { "C-FXXX": { make: "Cessna", model: "172", year: "1978" }, ... }
 *
 * Memory: TC + FAA combined is ~12 MB raw / ~2.5 MB gzipped, held once
 * per Node process. The lookup itself is O(1) hash access.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface RegistryEntry {
  make: string;
  model: string;
  year?: string;
  owner?: string;
  source: "TC" | "FAA";
}

const REGISTRY_PATH = join(process.cwd(), "data", "aircraft-registry.json");

let cache: Record<string, RegistryEntry> | null = null;
let cacheChecked = false;

/**
 * Lazily load the registry JSON on first call, cache for the life of the
 * Node process. Returns `null` if no file is bundled — callers should
 * treat that as "registry not populated yet" rather than an error.
 */
function loadRegistry(): Record<string, RegistryEntry> | null {
  if (cacheChecked) return cache;
  cacheChecked = true;
  if (!existsSync(REGISTRY_PATH)) return null;
  try {
    const raw = readFileSync(REGISTRY_PATH, "utf8");
    cache = JSON.parse(raw) as Record<string, RegistryEntry>;
    return cache;
  } catch {
    return null;
  }
}

/**
 * Look up a tail number in the TC + FAA registries.
 * Normalises common variants (strip spaces, uppercase, optional dash).
 */
export function lookupTailRegistry(tail: string): RegistryEntry | null {
  const reg = loadRegistry();
  if (!reg) return null;
  const norm = tail.trim().toUpperCase().replace(/\s+/g, "");
  // Try as-is, then with a dash inserted after the country prefix (C-FXXX, N-12345).
  const variants = [
    norm,
    norm.replace(/^(C|N|G|D|F)([A-Z0-9])/, "$1-$2"),
    norm.replace(/^(C|N|G|D|F)-/, "$1"),
  ];
  for (const v of variants) {
    const hit = reg[v];
    if (hit) return hit;
  }
  return null;
}

/** For diagnostics / Settings UI — how many aircraft are loaded? */
export function registrySize(): number {
  const reg = loadRegistry();
  return reg ? Object.keys(reg).length : 0;
}
