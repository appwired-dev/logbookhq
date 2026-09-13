import type { Metadata } from "next";
import { MarketingShell, PageHero, Article, Faq, CtaBand, ReconcileVisual } from "@/components/marketing/kit";

// Pure static content — no per-request data. Prerender at build so these
// SEO pages are served from the CDN (instant TTFB, no serverless cost).
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "A multi-regime pilot logbook — one logbook, every authority",
  description:
    "Fly under more than one aviation authority? Keep one logbook that tracks currency and flight-time limits under CAA, EASA, FAA, TCCA and more — instead of a spreadsheet per regulator.",
  alternates: { canonical: "/multi-regime-pilot-logbook" },
};

export default function MultiRegimePage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="For pilots who fly under more than one authority"
        title={<>One logbook.<br />Every authority.</>}
        visual={<ReconcileVisual />}
        lede={
          <>
            Most logbook apps quietly assume you answer to a single regulator. Plenty of pilots
            don&rsquo;t. If you trained in one country and fly in another, hold two licences, or fly
            an N-registered aircraft on a Canadian or European ticket, you already know the tax:
            one set of totals never quite fits every form you have to sign.
          </>
        }
      />

      <Article>
        <p>
          &ldquo;Multi-regime&rdquo; is a clumsy phrase for a common life. It just means your flying is
          governed by more than one authority &mdash; Transport Canada and the FAA, say, or the UK CAA and
          EASA &mdash; and each of them has its own opinion about how your time should be counted and when
          your currency runs out. The rules rarely contradict each other outright. They just don&rsquo;t
          line up, and the gaps are where the work lives.
        </p>

        <h2>Why one grand total isn&rsquo;t enough</h2>
        <p>
          A single &ldquo;total time&rdquo; number feels like it should be portable. In practice, the moment two
          regulators are involved, three things stop agreeing:
        </p>
        <ul>
          <li>
            <strong>How the hours are counted.</strong> Augmented long-haul time, instructor credit, the
            treatment of a heavy-crew rest period &mdash; the conventions differ, and a total that&rsquo;s right
            for one authority can be quietly wrong for another.
          </li>
          <li>
            <strong>What keeps you current.</strong> Passenger currency, IFR recency and the lookback
            windows behind them aren&rsquo;t the same rule with a different logo. Being current under one
            authority tells you very little about the other.
          </li>
          <li>
            <strong>Where your limits sit.</strong> Rolling flight-time limits &mdash; CAR 700.28, FAR 117,
            ORO.FTL &mdash; watch different windows and cut off at different numbers. You can be comfortably
            legal under one and over the line under another on the same day.
          </li>
        </ul>
        <p>
          The usual workaround is a spreadsheet per regulator, kept in sync by hand. It works right up
          until the week you&rsquo;re busy, forget one, and find out at the worst possible moment.
        </p>

        <h2>What this logbook does instead</h2>
        <p>
          You keep one logbook. You record a flight once. The app applies each authority&rsquo;s rules to the
          same underlying flights and shows you where you stand under every regime you&rsquo;ve told it you
          fly &mdash; no second sheet, no re-entry.
        </p>
        <ul>
          <li>
            <strong>Currency and recency, per authority.</strong> The dates that matter, tracked under
            each set of rules and flagged amber before they lapse rather than after.
          </li>
          <li>
            <strong>Rolling limits that watch the right windows.</strong> The last 28, 90 and 365 days
            under the actual regulation you fly, each window green until it isn&rsquo;t.
          </li>
          <li>
            <strong>Totals credited your way.</strong> Night, PIC, cross-country, instrument, multi-engine
            &mdash; each counted to your convention, including half-credit for augmented time if that&rsquo;s how
            you keep them.
          </li>
        </ul>

        <h2>Getting your history in</h2>
        <p>
          None of this helps if moving in means re-typing a decade of flights. It doesn&rsquo;t. Import the
          logbook you already keep &mdash; a spreadsheet, a ForeFlight or LogTen export, an Apple Numbers
          file, even one with its column headers in another language &mdash; and it maps your columns, then
          reconciles the import against the totals you already trust before it saves anything. If the
          numbers don&rsquo;t match your own, you&rsquo;ll see it before you commit, not later.
        </p>

        <h2>Where a single-authority logbook is the better tool</h2>
        <p>
          Honesty helps here. If you fly under one regulator and have no plans to change that, a
          logbook built around that one authority is a perfectly good choice, and some of them are
          excellent. The case for this one is specific: you fly under more than one set of rules, or you
          expect to, and you&rsquo;d rather not run a spreadsheet for each. That&rsquo;s the pilot it&rsquo;s for.
        </p>
      </Article>

      <Faq
        items={[
          {
            q: "Which authorities does it support?",
            a: "Currency and rolling flight-time limits are modelled for the main frameworks pilots ask about, including Transport Canada (CARs), the FAA (FAR 117 / Part 61), and EASA (ORO.FTL), with more added as pilots need them. You choose the ones you fly; the rest stay out of your way.",
          },
          {
            q: "Do I have to enter each flight more than once?",
            a: "No. You record a flight once. The app applies each authority's rules to the same flight data, so adding a second regime doesn't mean a second logbook.",
          },
          {
            q: "Can I move my existing logbook over?",
            a: "Yes. Import from a spreadsheet, CSV, ForeFlight, LogTen, MyFlightbook or an Apple Numbers file — including logbooks with non-English column headers. The import reconciles against your own totals before saving, so you can see it matched before you commit.",
          },
          {
            q: "What does it cost?",
            a: "Free up to 100 flights with no card. After that it's $3/month, $30/year, or $119 once for lifetime access.",
          },
        ]}
      />

      <CtaBand title={<>Fly under more than one flag? Keep one logbook.</>} />
    </MarketingShell>
  );
}
