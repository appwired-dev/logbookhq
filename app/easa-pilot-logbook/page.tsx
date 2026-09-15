import type { Metadata } from "next";
import { MarketingShell, PageHero, Article, Faq, CtaBand, ReconcileVisual, Breadcrumb } from "@/components/marketing/kit";

// Pure static content — no per-request data. Prerender at build so these
// SEO pages are served from the CDN (instant TTFB, no serverless cost).
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "EASA pilot logbook — Part-FCL currency, limits & export",
  description:
    "An EASA pilot logbook that tracks Part-FCL recency and ORO.FTL limits, exports in the EASA standard (AMC1 FCL.050) column layout, and still counts your FAA and UK CAA time.",
  alternates: { canonical: "/easa-pilot-logbook" },
  openGraph: {
    title: "EASA pilot logbook — Part-FCL currency, limits & export",
    description: "Tracks Part-FCL recency and ORO.FTL limits, exports in the EASA standard (AMC1 FCL.050) column layout, and counts your FAA and UK CAA time too.",
    url: "/easa-pilot-logbook",
  },
};

export default function EasaPage() {
  return (
    <MarketingShell>
      <Breadcrumb name="EASA pilot logbook" path="/easa-pilot-logbook" />
      <PageHero
        eyebrow="For pilots flying under EASA"
        title={<>Fluent<br />in Part-FCL.</>}
        visual={<ReconcileVisual />}
        lede={
          <>
            Track your recency and rolling limits under the rules that actually apply to you, and print a
            logbook laid out the way an EASA examiner expects to read it. This one models Part-FCL and
            ORO.FTL from the start &mdash; and if you also hold an FAA certificate or fly under the UK CAA, it
            counts that time too, in one logbook.
          </>
        }
      />

      <Article>
        <p>
          Most logbook software is built to FAA defaults and treats EASA as a setting. Fine until a
          proficiency check or a licence application, when your hours have been counted to the wrong rules
          and your printout doesn&rsquo;t sit the way Part-FCL wants it. Fly under EASA and your logbook should
          be built for EASA &mdash; not translated into it at the last minute.
        </p>

        <h2>Currency and limits under the right rules</h2>
        <ul>
          <li>
            <strong>Recency modelled on Part-FCL.</strong> The takeoffs and landings behind your 90-day
            passenger recency under FCL.060, tracked and flagged amber before they lapse, not after.
          </li>
          <li>
            <strong>Rolling flight-time limits on ORO.FTL.</strong> The last 28 days, 12 months and calendar
            year measured against the actual ORO.FTL.210 ceilings where they reach your operation &mdash; each
            window green until it isn&rsquo;t.
          </li>
          <li>
            <strong>Ratings before they lapse.</strong> Class and type rating validity and the checks that
            revalidate them, watched against the dates on your licence so an expiry never arrives as a
            surprise.
          </li>
        </ul>

        <h2>Export in the EASA standard column layout</h2>
        <p>
          When you need it on paper, export a PDF arranged in the EASA standard column order &mdash; the layout
          set out in AMC1 FCL.050: date, departure and arrival, aircraft, single- and multi-pilot time,
          total time, name of PIC, landings, operational-condition time, and the pilot-function columns for
          PIC, co-pilot, dual and instructor. It captures the data items FCL.050 requires, in the
          arrangement an examiner reads without translating. It&rsquo;s the standard AMC layout for handing over,
          not an EASA-certified filing &mdash; a formatting convenience, and a genuinely useful one.
        </p>

        <h2>If your flying crosses borders</h2>
        <p>
          Plenty of European pilots don&rsquo;t answer to a single regulator &mdash; an FAA certificate alongside
          the EASA licence, an N-registered aircraft, time in UK airspace where the CAA has run its own rules
          since Brexit. Instead of an EASA spreadsheet, an FAA one and a UK one kept in step by hand, you
          record each flight once and set which authority the dashboard checks &mdash; EASA, the FAA or the UK
          CAA &mdash; to see where you stand under its rules. Switch anytime; one logbook, no re-entry.
        </p>

        <h2>Bring the logbook you already keep</h2>
        <p>
          Switching shouldn&rsquo;t mean re-typing years of flying. Import the spreadsheet or app export you have
          now &mdash; Excel, CSV, ForeFlight, LogTen, MyFlightbook, Apple Numbers, even a sheet with its headers
          in German or French &mdash; and it maps your columns, then checks the imported totals against the ones
          you already trust before it saves anything. You watch your history land intact.
        </p>

        <h2>A note on staying legal</h2>
        <p>
          The app tracks your hours and flags your dates; it doesn&rsquo;t replace Part-FCL or a ruling from your
          competent authority, and the EASA-layout export is a formatting aid, not a certified record. The
          regulations are the authority. What the software does is make the numbers hard to lose track of &mdash;
          which is most of the battle. If you fly under EASA alone and always will, a single-framework
          logbook is a fine choice; this one is for pilots whose flying reaches further than one flag.
        </p>
      </Article>

      <Faq
        items={[
          {
            q: "Is it built around EASA Part-FCL?",
            a: "Yes. Recency and rating validity are modelled on Part-FCL (FCL.050 duty to keep a record, FCL.060 recent experience) and flight-time limits on ORO.FTL, rather than adapted from FAA defaults. You choose which rules apply to your flying and the app tracks against those.",
          },
          {
            q: "Can I export in the EASA logbook layout?",
            a: "Yes. Export a PDF arranged in the EASA standard column order from AMC1 FCL.050 — the layout an examiner expects. It captures the FCL.050-required data items; it's the standard AMC layout for handover, not an EASA-certified filing. (The single-/multi-pilot split uses each flight's multi-pilot flag; departure/arrival clock times aren't included yet — shown on the export screen.)",
          },
          {
            q: "I also fly under the FAA or UK CAA. Can it handle both?",
            a: "Yes. Record each flight once; set your authority and see your currency and limits under its rules. Switch between EASA, the FAA and the UK CAA anytime in Settings — one logbook, no re-entry.",
          },
          {
            q: "Can I import my current EASA logbook?",
            a: "Yes. Import from Excel, CSV, ForeFlight, LogTen, MyFlightbook or an Apple Numbers file — including sheets with non-English column headers. The import reconciles against your own totals before saving, so nothing lands wrong.",
          },
          {
            q: "What does it cost?",
            a: "Free up to 100 flights with no card. After that it's $4.99/month, $49/year, or $249 once for lifetime access.",
          },
        ]}
      />

      <CtaBand title={<>An EASA logbook that speaks your rules.</>} />
    </MarketingShell>
  );
}
