import { createClient } from "@/lib/supabase/server";
import { deriveFlight } from "@/lib/derive";
import { fetchAllFlights } from "@/lib/fetch-flights";
import { getLocale } from "@/lib/i18n-server";
import ExportClient from "./ExportClient";

export default async function ExportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, license_number, avatar_url")
    .eq("id", user!.id)
    .single();

  const flights = (await fetchAllFlights(supabase, { orderAsc: true })).map(deriveFlight);
  const locale = await getLocale();
  return (
    <ExportClient
      flights={flights}
      defaultName={profile?.full_name ?? ""}
      defaultLicense={profile?.license_number ?? ""}
      avatarUrl={profile?.avatar_url ?? null}
      locale={locale}
    />
  );
}
