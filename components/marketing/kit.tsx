import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared chrome + primitives for the marketing/content pages (comparisons,
 * category and guide pages), in the .lp dark theme. Kept separate from the
 * landing (app/page.tsx) so content pages stay consistent without touching the
 * hero. The hero deliberately mirrors the landing hero: an lp-h1-3d display
 * headline on the left, a live visual card on the right. Long-form body copy
 * uses the `.mkt-prose` styles in globals.css.
 */

export function Mark() {
  return (
    <span
      className="grid place-items-center rounded-lg"
      style={{ width: 32, height: 32, background: "linear-gradient(180deg,#12324a,#0b1f3a)", border: "1px solid var(--lp-line-2)" }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--lp-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    </span>
  );
}

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="lp">
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
      <main>{children}</main>
      <footer className="lp-hairline">
        <div className="mx-auto max-w-6xl px-5 py-8 space-y-4">
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Link className="lp-link inline-flex items-center min-h-[44px]" href="/multi-regime-pilot-logbook">Multi-regime logbook</Link>
            <Link className="lp-link inline-flex items-center min-h-[44px]" href="/foreflight-logbook-alternative">ForeFlight alternative</Link>
            <Link className="lp-link inline-flex items-center min-h-[44px]" href="/logten-pro-alternative">LogTen Pro alternative</Link>
            <Link className="lp-link inline-flex items-center min-h-[44px]" href="/transport-canada-pilot-logbook">Transport Canada logbook</Link>
            <Link className="lp-link inline-flex items-center min-h-[44px]" href="/myflightbook-alternative">MyFlightbook alternative</Link>
            <Link className="lp-link inline-flex items-center min-h-[44px]" href="/easa-pilot-logbook">EASA pilot logbook</Link>
            <Link className="lp-link inline-flex items-center min-h-[44px]" href="/faa-easa-logbook">FAA + EASA logbook</Link>
          </nav>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ color: "var(--lp-ink-3)" }}>
            <span>&copy; Pilot Logbook HQ &middot; a multi-regime pilot logbook</span>
            <nav className="flex items-center gap-3 sm:gap-4">
              <Link className="lp-link inline-flex items-center min-h-[44px]" href="/pricing">Pricing</Link>
              <Link className="lp-link inline-flex items-center min-h-[44px]" href="/terms">Terms</Link>
              <Link className="lp-link inline-flex items-center min-h-[44px]" href="/privacy">Privacy</Link>
              <Link className="lp-link inline-flex items-center min-h-[44px]" href="/login">Sign in</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Content-page hero. Mirrors the landing hero: eyebrow + lp-h1-3d headline +
 * lede + CTAs on the left, a live visual on the right. Keep `title` short and
 * punchy — lp-h1 is a large uppercase display face, so long sentences belong in
 * the lede, not the headline.
 */
export function PageHero({ eyebrow, title, lede, visual, cta = "Import your logbook free", href = "/signup" }: {
  eyebrow: string; title: ReactNode; lede: ReactNode; visual?: ReactNode; cta?: string; href?: string;
}) {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-16 sm:pt-24 pb-8">
      <div className={`grid ${visual ? "lg:grid-cols-[1.05fr_0.95fr]" : ""} gap-12 lg:gap-10 items-center`}>
        <div>
          {/* The target query IS the eyebrow; promote it to the page H1 (visual
              unchanged via .lp-eyebrow) and render the punchy tagline as a
              styled paragraph, so the H1 carries the keyword. */}
          <h1 className="lp-eyebrow lp-rise" style={{ animationDelay: "0ms" }}>{eyebrow}</h1>
          <p className="lp-h1 lp-h1-3d mt-4">{title}</p>
          <p className="lp-lede mt-5 max-w-xl lp-rise" style={{ animationDelay: "90ms" }}>{lede}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3 lp-rise" style={{ animationDelay: "140ms" }}>
            <Link className="lp-btn lp-btn-primary lp-btn-sheen" href={href}>{cta}</Link>
            <Link className="lp-btn lp-btn-ghost" href="/pricing">See pricing</Link>
          </div>
          <p className="lp-mono mt-4 text-xs lp-rise" style={{ color: "var(--lp-ink-3)", animationDelay: "180ms" }}>
            Free up to 100 flights &middot; no card &middot; $4.99/mo after
          </p>
        </div>
        {visual && <div className="lp-rise" style={{ animationDelay: "120ms" }}>{visual}</div>}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   Hero visuals
   --------------------------------------------------------------------------- */

/** The import-reconcile card — the switching story. Mirrors the landing card. */
export function ReconcileVisual() {
  const checks: [string, string][] = [
    ["Total time", "8,484.0 h"],
    ["Multi-engine", "6,281.2 h"],
    ["Night", "2,294.4 h"],
    ["Cross-country", "verified"],
    ["IFR approaches", "1,464"],
  ];
  return (
    <div className="lp-panel lp-panel-glow p-5 sm:p-6" role="img" aria-label="An imported logbook reconciled: every check green, 5,334 flights.">
      <div className="flex items-center gap-3">
        <div className="grid place-items-center rounded-lg shrink-0" style={{ width: 38, height: 38, background: "rgba(86,199,222,.10)", border: "1px solid var(--lp-line-2)" }}>
          <FileGlyph />
        </div>
        <div className="min-w-0">
          <div className="lp-mono text-sm truncate" style={{ color: "var(--lp-ink)" }}>Michael&nbsp;Logbook.numbers</div>
          <div className="lp-mono text-xs" style={{ color: "var(--lp-ink-3)" }}>Apple Numbers &middot; 3-header layout</div>
        </div>
        <span className="lp-chip ml-auto shrink-0" style={{ borderColor: "rgba(58,210,154,.4)", color: "var(--lp-good)" }}>
          <span className="lp-dot lp-dot-live" /> Recognised
        </span>
      </div>

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

      <div className="mt-4 flex items-baseline gap-2">
        <span className="lp-num" style={{ fontSize: 30, fontFamily: "var(--lp-display)", fontWeight: 700, color: "var(--lp-ink)" }}>5,334</span>
        <span className="text-sm" style={{ color: "var(--lp-ink-2)" }}>flights ready to import</span>
        <span className="lp-mono ml-auto text-xs" style={{ color: "var(--lp-good)" }}>every check green</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Prose + comparison + FAQ + CTA
   --------------------------------------------------------------------------- */

export function Article({ children }: { children: ReactNode }) {
  return <section className="mx-auto max-w-3xl px-5 py-6 mkt-prose">{children}</section>;
}

/** Yes / value cell for the comparison table. */
export function Yes({ children = "Yes" }: { children?: ReactNode }) {
  return <span style={{ color: "var(--lp-good)", fontWeight: 600 }}>{children}</span>;
}

export function CompareTable({ them, rows }: { them: string; rows: [string, ReactNode, ReactNode][] }) {
  return (
    <section className="mx-auto max-w-3xl px-5 py-6">
      <div className="lp-panel" style={{ overflow: "hidden" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 460 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--lp-line)" }}>
                <th className="text-left font-medium px-4 py-3" style={{ color: "var(--lp-ink-3)" }} />
                <th className="text-left px-4 py-3" style={{ color: "var(--lp-cyan)", fontWeight: 700, whiteSpace: "nowrap" }}>Pilot Logbook HQ</th>
                <th className="text-left px-4 py-3" style={{ color: "var(--lp-ink-2)", fontWeight: 600, whiteSpace: "nowrap" }}>{them}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r[0]} style={{ borderTop: i === 0 ? "none" : "1px solid var(--lp-line)" }}>
                  <td className="px-4 py-3 align-top" style={{ color: "var(--lp-ink)", fontWeight: 500 }}>{r[0]}</td>
                  <td className="px-4 py-3 align-top" style={{ color: "var(--lp-ink-2)" }}>{r[1]}</td>
                  <td className="px-4 py-3 align-top" style={{ color: "var(--lp-ink-2)" }}>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
  return (
    <section className="mx-auto max-w-3xl px-5 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <h2 style={{ fontFamily: "var(--lp-display)", fontWeight: 700, color: "var(--lp-ink)", fontSize: "clamp(22px,3vw,29px)", letterSpacing: "0.01em" }}>
        Common questions
      </h2>
      <div className="mt-5 divide-y" style={{ borderColor: "var(--lp-line)" }}>
        {items.map((it) => (
          <details key={it.q} className="group py-4">
            <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-start justify-between gap-4" style={{ color: "var(--lp-ink)", fontWeight: 600, fontSize: 16 }}>
              <span>{it.q}</span>
              <span className="shrink-0 transition-transform duration-200 group-open:rotate-45" style={{ color: "var(--lp-ink-3)", fontSize: 22, lineHeight: 1 }} aria-hidden>+</span>
            </summary>
            <p className="mt-3" style={{ color: "var(--lp-ink-2)", lineHeight: 1.7 }}>{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** In-content links to sibling guides — passes more topical weight to the
 *  pillar than the footer's boilerplate nav, and keeps the crawl hub-and-spoke. */
export function RelatedLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <section className="mx-auto max-w-3xl px-5 pt-2 pb-6">
      <p className="lp-mono text-2xs uppercase tracking-[0.14em] mb-3" style={{ color: "var(--lp-ink-3)" }}>Related guides</p>
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link className="lp-link inline-flex items-center gap-1 min-h-[44px]" href={l.href}>{l.label} &rarr;</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CtaBand({ title, sub = "Free up to 100 flights. No card required." }: { title: ReactNode; sub?: string }) {
  return (
    <section className="mx-auto max-w-3xl px-5 pb-24 pt-8 text-center">
      <h2 style={{ fontFamily: "var(--lp-display)", fontWeight: 700, color: "var(--lp-ink)", fontSize: "clamp(24px,3.6vw,34px)", letterSpacing: "0.01em", textWrap: "balance" }}>
        {title}
      </h2>
      <div className="mt-6 flex justify-center">
        <Link className="lp-btn lp-btn-primary lp-btn-sheen" style={{ height: 52, padding: "0 28px", fontSize: 16 }} href="/signup">
          Import your logbook free
        </Link>
      </div>
      <p className="lp-mono mt-4 text-xs" style={{ color: "var(--lp-ink-3)" }}>{sub}</p>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   Glyphs
   --------------------------------------------------------------------------- */
export function Breadcrumb({ name, path }: { name: string; path: string }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://pilotlogbookhq.com" },
      { "@type": "ListItem", position: 2, name, item: `https://pilotlogbookhq.com${path}` },
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />;
}

function FileGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lp-cyan)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" />
    </svg>
  );
}
function CheckGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--lp-good)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
