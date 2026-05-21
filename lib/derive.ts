/**
 * Base-facts → derived layout, totals, currency.
 * Pure functions — safe to use in Server Components.
 */
import type { Flight, FlightDerived, Totals, Role } from "./types";

const r1 = (n: number) => Math.round(n * 10) / 10;

export function deriveFlight(f: Flight): FlightDerived {
  // Backward-compat: any legacy AUG rows still in the DB count as SIC.
  // Migration 0004 normalizes the data; this guards display until it runs.
  const role = (f.role as string) === "AUG" ? "SIC" : f.role;
  const total = r1(Number(f.day_time) + Number(f.night_time));
  const out: FlightDerived = {
    ...f,
    role,
    day_time: Number(f.day_time),
    night_time: Number(f.night_time),
    actual_inst: Number(f.actual_inst),
    hood_inst: Number(f.hood_inst),
    sim_inst: Number(f.sim_inst),
    total_time: total,
    se_dual_day: 0, se_pic_day: 0, se_dual_night: 0, se_pic_night: 0,
    me_dual_day: 0, me_pic_day: 0, me_fo_day: 0, me_sic_day: 0, me_check_day: 0,
    me_dual_night: 0, me_pic_night: 0, me_fo_night: 0, me_sic_night: 0, me_check_night: 0,
    xc_day: 0, xc_night: 0,
  };

  if (f.category === "SE") {
    if (role === "DUAL") { out.se_dual_day = out.day_time; out.se_dual_night = out.night_time; }
    else if (role === "PIC") { out.se_pic_day = out.day_time; out.se_pic_night = out.night_time; }
  } else if (f.category === "ME") {
    if (role === "DUAL") { out.me_dual_day = out.day_time; out.me_dual_night = out.night_time; }
    else if (role === "PIC") { out.me_pic_day = out.day_time; out.me_pic_night = out.night_time; }
    else if (role === "FO") { out.me_fo_day = out.day_time; out.me_fo_night = out.night_time; }
    else if (role === "SIC") { out.me_sic_day = out.day_time; out.me_sic_night = out.night_time; }
    else if (role === "CHECK") { out.me_check_day = out.day_time; out.me_check_night = out.night_time; }
  }

  if (f.is_xcountry) {
    out.xc_day = out.day_time;
    out.xc_night = out.night_time;
  }
  return out;
}

export function computeTotals(flights: Flight[]): Totals {
  const t: Totals = blank();
  for (const f of flights) {
    const d = deriveFlight(f);
    const role = d.role; // already AUG→SIC normalized by deriveFlight
    t.total_time += d.total_time;
    if (role === "PIC") t.total_pic += d.total_time;
    if (role === "FO") t.total_fo += d.total_time;

    t.se_dual_day += d.se_dual_day; t.se_pic_day += d.se_pic_day;
    t.se_dual_night += d.se_dual_night; t.se_pic_night += d.se_pic_night;
    t.me_dual_day += d.me_dual_day; t.me_pic_day += d.me_pic_day;
    t.me_fo_day += d.me_fo_day; t.me_sic_day += d.me_sic_day; t.me_check_day += d.me_check_day;
    t.me_dual_night += d.me_dual_night; t.me_pic_night += d.me_pic_night;
    t.me_fo_night += d.me_fo_night; t.me_sic_night += d.me_sic_night; t.me_check_night += d.me_check_night;

    if (f.is_xcountry) {
      t.xc_day += d.day_time; t.xc_night += d.night_time;
      if (role === "DUAL") t.xc_dual += d.total_time;
      else if (role === "PIC") t.xc_pic += d.total_time;
      else if (role === "FO") t.xc_fo += d.total_time;
      else if (role === "SIC") t.xc_sic += d.total_time;
      else if (role === "CHECK") t.xc_check += d.total_time;
    }

    t.actual_inst += d.actual_inst;
    t.hood_inst += d.hood_inst;
    t.sim_inst += d.sim_inst;
    t.ifr_approaches += Number(f.ifr_approaches);

    // Migration 0009 — granular logbook aggregates. `?? 0` guards against
    // the brief window where the deploy is live but the DB migration hasn't
    // been applied yet (columns return undefined → Number(undefined) = NaN).
    t.total_cfi += Number(f.cfi_time ?? 0);
    t.total_holds += Number(f.holds ?? 0);
    t.total_precision += Number(f.precision_approaches ?? 0);
    t.total_non_precision += Number(f.non_precision_approaches ?? 0);

    // Category-class aggregates for sea/heli (single number each, no day/night
    // or role split — defer that detail until users actually ask for it).
    if (f.category === "SES") t.ses_total += d.total_time;
    else if (f.category === "MES") t.mes_total += d.total_time;
    else if (f.category === "HELI") t.heli_total += d.total_time;

    const key = f.make_model || "Unknown";
    t.by_type[key] = (t.by_type[key] ?? 0) + d.total_time;

    if (!t.by_type_role[key]) {
      t.by_type_role[key] = { PIC: 0, DUAL: 0, FO: 0, SIC: 0, CHECK: 0, total: 0, dominant: "PIC" };
    }
    t.by_type_role[key][role] += d.total_time;
    t.by_type_role[key].total += d.total_time;
  }

  t.se_day = t.se_dual_day + t.se_pic_day;
  t.se_night = t.se_dual_night + t.se_pic_night;
  t.se_total = t.se_day + t.se_night;
  t.me_day = t.me_dual_day + t.me_pic_day + t.me_fo_day + t.me_sic_day + t.me_check_day;
  t.me_night = t.me_dual_night + t.me_pic_night + t.me_fo_night + t.me_sic_night + t.me_check_night;
  t.me_total = t.me_day + t.me_night;
  t.xc_total = t.xc_day + t.xc_night;
  t.inst_total = t.actual_inst + t.hood_inst + t.sim_inst;

  for (const k of Object.keys(t) as (keyof Totals)[]) {
    if (typeof t[k] === "number") (t[k] as number) = r1(t[k] as number);
  }
  for (const k of Object.keys(t.by_type)) t.by_type[k] = r1(t.by_type[k]);
  for (const k of Object.keys(t.by_type_role)) {
    const tr = t.by_type_role[k];
    tr.PIC = r1(tr.PIC); tr.DUAL = r1(tr.DUAL); tr.FO = r1(tr.FO); tr.SIC = r1(tr.SIC); tr.CHECK = r1(tr.CHECK);
    tr.total = r1(tr.total);
    const roles: Role[] = ["PIC", "DUAL", "FO", "SIC", "CHECK"];
    tr.dominant = roles.reduce((best, r) => tr[r] > tr[best] ? r : best, "PIC");
  }
  return t;
}

function blank(): Totals {
  return {
    total_time: 0, total_pic: 0, total_fo: 0,
    total_cfi: 0, total_holds: 0,
    total_precision: 0, total_non_precision: 0,
    ses_total: 0, mes_total: 0, heli_total: 0,
    se_dual_day: 0, se_pic_day: 0, se_day: 0,
    se_dual_night: 0, se_pic_night: 0, se_night: 0, se_total: 0,
    me_dual_day: 0, me_pic_day: 0, me_fo_day: 0, me_sic_day: 0, me_check_day: 0, me_day: 0,
    me_dual_night: 0, me_pic_night: 0, me_fo_night: 0, me_sic_night: 0, me_check_night: 0,
    me_night: 0, me_total: 0,
    xc_day: 0, xc_night: 0, xc_total: 0,
    xc_dual: 0, xc_pic: 0, xc_fo: 0, xc_sic: 0, xc_check: 0,
    actual_inst: 0, hood_inst: 0, sim_inst: 0, ifr_approaches: 0, inst_total: 0,
    by_type: {}, by_type_role: {},
  };
}
