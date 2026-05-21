import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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
    <div className="max-w-xl mx-auto text-center py-16 space-y-5">
      <div className="text-6xl">🎉</div>
      <h1 className="text-3xl font-bold text-slate-900">
        {firstName ? `Welcome to Pro, ${firstName}!` : "Welcome to Pro!"}
      </h1>
      <p className="text-slate-600">
        Payment confirmed. Your account tier updates automatically in a few seconds
        — refresh the dashboard if you don&apos;t see the change immediately.
      </p>
      <p className="text-xs text-slate-500">
        Current tier: <span className="font-mono font-bold">{profile?.tier ?? "free"}</span>
      </p>
      <div className="flex gap-3 justify-center pt-3">
        <Link href="/app" className="btn btn-primary">Go to dashboard</Link>
        <Link href="/app/settings" className="btn">Manage billing</Link>
      </div>
    </div>
  );
}
