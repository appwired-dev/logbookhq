"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lookupTailRegistry } from "@/lib/aircraft-registry";
import type { FlightInput, Category, Role } from "@/lib/types";

const CATEGORIES: Category[] = ["SE", "ME", "SES", "MES", "HELI", "SIM"];
const ROLES: Role[] = ["PIC", "DUAL", "FO", "SIC", "CHECK"];

/**
 * Normalise + sanity-check a FlightInput coming from the client. We rely on
 * RLS for auth, but Postgres rejects invalid enum/number values with cryptic
 * 400s that surface as ugly toasts. Validating here gives the user a clear
 * "Invalid category" instead of "new row violates check constraint flights_role_check".
 *
 * Returns either a validated payload or a structured error.
 */
function validateFlight(input: FlightInput): { ok: true; value: FlightInput } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid flight payload." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "")) return { ok: false, error: "Date must be YYYY-MM-DD." };
  if (!input.make_model || typeof input.make_model !== "string") return { ok: false, error: "Make/model is required." };
  if (!CATEGORIES.includes(input.category)) return { ok: false, error: "Invalid category." };
  if (!ROLES.includes(input.role)) return { ok: false, error: "Invalid role." };

  // Coerce numeric fields and clamp to non-negative. DB columns are
  // numeric(5,1) / integer with check (>= 0); rejecting here gives a nicer
  // error than Postgres's constraint name.
  const nonNegNumber = (n: unknown, name: string): number | string => {
    const v = Number(n);
    if (!Number.isFinite(v)) return `${name} must be a number.`;
    if (v < 0) return `${name} must be ≥ 0.`;
    return v;
  };
  const numericFields: (keyof FlightInput)[] = [
    "day_time", "night_time", "actual_inst", "hood_inst", "sim_inst",
    "ifr_approaches", "precision_approaches", "non_precision_approaches",
    "holds", "cfi_time", "takeoffs_day", "takeoffs_night",
    "landings_day", "landings_night", "duty_time",
  ];
  const cleaned: Record<string, unknown> = { ...input };
  for (const f of numericFields) {
    const r = nonNegNumber((input as Record<string, unknown>)[f], f as string);
    if (typeof r === "string") return { ok: false, error: r };
    cleaned[f as string] = r;
  }
  cleaned.is_xcountry = !!input.is_xcountry;

  return { ok: true, value: cleaned as FlightInput };
}

export async function createFlight(input: FlightInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const v = validateFlight(input);
  if (!v.ok) return { error: v.error };
  const { error } = await supabase.from("flights").insert({ ...v.value, user_id: user.id });
  if (error) return { error: error.message };
  revalidatePath("/app");
  revalidatePath("/app/flights");
  redirect("/app/flights");
}

export async function updateFlight(id: number, input: FlightInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const v = validateFlight(input);
  if (!v.ok) return { error: v.error };
  // RLS already restricts UPDATE to rows where auth.uid() = user_id, but
  // adding the explicit eq is defense in depth — if RLS is ever accidentally
  // dropped, this still scopes the write to the caller's rows.
  const { error } = await supabase
    .from("flights")
    .update(v.value)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/app");
  revalidatePath("/app/flights");
  redirect("/app/flights");
}

export async function deleteFlight(id: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const { error } = await supabase
    .from("flights")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/app");
  revalidatePath("/app/flights");
  redirect("/app/flights");
}

/**
 * Look up the make/model for a tail number. Two-tier lookup:
 *   1. The pilot's own flight history — most relevant, infers category too
 *      since we know how they flew it last time.
 *   2. Public registries (TC for C-* tails, FAA for N-* tails) — bundled
 *      JSON loaded once per process. Returns "SE" as a default category
 *      since the public register doesn't include single/multi distinction
 *      reliably; the pilot can edit before saving.
 */
export async function lookupRegistration(registration: string): Promise<
  { make_model: string; category: Category; source: "history" | "registry" } | null
> {
  const clean = registration.trim().toUpperCase();
  if (clean.length < 3) return null;

  // Tier 1 — the user's own history.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("flights")
    .select("make_model, category")
    .eq("user_id", user.id)
    .ilike("registration", clean)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.make_model) {
    return { make_model: data.make_model, category: data.category as Category, source: "history" };
  }

  // Tier 2 — public TC + FAA registries (no-op if registry JSON missing).
  const hit = lookupTailRegistry(clean);
  if (hit) {
    const make_model = `${hit.make} ${hit.model}`.trim();
    return { make_model, category: "SE", source: "registry" };
  }
  return null;
}
