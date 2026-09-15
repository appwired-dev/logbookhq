import type { Metadata } from "next";
import Link from "next/link";
import { RelatedLinks, MarketingShell, PageHero, Article, Faq, CtaBand, ReconcileVisual, Breadcrumb } from "@/components/marketing/kit";

// Pure static content — no per-request data. Prerender at build so these
// SEO pages are served from the CDN (instant TTFB, no serverless cost).
import { OG_BASE } from "@/lib/seo";
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "FAA + EASA logbook for dual-licensed pilots",
  description:
    "Hold an FAA certificate and an EASA licence? Keep one pilot logbook: import once, and track currency and flight-time limits under whichever authority you set — switch between them anytime.",
  alternates: { canonical: "/faa-easa-logbook" },
  openGraph: {
    ...OG_BASE,
    title: "FAA + EASA logbook for dual-licensed pilots",
    description: "Hold an FAA certificate and an EASA licence? Keep one pilot logbook: import once, and track currency and flight-time limits under whichever authority you set — switch between them anytime.",
    url: "/faa-easa-logbook",
  },
};

export default function FaaEasaPage() {
  return (
    <MarketingShell>
      <Breadcrumb name="FAA + EASA logbook" path="/faa-easa-logbook" />
      <PageHero
        eyebrow="For dual-licensed FAA + EASA pilots"
        title={<>Two rulebooks.<br />One logbook.</>}
        visual={<ReconcileVisual />}
        lede={
          <>
            Plenty of pilots hold both an FAA certificate and an EASA licence &mdash; trained on one side
            of the Atlantic and working the other, or flying an N-registered aircraft on their EASA ticket.
            The flying is one life. The paperwork insists it&rsquo;s two. Keep it one logbook, and read the same
            flights under whichever authority you need &mdash; switch between them anytime.
          </>
        }
      />

      <Article>
        <p>
          The FAA and EASA rarely disagree about whether a flight happened. They disagree about what to
          make of it. The same two hours can be counted and credited differently depending on which
          authority is asking &mdash; and the gaps are small enough to ignore right up until a proficiency
          check, a licence revalidation or a new-hire pack asks you to show your numbers under one specific
          set of rules.
        </p>

        <h2>Where the two authorities quietly diverge</h2>
        <p>
          Hold both credentials for a while and you learn the seams by feel. Three of them do most of the
          damage:
        </p>
        <ul>
          <li>
            <strong>How the time is credited.</strong> Cross-country, PIC, multi-crew and instructor time
            aren&rsquo;t counted the same way under Part 61 and Part-FCL. A total that&rsquo;s right for your US
            record isn&rsquo;t automatically the number an EASA form is asking for.
          </li>
          <li>
            <strong>Currency runs on separate clocks.</strong> Some rules rhyme &mdash; the 90-day passenger
            recency looks familiar on both sides. Others don&rsquo;t: the FAA flight review and IFR recency
            under Part 61 aren&rsquo;t the same machinery as EASA rating revalidation and the instrument
            proficiency check. It&rsquo;s the ones that don&rsquo;t line up that catch people out.
          </li>
          <li>
            <strong>Limits watch different windows.</strong> FAR 117 governs US airline flight and duty
            time; ORO.FTL governs European commercial air transport. Different reference periods, different
            numbers. You can be comfortably legal under one and over the line under the other on the same
            roster.
          </li>
        </ul>
        <p>
          The usual fix is two files &mdash; a US logbook and a European one &mdash; kept in step by hand. It
          holds together until the busy month when you update one, forget the other, and go looking for a
          number you can no longer trust.
        </p>

        <h2>What one logbook does for two tickets</h2>
        <p>
          You record a flight once. Set which authority the dashboard checks &mdash; the FAA or EASA &mdash; and it
          applies those rules to your flights and shows you where you stand. Switch to the other in Settings
          and the same flights are re-checked against its rules. No second sheet, no re-entry.
        </p>
        <ul>
          <li>
            <strong>Currency under the authority you set.</strong> The dates that matter, tracked under
            Part 61 or Part-FCL, and flagged amber before they lapse rather than after.
          </li>
          <li>
            <strong>Rolling limits watching the right windows.</strong> FAR 117 or ORO.FTL periods
            tracked against the limits you actually fly, each window green until it isn&rsquo;t.
          </li>
          <li>
            <strong>Export in either layout.</strong> Print the record in the FAA (14 CFR 61.51) or EASA
            (AMC1 FCL.050) column layout &mdash; whichever office is asking.
          </li>
        </ul>

        <h2>The sharpest case of a bigger idea</h2>
        <p>
          Holding two tickets is just the cleanest example of something broader: a{" "}
          <Link href="/multi-regime-pilot-logbook">multi-regime logbook</Link> that applies any
          authority&rsquo;s rules to one set of flights. If your flying also reaches{" "}
          <Link href="/transport-canada-pilot-logbook">Transport Canada</Link>, the same approach holds
          &mdash; you tell it which rules you fly under, and it tracks each of them from the one record.
        </p>

        <h2>Bring both logbooks over as one</h2>
        <p>
          Switching shouldn&rsquo;t mean re-typing years of flying &mdash; least of all twice. Import the export
          you already have &mdash; ForeFlight, LogTen, Excel, CSV, an Apple Numbers file &mdash; and it maps
          your columns, then reconciles the import against the totals you already trust before it saves
          anything. If you&rsquo;ve been keeping one file per authority, bring both; they land as a single
          logbook, and you see every number matched before you commit.
        </p>

        <h2>Where a single-authority logbook is the better tool</h2>
        <p>
          Worth saying plainly: if one of your two credentials is dormant &mdash; an EASA licence you hold
          but don&rsquo;t currently fly on, or an FAA certificate parked while you fly in Europe &mdash; a good
          single-authority logbook will serve you well, and you can point the dashboard at that authority in
          Settings the day it comes back to life.
        </p>
        <p>
          And none of this stands in for the regulations or for your own currency check. It tracks the
          hours and flags the windows; confirming you&rsquo;re legal to fly is still yours to do. What it takes
          off your plate is rebuilding the same numbers twice, by hand.
        </p>
      </Article>

      <Faq
        items={[
          {
            q: "How is this different from logging under one authority?",
            a: "You record each flight once instead of keeping a file per authority. Set which authority the dashboard checks and it applies those rules to your flights; switch between the FAA and EASA anytime in Settings, and export in either's column layout — one logbook, no re-entry.",
          },
          {
            q: "Can it print in both the FAA and EASA layouts?",
            a: "Yes. Export a PDF in the FAA (14 CFR 61.51) or the EASA (AMC1 FCL.050) column layout from the same flights — the arrangement each office expects. These are the standard column layouts for handover, not certified filings.",
          },
          {
            q: "Which rules does it track?",
            a: "FAA recency under Part 61 and flight-time limits under FAR 117, alongside EASA currency under Part-FCL and flight and duty limits under ORO.FTL. You choose which apply to your flying, and confirm currency against the regulations yourself.",
          },
          {
            q: "Can I import the logbook or logbooks I already keep?",
            a: "Yes. Import from ForeFlight, LogTen, Excel, CSV or an Apple Numbers file — including two separate files if you've been keeping one per authority. The import reconciles against your own totals before saving, so you can see it matched first.",
          },
          {
            q: "What does it cost?",
            a: "Free up to 100 flights with no card. After that it's $4.99/month, $49/year, or $249 once for lifetime access.",
          },
        ]}
      />

      <RelatedLinks
        links={[
          { href: "/multi-regime-pilot-logbook", label: "Multi-regime logbook" },
          { href: "/easa-pilot-logbook", label: "EASA pilot logbook" },
          { href: "/transport-canada-pilot-logbook", label: "Transport Canada logbook" },
        ]}
      />

      <CtaBand title={<>Hold both tickets? Keep one logbook.</>} />
    </MarketingShell>
  );
}
