import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import ImportWizard from "./ImportWizard";

export default async function ImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // The wizard only needs the aug-half convention (to caption the reconcile
  // suggestion); the layout has already redirected signed-out visitors.
  const { data: profile } = await supabase
    .from("profiles")
    .select("aug_half_credit")
    .eq("id", user!.id)
    .maybeSingle();
  const locale = await getLocale();
  return <ImportWizard locale={locale} augHalfCredit={Boolean(profile?.aug_half_credit)} />;
}
