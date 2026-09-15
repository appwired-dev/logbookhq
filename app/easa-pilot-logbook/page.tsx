import type { Metadata } from "next";
import { MarketingShell, PageHero, Article, Faq, CtaBand, ReconcileVisual, Breadcrumb } from "@/components/marketing/kit";

// Pure static content — no per-request data. Prerender at build so these
// SEO pages are served from the CDN (instant TTFB, no serverless cost).
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "EASA pilot logbook for Part-FCL currency & limits",
  description:
    "A pilot logbook built for EASA flying: keep your record in the Part-FCL layout, track recency and rating validity, and still count FAA and UK CAA time.",
  alternates: { canonical: "/easa-pilot-logbook" },
  openGraph: {
    title: "EASA pilot logbook for Part-FCL currency & limits",
    description: "A pilot logbook built for EASA flying: keep your record in the Part-FCL layout, track recency and rating validity, and still count FAA and UK CAA time.",
    url: "/easa-pilot-logbook",
  },
};

export default function EasaPage() {
  return (
    <MarketingShell>
      <Breadcrumb name="EASA pilot logbook" path="/easa-pilot-logbook" />
      <PageHero
        eyebrow="For pilots flying under EASA"
        title={<>Built around<br />Part-FCL.</>}
        visual={<ReconcileVisual />}
        lede={
          <>
            Most logbook apps are built to FAA conventions and bolt the EASA columns on afterwards
            &mdash; which holds up right until a proficiency check, when the totals don&rsquo;t sit where
            Part-FCL wants them. This one is laid out for Part-FCL from the start. And if you also hold
            an FAA certificate or fly under the UK CAA, it counts that time too, without a second
            logbook.
          </>
        }
      />

      <Article>
        <p>
          FCL.050 is blunt about it: keep a reliable record of every flight, in the form your competent
          authority lays down. Simple enough &mdash; until your software counts hours to someone
          else&rsquo;s conventions and leaves you re-shaping them into the EASA columns by hand the week
          before a proficiency check, a licence application, or a new job.
        </p>

        <h2>Built around the EASA layout, not translated into it</h2>
        <ul>
          <li>
            <strong>Your record, kept in EASA columns.</strong> The layout Part-FCL expects &mdash;
            single-pilot and multi-pilot time, operational-condition time like night and IFR, and
            pilot-function time for PIC, co-pilot, dual and instructor &mdash; not an FAA sheet wearing
            the wrong headings.
          </li>
          <li>
            <strong>Recency you can see at a glance.</strong> The takeoffs and landings behind your
            90-day passenger recency under FCL.060, tracked and flagged amber before it lapses rather
            than after.
          </li>
          <li>
            <strong>Ratings before they lapse.</strong> Class and type rating validity and the checks
            that revalidate them, watched against the dates on your licence so an expiry doesn&rsquo;t
            arrive as a surprise.
          </li>
        </ul>

        <h2>If your flying crosses borders</h2>
        <p>
          Plenty of European pilots don&rsquo;t answer to one regulator. You might hold an FAA
          certificate alongside your EASA licence, fly an N-registered aircraft, or fly in UK airspace,
          where the CAA has run its own rules since Brexit. Instead of an EASA spreadsheet, an FAA one
          and a UK one kept in sync by hand, you record each flight once and see where you stand under
          EASA, the FAA and the UK CAA from the same data &mdash; one logbook, each authority&rsquo;s
          rules applied to it, including rolling flight-time limits like ORO.FTL where they reach your
          operation.
        </p>

        <h2>Bring the logbook you already keep</h2>
        <p>
          Switching shouldn&rsquo;t mean re-typing years of flying, and it doesn&rsquo;t. Import the
          spreadsheet or app export you have now &mdash; Excel, CSV, ForeFlight, LogTen, MyFlightbook,
          Apple Numbers, even a sheet with its headers in German or French &mdash; and it maps your
          columns, then checks the imported totals against the ones you already trust before it saves
          anything. Your history comes across intact, and you get to see that it did.
        </p>

        <h2>Where a single-authority logbook is the better tool</h2>
        <p>
          Honesty helps here. If you fly under EASA alone and expect to keep it that way, a logbook
          built around that one framework is a perfectly good choice, and a few of them are excellent.
          The case for this one is specific: your flying reaches more than one authority, or you expect
          it to, and you&rsquo;d rather not run a spreadsheet for each. That&rsquo;s the pilot it&rsquo;s
          for.
        </p>

        <h2>A note on staying legal</h2>
        <p>
          This tracks your hours and flags your dates; it doesn&rsquo;t replace Part-FCL or a ruling from
          your competent authority. The regulations are the authority, and your currency and rating
          validity are ultimately yours to confirm. What the software does is make the numbers hard to
          lose track of &mdash; which is most of the battle.
        </p>
      </Article>

      <Faq
        items={[
          {
            q: "Does it follow EASA Part-FCL?",
            a: "It's built around it. Your record is kept in the EASA column layout, and recency and rating validity are modelled on Part-FCL — including the FCL.050 duty to keep a record and FCL.060 recent experience — rather than adapted from FAA defaults. You confirm which rules apply to your flying and the app tracks against those.",
          },
          {
            q: "I also fly under the FAA or UK CAA. Can it handle both?",
            a: "Yes. Record each flight once and see your currency and limits under EASA, the FAA and the UK CAA from the same flights — no second logbook, no double entry.",
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

      <CtaBand title={<>Keep an EASA logbook that fits Part-FCL.</>} />
    </MarketingShell>
  );
}
