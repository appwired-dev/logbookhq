import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { fetchAllFlights } from "@/lib/fetch-flights";
import { openBillingPortal } from "@/app/app/billing/actions";
import { Card, CardHeader, Icon, Pill, buttonClass } from "@/components/ui";
import type { Locale } from "@/lib/i18n";
import SettingsForm from "./SettingsForm";
import BackupCard from "./BackupCard";
import { settingsStrings } from "./settings-strings";

/** Tier → pill tone (same map as SettingsForm and the admin table). */
const TIER_PILL: Record<string, string> = { free: "neutral", pro: "pic", lifetime: "sic" };

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
    <SettingsForm
      profile={profile!}
      locale={locale}
      billing={<BillingCard tier={profile?.tier ?? "free"} hasStripeCustomer={hasStripeCustomer} locale={locale} />}
      backup={
        <BackupCard
          flights={flights}
          defaultName={profile?.full_name ?? ""}
          defaultLicense={profile?.license_number ?? ""}
          avatarUrl={profile?.avatar_url ?? null}
          locale={locale}
        />
      }
    />
  );
}

/**
 * Billing card — visible to everyone; the CTA depends on whether a Stripe
 * customer exists. Stays a Server Component so the portal redirect runs as
 * a plain form action (no client JS needed).
 */
function BillingCard({ tier, hasStripeCustomer, locale }: { tier: string; hasStripeCustomer: boolean; locale: Locale }) {
  const s = settingsStrings(locale);
  return (
    <Card id="billing" padding="md" className="scroll-mt-20">
      <CardHeader
        title={s("billing")}
        meta={<span className="inline-flex items-center gap-2">{s("currentPlan")} <Pill variant={TIER_PILL[tier] ?? "neutral"}>{tier}</Pill></span>}
      />
      <p className="text-xs text-ink-3">{s("billingHint")}</p>
      <div className="mt-3">
        {hasStripeCustomer ? (
          <form action={openBillingPortal}>
            <button type="submit" className={buttonClass("default", "md", "h-11 sm:h-10")}>
              <Icon.CreditCard size={16} strokeWidth={1.75} aria-hidden />{s("manageBilling")}
            </button>
          </form>
        ) : (
          <Link href="/pricing" className={buttonClass("primary", "md", "h-11 sm:h-10")}>
            {s("upgrade")}<Icon.ArrowRight size={16} strokeWidth={2} aria-hidden />
          </Link>
        )}
      </div>
    </Card>
  );
}
