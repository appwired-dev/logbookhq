import type { Metadata } from "next";
import { RelatedLinks, MarketingShell, PageHero, Article, Faq, CtaBand, ReconcileVisual, Breadcrumb } from "@/components/marketing/kit";
import { OG_BASE } from "@/lib/seo";

// Pure static content — prerendered at build, served from the CDN.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "UK CAA pilot logbook — Part-FCL currency, limits & export",
  description:
    "A UK CAA pilot logbook that tracks retained Part-FCL recency and ORO.FTL flight-time limits, exports in the standard column layout, and still counts your EASA and FAA time — one logbook for a border-crossing career.",
  alternates: { canonical: "/uk-caa-pilot-logbook" },
  openGraph: {
    ...OG_BASE,
    title: "UK CAA pilot logbook — Part-FCL currency, limits & export",
    description: "Tracks retained Part-FCL recency and ORO.FTL limits, exports in the standard column layout, and counts your EASA and FAA time too.",
    url: "/uk-caa-pilot-logbook",
  },
};

export default function UkCaaPage() {
  return (
    <MarketingShell>
      <Breadcrumb name="UK CAA pilot logbook" path="/uk-caa-pilot-logbook" />
      <PageHero
        eyebrow="UK CAA pilot logbook"
        title={<>Current under<br />the UK CAA.</>}
        visual={<ReconcileVisual />}
        lede={
          <>
            Since Brexit the UK CAA is its own authority, running retained Part-FCL and ORO.FTL &mdash; the
            same shape as the EASA rules, under a different flag. This logbook tracks your recency and
            flight-time limits under the UK rules, prints in the standard column layout, and still counts
            your EASA and FAA time when your flying crosses a border.
          </>
        }
      />

      <Article>
        <p>
          If you hold a UK licence, most logbook software still treats you as either &ldquo;EASA&rdquo; or
          &ldquo;FAA&rdquo; and leaves you to reconcile the difference. The UK kept the European framework but
          owns it now &mdash; so the sensible thing is a logbook that tracks the UK rules directly, and can
          switch to another authority the moment your flying does.
        </p>

        <h2>Recency and limits under the UK rules</h2>
        <ul>
          <li>
            <strong>Part-FCL recency.</strong> Passenger currency from the takeoffs and landings behind it,
            and the checks that keep your ratings live &mdash; flagged amber before they lapse, not after.
          </li>
          <li>
            <strong>ORO.FTL flight-time limits.</strong> The rolling windows &mdash; the last 28 days, the
            calendar year, twelve calendar months &mdash; watched against the retained ORO.FTL.210 numbers
            (unchanged from the EU set), each window green until it isn&rsquo;t.
          </li>
          <li>
            <strong>The standard column layout.</strong> When you need it on paper, export a PDF in the
            standard EASA/UK column order (AMC1 FCL.050) &mdash; the arrangement an examiner reads without
            translating. It&rsquo;s a formatting convenience for handover, not a certified filing.
          </li>
        </ul>

        <h2>One licence is rarely the whole story</h2>
        <p>
          Plenty of UK pilots also hold an EASA licence from a member-state authority, or an FAA
          certificate from training in the States. Rather than a logbook per flag, you record each flight
          once and set which authority the dashboard checks &mdash; UK CAA, EASA or the FAA &mdash; to see where you
          stand under its rules. Switch anytime in Settings; one logbook, no re-entry.
        </p>

        <h2>Bring the logbook you already keep</h2>
        <p>
          Switching shouldn&rsquo;t mean re-typing years of flying. Import the spreadsheet or app export you
          have now &mdash; Excel, CSV, ForeFlight, LogTen, Apple Numbers &mdash; and it maps your columns, then
          checks the imported totals against the ones you already trust before saving anything. Your
          history comes across intact, and you can see that it did.
        </p>

        <h2>A note on staying legal</h2>
        <p>
          The software tracks your hours and flags your windows; it doesn&rsquo;t replace the ANOs, Part-FCL or
          your own judgement. The regulations are the authority, and currency is ultimately yours to
          confirm. What this does is make the numbers hard to lose track of.
        </p>
      </Article>

      <Faq
        items={[
          {
            q: "Does it follow the UK CAA rules, not just EASA?",
            a: "Yes. The UK retained Part-FCL and ORO.FTL after Brexit, so the numbers match the EASA set — but you select the UK CAA as your authority and the app tracks recency and rolling flight-time limits against those rules.",
          },
          {
            q: "I hold both a UK and an EASA licence. Can it handle both?",
            a: "Yes. Record each flight once; set your authority and see your currency and limits under its rules. Switch between the UK CAA, EASA and the FAA anytime in Settings — one logbook, no re-entry.",
          },
          {
            q: "Can I export in the standard column layout?",
            a: "Yes. Export a PDF in the standard EASA/UK column order (AMC1 FCL.050) for handing to an examiner or employer. It's the standard layout, not a certified filing; a couple of cells are inferred or omitted and shown on the export screen.",
          },
          {
            q: "Can I import my current logbook?",
            a: "Yes. Import from Excel, CSV, ForeFlight, LogTen or an Apple Numbers file — including sheets with your own column names. The import reconciles against your totals before saving, so nothing lands wrong.",
          },
        ]}
      />

      <RelatedLinks
        links={[
          { href: "/multi-regime-pilot-logbook", label: "Multi-regime logbook" },
          { href: "/easa-pilot-logbook", label: "EASA pilot logbook" },
          { href: "/faa-easa-logbook", label: "FAA + EASA logbook" },
        ]}
      />

      <CtaBand title={<>Keep a UK logbook that tracks the UK rules.</>} />
    </MarketingShell>
  );
}
