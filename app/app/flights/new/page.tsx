import Link from "next/link";
// ArrowLeft isn't in components/ui/icons.ts yet (read-only for this pass) — import it directly for now.
import { ArrowLeft } from "@/components/ui/icons";
import FlightForm from "../FlightForm";
import { formStrings } from "../form-strings";
import { getLocale } from "@/lib/i18n-server";
import { PageHeader, buttonClass } from "@/components/ui";

export default async function NewFlightPage() {
  const locale = await getLocale();
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
        <PageHeader className="min-w-0 flex-1" title={s("newFlight")} subtitle={s("newFlightDesc")} />
      </div>
      <FlightForm locale={locale} />
    </div>
  );
}
