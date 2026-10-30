import type { Metadata } from "next";
import Link from "next/link";
import { Kalam } from "next/font/google";
import { MarketingShell } from "@/components/marketing/kit";
import { CampaignVideo, type CampaignVideoSource } from "@/components/marketing/CampaignVideo";
import { OG_BASE } from "@/lib/seo";
import { LogbookSpread } from "./LogbookSpread";
import s from "./tcexamprep.module.css";

// Landing page for links shared on TC Exam Prep's socials, e.g.
//   /tcexamprep?utm_source=tcexamprep&utm_medium=social&utm_campaign=logbook_sunday
// Pure static content: the query string is read only in the browser, by
// components/SiteStats.tsx, which counts the landing under source "tcexamprep"
// and campaign "logbook_sunday" (daily totals only — lib/site-stats-core.ts).
// Nothing here carries the campaign into signup: the stats are cookieless and
// keep no visitor identifier, by design (privacy policy §1).
//
// Every product statement below is checked against the app; keep it that way
// (no goals feature, PDF export is paid, no Transport Canada approval).
export const dynamic = "force-static";

/** Ballpoint hand for the paper page and the "by hand" column. Loaded on this page only. */
const ink = Kalam({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-ink", display: "swap" });

const TITLE = "Pilot Logbook HQ — for pilots coming from TC Exam Prep";
const DESCRIPTION =
  "You passed the written; the logbook comes next. Totals, recency and document expiries added up for you. Free up to 100 flights, then $4.99/mo.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tcexamprep" },
  // A campaign landing for social links, not a search page: kept out of the index and the sitemap.
  robots: { index: false, follow: true },
  openGraph: { ...OG_BASE, title: TITLE, description: DESCRIPTION, url: "/tcexamprep" },
};

/**
 * Logbook Sunday #1. Null until the approved file is committed under
 * public/media/ — its section stays out of the page until then. Use the real
 * encoded size, and add `captions` unless they are burned into the video.
 */
const LOGBOOK_SUNDAY_1: CampaignVideoSource | null = null;

/** The jobs a paper logbook leaves to you, and what the app does instead. */
const LEDGER: { job: string; byHand: string; here: string }[] = [
  {
    job: "Totals",
    byHand: "Add every column, every page, and carry it forward.",
    here: "Total, PIC, cross-country, instrument and the rest, always current on your dashboard.",
  },
  {
    job: "Recency",
    byHand: "Count back six months of take-offs and landings.",
    here: "Six-month passenger and IFR recency under the CARs (401.05), checked for you — and other authorities’ rules if you fly under them.",
  },
  {
    job: "Expiries",
    byHand: "Remember the date on your medical.",
    here: "Medical, licence, type ratings, IPCs, recurrent training and passport, each with its expiry date, flagged before it lapses.",
  },
  {
    job: "Finding a flight",
    byHand: "Flip pages.",
    here: "Search by aircraft, registration, route, crew or remarks; filter by year, category and role; sort by column in the full table view.",
  },
  {
    job: "Showing your time",
    byHand: "Photocopy the pages.",
    here: "A PDF in a standard logbook column layout (paid plans), or a CSV of every flight. The PDF is a formatting convenience, not an officially approved format.",
  },
  {
    job: "Moving in",
    byHand: "Retype another app’s export or your spreadsheet.",
    here: "Import CSV, Excel or Apple Numbers files. Built-in profiles read ForeFlight, LogTen Pro, MyFlightbook and Pilot Logbook HQ exports and a common three-row Apple Numbers layout; any other sheet is matched column by column for you to confirm. Before anything is saved, the import checks its totals against any your sheet declares.",
  },
  {
    job: "Limits, later",
    byHand: "Watch the calendar.",
    here: "When you fly commercially: flight-time limits over rolling 28-, 90- and 365-day windows (CAR 700.27).",
  },
  {
    job: "The picture",
    byHand: "—",
    here: "Charts of hours by aircraft type, your rolling 365-day total against its limit, a career flow and a globe of the routes you’ve flown.",
  },
];

export default function TcExamPrepLandingPage() {
  return (
    <MarketingShell>
      <div className={ink.variable}>
        <section className="mx-auto max-w-6xl px-5 pt-14 sm:pt-20 pb-8">
          <p className="lp-eyebrow">From TC Exam Prep</p>
          <h1 className="lp-h1 mt-3" style={{ color: "var(--lp-ink)" }}>
            Carry it <span className={s.ruled}>forward.</span>
          </h1>
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_auto] gap-6 lg:items-end">
            <p className="lp-lede max-w-2xl">
              You passed the written. Every hour from here goes in your logbook, and Pilot Logbook HQ adds it up
              for you: totals, recency and expiries, carried forward each time you log a flight.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link className="lp-btn lp-btn-primary" href="/signup">Start your logbook free</Link>
              <Link className="lp-btn lp-btn-ghost" href="/pricing">See pricing</Link>
            </div>
          </div>
          <p className="lp-mono mt-4 text-xs" style={{ color: "var(--lp-ink-3)" }}>
            Free up to 100 flights &middot; then $4.99/mo CAD &middot; no card to start
          </p>
        </section>

        {/* Edge to edge on phones, so the paper page gets every pixel of width. */}
        <section className="mx-auto max-w-6xl sm:px-5 pb-6">
          <LogbookSpread />
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-10">
          <p className={s.remarks} role="note">
            <span className="lp-mono text-xs uppercase tracking-[0.14em]" style={{ color: "var(--lp-amber)" }}>Remarks</span>
            <span className="text-sm leading-relaxed" style={{ color: "var(--lp-ink-2)" }}>
              <strong style={{ color: "var(--lp-ink)" }}>Built by the same team as TC Exam Prep.</strong>{" "}
              Pilot Logbook HQ is not affiliated with, approved by or endorsed by Transport Canada.
            </span>
          </p>
        </section>

        {LOGBOOK_SUNDAY_1 && (
          <section className="mx-auto max-w-6xl px-5 pb-12 grid grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 items-center">
            <div>
              <p className="lp-eyebrow" style={{ color: "var(--lp-amber)" }}>Logbook Sunday #1</p>
              <h2 className="lp-h2 mt-2" style={{ fontSize: "clamp(24px,3.4vw,34px)" }}>Can you prove your hours?</h2>
            </div>
            <CampaignVideo video={LOGBOOK_SUNDAY_1} />
          </section>
        )}

        <section className="mx-auto max-w-6xl px-5 pb-14">
          <p className="lp-eyebrow" style={{ color: "var(--lp-amber)" }}>The arithmetic, done</p>
          <h2 className="lp-h2 mt-2" style={{ fontSize: "clamp(24px,3.4vw,34px)" }}>What a paper logbook leaves to you.</h2>
          <div className={`${s.ledger} mt-7`}>
            <div className={s.ledgerHead} aria-hidden>
              <span>Job</span><span>By hand</span><span>Pilot Logbook HQ</span>
            </div>
            {LEDGER.map((r) => (
              <div key={r.job} className={s.ledgerRow}>
                <h3 className="lp-mono text-xs uppercase tracking-[0.14em]" style={{ color: "var(--lp-ink-3)" }}>{r.job}</h3>
                <p className={s.byHand}><span className="sr-only">By hand: </span>{r.byHand}</p>
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--lp-ink)" }}>{r.here}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-24">
          <p className="lp-eyebrow" style={{ color: "var(--lp-amber)" }}>Totals to date</p>
          <div className={`${s.totalsRow} mt-4`}>
            <div className={s.totalsCell}>
              <div className="lp-mono text-xs uppercase tracking-[0.14em]" style={{ color: "var(--lp-ink-3)" }}>Up to 100 flights</div>
              <div className={`${s.totalsFig} mt-2`}>Free</div>
              <p className="mt-2 text-sm" style={{ color: "var(--lp-ink-2)" }}>No card to start.</p>
            </div>
            <div className={s.totalsCell}>
              <div className="lp-mono text-xs uppercase tracking-[0.14em]" style={{ color: "var(--lp-ink-3)" }}>After that</div>
              <div className={`${s.totalsFig} mt-2`}>$4.99<span className="lp-mono text-base" style={{ color: "var(--lp-ink-3)" }}> CAD / month</span></div>
              <p className="mt-2 text-sm" style={{ color: "var(--lp-ink-2)" }}>
                Annual and lifetime plans are on the <Link className="lp-link underline underline-offset-2" href="/pricing">pricing page</Link>.
              </p>
            </div>
          </div>
          <div className="mt-10">
            <Link className="lp-btn lp-btn-primary lp-btn-sheen" style={{ height: 52, padding: "0 28px", fontSize: 16 }} href="/signup">
              Start your logbook free
            </Link>
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}
