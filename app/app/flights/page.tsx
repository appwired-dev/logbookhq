import { createClient } from "@/lib/supabase/server";
import { deriveFlight } from "@/lib/derive";
import { fetchAllFlights } from "@/lib/fetch-flights";
import { getLocale } from "@/lib/i18n-server";
import FlightsClient from "./FlightsClient";

export default async function FlightsPage() {
  const supabase = await createClient();
  const flights = await fetchAllFlights(supabase);
  const derived = flights.map(deriveFlight);
  const locale = await getLocale();
  return <FlightsClient flights={derived} locale={locale} />;
}
