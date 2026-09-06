import FlightForm from "../FlightForm";
import { formStrings } from "../form-strings";
import { getLocale } from "@/lib/i18n-server";
import { PageHeader } from "@/components/ui";

export default async function NewFlightPage() {
  const locale = await getLocale();
  const s = formStrings(locale);
  // The back link renders inside FlightForm, beside this header, so it can
  // share the form's unsaved-changes prompt.
  return (
    <div className="space-y-4">
      <FlightForm
        locale={locale}
        header={<PageHeader className="min-w-0 flex-1" title={s("newFlight")} subtitle={s("newFlightDesc")} />}
      />
    </div>
  );
}
