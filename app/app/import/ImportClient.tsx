import type { Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import ImportWizard from "./ImportWizard";

/**
 * Compatibility wrapper — app/app/transfer/page.tsx still renders
 * `<ImportClient locale={locale} />`. Now a Server Component that loads the
 * one profile flag the wizard needs and defers to ImportWizard.
 *
 * @deprecated Render `ImportWizard` directly (see app/app/import/page.tsx)
 * and delete this file once the transfer page is migrated.
 */
export default async function ImportClient({ locale }: { locale: Locale }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let augHalfCredit = false;
  if (user) {
    const { data } = await supabase.from("profiles").select("aug_half_credit").eq("id", user.id).maybeSingle();
    augHalfCredit = Boolean(data?.aug_half_credit);
  }
  return <ImportWizard locale={locale} augHalfCredit={augHalfCredit} />;
}
