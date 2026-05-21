import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import type { PilotDocument } from "@/lib/types";
import DocumentsClient from "./DocumentsClient";

export default async function DocumentsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("*")
    .order("expires_on", { ascending: true, nullsFirst: false });
  const locale = await getLocale();
  return <DocumentsClient documents={(data ?? []) as PilotDocument[]} locale={locale} />;
}
