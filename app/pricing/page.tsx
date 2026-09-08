import Link from "next/link";
import { startCheckoutFromForm } from "@/app/app/billing/actions";

/**
 * Pricing — the storefront's second page, same instrument-panel dark skin as
 * the landing. Tiers, Stripe checkout wiring and the free-vs-paid CTA split
 * are unchanged; only the presentation moved onto the `.lp` theme.
 */
export const metadata = {
  title: "Pricing — Pilot Logbook HQ",
  description: "Free up to 100 flights, then $3/mo, $30/yr, or $119 once for lifetime. Cancel anytime.",
};

type Plan = "monthly" | "annual" | "lifetime" | null;
interface Tier {
  name: string; price: string; cadence: string; description: string;
  cta: string; href: string; highlight: boolean; features: string[];
  plan: Plan;
}
const TIERS: Tier[] = [
  {
    name: "Free", price: "$0", cadence: "forever",
    description: "Log up to 100 flights. Import & export. The full dashboard.",
    cta: "Start free", href: "/signup", highlight: false, plan: null,
    features: ["Up to 100 flights", "One authority (you pick)", "Import any layout · CSV export", "The full dashboard"],
  },
  {
    name: "Monthly", price: "$3", cadence: "/ month",
    description: "Unlimited flights, every authority, PDF export, the charts.",
    cta: "Go Pro", href: "/signup?plan=monthly", highlight: false, plan: "monthly",
    features: ["Unlimited flights", "Every authority (CA · FAA · EASA · more)", "PDF export (18-column layout)", "Charts, Sankey & globe", "Cloud sync across devices", "Currency tracking per authority"],
  },
  {
    name: "Annual", price: "$30", cadence: "/ year",
    description: "Everything in Pro, billed yearly. Two months free.",
    cta: "Go Annual", href: "/signup?plan=annual", highlight: true, plan: "annual",
    features: ["Everything in Monthly", "Two months free vs. monthly", "Priority email support"],
  },
  {
    name: "Lifetime", price: "$119", cadence: "once",
    description: "Pay once. Yours forever. The clean exit from subscriptions.",
    cta: "Buy lifetime", href: "/signup?plan=lifetime", highlight: false, plan: "lifetime",
    features: ["Everything in Pro, forever", "All future authorities included", "No recurring charges", "Founding-member badge"],
  },
];

export default function PricingPage() {
  return (
    <div className="lp">
      <header className="sticky top-0 z-30 backdrop-blur-md" style={{ background: "rgba(10,15,22,0.72)", borderBottom: "1px solid var(--lp-line)" }}>
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Mark />
            <span className="font-semibold tracking-tight text-[15px]">Pilot Logbook <span className="lp-amber-text">HQ</span></span>
          </Link>
          <nav className="flex items-center gap-1.5 sm:gap-3 text-sm">
            <Link className="lp-link px-2.5 py-2" href="/login">Sign in</Link>
            <Link className="lp-btn lp-btn-primary" style={{ height: 40, padding: "0 16px" }} href="/signup">Start free</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pt-16 sm:pt-20 pb-4 text-center">
          <div className="lp-eyebrow">Pricing</div>
          <h1 className="lp-h1 mt-4" style={{ fontSize: "clamp(36px,6vw,64px)" }}>Start free.<br />Pay once you&apos;ve moved in.</h1>
          <p className="lp-lede mt-5 max-w-xl mx-auto">
            Import your logbook and run the whole app on the free tier. Upgrade only when you cross 100 flights.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {TIERS.map((t) => (
              <div
                key={t.name}
                className="lp-panel p-6 flex flex-col"
                style={t.highlight ? { borderColor: "rgba(240,166,46,.5)", boxShadow: "0 0 0 1px rgba(240,166,46,.25), 0 24px 60px -30px rgba(240,166,46,.4)" } : undefined}
              >
                <div className="flex items-center justify-between">
                  <span className="lp-mono text-xs uppercase tracking-widest" style={{ color: t.highlight ? "var(--lp-amber)" : "var(--lp-ink-3)" }}>{t.name}</span>
                  {t.highlight && <span className="lp-chip" style={{ borderColor: "rgba(240,166,46,.4)", color: "var(--lp-amber)" }}>Most popular</span>}
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span style={{ fontFamily: "var(--lp-display)", fontWeight: 700, fontSize: 44, lineHeight: 1, color: "var(--lp-ink)" }}>{t.price}</span>
                  <span className="lp-mono text-xs" style={{ color: "var(--lp-ink-3)" }}>{t.cadence}</span>
                </div>
                <p className="mt-2 text-sm" style={{ color: "var(--lp-ink-2)" }}>{t.description}</p>
                <ul className="mt-5 space-y-2.5 text-sm flex-1">
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-2.5" style={{ color: "var(--lp-ink-2)" }}>
                      <span className="shrink-0 mt-0.5"><CheckGlyph /></span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {t.plan ? (
                  <form action={startCheckoutFromForm} className="mt-6">
                    <input type="hidden" name="plan" value={t.plan} />
                    <button type="submit" className={`lp-btn w-full ${t.highlight ? "lp-btn-primary" : "lp-btn-ghost"}`}>{t.cta}</button>
                  </form>
                ) : (
                  <Link className={`lp-btn w-full mt-6 ${t.highlight ? "lp-btn-primary" : "lp-btn-ghost"}`} href={t.href}>{t.cta}</Link>
                )}
              </div>
            ))}
          </div>

          <p className="text-center mt-8 lp-mono text-xs" style={{ color: "var(--lp-ink-3)" }}>
            Stripe billing · cancel anytime · 30-day refund on annual &amp; lifetime
          </p>
        </section>
      </main>

      <footer className="lp-hairline">
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ color: "var(--lp-ink-3)" }}>
          <span>© Pilot Logbook HQ · a multi-regime pilot logbook</span>
          <nav className="flex items-center gap-4">
            <Link className="lp-link" href="/">Home</Link>
            <Link className="lp-link" href="/terms">Terms</Link>
            <Link className="lp-link" href="/privacy">Privacy</Link>
            <Link className="lp-link" href="/login">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Mark() {
  return (
    <span className="grid place-items-center rounded-lg" style={{ width: 32, height: 32, background: "linear-gradient(180deg,#12324a,#0b1f3a)", border: "1px solid var(--lp-line-2)" }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--lp-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    </span>
  );
}
function CheckGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--lp-good)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
