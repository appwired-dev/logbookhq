import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, Icon, buttonClass } from "@/components/ui";

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

  return (
    <div className="max-w-xl mx-auto py-16">
      <EmptyState headingLevel={1}
        icon={Icon.PartyPopper}
        title={firstName ? `Welcome to Pro, ${firstName}!` : "Welcome to Pro!"}
        body={<>
          Payment confirmed. Your account tier updates automatically in a few seconds
          — refresh the dashboard if you don&apos;t see the change immediately.
          <span className="block mt-2 text-xs text-ink-3">
            Current tier: <span className="mono font-semibold text-ink-1">{profile?.tier ?? "free"}</span>
          </span>
        </>}
        primary={<Link href="/app" className={buttonClass("primary")}>Go to dashboard</Link>}
        secondary={<Link href="/app/settings" className={buttonClass()}>Manage billing</Link>}
      />
    </div>
  );
}
