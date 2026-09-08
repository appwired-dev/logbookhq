import { createClient } from "@/lib/supabase/server";
import { deriveFlight } from "@/lib/derive";
import { getServerIsDesktop } from "@/lib/device-hint";
import { fetchAllFlights } from "@/lib/fetch-flights";
import { getLocale } from "@/lib/i18n-server";
import FlightsClient from "./FlightsClient";

export default async function FlightsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [flights, locale, isDesktop, { data: profile }] = await Promise.all([
    fetchAllFlights(supabase),
    getLocale(),
    // Device hint: phones SSR the card list, everything else the table.
    getServerIsDesktop(),
    // Same convention switch the dashboard / charts honour (SIC at 50 %).
    supabase.from("profiles").select("aug_half_credit").eq("id", user?.id ?? "").maybeSingle(),
  ]);
  const derived = flights.map(deriveFlight);
  return (
    <FlightsClient
      flights={derived}
      locale={locale}
      augHalfCredit={Boolean(profile?.aug_half_credit)}
      initialIsDesktop={isDesktop}
    />
  );
}
