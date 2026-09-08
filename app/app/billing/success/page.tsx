import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { EmptyState, Icon, Pill, buttonClass } from "@/components/ui";
import { settingsStrings } from "@/app/app/settings/settings-strings";

const TIER_PILL: Record<string, string> = { free: "neutral", pro: "pic", lifetime: "sic" };

/**
 * Landing page after a successful Stripe Checkout. The webhook is the
 * source of truth for tier promotion (eventually-consistent — usually
 * within a few seconds); this page just shows a friendly "thanks" while
 * that happens.
 */
export default async function BillingSuccessPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("tier, full_name").eq("id", user.id).single()
    : { data: null };
  const firstName = (profile?.full_name ?? "").split(" ")[0];
  const tier = profile?.tier ?? "free";
  const locale = await getLocale();
  const s = settingsStrings(locale);

  return (
    <div className="max-w-xl mx-auto py-10 sm:py-16">
      <EmptyState
        headingLevel={1}
        icon={Icon.CircleCheck}
        title={firstName ? s("successTitle", { name: firstName }) : s("successTitleNoName")}
        body={<>
          {s("successBody")}
          <span className="mt-3 flex items-center justify-center gap-2 text-xs text-ink-3">
            {s("currentTier")} <Pill variant={TIER_PILL[tier] ?? "neutral"}>{tier}</Pill>
          </span>
        </>}
        primary={
          <Link href="/app" className={buttonClass("primary", "md", "h-11 sm:h-10")}>
            {s("goDashboard")}<Icon.ArrowRight size={16} strokeWidth={2} aria-hidden />
          </Link>
        }
        secondary={
          <Link href="/app/settings#billing" className={buttonClass("default", "md", "h-11 sm:h-10")}>
            <Icon.CreditCard size={16} strokeWidth={1.75} aria-hidden />{s("manageBilling")}
          </Link>
        }
      />
    </div>
  );
}
