import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FlightForm from "../FlightForm";
import { formStrings } from "../form-strings";
import { getLocale } from "@/lib/i18n-server";
import { PageHeader } from "@/components/ui";
import type { Flight } from "@/lib/types";

export default async function EditFlightPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  // `/app/flights/abc` would otherwise blow up Postgres with an invalid
  // bigint cast; treat any non-numeric slug as a 404.
  if (!Number.isFinite(numericId) || numericId <= 0) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("flights").select("*").eq("id", numericId).single();
  if (!data) notFound();
  const locale = await getLocale();
  const flight = data as Flight;
  const s = formStrings(locale);
  // The back link renders inside FlightForm, beside this header, so it can
  // share the form's unsaved-changes prompt.
  return (
    <div className="space-y-4">
      <FlightForm
        flight={flight}
        locale={locale}
        header={
          <PageHeader
            className="min-w-0 flex-1"
            title={s("editFlight")}
            subtitle={
              <>
                <span className="num">{flight.date}</span>
                {flight.route && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="mono">{flight.route}</span>
                  </>
                )}
                <span aria-hidden>·</span>
                <span className="mono">#{flight.id}</span>
              </>
            }
          />
        }
      />
    </div>
  );
}
