import { createClient } from "@/lib/supabase/server";
import { deriveFlight } from "@/lib/derive";
import { fetchAllFlights } from "@/lib/fetch-flights";
import { getLocale, getT } from "@/lib/i18n-server";
import ExportClient from "../export/ExportClient";
import ImportClient from "../import/ImportClient";

/**
 * Combined Import / Export page. Replaces the two separate routes so the user
 * has one place to move flights in and out. The two existing client
 * components (ExportClient, ImportClient) are reused unchanged — this page
 * just stacks them and adds a unifying heading.
 */
export default async function TransferPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, license_number, avatar_url")
    .eq("id", user!.id)
    .single();

  const flights = (await fetchAllFlights(supabase, { orderAsc: true })).map(deriveFlight);
  const locale = await getLocale();
  const t = await getT();

  return (
    <div className="space-y-10">
      {/* Export section */}
      <section>
        <ExportClient
          flights={flights}
          defaultName={profile?.full_name ?? ""}
          defaultLicense={profile?.license_number ?? ""}
          avatarUrl={profile?.avatar_url ?? null}
          locale={locale}
        />
      </section>

      {/* Divider */}
      <div className="border-t border-slate-200 -mx-4 sm:-mx-6" />

      {/* Import section */}
      <section>
        <ImportClient locale={locale} />
      </section>

      {/* Reference the translator so future copy edits can use t() */}
      <span className="sr-only">{t("nav.dashboard")}</span>
    </div>
  );
}
