import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { fetchAllFlights } from "@/lib/fetch-flights";
import { openBillingPortal } from "@/app/app/billing/actions";
import { stripe } from "@/lib/stripe";
import { Card, CardHeader, Icon, Pill, buttonClass } from "@/components/ui";
import type { Locale } from "@/lib/i18n";
import SettingsForm from "./SettingsForm";
import BackupCard from "./BackupCard";
import SupportCard from "./SupportCard";
import AccountSecurityCard from "./AccountSecurityCard";

/** One past payment, flattened from a Stripe charge for the billing card. */
type Receipt = { id: string; created: number; amount: number; currency: string; status: string; url: string | null };

/** Recent payments for the billing history — Stripe charges cover both
 *  subscriptions and the one-time lifetime purchase. Fails soft (empty list)
 *  if Stripe is unreachable or unconfigured, so Settings still renders. */
async function fetchReceipts(customerId: string | null | undefined): Promise<Receipt[]> {
  if (!customerId) return [];
  try {
    const list = await stripe.charges.list({ customer: customerId, limit: 10 });
    return list.data.map((c) => ({
      id: c.id, created: c.created, amount: c.amount, currency: c.currency, status: c.status,
      url: c.receipt_url ?? null,
    }));
  } catch {
    return [];
  }
}
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
  const receipts = await fetchReceipts(profile?.stripe_customer_id);

  return (
    <SettingsForm
      profile={profile!}
      locale={locale}
      security={<AccountSecurityCard currentEmail={profile?.email ?? user!.email ?? ""} locale={locale} />}
      billing={<BillingCard tier={profile?.tier ?? "free"} hasStripeCustomer={hasStripeCustomer} receipts={receipts} locale={locale} />}
      backup={
        <BackupCard
          flights={flights}
          defaultName={profile?.full_name ?? ""}
          defaultLicense={profile?.license_number ?? ""}
          avatarUrl={profile?.avatar_url ?? null}
          locale={locale}
        />
      }
      support={<SupportCard locale={locale} />}
    />
  );
}

/**
 * Billing card — visible to everyone; the CTA depends on whether a Stripe
 * customer exists. Stays a Server Component so the portal redirect runs as
 * a plain form action (no client JS needed).
 */
const HISTORY_T: Record<Locale, { title: string; receipt: string; empty: string }> = {
  en: { title: "Payment history", receipt: "Receipt", empty: "No payments yet." },
  ko: { title: "결제 내역", receipt: "영수증", empty: "아직 결제 내역이 없습니다." },
  zh: { title: "付款记录", receipt: "收据", empty: "暂无付款记录。" },
  es: { title: "Historial de pagos", receipt: "Recibo", empty: "Aún no hay pagos." },
};

function BillingCard({ tier, hasStripeCustomer, receipts, locale }: {
  tier: string; hasStripeCustomer: boolean; receipts: Receipt[]; locale: Locale;
}) {
  const s = settingsStrings(locale);
  const h = HISTORY_T[locale] ?? HISTORY_T.en;
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
  const day = (unix: number) =>
    new Date(unix * 1000).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });

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

      {hasStripeCustomer && (
        <div className="mt-5 pt-4 border-t border-border">
          <h3 className="text-2xs font-semibold uppercase tracking-[0.08em] text-ink-2">{h.title}</h3>
          {receipts.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">{h.empty}</p>
          ) : (
            <ul className="mt-2 divide-y divide-border/60">
              {receipts.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-ink-2 tabular-nums">{day(r.created)}</span>
                  <span className="num font-medium text-ink-1">{money(r.amount, r.currency)}</span>
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-[44px] sm:min-h-0 text-brand hover:underline shrink-0">
                      {h.receipt}
                    </a>
                  ) : (
                    <span className="text-ink-3 shrink-0">{r.status}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
