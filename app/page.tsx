import Link from "next/link";

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
            <Link className="lp-link px-2.5 py-2" href="/login">Sign in</Link>
            <Link className="lp-btn lp-btn-primary" style={{ height: 40, padding: "0 16px" }} href="/signup">Start free</Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ---- hero ---- */}
        <section className="mx-auto max-w-6xl px-5 pt-16 sm:pt-24 pb-8">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-10 items-center">
            <div>
              <div className="lp-eyebrow lp-rise" style={{ animationDelay: "0ms" }}>Import · any format · any language</div>
              <h1 className="lp-h1 mt-4 lp-rise" style={{ animationDelay: "40ms" }}>
                Bring the logbook<br />you already have.
              </h1>
              <p className="lp-lede mt-5 max-w-xl lp-rise" style={{ animationDelay: "90ms" }}>
                Drop in your spreadsheet, your ForeFlight export, a Numbers file, even columns
                in <span style={{ color: "var(--lp-ink)" }}>Korean</span>. It maps your columns,
                checks the totals against your own, and files thousands of flights in seconds.
                Then your limits and currency follow you across every authority you fly under.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3 lp-rise" style={{ animationDelay: "140ms" }}>
                <Link className="lp-btn lp-btn-primary" href="/signup">Import your logbook free</Link>
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

        {/* ---- career-flow showcase (the beauty shot) ---- */}
        <section className="mx-auto max-w-6xl px-5 pt-6 pb-4">
          <div className="lp-panel lp-panel-glow p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="lp-eyebrow" style={{ color: "var(--lp-amber)" }}>See the whole career</div>
                <h2 className="lp-h2 mt-2" style={{ fontSize: "clamp(24px,3.4vw,34px)" }}>Every year, into every type, into every seat.</h2>
              </div>
              <p className="lp-mono text-xs" style={{ color: "var(--lp-ink-3)" }}>drawn from your flights · hover for hours</p>
            </div>
            <div className="mt-6 overflow-x-auto">
              <CareerFlow />
            </div>
          </div>
        </section>

        {/* ---- the switch ---- */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="lp-panel p-7 sm:p-9 lp-panel-glow">
            <div className="lp-eyebrow">The switch</div>
            <h2 className="lp-h2 mt-3 max-w-3xl">
              Changing logbooks shouldn&apos;t mean re-typing your career.
            </h2>
            <p className="lp-lede mt-4 max-w-2xl">
              Every other app assumes you start from zero, or that you fly for the FAA. Pilot Logbook HQ
              reads the logbook you kept for years, whatever shape it&apos;s in, reconciles it against the
              totals you already trust, and tells you exactly what it found before it saves a thing.
            </p>
          </div>
        </section>

        {/* ---- feature narrative ---- */}
        <section className="mx-auto max-w-6xl px-5 pb-10">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Feature
              eyebrow="Every authority"
              title="Your limits follow you"
              body="Fly for a Canadian, US, European or Gulf operator and your rolling flight-time limits and currency track the right rules — CAR 700.28, FAR 117, ORO.FTL.210, and more."
            >
              <GaugeMotif />
            </Feature>

            <Feature
              eyebrow="See the career"
              title="Where the hours went"
              body="A single flow of every year into every aircraft into every seat. Ten thousand rows become one picture you can read in a glance."
            >
              <SankeyMotif />
            </Feature>

            <Feature
              eyebrow="The map"
              title="Every route you've flown"
              body="A living globe of your network — every airport, every leg, spun up from the flights you already logged."
            >
              <GlobeMotif />
            </Feature>

            <Feature
              eyebrow="Find it fast"
              title="Search thousands of flights"
              body="Type a tail number, an airport, a name. Three thousand flights narrow to the ones you meant, on the keystroke."
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
              It&apos;s the same tool I use to track my own hours — 2,600 flights and counting.
            </p>
          </div>
        </section>

        {/* ---- final CTA ---- */}
        <section className="mx-auto max-w-3xl px-5 pb-24 pt-6 text-center">
          <h2 className="lp-h2">Bring your logbook.<br /><span className="lp-amber-text">We&apos;ll read every column.</span></h2>
          <div className="mt-7 flex justify-center">
            <Link className="lp-btn lp-btn-primary" style={{ height: 52, padding: "0 28px", fontSize: 16 }} href="/signup">
              Import your logbook free
            </Link>
          </div>
          <p className="lp-mono mt-4 text-xs" style={{ color: "var(--lp-ink-3)" }}>Free up to 100 flights · no card required</p>
        </section>
      </main>

      <footer className="lp-hairline">
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ color: "var(--lp-ink-3)" }}>
          <span>© Pilot Logbook HQ · a multi-regime pilot logbook</span>
          <nav className="flex items-center gap-4">
            <Link className="lp-link" href="/pricing">Pricing</Link>
            <Link className="lp-link" href="/terms">Terms</Link>
            <Link className="lp-link" href="/privacy">Privacy</Link>
            <Link className="lp-link" href="/login">Sign in</Link>
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
    ["Total time", "4,242.0 h"],
    ["Multi-engine", "3,140.6 h"],
    ["Night", "1,147.2 h"],
    ["Cross-country", "verified"],
    ["IFR approaches", "732"],
  ];
  return (
    <div className="lp-panel lp-panel-glow p-5 sm:p-6" role="img" aria-label="An imported logbook reconciled: every check green, 2,672 flights.">
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
          <span className="lp-dot" /> Recognised
        </span>
      </div>

      {/* checks */}
      <div className="mt-5 rounded-xl p-4" style={{ background: "rgba(0,0,0,.25)", border: "1px solid var(--lp-line)" }}>
        <div className="flex items-center justify-between">
          <span className="lp-mono text-xs" style={{ color: "var(--lp-ink-3)" }}>RECONCILE</span>
          <span className="lp-mono text-xs" style={{ color: "var(--lp-ink-3)" }}>vs. your sheet</span>
        </div>
        <div className="mt-2">
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
        <span className="lp-num" style={{ fontSize: 30, fontFamily: "var(--lp-display)", fontWeight: 700, color: "var(--lp-ink)" }}>2,672</span>
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

function GaugeMotif() {
  const rows: [string, number][] = [["365 d", 0.62], ["90 d", 0.44], ["28 d", 0.8]];
  return (
    <div className="space-y-2.5">
      {rows.map(([label, pct]) => (
        <div key={label} className="flex items-center gap-3">
          <span className="lp-mono text-xs w-10 shrink-0" style={{ color: "var(--lp-ink-3)" }}>{label}</span>
          <div className="lp-gauge lp-sweep flex-1">
            <i style={{ width: `${pct * 100}%` }} />
            <span className="lp-gauge-ceiling" style={{ right: "8%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The career-flow beauty shot: a real three-column Sankey (Year → Aircraft →
 * Seat) with proper stacked-ribbon attachment, hand-set to a believable
 * balanced flow. Pure SVG, no data, no library — it's a marketing motif that
 * mirrors the app's own career Sankey.
 */
function CareerFlow() {
  const W = 920, H = 300, PAD_TOP = 30, GAP = 16, UNIT = 1.9, BAR = 9;
  type N = { key: string; label: string; val: number };
  const years: N[] = [
    { key: "2024", label: "2024", val: 52 },
    { key: "2023", label: "2023", val: 44 },
    { key: "2022", label: "2022", val: 30 },
  ];
  const acft: N[] = [
    { key: "A320", label: "A320", val: 64 },
    { key: "B787", label: "B787", val: 34 },
    { key: "C172", label: "C172", val: 28 },
  ];
  const seats: N[] = [
    { key: "PIC", label: "PIC", val: 70 },
    { key: "FO", label: "FO", val: 38 },
    { key: "DUAL", label: "DUAL", val: 18 },
  ];
  // links carry value; attach in list order so ribbons stack within each node.
  const l1: [string, string, number][] = [
    ["2024", "A320", 32], ["2024", "B787", 14], ["2024", "C172", 6],
    ["2023", "A320", 24], ["2023", "B787", 14], ["2023", "C172", 6],
    ["2022", "A320", 8], ["2022", "B787", 6], ["2022", "C172", 16],
  ];
  const l2: [string, string, number][] = [
    ["A320", "PIC", 40], ["A320", "FO", 24],
    ["B787", "PIC", 22], ["B787", "FO", 12],
    ["C172", "PIC", 8], ["C172", "FO", 2], ["C172", "DUAL", 18],
  ];

  const layout = (nodes: N[]) => {
    const m = new Map<string, { y: number; h: number; out: number; in: number }>();
    let y = PAD_TOP;
    for (const n of nodes) { const h = n.val * UNIT; m.set(n.key, { y, h, out: 0, in: 0 }); y += h + GAP; }
    return m;
  };
  const yc = layout(years), ac = layout(acft), sc = layout(seats);
  const X = { year: 150, acftL: 455, acftR: 464, seat: 766 };

  const ribbon = (x0: number, y0: number, w0: number, x1: number, y1: number, w1: number) => {
    const mx = (x0 + x1) / 2;
    return `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1} L${x1},${y1 + w1} C${mx},${y1 + w1} ${mx},${y0 + w0} ${x0},${y0 + w0} Z`;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 640, height: "auto" }} role="img" aria-label="A Sankey flow of flight hours from year to aircraft type to crew seat.">
      <defs>
        <linearGradient id="cf" x1="0" x2="1">
          <stop offset="0" stopColor="var(--lp-cyan)" />
          <stop offset="1" stopColor="var(--lp-amber)" />
        </linearGradient>
      </defs>
      {/* column headers */}
      {[["YEAR", 150], ["AIRCRAFT", 460], ["SEAT", 770]].map(([t, x]) => (
        <text key={t as string} x={x as number} y={16} textAnchor="middle" className="lp-mono" style={{ fill: "var(--lp-ink-3)", fontSize: 11, letterSpacing: "0.12em" }}>{t}</text>
      ))}
      {/* ribbons: year → aircraft */}
      {l1.map(([s, t, v], i) => {
        const S = yc.get(s)!, T = ac.get(t)!;
        const sy = S.y + S.out; S.out += v * UNIT;
        const ty = T.y + T.in; T.in += v * UNIT;
        return <path key={`a${i}`} d={ribbon(X.year + BAR, sy, v * UNIT, X.acftL, ty, v * UNIT)} fill="url(#cf)" fillOpacity={0.4} />;
      })}
      {/* ribbons: aircraft → seat */}
      {l2.map(([s, t, v], i) => {
        const S = ac.get(s)!, T = sc.get(t)!;
        const sy = S.y + S.out; S.out += v * UNIT;
        const ty = T.y + T.in; T.in += v * UNIT;
        return <path key={`b${i}`} d={ribbon(X.acftR, sy, v * UNIT, X.seat, ty, v * UNIT)} fill="url(#cf)" fillOpacity={0.4} />;
      })}
      {/* node bars + labels */}
      {years.map((n) => { const g = yc.get(n.key)!; return (
        <g key={n.key}>
          <rect x={X.year} y={g.y} width={BAR} height={g.h} rx={2} fill="var(--lp-cyan)" />
          <text x={X.year - 8} y={g.y + g.h / 2 + 4} textAnchor="end" className="lp-mono" style={{ fill: "var(--lp-ink-2)", fontSize: 13 }}>{n.label}</text>
        </g>); })}
      {acft.map((n) => { const g = ac.get(n.key)!; return (
        <g key={n.key}>
          <rect x={X.acftL} y={g.y} width={BAR} height={g.h} rx={2} fill="var(--lp-ink-2)" />
          <text x={X.acftR + 8} y={g.y + g.h / 2 + 4} className="lp-mono" style={{ fill: "var(--lp-ink)", fontSize: 13, fontWeight: 600 }}>{n.label}</text>
        </g>); })}
      {seats.map((n) => { const g = sc.get(n.key)!; return (
        <g key={n.key}>
          <rect x={X.seat} y={g.y} width={BAR} height={g.h} rx={2} fill="var(--lp-amber)" />
          <text x={X.seat + BAR + 8} y={g.y + g.h / 2 + 4} className="lp-mono" style={{ fill: "var(--lp-ink-2)", fontSize: 13 }}>{n.label}</text>
        </g>); })}
    </svg>
  );
}

function SankeyMotif() {
  return (
    <svg viewBox="0 0 240 72" className="w-full" style={{ height: 72 }} aria-hidden>
      <defs>
        <linearGradient id="sk" x1="0" x2="1">
          <stop offset="0" stopColor="var(--lp-cyan)" />
          <stop offset="1" stopColor="var(--lp-amber)" />
        </linearGradient>
      </defs>
      {[
        "M8 14 C 90 14 120 20 232 20",
        "M8 30 C 90 30 120 36 232 40",
        "M8 46 C 90 46 120 50 232 30",
        "M8 60 C 90 60 120 56 232 56",
      ].map((d, i) => (
        <path key={i} d={d} fill="none" stroke="url(#sk)" strokeWidth={[9, 6, 5, 4][i]} strokeOpacity={0.55} strokeLinecap="round" />
      ))}
    </svg>
  );
}

function GlobeMotif() {
  return (
    <svg viewBox="0 0 120 72" className="w-full" style={{ height: 72 }} aria-hidden>
      <circle cx="60" cy="40" r="30" fill="none" stroke="var(--lp-line-2)" strokeWidth="1" />
      <ellipse cx="60" cy="40" rx="30" ry="11" fill="none" stroke="var(--lp-line-2)" strokeWidth="1" strokeOpacity="0.6" />
      <ellipse cx="60" cy="40" rx="12" ry="30" fill="none" stroke="var(--lp-line-2)" strokeWidth="1" strokeOpacity="0.6" />
      {["M34 30 Q 60 2 86 34", "M30 46 Q 62 20 90 44", "M40 22 Q 78 30 78 56"].map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--lp-cyan)" strokeWidth="1.5" strokeOpacity="0.85" />
      ))}
      {[[34, 30], [86, 34], [30, 46], [90, 44], [78, 56], [40, 22]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.8" fill="var(--lp-amber)" />
      ))}
    </svg>
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
