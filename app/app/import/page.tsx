import { getLocale } from "@/lib/i18n-server";
import ImportClient from "./ImportClient";

export default async function ImportPage() {
  const locale = await getLocale();
  return <ImportClient locale={locale} />;
}
