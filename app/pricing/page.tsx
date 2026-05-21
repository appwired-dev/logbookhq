import Link from "next/link";
import { startCheckoutFromForm } from "@/app/app/billing/actions";

type Plan = "monthly" | "annual" | "lifetime" | null;
interface Tier {
  name: string; price: string; cadence: string; description: string;
  cta: string; href: string; highlight: boolean; features: string[];
  /** Stripe plan id — null for the Free tier (no checkout). */
  plan: Plan;
}
const TIERS: Tier[] = [
  {
    name: "Free", price: "$0", cadence: "forever",
    description: "Log up to 100 flights. CSV import & export. Basic dashboard.",
    cta: "Start free", href: "/signup", highlight: false, plan: null,
    features: [
      "Up to 100 flights",
      "Single regime (you pick)",
      "Dashboard + CSV export",
      "Local-only — no cloud sync",
    ],
  },
  {
    name: "Pro Monthly", price: "$3", cadence: "/ month",
    description: "Unlimited flights. PDF export. Charts. Cloud sync. Multi-regime.",
    cta: "Go Pro", href: "/signup?plan=monthly", highlight: false, plan: "monthly",
    features: [
      "Unlimited flights",
      "All regimes (CA, ICAO, FAA, EASA)",
      "PDF export (18-col layout)",
      "Charts & analytics",
      "Cloud sync across devices",
      "Currency tracking per regime",
    ],
  },
  {
    name: "Pro Annual", price: "$30", cadence: "/ year",
    description: "Everything in Pro, billed yearly. Two months free.",
    cta: "Go Annual", href: "/signup?plan=annual", highlight: true, plan: "annual",
    features: [
      "Everything in Pro Monthly",
      "Save 17% vs monthly",
      "Priority email support",
    ],
  },
  {
    name: "Lifetime", price: "$119", cadence: "once",
    description: "Pay once. Yours forever. The clean exit from subscription fatigue.",
    cta: "Buy lifetime", href: "/signup?plan=lifetime", highlight: false, plan: "lifetime",
    features: [
      "Everything in Pro, forever",
      "All future regime additions",
      "No recurring charges",
      "Founding-member badge",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-cyan flex items-center justify-center">
            <PlaneIcon />
          </div>
          <div className="font-bold text-slate-900 text-[15px] tracking-tight">
            Pilot Logbook <span className="text-sky-600">HQ</span>
          </div>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link className="text-slate-700 hover:text-slate-900 font-medium" href="/login">Sign in</Link>
          <Link className="btn btn-primary" href="/signup">Start free</Link>
        </nav>
      </header>

      <main className="flex-1 px-6 pb-16">
        <div className="mx-auto max-w-6xl py-12">
          <div className="text-center mb-12 animate-fade-up">
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">Simple pricing</h1>
            <p className="mt-3 text-slate-600 text-lg">Start free. Upgrade when you outgrow it. Cancel anytime.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {TIERS.map((t) => (
              <div
                key={t.name}
                className={`card p-6 flex flex-col animate-fade-up ${
                  t.highlight ? "ring-2 ring-sky-400 shadow-[0_0_40px_rgba(56,189,248,0.35)]" : ""
                }`}
              >
                {t.highlight && (
                  <div className="text-[10px] font-bold uppercase tracking-widest text-sky-600 mb-1">
                    Most popular
                  </div>
                )}
                <div className="text-lg font-bold text-slate-900">{t.name}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-slate-900">{t.price}</span>
                  <span className="text-sm text-slate-500">{t.cadence}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{t.description}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700 flex-1">
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {t.plan ? (
                  <form action={startCheckoutFromForm} className="mt-6">
                    <input type="hidden" name="plan" value={t.plan} />
                    <button
                      type="submit"
                      className={`${t.highlight ? "btn btn-primary" : "btn"} w-full justify-center`}
                    >
                      {t.cta}
                    </button>
                  </form>
                ) : (
                  <Link
                    className={`mt-6 ${t.highlight ? "btn btn-primary" : "btn"} w-full justify-center`}
                    href={t.href}
                  >
                    {t.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>

          <p className="text-center mt-8 text-xs text-slate-500">
            Stripe billing · Cancel anytime · 30-day refund on annual & lifetime
          </p>
        </div>
      </main>

      <footer className="px-6 py-6 text-center text-xs text-slate-500 border-t border-slate-200/60">
        © Pilot Logbook HQ ·{" "}
        <Link className="hover:text-slate-700" href="/pricing">Pricing</Link> ·{" "}
        <Link className="hover:text-slate-700" href="/terms">Terms</Link> ·{" "}
        <Link className="hover:text-slate-700" href="/privacy">Privacy</Link>
      </footer>
    </div>
  );
}

function PlaneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  );
}
