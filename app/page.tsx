import Link from "next/link";
import Image, { type StaticImageData } from "next/image";
import CursorGlow from "./CursorGlow";
import dashboardShot from "@/public/marketing/dashboard.png";
import limitsShot from "@/public/marketing/limits.png";
import sankeyShot from "@/public/marketing/sankey.png";
import globeShot from "@/public/marketing/globe.png";
import transferShot from "@/public/marketing/transfer.png";

/**
 * Marketing landing page — instrument-panel dark.
 *
 * Leads with the import: the biggest barrier to switching logbook apps is
 * re-typing years of data, so the hero shows the product reading a real
 * logbook and reconciling it to green checks. The palette and type live in
 * globals.css under `.lp` (self-contained dark theme; the app behind the login
 * stays light). Everything is visible at rest — only the hero rises on load.
 */
export const metadata = {
  title: "Pilot Logbook HQ — bring the logbook you already have",
  description:
    "Import your pilot logbook from any format or language, track currency under every aviation authority you fly, and see your whole career at a glance. Free up to 100 flights.",
};

const FORMATS = ["Apple Numbers", "Excel", "ForeFlight", "LogTen", "MyFlightbook", "CSV"];

export default function LandingPage() {
  return (
    <div className="lp">
      <CursorGlow />
      {/* ---- top bar ---- */}
      <header className="sticky top-0 z-30 backdrop-blur-md" style={{ background: "rgba(10,15,22,0.72)", borderBottom: "1px solid var(--lp-line)" }}>
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Mark />
            <span className="font-semibold tracking-tight text-[15px]">
              Pilot Logbook <span className="lp-amber-text">HQ</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1.5 sm:gap-3 text-sm">
            <Link className="lp-link px-2.5 py-2 hidden sm:inline" href="/pricing">Pricing</Link>
            <Link className="lp-link px-2.5 inline-flex items-center min-h-[44px]" href="/login">Sign in</Link>
            <Link className="lp-btn lp-btn-primary" style={{ padding: "0 16px" }} href="/signup">Start free</Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ---- hero ---- */}
        <section className="mx-auto max-w-6xl px-5 pt-16 sm:pt-24 pb-8">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-10 items-center">
            <div>
              <div className="lp-eyebrow lp-rise" style={{ animationDelay: "0ms" }}>Import · any format · any language</div>
              <h1 className="lp-h1 lp-h1-3d mt-4">
                Bring the logbook<br />you already have.
              </h1>
              <p className="lp-lede mt-5 max-w-xl lp-rise" style={{ animationDelay: "90ms" }}>
                Drop in your spreadsheet, your ForeFlight export, a Numbers file, even columns
                in <span style={{ color: "var(--lp-ink)" }}>a different language</span>. It maps your columns,
                checks the totals against your own, and files thousands of flights in seconds.
                Then your limits and currency follow you across every authority you fly under.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3 lp-rise" style={{ animationDelay: "140ms" }}>
                <Link className="lp-btn lp-btn-primary lp-btn-sheen" href="/signup">Import your logbook free</Link>
                <Link className="lp-btn lp-btn-ghost" href="/pricing">See pricing</Link>
              </div>
              <p className="lp-mono mt-4 text-xs lp-rise" style={{ color: "var(--lp-ink-3)", animationDelay: "180ms" }}>
                Free up to 100 flights · no card · $3/mo after
              </p>
            </div>

            {/* the thesis, made visual: a file → reconciled to green checks */}
            <div className="lp-rise" style={{ animationDelay: "120ms" }}>
              <ReconcileCard />
            </div>
          </div>

          {/* format strip */}
          <div className="mt-14 flex flex-wrap items-center gap-2.5">
            <span className="lp-mono text-xs" style={{ color: "var(--lp-ink-3)" }}>Reads&nbsp;out&nbsp;of&nbsp;the&nbsp;box:</span>
            {FORMATS.map((f) => (
              <span key={f} className="lp-chip">{f}</span>
            ))}
          </div>
        </section>

        {/* ---- product showcase: real captures from the app ---- */}
        <Showcase
          eyebrow="The switch"
          title="Changing logbooks shouldn't mean re-typing your career."
          lede="Every other app assumes you start from zero, or that you fly for the FAA. Drop in the logbook you kept for years — CSV, Excel, ForeFlight, LogTen, a Numbers file — and it detects your columns, then reconciles the import against the totals you already trust before it saves a thing."
          src={transferShot}
          alt="The import and export screen: reads ForeFlight, LogTen, MyFlightbook, Apple Numbers and CSV; exports PDF and CSV."
        />

        <Showcase
          flip
          eyebrow="Your logbook, totalled"
          title="Every hour, added up the way you keep them."
          lede="Total time, PIC, night, cross-country, instrument, multi-engine — each credited to your own convention, augmenting time at 50% if that's how you count. Here: 8,484 hours across 5,334 flights."
          src={dashboardShot}
          alt="The dashboard: stat tiles showing 8,484 total hours, PIC, FO, cross-country and instrument time, each with a 30-day trend."
        />

        <Showcase
          eyebrow="See the whole career"
          title="Every year, into every type, into every seat."
          lede="One flow of your entire logbook — each year into each aircraft into each crew seat, ribbon width in hours. Twenty-five years of flying, read in a single glance."
          src={sankeyShot}
          alt="A Sankey diagram flowing from year (1999 to 2026) to aircraft type to crew role — PIC, FO, dual, SIC — with ribbon width scaled to hours."
        />

        <Showcase
          flip
          dark
          eyebrow="The map"
          title="Every route you've flown, on a living globe."
          lede="Spun up from the airports in your own logbook — 147 routes across 97 airports here — with your busiest legs ranked beside it. Drag to spin, scroll to zoom."
          src={globeShot}
          alt="An interactive 3D globe of flown routes over North America, arcs weighted by number of flights, with a top-routes panel."
        />

        <Showcase
          eyebrow="Every authority"
          title="Your limits and currency follow you."
          lede="Rolling flight-time limits and recency under the rules you actually fly — CAR 700.28 here, or FAR 117, ORO.FTL and more — each window green until it isn't."
          src={limitsShot}
          alt="Flight-time-limit bars for the last 365, 90 and 28 days, a calendar heatmap of flying days, and IFR and passenger recency cards, all showing current."
        />

        {/* ---- feature narrative (the rest of the panel) ---- */}
        <section className="mx-auto max-w-6xl px-5 pt-8 pb-10">
          <div className="lp-eyebrow" style={{ color: "var(--lp-amber)" }}>And the rest of the panel</div>
          <h2 className="lp-h2 mt-2" style={{ fontSize: "clamp(24px,3.4vw,34px)" }}>The details that keep you legal and fast.</h2>
          <div className="mt-7 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Feature
              eyebrow="Find it fast"
              title="Search thousands of flights"
              body="Type a tail number, an airport, a name. Thousands of flights narrow to the ones you meant, on the keystroke."
            >
              <SearchMotif />
            </Feature>

            <Feature
              eyebrow="Stay current"
              title="Documents that warn you early"
              body="Medical, ratings, passport, recurrent checks — each with the date that matters, flagged amber before it lapses."
            >
              <DocMotif />
            </Feature>

            <Feature
              eyebrow="Your language"
              title="Built for pilots everywhere"
              body="The whole app in English, Korean, Chinese or Spanish — because the pilots other logbooks ignore don't all read English."
            >
              <div className="flex flex-wrap gap-2 pt-1">
                {["English", "한국어", "中文", "Español"].map((l) => (
                  <span key={l} className="lp-chip" style={{ borderColor: "var(--lp-line-2)" }}>{l}</span>
                ))}
              </div>
            </Feature>
          </div>
        </section>

        {/* ---- pricing ---- */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="text-center">
            <div className="lp-eyebrow">Pricing</div>
            <h2 className="lp-h2 mt-3">Start free. Pay once you&apos;ve moved in.</h2>
          </div>
          <div className="mt-9 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <PriceTile name="Free" price="$0" unit="forever" note="Up to 100 flights" />
            <PriceTile name="Monthly" price="$3" unit="/ month" note="Unlimited flights" />
            <PriceTile name="Annual" price="$30" unit="/ year" note="Two months off" />
            <PriceTile name="Lifetime" price="$119" unit="once" note="Pay once, keep forever" featured />
          </div>
          <p className="text-center mt-6 lp-mono text-xs" style={{ color: "var(--lp-ink-3)" }}>
            No card to start · cancel anytime · <Link className="lp-cyan-text hover:underline" href="/pricing">full pricing →</Link>
          </p>
        </section>

        {/* ---- founder ---- */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="lp-panel p-7 sm:p-9 flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="shrink-0">
              <div className="lp-num text-xs" style={{ color: "var(--lp-ink-3)" }}>PIC · CYVR</div>
              <div className="lp-h2 mt-1" style={{ fontSize: "clamp(22px,3vw,30px)" }}>Built by a working pilot</div>
            </div>
            <p className="lp-lede sm:border-l sm:pl-6" style={{ borderColor: "var(--lp-line)" }}>
              I fly the line out of Vancouver. I built this because the logbooks I could buy treated
              Canadian and international pilots as an afterthought, and the free ones looked a decade old.
              It&apos;s the same tool I use to track my own hours — 5,200 flights and counting.
            </p>
          </div>
        </section>

        {/* ---- final CTA ---- */}
        <section className="mx-auto max-w-3xl px-5 pb-24 pt-6 text-center">
          <h2 className="lp-h2">Bring your logbook.<br /><span className="lp-amber-text">We&apos;ll read every column.</span></h2>
          <div className="mt-7 flex justify-center">
            <Link className="lp-btn lp-btn-primary lp-btn-sheen" style={{ height: 52, padding: "0 28px", fontSize: 16 }} href="/signup">
              Import your logbook free
            </Link>
          </div>
          <p className="lp-mono mt-4 text-xs" style={{ color: "var(--lp-ink-3)" }}>Free up to 100 flights · no card required</p>
        </section>
      </main>

      <footer className="lp-hairline">
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ color: "var(--lp-ink-3)" }}>
          <span>© Pilot Logbook HQ · a multi-regime pilot logbook</span>
          <nav className="flex items-center gap-3 sm:gap-4">
            <Link className="lp-link inline-flex items-center min-h-[44px]" href="/pricing">Pricing</Link>
            <Link className="lp-link inline-flex items-center min-h-[44px]" href="/terms">Terms</Link>
            <Link className="lp-link inline-flex items-center min-h-[44px]" href="/privacy">Privacy</Link>
            <Link className="lp-link inline-flex items-center min-h-[44px]" href="/login">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Hero visual — the import moment
   --------------------------------------------------------------------------- */
function ReconcileCard() {
  const checks: [string, string][] = [
    ["Total time", "8,484.0 h"],
    ["Multi-engine", "6,281.2 h"],
    ["Night", "2,294.4 h"],
    ["Cross-country", "verified"],
    ["IFR approaches", "1,464"],
  ];
  return (
    <div className="lp-panel lp-panel-glow p-5 sm:p-6" role="img" aria-label="An imported logbook reconciled: every check green, 5,334 flights.">
      {/* file chip */}
      <div className="flex items-center gap-3">
        <div className="grid place-items-center rounded-lg shrink-0" style={{ width: 38, height: 38, background: "rgba(86,199,222,.10)", border: "1px solid var(--lp-line-2)" }}>
          <FileGlyph />
        </div>
        <div className="min-w-0">
          <div className="lp-mono text-sm truncate" style={{ color: "var(--lp-ink)" }}>Michael&nbsp;Logbook.numbers</div>
          <div className="lp-mono text-xs" style={{ color: "var(--lp-ink-3)" }}>Apple Numbers · 3-header layout</div>
        </div>
        <span className="lp-chip ml-auto shrink-0" style={{ borderColor: "rgba(58,210,154,.4)", color: "var(--lp-good)" }}>
          <span className="lp-dot lp-dot-live" /> Recognised
        </span>
      </div>

      {/* checks — reconcile runs live on load: a scan sweep, then each row lands */}
      <div className="mt-5 rounded-xl p-4 relative overflow-hidden" style={{ background: "rgba(0,0,0,.25)", border: "1px solid var(--lp-line)" }}>
        <span className="lp-scan" aria-hidden />
        <div className="flex items-center justify-between">
          <span className="lp-mono text-xs" style={{ color: "var(--lp-ink-3)" }}>RECONCILE</span>
          <span className="lp-mono text-xs" style={{ color: "var(--lp-ink-3)" }}>vs. your sheet</span>
        </div>
        <div className="mt-2 lp-reconcile">
          {checks.map(([label, val]) => (
            <div className="lp-check-row" key={label}>
              <CheckGlyph />
              <span className="text-sm" style={{ color: "var(--lp-ink)" }}>{label}</span>
              <span className="lp-num text-sm" style={{ color: "var(--lp-ink-2)" }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* footer stat */}
      <div className="mt-4 flex items-baseline gap-2">
        <span className="lp-num" style={{ fontSize: 30, fontFamily: "var(--lp-display)", fontWeight: 700, color: "var(--lp-ink)" }}>5,334</span>
        <span className="text-sm" style={{ color: "var(--lp-ink-2)" }}>flights ready to import</span>
        <span className="lp-mono ml-auto text-xs" style={{ color: "var(--lp-good)" }}>every check green</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Feature card + motifs (CSS/SVG, no image assets)
   --------------------------------------------------------------------------- */
function Feature({ eyebrow, title, body, children }: { eyebrow: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="lp-panel p-6 flex flex-col">
      <div className="lp-eyebrow" style={{ color: "var(--lp-amber)" }}>{eyebrow}</div>
      <h3 className="mt-2 text-lg font-semibold" style={{ color: "var(--lp-ink)" }}>{title}</h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--lp-ink-2)" }}>{body}</p>
      <div className="mt-5 pt-4 lp-hairline">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Product showcase — real app captures as compact tiles beside the copy,
   sides alternating down the page. No browser chrome.
   --------------------------------------------------------------------------- */
function Showcase({ eyebrow, title, lede, src, alt, dark = false, flip = false }: {
  eyebrow: string; title: string; lede: string; src: StaticImageData; alt: string; dark?: boolean; flip?: boolean;
}) {
  const text = (
    <div key="t">
      <div className="lp-eyebrow" style={{ color: "var(--lp-amber)" }}>{eyebrow}</div>
      <h2 className="lp-h2 mt-2" style={{ fontSize: "clamp(20px,2.6vw,27px)" }}>{title}</h2>
      <p className="lp-lede mt-3" style={{ fontSize: 14 }}>{lede}</p>
    </div>
  );
  const shot = (
    <figure key="s" className={`lp-shot${dark ? " lp-shot-frame-dark" : ""}`}>
      <Image src={src} alt={alt} sizes="(max-width: 1024px) 100vw, 880px" placeholder="blur" className="lp-shot-img" />
    </figure>
  );
  // The tile always takes the wider column (~62%); copy the narrower.
  const cols = flip
    ? "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]"
    : "lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]";
  return (
    <section className="mx-auto max-w-6xl px-5 py-8">
      <div className={`grid gap-8 lg:gap-12 items-center ${cols}`}>
        {flip ? [shot, text] : [text, shot]}
      </div>
    </section>
  );
}

function SearchMotif() {
  return (
    <div>
      <div className="flex items-center gap-2 rounded-lg px-3 h-9" style={{ background: "rgba(0,0,0,.25)", border: "1px solid var(--lp-line-2)" }}>
        <SearchGlyph />
        <span className="lp-mono text-sm" style={{ color: "var(--lp-ink)" }}>CYVR</span>
        <span style={{ width: 1, height: 14, background: "var(--lp-cyan)" }} />
        <span className="lp-mono text-xs ml-auto" style={{ color: "var(--lp-ink-3)" }}>128 flights</span>
      </div>
      <div className="mt-2.5 space-y-1.5">
        {["CYVR → CYYZ", "CYVR → KSEA", "CYVR → CYUL"].map((r) => (
          <div key={r} className="lp-mono text-xs flex justify-between" style={{ color: "var(--lp-ink-2)" }}>
            <span>{r}</span><span style={{ color: "var(--lp-ink-3)" }}>ME · PIC</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocMotif() {
  const docs: [string, string, string][] = [
    ["Medical", "expires 24 d", "amber"],
    ["IFR renewal", "current", "good"],
    ["Passport", "valid", "good"],
  ];
  return (
    <div className="space-y-2">
      {docs.map(([name, status, tone]) => (
        <div key={name} className="flex items-center justify-between text-sm">
          <span style={{ color: "var(--lp-ink)" }}>{name}</span>
          <span
            className="lp-mono text-xs px-2 py-0.5 rounded-full"
            style={
              tone === "amber"
                ? { color: "var(--lp-amber)", background: "rgba(240,166,46,.12)", border: "1px solid rgba(240,166,46,.35)" }
                : { color: "var(--lp-good)", background: "rgba(58,210,154,.10)", border: "1px solid rgba(58,210,154,.3)" }
            }
          >
            {status}
          </span>
        </div>
      ))}
    </div>
  );
}

function PriceTile({ name, price, unit, note, featured = false }: { name: string; price: string; unit: string; note: string; featured?: boolean }) {
  return (
    <div
      className="lp-panel p-5"
      style={featured ? { borderColor: "rgba(240,166,46,.5)", boxShadow: "0 0 0 1px rgba(240,166,46,.25), 0 20px 50px -25px rgba(240,166,46,.4)" } : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="lp-mono text-xs uppercase tracking-widest" style={{ color: featured ? "var(--lp-amber)" : "var(--lp-ink-3)" }}>{name}</span>
        {featured && <span className="lp-dot" style={{ background: "var(--lp-amber)", boxShadow: "0 0 8px var(--lp-amber)" }} />}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span style={{ fontFamily: "var(--lp-display)", fontWeight: 700, fontSize: 40, lineHeight: 1, color: "var(--lp-ink)" }}>{price}</span>
        <span className="lp-mono text-xs" style={{ color: "var(--lp-ink-3)" }}>{unit}</span>
      </div>
      <div className="mt-2 text-sm" style={{ color: "var(--lp-ink-2)" }}>{note}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Glyphs
   --------------------------------------------------------------------------- */
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lp-good)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function FileGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lp-cyan)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" />
    </svg>
  );
}
function SearchGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--lp-ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}
