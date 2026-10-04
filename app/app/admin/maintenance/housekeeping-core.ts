/**
 * Pure helpers for the Maintenance tab, shared by its page (server), its panel
 * (client) and app/app/admin/ops-actions.ts. No server-only, next/* or node:*
 * imports, so the client graph stays clean.
 *
 * The rule names are the keys run_housekeeping() (migration 0021) writes into
 * `counts` / `errors` and into the housekeeping.* audit rows' detail.
 */
import { RETENTION } from "@/lib/site-stats-core";

export const HOUSEKEEPING_RULES = ["rate_limit", "traffic", "stripe_events", "support_resolved", "audit"] as const;
export type HousekeepingRule = (typeof HOUSEKEEPING_RULES)[number];
export type RuleCounts = Partial<Record<HousekeepingRule, number>>;

/** Days each rule keeps — RETENTION is the single source (also pinned against the policy and the SQL). */
export const RULE_RETENTION_DAYS: Readonly<Record<HousekeepingRule, number>> = {
  rate_limit: RETENTION.rateLimitDays,
  traffic: RETENTION.trafficDays,
  stripe_events: RETENTION.stripeDays,
  support_resolved: RETENTION.supportResolvedDays,
  audit: RETENTION.auditDays,
};

const RULE_SET: ReadonlySet<string> = new Set(HOUSEKEEPING_RULES);

export function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function isHousekeepingRule(v: unknown): v is HousekeepingRule {
  return typeof v === "string" && RULE_SET.has(v);
}

/** A non-negative whole number, or null. bigint values arrive as JSON numbers (numeric strings accepted defensively). */
export function toCount(v: unknown): number | null {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/** Per-rule counts from run_housekeeping's `counts`, or from a housekeeping.* audit detail (same keys). */
export function ruleCounts(v: unknown): RuleCounts {
  const out: RuleCounts = {};
  if (!isRecord(v)) return out;
  for (const rule of HOUSEKEEPING_RULES) {
    const n = toCount(v[rule]);
    if (n !== null) out[rule] = n;
  }
  return out;
}

export function sumCounts(c: RuleCounts): number {
  let total = 0;
  for (const rule of HOUSEKEEPING_RULES) total += c[rule] ?? 0;
  return total;
}

/**
 * Names of the rules that reported an error (the keys of an `errors` object).
 * The SQL error messages themselves are never passed on — only the rule names.
 */
export function errorRules(v: unknown): string[] {
  if (!isRecord(v)) return [];
  return Object.keys(v).filter((k) => /^[a-z_]{1,40}$/.test(k));
}
