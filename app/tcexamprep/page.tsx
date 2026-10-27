import type { Metadata } from "next";
import { MarketingShell, PageHero, CtaBand, ReconcileVisual } from "@/components/marketing/kit";
import { CampaignVideo, type CampaignVideoSource } from "@/components/marketing/CampaignVideo";
import { OG_BASE } from "@/lib/seo";

// Landing page for links shared on TC Exam Prep's socials, e.g.
//   /tcexamprep?utm_source=tcexamprep&utm_medium=social&utm_campaign=logbook_sunday
// Pure static content: the query string is read only in the browser, by
// components/SiteStats.tsx, which counts the landing under source "tcexamprep"
// and campaign "logbook_sunday" (daily totals only — lib/site-stats-core.ts).
// Nothing here carries the campaign into signup: the stats are cookieless and
// keep no visitor identifier, by design (privacy policy §1).
export const dynamic = "force-static";

const TITLE = "Pilot Logbook HQ — for pilots coming from TC Exam Prep";
const DESCRIPTION =
  "Totals, currency and document expiries on one dashboard. Import from ForeFlight, LogTen Pro, MyFlightbook or Apple Numbers; export to PDF or CSV. Free to 100 flights, then $4.99/mo.";

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
 * public/media/ — the hero shows the import card meanwhile. Use the real
 * encoded size, and add `captions` unless they are burned into the video.
 */
const LOGBOOK_SUNDAY_1: CampaignVideoSource | null = null;

const FEATURES: { eyebrow: string; title: string; body: string }[] = [
  {
    eyebrow: "Dashboard",
    title: "Totals, currency and limits on one screen",
    body:
      "Total, PIC, cross-country and instrument time up top. Under Canadian rules, six-month passenger and IFR recency (CARs 401.05) and flight-time limits over rolling 28-, 90- and 365-day windows (CAR 700.27). Other authorities’ rules are built in too.",
  },
  {
    eyebrow: "Flights",
    title: "Search and filter every flight",
    body:
      "Search by aircraft, registration, route, crew name or remarks, then filter by year, category and role, and sort the columns.",
  },
  {
    eyebrow: "Import",
    title: "Bring the logbook you already keep",
    body:
      "CSV, Excel and Apple Numbers files, with built-in profiles for ForeFlight, LogTen Pro, MyFlightbook, Pilot Logbook HQ exports and Apple Numbers logbooks. Before anything is saved, the import checks its totals against any your sheet declares.",
  },
  {
    eyebrow: "Export",
    title: "PDF or CSV when someone asks",
    body:
      "A PDF in a standard logbook column layout for an examiner or an employer (paid plans), or a CSV of every flight. The PDF is a formatting convenience, not an officially approved format.",
  },
  {
    eyebrow: "Charts",
    title: "See where the hours went",
    body:
      "Hours by aircraft type, your rolling 365-day total against its limit, a career flow from years to aircraft to roles, and a globe of the routes you’ve flown.",
  },
  {
    eyebrow: "Documents",
    title: "Expiries before they catch you out",
    body:
      "Medical, licence, ratings, passport and recurrent checks, each with its expiry date, flagged before it lapses. The next ones due sit on your dashboard.",
  },
];

export default function TcExamPrepLandingPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="For pilots coming from TC Exam Prep"
        title={<>Exam passed.<br />Now log it.</>}
        visual={LOGBOOK_SUNDAY_1 ? <CampaignVideo video={LOGBOOK_SUNDAY_1} /> : <ReconcileVisual />}
        lede={
          <>
            Pilot Logbook HQ puts your totals, currency and document expiries on one dashboard. It imports the
            logbook you already keep, and exports a PDF or CSV when an examiner or an employer asks for it.
          </>
        }
      />

      <section className="mx-auto max-w-6xl px-5 pb-6">
        <p className="lp-panel px-4 py-3 text-sm leading-relaxed" role="note" style={{ color: "var(--lp-ink-2)" }}>
          <strong style={{ color: "var(--lp-ink)" }}>Disclosure:</strong> Pilot Logbook HQ is built by the same team as
          TC Exam Prep. It is not affiliated with, approved by or endorsed by Transport Canada.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-6 pb-4">
        <div className="lp-eyebrow" style={{ color: "var(--lp-amber)" }}>What you get</div>
        <h2 className="lp-h2 mt-2" style={{ fontSize: "clamp(24px,3.4vw,34px)" }}>What&rsquo;s in the logbook.</h2>
        <div className="mt-7 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.eyebrow} className="lp-panel p-6">
              <div className="lp-eyebrow" style={{ color: "var(--lp-amber)" }}>{f.eyebrow}</div>
              <h3 className="mt-2 text-lg font-semibold" style={{ color: "var(--lp-ink)" }}>{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--lp-ink-2)" }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <CtaBand
        title={<>Free for your first 100 flights.<br />Then $4.99 a month.</>}
        sub="No card to start · annual and lifetime plans on the pricing page"
      />
    </MarketingShell>
  );
}
