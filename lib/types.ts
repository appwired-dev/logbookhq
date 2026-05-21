/**
 * Shared types for LogbookHQ. Mirrors the Postgres schema in
 * supabase/migrations/0001_init.sql.
 */

// Category — expanded in migration 0009 to cover sea/heli classes.
export type Category = "SE" | "ME" | "SES" | "MES" | "HELI" | "SIM";
export type Role = "PIC" | "DUAL" | "FO" | "SIC" | "CHECK";

export interface Flight {
  id: number;
  user_id: string;
  date: string;
  make_model: string;
  registration: string | null;
  pic: string | null;
  copilot: string | null;
  third_pilot: string | null;
  check_pilot: string | null;
  route: string | null;
  remarks: string | null;
  category: Category;
  role: Role;
  day_time: number;
  night_time: number;
  is_xcountry: boolean;
  actual_inst: number;
  hood_inst: number;
  sim_inst: number;
  // Total approaches (legacy / aggregate). New rows should also populate the
  // granular split below — UI sums the two into this for backward compat.
  ifr_approaches: number;
  // Migration 0009 — granular traditional-logbook fields.
  precision_approaches: number;
  non_precision_approaches: number;
  holds: number;
  cfi_time: number;
  takeoffs_day: number;
  takeoffs_night: number;
  landings_day: number;
  landings_night: number;
  duty_time: number;
  created_at: string;
  updated_at: string;
}

export type DocumentType =
  | "MEDICAL" | "LICENSE" | "TYPE_RATING" | "IPC" | "RECURRENT"
  | "PASSPORT" | "VISA" | "OTHER";

export interface PilotDocument {
  id: number;
  user_id: string;
  doc_type: DocumentType;
  name: string;
  reference: string | null;
  issued_on: string | null;
  expires_on: string | null;
  storage_path: string;
  mime_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type FlightInput = Omit<Flight, "id" | "user_id" | "created_at" | "updated_at">;

export interface FlightDerived extends Flight {
  total_time: number;
  se_dual_day: number; se_pic_day: number;
  se_dual_night: number; se_pic_night: number;
  me_dual_day: number; me_pic_day: number; me_fo_day: number; me_sic_day: number; me_check_day: number;
  me_dual_night: number; me_pic_night: number; me_fo_night: number; me_sic_night: number; me_check_night: number;
  xc_day: number; xc_night: number;
}

export interface Totals {
  total_time: number;
  total_pic: number;
  total_fo: number;
  // Migration 0009 — traditional-logbook aggregates.
  total_cfi: number;
  total_holds: number;
  total_precision: number;     // precision approach count
  total_non_precision: number; // non-precision approach count
  // SE/ME existing detailed breakdowns; SES/MES/HELI start as aggregate totals
  // (no day/night/role splits yet — defer until there's user demand).
  se_dual_day: number; se_pic_day: number; se_day: number;
  se_dual_night: number; se_pic_night: number; se_night: number; se_total: number;
  me_dual_day: number; me_pic_day: number; me_fo_day: number; me_sic_day: number; me_check_day: number; me_day: number;
  me_dual_night: number; me_pic_night: number; me_fo_night: number; me_sic_night: number; me_check_night: number; me_night: number; me_total: number;
  ses_total: number;
  mes_total: number;
  heli_total: number;
  xc_day: number; xc_night: number; xc_total: number;
  xc_dual: number; xc_pic: number; xc_fo: number; xc_sic: number; xc_check: number;
  actual_inst: number; hood_inst: number; sim_inst: number; ifr_approaches: number; inst_total: number;
  by_type: Record<string, number>;
  by_type_role: Record<string, { PIC: number; DUAL: number; FO: number; SIC: number; CHECK: number; total: number; dominant: Role }>;
}

export interface CurrencyWindow {
  label: string; days: number; used: number; max: number; start_date: string;
  remaining: number; pct: number;
}

/**
 * One bucket of "recency" currency (IFR, day-PAX, night-PAX). Tracks counts
 * vs. a minimum threshold over a rolling window — green when met, amber as
 * the window ages, rose once expired.
 */
export interface RecencyStatus {
  /** Stable id for translation lookup, e.g. "ifr" | "pax-day" | "pax-night". */
  key: string;
  /** Display label fallback (used if no translation matches the key). */
  label: string;
  /** Rolling window in days. */
  windowDays: number;
  /** Minimum count required to be current. */
  required: number;
  /** Count actually achieved in the window. */
  achieved: number;
  /** True when achieved >= required. */
  current: boolean;
  /** ISO date this currency expires (achieved < required), or null if not current. */
  expiresOn: string | null;
  /** Days remaining until earliest landing/approach falls out of the window. */
  daysUntilExpiry: number | null;
  /** Authority-specific reg cite (e.g. "FAR 61.57(c)"). */
  citation?: string;
}

export interface CurrencyReport {
  today: string;
  windows: CurrencyWindow[];
  recency: RecencyStatus[];
}
