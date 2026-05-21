/**
 * Career achievement badge engine. Computes earned badges from a user's
 * flight history. Each badge is timestamped with the earning flight so the
 * UI can show "earned 2018-07-29" or similar.
 *
 * Pure function — safe in Server Components. Each badge carries a `kind`
 * (visual symbol) and `tier` (bronze/silver/gold/platinum/diamond) which
 * the BadgeMedallion component renders as a coloured medallion.
 */
import type { Flight, PilotDocument } from "./types";
import type { BadgeKind, BadgeTier } from "@/components/BadgeMedallion";
import { translate, type Locale, type TranslationKey } from "./i18n";

export interface Badge {
  id: string;
  name: string;
  description: string;
  kind: BadgeKind;
  tier: BadgeTier;
  earned: boolean;
  earnedOn?: string;
  progress?: { current: number; target: number };
  category: "milestones" | "firsts" | "regime" | "endurance";
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function totalHours(flights: Flight[]) {
  return flights.reduce((s, f) => s + Number(f.day_time) + Number(f.night_time), 0);
}

function firstFlight(flights: Flight[], pred: (f: Flight) => boolean): Flight | undefined {
  return [...flights].sort((a, b) => a.date.localeCompare(b.date)).find(pred);
}

function hoursThreshold(flights: Flight[], threshold: number, pred: (f: Flight) => boolean = () => true): Flight | undefined {
  const sorted = [...flights].sort((a, b) => a.date.localeCompare(b.date));
  let cum = 0;
  for (const f of sorted) {
    if (!pred(f)) continue;
    cum += Number(f.day_time) + Number(f.night_time);
    if (cum >= threshold) return f;
  }
  return undefined;
}

export function computeBadges(flights: Flight[], documents: PilotDocument[] = [], locale: Locale = "en"): Badge[] {
  const out: Badge[] = [];
  const t = (key: TranslationKey, vars?: Record<string, string | number>) => translate(key, locale, vars);

  /** Match a LICENSE document whose name contains the given token (PPL/CPL/ATPL). */
  const findLicenseDoc = (token: string) => documents.find((d) =>
    d.doc_type === "LICENSE" && new RegExp(`\\b${token}\\b`, "i").test(d.name)
  );

  // === First-time milestones (all bronze — entry-level achievements) ===
  const firstFly = firstFlight(flights, () => true);
  out.push({
    id: "first-flight",
    name: t("b.firstFlight.name"),
    description: t("b.firstFlight.desc"),
    kind: "rocket", tier: "bronze",
    category: "firsts",
    earned: !!firstFly,
    earnedOn: firstFly?.date,
  });

  const firstSolo = firstFlight(flights, (f) => f.role === "PIC" && f.category === "SE");
  out.push({
    id: "first-solo",
    name: t("b.firstSolo.name"),
    description: t("b.firstSolo.desc"),
    kind: "eagle", tier: "bronze",
    category: "firsts",
    earned: !!firstSolo,
    earnedOn: firstSolo?.date,
  });

  const firstNight = firstFlight(flights, (f) => Number(f.night_time) > 0);
  out.push({
    id: "first-night",
    name: t("b.firstNight.name"),
    description: t("b.firstNight.desc"),
    kind: "moon", tier: "bronze",
    category: "firsts",
    earned: !!firstNight,
    earnedOn: firstNight?.date,
  });

  const firstXC = firstFlight(flights, (f) => f.is_xcountry);
  out.push({
    id: "first-xc",
    name: t("b.firstXC.name"),
    description: t("b.firstXC.desc"),
    kind: "compass", tier: "bronze",
    category: "firsts",
    earned: !!firstXC,
    earnedOn: firstXC?.date,
  });

  const firstIFR = firstFlight(flights, (f) => Number(f.actual_inst) + Number(f.hood_inst) > 0);
  out.push({
    id: "first-ifr",
    name: t("b.firstIFR.name"),
    description: t("b.firstIFR.desc"),
    kind: "fog", tier: "bronze",
    category: "firsts",
    earned: !!firstIFR,
    earnedOn: firstIFR?.date,
  });

  const firstME = firstFlight(flights, (f) => f.category === "ME");
  out.push({
    id: "first-me",
    name: t("b.firstME.name"),
    description: t("b.firstME.desc"),
    kind: "twin", tier: "bronze",
    category: "firsts",
    earned: !!firstME,
    earnedOn: firstME?.date,
  });

  const firstInternational = firstFlight(flights, (f) => {
    if (!f.route) return false;
    const codes = f.route.split(/[-→/\s]+/).filter((s) => /^[A-Z]{4}$/.test(s));
    if (codes.length < 2) return false;
    return codes[0][0] !== codes[codes.length - 1][0];
  });
  out.push({
    id: "first-international",
    name: t("b.firstIntl.name"),
    description: t("b.firstIntl.desc"),
    kind: "passport", tier: "bronze",
    category: "firsts",
    earned: !!firstInternational,
    earnedOn: firstInternational?.date,
  });

  // === Hour milestones (graduated tiers + symbols) ===
  type HourSpec = { hours: number; kind: BadgeKind; tier: BadgeTier };
  const HOUR_SPECS: HourSpec[] = [
    { hours: 50,    kind: "star",     tier: "bronze" },
    { hours: 100,   kind: "medal",    tier: "bronze" },
    { hours: 250,   kind: "medal",    tier: "silver" },
    { hours: 500,   kind: "award",    tier: "silver" },
    { hours: 1000,  kind: "award",    tier: "gold" },
    { hours: 1500,  kind: "trophy",   tier: "gold" },
    { hours: 2500,  kind: "trophy",   tier: "platinum" },
    { hours: 5000,  kind: "crown",    tier: "platinum" },
    { hours: 10000, kind: "gem",      tier: "diamond" },
  ];
  const total = totalHours(flights);
  for (const { hours, kind, tier } of HOUR_SPECS) {
    const f = hoursThreshold(flights, hours);
    const hrs = hours.toLocaleString();
    out.push({
      id: `total-${hours}`,
      name: t("b.totalHours.name", { hours: hrs }),
      description: t("b.totalHours.desc", { hours: hrs }),
      kind, tier,
      category: "milestones",
      earned: !!f,
      earnedOn: f?.date,
      progress: f ? undefined : { current: r1(total), target: hours },
    });
  }

  // === PIC milestones (climbing rank: 2 → 3 → 4 → 5 stripes) ===
  const PIC_SPECS: { hours: number; kind: BadgeKind; tier: BadgeTier }[] = [
    { hours: 500,  kind: "medal",  tier: "silver" },
    { hours: 1000, kind: "trophy", tier: "gold" },
    { hours: 1500, kind: "crown",  tier: "platinum" },
    { hours: 3000, kind: "gem",    tier: "diamond" },
  ];
  const picTotal = flights.filter((f) => f.role === "PIC").reduce((s, f) => s + Number(f.day_time) + Number(f.night_time), 0);
  for (const { hours, kind, tier } of PIC_SPECS) {
    const f = hoursThreshold(flights, hours, (f) => f.role === "PIC");
    const hrs = hours.toLocaleString();
    out.push({
      id: `pic-${hours}`,
      name: t("b.picHours.name", { hours: hrs }),
      description: t("b.picHours.desc", { hours: hrs }),
      kind, tier,
      category: "milestones",
      earned: !!f,
      earnedOn: f?.date,
      progress: f ? undefined : { current: r1(picTotal), target: hours },
    });
  }

  // === Regime / certification — Canadian (CARs) license + rating ladder ===
  // Precompute the totals each badge below needs, so the predicates stay readable.
  const nightHrs = flights.reduce((s, f) => s + Number(f.night_time), 0);
  const instHrs = flights.reduce((s, f) => s + Number(f.actual_inst) + Number(f.hood_inst), 0);
  const meHrs = flights.filter((f) => f.category === "ME")
    .reduce((s, f) => s + Number(f.day_time) + Number(f.night_time), 0);

  // License-tier stacking: holding a higher license implies the lower ones
  // (you cannot get an ATPL without first holding a CPL, which requires a PPL).
  // We pick the earliest-dated qualifying doc so the earnedOn date is meaningful.
  const pplDocExact = findLicenseDoc("PPL");
  const cplDocExact = findLicenseDoc("CPL");
  const atplDocExact = findLicenseDoc("ATPL");

  const pplSource = pplDocExact ?? cplDocExact ?? atplDocExact;
  out.push({
    id: "ppl",
    name: t("b.ppl.name"),
    description: pplDocExact
      ? t("b.ppl.onFile")
      : pplSource
        ? t("b.lic.impliedBy", { higher: cplDocExact ? "CPL" : "ATPL" })
        : t("b.lic.upload", { kind: "PPL" }),
    kind: "award", tier: "bronze",
    category: "regime",
    earned: !!pplSource,
    earnedOn: pplSource?.issued_on ?? pplSource?.created_at?.slice(0, 10),
  });

  out.push({
    id: "night-rating",
    name: t("b.nightRating.name"),
    description: t("b.nightRating.desc"),
    kind: "moon", tier: "bronze",
    category: "regime",
    earned: nightHrs >= 10,
    progress: nightHrs >= 10 ? undefined : { current: r1(nightHrs), target: 10 },
  });

  out.push({
    id: "me-rating",
    name: t("b.meRating.name"),
    description: t("b.meRating.desc"),
    kind: "twin", tier: "silver",
    category: "regime",
    earned: meHrs >= 5,
    progress: meHrs >= 5 ? undefined : { current: r1(meHrs), target: 5 },
  });

  out.push({
    id: "ifr-rating",
    name: t("b.ifrRating.name"),
    description: t("b.ifrRating.desc"),
    kind: "fog", tier: "silver",
    category: "regime",
    earned: instHrs >= 40,
    progress: instHrs >= 40 ? undefined : { current: r1(instHrs), target: 40 },
  });

  const cplSource = cplDocExact ?? atplDocExact;
  out.push({
    id: "cpl",
    name: t("b.cpl.name"),
    description: cplDocExact
      ? t("b.cpl.onFile")
      : cplSource
        ? t("b.lic.impliedBy", { higher: "ATPL" })
        : t("b.lic.upload", { kind: "CPL" }),
    kind: "medal", tier: "silver",
    category: "regime",
    earned: !!cplSource,
    earnedOn: cplSource?.issued_on ?? cplSource?.created_at?.slice(0, 10),
  });

  out.push({
    id: "atpl",
    name: t("b.atpl.name"),
    description: atplDocExact ? t("b.atpl.onFile") : t("b.lic.upload", { kind: "ATPL" }),
    kind: "target", tier: "gold",
    category: "regime",
    earned: !!atplDocExact,
    earnedOn: atplDocExact?.issued_on ?? atplDocExact?.created_at?.slice(0, 10),
  });

  // === Endurance ===
  const longestFlight = flights.reduce((m, f) => Math.max(m, Number(f.day_time) + Number(f.night_time)), 0);
  out.push({
    id: "long-haul",
    name: t("b.longHaul.name"),
    description: t("b.longHaul.desc"),
    kind: "clock", tier: "silver",
    category: "endurance",
    earned: longestFlight >= 8,
  });

  out.push({
    id: "ultra-long",
    name: t("b.ultraLong.name"),
    description: t("b.ultraLong.desc"),
    kind: "globe", tier: "gold",
    category: "endurance",
    earned: longestFlight >= 12,
  });

  // === Aircraft types ===
  const TYPE_SPECS: { count: number; kind: BadgeKind; tier: BadgeTier }[] = [
    { count: 5,  kind: "plane",    tier: "bronze" },
    { count: 10, kind: "plane",    tier: "silver" },
    { count: 20, kind: "sparkles", tier: "gold" },
  ];
  const types = new Set(flights.map((f) => f.make_model));
  for (const { count, kind, tier } of TYPE_SPECS) {
    out.push({
      id: `types-${count}`,
      name: t("b.types.name", { n: count }),
      description: t("b.types.desc", { n: count }),
      kind, tier,
      category: "milestones",
      earned: types.size >= count,
      progress: types.size >= count ? undefined : { current: types.size, target: count },
    });
  }

  return out;
}
