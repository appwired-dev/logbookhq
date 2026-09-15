import type { Metadata } from "next";
import { MarketingShell, PageHero, Article, Faq, CtaBand, ReconcileVisual, Breadcrumb } from "@/components/marketing/kit";

// Pure static content — no per-request data. Prerender at build so these
// SEO pages are served from the CDN (instant TTFB, no serverless cost).
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Transport Canada pilot logbook (CARs currency & limits)",
  description:
    "A pilot logbook built for Canadian flying: keep your personal log, track recency under the CARs, and watch your 700-series flight-time limits — and still handle FAA time if you fly N-registered.",
  alternates: { canonical: "/transport-canada-pilot-logbook" },
  openGraph: {
    title: "Transport Canada pilot logbook (CARs currency & limits)",
    description: "A pilot logbook built for Canadian flying: keep your personal log, track recency under the CARs, and watch your 700-series flight-time limits — and still handle FAA time if you fly N-registered.",
    url: "/transport-canada-pilot-logbook",
  },
};

export default function TransportCanadaPage() {
  return (
    <MarketingShell>
      <Breadcrumb name="Transport Canada logbook" path="/transport-canada-pilot-logbook" />
      <PageHero
        eyebrow="For Canadian pilots"
        title={<>Built for<br />Canadian flying.</>}
        visual={<ReconcileVisual />}
        lede={
          <>
            Most logbook software is written to FAA defaults and treats Canadian flying as a checkbox.
            This one is built by a Canadian line pilot, so the CARs aren&rsquo;t an afterthought &mdash; and if
            you also fly an N-registered aircraft, it counts that time too, without a second logbook.
          </>
        }
      />

      <Article>
        <p>
          Transport Canada expects you to keep a personal log, and to be able to show recency and
          totals when it matters &mdash; a ride, a job application, a medical, a ramp check. That&rsquo;s not
          hard in principle. It gets tedious when your software counts hours to someone else&rsquo;s rules and
          leaves you doing the Canadian arithmetic by hand.
        </p>

        <h2>Built around the CARs, not translated into them</h2>
        <ul>
          <li>
            <strong>Your personal log, kept properly.</strong> The record Transport Canada expects,
            with your totals added up the way you keep them &mdash; not forced into an FAA column layout.
          </li>
          <li>
            <strong>Recency you can see at a glance.</strong> The takeoffs and landings behind passenger
            currency, and the training and reviews that keep your licence live, tracked and flagged amber
            before they lapse rather than after.
          </li>
          <li>
            <strong>700-series flight-time limits.</strong> Rolling windows &mdash; the last 28, 90 and 365
            days &mdash; watched against the limits you actually fly under, including CAR 700.28, each window
            green until it isn&rsquo;t.
          </li>
        </ul>

        <h2>If you fly both sides of the border</h2>
        <p>
          Plenty of Canadian pilots log N-registered time, or trained in the States and kept an FAA
          certificate. Instead of a Canadian spreadsheet and an American one, you record each flight once
          and see where you stand under Transport Canada <em>and</em> the FAA from the same data. Add EASA
          to that if your flying reaches Europe. One logbook, each authority&rsquo;s rules applied to it.
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
          The software tracks your hours and flags your windows; it doesn&rsquo;t replace the CARs or your own
          judgement. The regulations are the authority, and currency is ultimately yours to confirm.
          What this does is make the numbers hard to lose track of &mdash; which is most of the battle.
        </p>
      </Article>

      <Faq
        items={[
          {
            q: "Does it follow the Canadian Aviation Regulations?",
            a: "It's built around them. Recency and rolling flight-time limits are modelled on the CARs — including the 700-series and CAR 700.28 — rather than adapted from FAA defaults. You confirm which rules apply to your flying and the app tracks against those.",
          },
          {
            q: "I fly N-registered aircraft too. Can it handle both?",
            a: "Yes. Record each flight once and see your currency and limits under both Transport Canada and the FAA from the same flights — no second logbook, no double entry.",
          },
          {
            q: "Can I import my current Canadian logbook?",
            a: "Yes. Import from Excel, CSV, ForeFlight, LogTen or an Apple Numbers file — including sheets with your own column names. The import reconciles against your totals before saving so nothing lands wrong.",
          },
          {
            q: "Is it a Canadian company?",
            a: "It's built and run by a working Canadian line pilot who uses it for their own logbook. Canadian flying is the starting point, not a bolt-on.",
          },
        ]}
      />

      <CtaBand title={<>Keep a Canadian logbook that counts hours your way.</>} />
    </MarketingShell>
  );
}
