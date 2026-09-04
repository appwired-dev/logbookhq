import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { fetchAllFlights } from "@/lib/fetch-flights";
import { openBillingPortal } from "@/app/app/billing/actions";
import SettingsForm from "./SettingsForm";
import BackupCard from "./BackupCard";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, license_number, primary_regime, tier, is_admin, avatar_url, share_token, stripe_customer_id, aug_half_credit")
    .eq("id", user!.id)
    .single();
  const locale = await getLocale();
  const flights = await fetchAllFlights(supabase, { orderAsc: true });
  const hasStripeCustomer = !!profile?.stripe_customer_id;

  return (
    <div className="space-y-4">
      <SettingsForm profile={profile!} locale={locale} />
      <div className="max-w-2xl space-y-4">
        {/* Billing card — visible to everyone; CTA changes by tier */}
        <div id="billing" className="card p-4 space-y-3 scroll-mt-20">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Billing</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Current plan: <span className="font-mono font-bold uppercase">{profile?.tier ?? "free"}</span>
            </p>
          </div>
          {hasStripeCustomer ? (
            <form action={openBillingPortal}>
              <button type="submit" className="btn">Manage billing →</button>
            </form>
          ) : (
            <Link href="/pricing" className="btn btn-primary inline-flex">Upgrade →</Link>
          )}
        </div>

        <BackupCard
          flights={flights}
          defaultName={profile?.full_name ?? ""}
          defaultLicense={profile?.license_number ?? ""}
          avatarUrl={profile?.avatar_url ?? null}
          locale={locale}
        />
      </div>
    </div>
  );
}
