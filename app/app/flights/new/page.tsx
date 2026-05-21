import FlightForm from "../FlightForm";
import { getLocale } from "@/lib/i18n-server";

export default async function NewFlightPage() {
  const locale = await getLocale();
  return <FlightForm locale={locale} />;
}
