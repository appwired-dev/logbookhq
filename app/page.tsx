import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-cyan flex items-center justify-center">
            <PlaneIcon />
          </div>
          <div className="font-bold text-slate-900 text-[15px] tracking-tight">
            Pilot Logbook <span className="text-sky-600">HQ</span>
          </div>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link className="text-slate-700 hover:text-slate-900 px-2" href="/pricing">Pricing</Link>
          <Link className="text-slate-700 hover:text-slate-900 px-2" href="/login">Sign in</Link>
          <Link className="btn btn-primary" href="/signup">Start free</Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero — dark gradient, text only (visuals moved down below the feature grid) */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-800">
          <div className="max-w-5xl mx-auto px-6 py-24 sm:py-32 text-center relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-100 border border-sky-300/40 mb-6 animate-fade-up backdrop-blur-sm">
              <span className="w-1.5 h-1.5 bg-sky-300 rounded-full animate-pulse" />
              For pilots under any aviation authority
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold text-white tracking-tight leading-[1.05] animate-fade-up">
              The multi-regime<br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-200 to-violet-200">
                pilot logbook.
              </span>
            </h1>
            <p className="mt-6 text-lg text-sky-50/90 max-w-2xl mx-auto animate-fade-up">
              Log every flight once. Track currency under <strong>Transport Canada,
              FAA, EASA, ICAO, UKCAA</strong> and five more authorities. Export
              ATPL-quality PDFs for the hiring office. Designed and maintained by
              an active line pilot.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3 animate-fade-up">
              <Link className="btn btn-primary text-base px-6 py-3" href="/signup">Start free</Link>
              <Link className="btn text-base px-6 py-3" href="/pricing">See pricing</Link>
            </div>
            <p className="mt-4 text-xs text-sky-100/80">
              $3/mo · $30/yr · $119 lifetime · 100 flights free, no card required
            </p>
          </div>
        </section>

        {/* Differentiators */}
        <section className="max-w-5xl mx-auto px-6 py-16 grid sm:grid-cols-3 gap-4">
          <Feature
            badge="Multi-regime"
            title="CA · ICAO · FAA · EASA"
            body="Switch jurisdictions in Settings — currency rules and PDF layouts adapt. Every existing logbook treats you as American; we don't."
          />
          <Feature
            badge="Currency that works"
            title="700.15 · Part 117 · Annex 6"
            body="Flight-time rolling windows on the dashboard, color-coded as you approach the cap. Set it once, glance at it daily."
          />
          <Feature
            badge="Real PDFs"
            title="ATPL-quality export"
            body="18-column traditional layout, cover page, signature line, page subtotals. Hand it to an interviewer; they won't blink."
          />
        </section>

        {/* Atmospheric image stack: faded airplane above, runway sunset blending
            up into the page's slate gradient. The "Built by a working pilot"
            copy sits on top, anchored. */}
        <section className="relative overflow-hidden">
          {/* Airplane (subtle, atmospheric) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/widebody-takeoff.png"
            alt=""
            className="w-[90%] max-w-[806px] mx-auto block pointer-events-none"
            style={{ opacity: 0.35 }}
            aria-hidden
          />
          {/* Runway sunset — top edge fades to transparent so it dissolves into
              the slate body gradient instead of cutting hard. */}
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/runway-sunset.png"
              alt=""
              className="w-full block pointer-events-none -mt-6 sm:-mt-12"
              style={{ WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 35%)", maskImage: "linear-gradient(to bottom, transparent 0%, black 35%)" }}
              aria-hidden
            />
            {/* "Built by a working pilot" copy floats over the sunset/sky area */}
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-[14%] px-6 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3 drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">Built by a working pilot</h2>
              <p className="text-sky-50/90 max-w-2xl drop-shadow-[0_1px_8px_rgba(0,0,0,0.75)]">
                I fly the EA32 out of CYVR. I built Pilot Logbook HQ because I was tired of
                $90/year apps that ignore Canadian regs, and free apps that look like
                they&apos;re from 2007. Same toolset I use to track my own hours.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="card p-8 bg-gradient-aviation text-white border-white/10 shadow-[0_0_60px_rgba(56,189,248,0.30)]">
            <h2 className="text-2xl font-bold tracking-tight">Try it free, no card</h2>
            <p className="mt-2 text-sky-100/80">100 flights free. Upgrade when you outgrow it. Cancel anytime.</p>
            <Link className="btn bg-white text-slate-900 hover:bg-slate-100 mt-6 text-base px-6 py-3" href="/signup">
              Start free →
            </Link>
          </div>
        </section>
      </main>

      <footer className="px-6 py-6 text-center text-xs text-slate-500 border-t border-slate-200/60">
        © Pilot Logbook HQ · Multi-regime pilot logbook ·{" "}
        <Link className="hover:text-slate-700" href="/pricing">Pricing</Link> ·{" "}
        <Link className="hover:text-slate-700" href="/terms">Terms</Link> ·{" "}
        <Link className="hover:text-slate-700" href="/privacy">Privacy</Link>
      </footer>
    </div>
  );
}

function Feature({ badge, title, body }: { badge: string; title: string; body: string }) {
  return (
    <div className="card p-5 animate-fade-up">
      <div className="text-[10px] font-bold uppercase tracking-widest text-sky-600 mb-1">{badge}</div>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600 mt-2 leading-relaxed">{body}</p>
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
