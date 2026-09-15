import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell, PageHero, Article, Faq, CtaBand, ReconcileVisual, Breadcrumb } from "@/components/marketing/kit";

// Pure static content — no per-request data. Prerender at build so these
// SEO pages are served from the CDN (instant TTFB, no serverless cost).
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "FAA + EASA logbook for dual-licensed pilots",
  description:
    "Hold an FAA certificate and an EASA licence? Keep one pilot logbook: import once and see each authority's currency and flight-time limits on the same flights.",
  alternates: { canonical: "/faa-easa-logbook" },
  openGraph: {
    title: "FAA + EASA logbook for dual-licensed pilots",
    description: "Hold an FAA certificate and an EASA licence? Keep one pilot logbook: import once and see each authority's currency and flight-time limits on the same flights.",
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
            The flying is one life. The paperwork insists it&rsquo;s two. Keep it one logbook, and let each
            authority read the same flights its own way.
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

        <h2>What one logbook does with both</h2>
        <p>
          You record a flight once. The app applies both the FAA&rsquo;s and EASA&rsquo;s rules to that same flight
          and shows you where you stand under each &mdash; no second sheet, no re-entry.
        </p>
        <ul>
          <li>
            <strong>Currency under each authority.</strong> The dates that matter, tracked under Part 61
            and under Part-FCL, and flagged amber before they lapse rather than after.
          </li>
          <li>
            <strong>Rolling limits watching the right windows.</strong> FAR 117 and ORO.FTL periods
            tracked side by side against the limits you actually fly, each window green until it isn&rsquo;t.
          </li>
          <li>
            <strong>Totals credited each way.</strong> Night, PIC, cross-country, instrument, multi-crew
            &mdash; counted to the FAA&rsquo;s convention and to EASA&rsquo;s, so the total you show is the one that
            authority expects.
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
          single-authority logbook will serve you well, and you can switch the second regime on here the
          day it comes back to life.
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
            a: "You record each flight once and the app applies both the FAA's and EASA's rules to it, so you see currency and flight-time limits under each without keeping a separate logbook for each.",
          },
          {
            q: "Does it handle the different ways the FAA and EASA count time?",
            a: "Yes. Cross-country, PIC, multi-crew and instructor time can be credited to each authority's conventions, so the totals you present are the ones that authority expects rather than a single number that only fits one of them.",
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

      <CtaBand title={<>Hold both tickets? Keep one logbook.</>} />
    </MarketingShell>
  );
}
