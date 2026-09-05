import Link from "next/link";
import { notFound } from "next/navigation";
// ArrowLeft isn't in components/ui/icons.ts yet (read-only for this pass) — import it directly for now.
import { ArrowLeft } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import FlightForm from "../FlightForm";
import { formStrings } from "../form-strings";
import { getLocale } from "@/lib/i18n-server";
import { PageHeader, buttonClass } from "@/components/ui";
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
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <Link
          href="/app/flights"
          aria-label={s("backToFlights")}
          title={s("backToFlights")}
          className={buttonClass("ghost", "md", "btn-icon h-11 w-11 sm:h-9 sm:w-9 shrink-0 -ml-2 text-ink-2 hover:text-ink-1")}
        >
          <ArrowLeft size={18} strokeWidth={1.75} aria-hidden />
        </Link>
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
      </div>
      <FlightForm flight={flight} locale={locale} />
    </div>
  );
}
