/**
 * ISO alpha-2 ↔ world-countries.json mapping used by the admin Traffic globe
 * (lib/country-features.ts), checked against the real GeoJSON.
 *
 *   npx tsx scripts/country-features.test.ts
 *
 * Pure and offline. Every case prints PASS/FAIL; process.exitCode is set to 1
 * on any failure. Unmatched features are printed so a dataset swap that adds a
 * new spelling shows exactly which alias is missing.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ISO2_CODES, featureNameForIso2, iso2ForFeatureName, normalizeCountryName,
} from "../lib/country-features";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    const reason = e instanceof Error ? e.message : String(e);
    console.log(`FAIL  ${name}\n      ${reason.split("\n").join("\n      ")}`);
  }
}

type Feature = { properties?: { name?: unknown } };
const geo = JSON.parse(readFileSync(join(__dirname, "..", "public", "world-countries.json"), "utf8")) as { features?: Feature[] };
const featureNames = (geo.features ?? [])
  .map((f) => f.properties?.name)
  .filter((n): n is string => typeof n === "string" && n.length > 0);
const featureKeys = new Map(featureNames.map((n) => [normalizeCountryName(n), n] as const));

/** Natural Earth features with no ISO 3166-1 code of their own — expected to stay unmatched. */
const NO_ISO_CODE = new Set(["N. Cyprus", "Somaliland"]);

/** The codes the Traffic tab must place on the globe whenever the dataset has the country. */
const MUST_RESOLVE = [
  "US", "GB", "RU", "KR", "KP", "CZ", "CI", "CD", "CG", "TZ", "IR", "SY", "VN", "LA", "BO", "VE", "MK", "MD",
  "BA", "DO", "CF", "SS", "SZ", "TL", "FK", "PS", "TW", "XK",
  // Plus the rest of the Natural Earth abbreviations and CLDR renames.
  "EH", "GQ", "SB", "TF", "TT", "MM", "TR", "CA", "FR", "DE", "JP", "CN", "IN", "BR", "AU", "MX", "ZA",
];

test("the GeoJSON loads with named features", () => {
  assert.ok(featureNames.length > 150, `only ${featureNames.length} features`);
});

test("ISO2_CODES: unique, two upper-case letters, includes XK, excludes XX", () => {
  assert.equal(new Set(ISO2_CODES).size, ISO2_CODES.length, "duplicate code");
  for (const c of ISO2_CODES) assert.match(c, /^[A-Z]{2}$/, c);
  assert.ok(ISO2_CODES.includes("XK"));
  assert.ok(!ISO2_CODES.includes("XX"));
  assert.ok(ISO2_CODES.length >= 249, `${ISO2_CODES.length} codes`);
});

test("every alpha-2 code that has a feature resolves (both directions)", () => {
  const covered = new Set<string>();
  for (const code of ISO2_CODES) {
    const name = featureNameForIso2(code);
    if (!name) continue;
    const feature = featureKeys.get(normalizeCountryName(name));
    if (!feature) continue; // microstate / territory not in the 110 m dataset
    covered.add(feature);
    assert.equal(iso2ForFeatureName(feature), code, `${feature} → ${iso2ForFeatureName(feature)}, expected ${code}`);
  }
  const unmatched = featureNames.filter((n) => !covered.has(n));
  if (unmatched.length) console.log(`      unmatched features: ${unmatched.join(", ")}`);
  const unexpected = unmatched.filter((n) => !NO_ISO_CODE.has(n));
  assert.deepEqual(unexpected, [], `features with no code mapping: ${unexpected.join(", ")}`);
});

test("every feature name maps back to a code (except features with no ISO code)", () => {
  for (const n of featureNames) {
    const code = iso2ForFeatureName(n);
    if (NO_ISO_CODE.has(n)) {
      assert.equal(code, null, `${n} should stay unmatched, got ${code}`);
      continue;
    }
    assert.ok(code, `${n} has no code`);
    assert.equal(normalizeCountryName(featureNameForIso2(code!) ?? ""), normalizeCountryName(n), `${n} ↔ ${code}`);
  }
});

test("the required codes resolve to a feature that exists", () => {
  const missing: string[] = [];
  for (const code of MUST_RESOLVE) {
    const name = featureNameForIso2(code);
    if (!name || !featureKeys.has(normalizeCountryName(name))) missing.push(`${code} → ${name ?? "null"}`);
  }
  assert.deepEqual(missing, []);
});

test("featureNameForIso2: case-insensitive; null for unknown, malformed and deprecated codes", () => {
  assert.equal(featureNameForIso2("us"), "United States of America");
  assert.equal(featureNameForIso2(" gb "), "United Kingdom");
  assert.equal(featureNameForIso2("CI"), "Côte d'Ivoire");
  assert.equal(featureNameForIso2("CG"), "Congo");
  assert.equal(featureNameForIso2("CD"), "Dem. Rep. Congo");
  for (const bad of ["XX", "ZZ", "", "USA", "U1", "DD", "UK", "ZR", "TP", "SU"]) {
    assert.equal(featureNameForIso2(bad), null, bad);
  }
  assert.equal(featureNameForIso2(undefined as unknown as string), null);
});

test("iso2ForFeatureName: typographic variants match; junk does not", () => {
  assert.equal(iso2ForFeatureName("Côte d’Ivoire"), "CI");
  assert.equal(iso2ForFeatureName("côte d'ivoire"), "CI");
  assert.equal(iso2ForFeatureName("Bosnia & Herzegovina"), "BA");
  assert.equal(iso2ForFeatureName("  United   Kingdom "), "GB");
  assert.equal(iso2ForFeatureName("Atlantis"), null);
  assert.equal(iso2ForFeatureName(""), null);
  assert.equal(iso2ForFeatureName(null), null);
  assert.equal(iso2ForFeatureName(undefined), null);
});

test("no two features claim the same code", () => {
  const seen = new Map<string, string>();
  for (const n of featureNames) {
    const code = iso2ForFeatureName(n);
    if (!code) continue;
    const prev = seen.get(code);
    assert.ok(!prev, `${code} claimed by both ${prev} and ${n}`);
    seen.set(code, n);
  }
});

console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) process.exitCode = 1;
