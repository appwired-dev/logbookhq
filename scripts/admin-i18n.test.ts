/**
 * Locale parity for the admin string tables (app/app/admin/admin-strings.ts
 * and app/app/admin/admin-ops-strings.ts).
 *
 *   npm run test:admin-i18n
 *
 * tsc already fails on a missing key; this catches what tsc cannot: an empty
 * value, a placeholder dropped or renamed in translation ({open} vs {n}), and
 * broken substitution / English fallback. Pure and offline.
 */
import assert from "node:assert/strict";
import { LOCALES, type Locale } from "../lib/i18n";
import { ADMIN_KEYS, adminStrings } from "../app/app/admin/admin-strings";
import { ADMIN_OPS_KEYS, adminOpsStrings } from "../app/app/admin/admin-ops-strings";

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

const placeholders = (s: string) => [...new Set(s.match(/\{\w+\}/g) ?? [])].sort();

function parity<K extends string>(label: string, keys: K[], t: (l: Locale) => (k: K) => string) {
  test(`${label}: every key is non-empty in every locale, with the English placeholders`, () => {
    assert.ok(keys.length > 0, "no keys exported");
    const en = t("en");
    for (const l of LOCALES) {
      const tl = t(l);
      for (const k of keys) {
        const v = tl(k);
        assert.ok(typeof v === "string" && v.trim().length > 0, `${label} ${l}.${k} is empty`);
        assert.deepEqual(placeholders(v), placeholders(en(k)), `${label} ${l}.${k} placeholders differ from en`);
      }
    }
  });
}

parity("admin-strings", ADMIN_KEYS, (l) => adminStrings(l));
parity("admin-ops-strings", ADMIN_OPS_KEYS, (l) => adminOpsStrings(l));

test("substitution replaces every occurrence and leaves other text intact", () => {
  assert.equal(adminStrings("en")("supportMeta", { open: 2, total: 9 }), "2 open · 9 total");
  assert.equal(adminOpsStrings("ko")("lastRun", { when: "어제", count: 3 }), "마지막 실행 어제 · 3건 삭제");
});

test("an unknown locale falls back to English, never to the key", () => {
  assert.equal(adminOpsStrings("xx" as Locale)("statVisits"), adminOpsStrings("en")("statVisits"));
  assert.notEqual(adminOpsStrings("xx" as Locale)("statVisits"), "statVisits", "never the bare key");
  assert.equal(adminOpsStrings("xx" as Locale)("trafficTitle"), "Admin · Traffic");
  assert.equal(adminStrings("xx" as Locale)("tabTraffic"), "Traffic");
});

test("no key is shared by both tables (one source of truth per string)", () => {
  const a = new Set<string>(ADMIN_KEYS);
  const dupes = ADMIN_OPS_KEYS.filter((k) => a.has(k));
  assert.deepEqual(dupes, []);
});

console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) process.exitCode = 1;
