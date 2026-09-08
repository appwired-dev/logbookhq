/**
 * Canonical target enumerations, stable string keys and constructors.
 * Kept dependency-free so both ./mapping and ./templates can import it.
 */
import type { CanonicalTarget, FieldTarget, TimeCategory, TimeCondition, TimeRole } from "./types";

export const CATEGORIES: readonly TimeCategory[] = ["any", "se", "me", "ses", "mes", "heli", "sim"];
export const CONDITIONS: readonly TimeCondition[] = ["any", "day", "night"];
export const ROLES: readonly TimeRole[] = ["any", "dual", "pic", "fo", "sic", "check", "solo"];
export const FIELDS: readonly FieldTarget[] = [
  "date", "make_model", "registration", "pic", "copilot", "third_pilot", "check_pilot",
  "route", "from", "to", "remarks", "category", "role", "xc_time", "xc_flag",
  "actual_inst", "hood_inst", "sim_inst",
  "ifr_approaches", "precision_approaches", "non_precision_approaches", "holds", "cfi_time",
  "takeoffs_day", "takeoffs_night", "landings_day", "landings_night",
  "total_time", "block_off", "block_on",
];
const FIELD_SET = new Set<string>(FIELDS);

export const IGNORE: CanonicalTarget = { kind: "ignore" };
export const time = (category: TimeCategory, condition: TimeCondition, role: TimeRole): CanonicalTarget =>
  ({ kind: "time", category, condition, role });
export const field = (f: FieldTarget): CanonicalTarget => ({ kind: "field", field: f });

/** Stable id: "time:me:night:fo", "field:date", "ignore". */
export function targetKey(t: CanonicalTarget): string {
  if (t.kind === "ignore") return "ignore";
  if (t.kind === "field") return `field:${t.field}`;
  return `time:${t.category}:${t.condition}:${t.role}`;
}

/** Inverse of targetKey; anything unknown becomes "ignore". */
export function parseTargetKey(key: string): CanonicalTarget {
  const parts = (key ?? "").trim().split(":");
  if (parts[0] === "field" && parts.length === 2 && FIELD_SET.has(parts[1])) return field(parts[1] as FieldTarget);
  if (parts[0] === "time" && parts.length === 4) {
    const [, c, k, r] = parts;
    if ((CATEGORIES as readonly string[]).includes(c) && (CONDITIONS as readonly string[]).includes(k) && (ROLES as readonly string[]).includes(r)) {
      return time(c as TimeCategory, k as TimeCondition, r as TimeRole);
    }
  }
  return IGNORE;
}

export function sameTarget(a: CanonicalTarget, b: CanonicalTarget): boolean {
  return targetKey(a) === targetKey(b);
}

/** Fields that may legitimately be fed by several columns (values are summed). */
export const SUMMABLE_FIELDS: ReadonlySet<FieldTarget> = new Set<FieldTarget>([
  "xc_time", "actual_inst", "hood_inst", "sim_inst", "cfi_time",
  "ifr_approaches", "precision_approaches", "non_precision_approaches", "holds",
  "takeoffs_day", "takeoffs_night", "landings_day", "landings_night",
]);

/** Every legal target key (the AI arbiter's enum). */
export function allTargetKeys(): string[] {
  const keys = new Set<string>(["ignore"]);
  for (const f of FIELDS) keys.add(targetKey(field(f)));
  for (const c of CATEGORIES) for (const k of CONDITIONS) for (const r of ROLES) keys.add(targetKey(time(c, k, r)));
  return [...keys];
}
