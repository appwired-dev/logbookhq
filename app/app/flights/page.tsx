import { createClient } from "@/lib/supabase/server";
import { deriveFlight } from "@/lib/derive";
import { fetchAllFlights } from "@/lib/fetch-flights";
import { getLocale } from "@/lib/i18n-server";
import FlightsClient from "./FlightsClient";

export default async function FlightsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [flights, locale, { data: profile }] = await Promise.all([
    fetchAllFlights(supabase),
    getLocale(),
    // Same convention switch the dashboard / charts honour (SIC at 50 %).
    supabase.from("profiles").select("aug_half_credit").eq("id", user?.id ?? "").maybeSingle(),
  ]);
  const derived = flights.map(deriveFlight);
  return <FlightsClient flights={derived} locale={locale} augHalfCredit={Boolean(profile?.aug_half_credit)} />;
}
