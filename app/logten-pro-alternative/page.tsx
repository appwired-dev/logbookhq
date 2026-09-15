import type { Metadata } from "next";
import { MarketingShell, PageHero, Article, CompareTable, Faq, CtaBand, Yes, ReconcileVisual, Breadcrumb } from "@/components/marketing/kit";

// Pure static content — no per-request data. Prerender at build so these
// SEO pages are served from the CDN (instant TTFB, no serverless cost).
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "LogTen Pro alternative — web-based and multi-regime",
  description:
    "A LogTen Pro alternative that runs in any browser, not just on Apple: multi-authority currency built in, plus a $249 lifetime option instead of a subscription.",
  alternates: { canonical: "/logten-pro-alternative" },
  openGraph: {
    title: "LogTen Pro alternative — web-based and multi-regime",
    description: "A LogTen Pro alternative that runs in any browser, not just on Apple: multi-authority currency built in, plus a $249 lifetime option instead of a subscription.",
    url: "/logten-pro-alternative",
  },
};

export default function LogTenAlternativePage() {
  return (
    <MarketingShell>
      <Breadcrumb name="LogTen Pro alternative" path="/logten-pro-alternative" />
      <PageHero
        eyebrow="LogTen Pro alternative"
        title={<>Any device.<br />No install.</>}
        visual={<ReconcileVisual />}
        lede={
          <>
            LogTen is about as deep as a flight logbook gets, and if you live in Apple&rsquo;s world and
            enjoy configuring things, it&rsquo;s hard to beat. This page is for the pilots on the other side
            of that sentence &mdash; the ones who want their logbook on any device, and would rather
            multi-authority rules just worked than spend an evening building them.
          </>
        }
      />

      <Article>
        <p>
          Credit to LogTen first. It&rsquo;s deep and mature, and the pilots who use it swear by it &mdash; you
          can bend it into almost any shape you please. The catch is what comes attached: it runs on
          Apple hardware, it bills by subscription, and the bending is yours to do. Whether that&rsquo;s a
          fair trade comes down to how you fly and what you already own.
        </p>
      </Article>

      <CompareTable
        them="LogTen Pro"
        rows={[
          ["Runs on", "Any browser — Mac, Windows, phone, tablet", "Apple only — Mac, iPad, iPhone"],
          ["Multi-authority rules", <Yes key="a">Built in — pick the regimes you fly</Yes>, "Deep, but you configure it"],
          ["Currency & rolling limits", "CARs, FAR 117, EASA ORO.FTL — side by side", "Highly capable, FAA-oriented defaults"],
          ["Regulator-ready export", "CARs, EASA and FAA formats — and more", "Strong for FAA and EASA filings"],
          ["Airline crew schedules", "Not directly — import spreadsheet, CSV, ForeFlight & LogTen exports", <Yes key="b">Reads airline crew schedules directly</Yes>],
          ["Setup", "Import and go", "Deep and configurable — rewards time spent"],
          ["Bring your history", "Reconciles your import against your own totals first", "Imports logbook data — crew schedules included"],
          ["Languages", "English, 한국어, 中文, Español", "English"],
          ["Price", "Free to 100 flights, then $4.99/mo · $49/yr · $249 once", "Subscription"],
        ]}
      />

      <Article>
        <h2>Own your logbook, don&rsquo;t rent it</h2>
        <p>
          LogTen runs on a subscription. That&rsquo;s a reasonable way to fund a mature app, and if it earns
          its keep for you, keep paying it. The objection here is narrower: a logbook is a record you&rsquo;ll
          want for forty years, and a record that stops opening the month a payment lapses is a strange
          thing to trust with a career. So there&rsquo;s a way to own it outright. Free to your first 100
          flights, no card. After that, $4.99 a month or $49 a year if you&rsquo;d rather pay as you go &mdash;
          or $249 once, and you never see a bill again. Buy the lifetime option and the app is simply
          yours.
        </p>

        <h2>Every device, nothing to install</h2>
        <p>
          LogTen is an Apple app, and a good one &mdash; but it means your logbook lives on Macs, iPads and
          iPhones and nowhere else. This opens in a browser instead. The work laptop that happens to run
          Windows, the shared computer at the flying club, the Android phone in your pocket &mdash; each
          shows the same logbook, because there&rsquo;s nothing to install and nothing tied to one platform.
          The honest limit: if you do most of your entry with no signal at all, a native app that keeps
          everything on the device has the edge. For most pilots, a browser and a login is the shorter
          path.
        </p>

        <h2>An import that proves itself first</h2>
        <p>
          Most apps import your history and ask you to trust that it worked. This one reconciles before
          it saves. Point it at a spreadsheet, a CSV, an Apple Numbers file, or a ForeFlight or LogTen
          export &mdash; column headers in another language included &mdash; and it maps the columns, then checks
          its totals against the ones you already keep: total time, PIC, night, approaches. If a number
          is off by an hour, you see the mismatch before anything is committed, not three months later
          when a form disagrees with you. Credit to LogTen here too: its own import reads airline crew
          schedules directly, which no spreadsheet-based import can. If that&rsquo;s how your roster reaches
          your logbook, that&rsquo;s a real convenience.
        </p>

        <h2>Exports a regulator will accept</h2>
        <p>
          A logbook you can&rsquo;t get a clean printout from is only half a logbook. Exports here are shaped
          to what the authorities actually want to see &mdash; Transport Canada (CARs) formats, EASA layouts,
          the FAA columns &mdash; with more added as pilots need them, so the same underlying flights come out
          in the form the regulator in front of you expects. LogTen is strong on this ground: its export
          is about as good as it gets for FAA and EASA filing, and if those are the only two authorities
          you answer to, it will serve you well. The difference is coverage. When your flying crosses
          more frameworks than that, one export that speaks several of them beats keeping a second tool
          for the odd one out.
        </p>

        <h2>Currency that knows the rulebook</h2>
        <p>
          Currency is where a single-authority assumption quietly bites. Being legal under the FAA tells
          you nothing certain about EASA, and a passenger-currency window under one authority isn&rsquo;t the
          same window under another. This tracks currency and rolling flight-time limits &mdash; the last 28,
          90 and 365 days under CARs, FAR 117 and ORO.FTL &mdash; for each authority you fly, from one set of
          flights, and turns a window amber before it lapses rather than after. LogTen can be shaped to
          do a great deal of this; it&rsquo;s deeply configurable, with FAA-oriented defaults out of the box.
          The trade is the evening you spend configuring it, against the regimes arriving already built.
        </p>

        <h2>Your data leaves as easily as it arrived</h2>
        <p>
          Whatever you decide later, your logbook should never be the reason you can&rsquo;t leave. Export the
          whole thing whenever you like, in a format another app can read, and if you try this and go
          back to LogTen, nothing is stranded. The lifetime option is the same promise in money: buy it
          once and the app keeps opening whether or not it ever becomes your main logbook. A career-long
          record deserves that much.
        </p>
      </Article>

      <Article>
        <h2>Where LogTen is the better choice</h2>
        <p>
          If you&rsquo;re all-Apple, want one of the most configurable logbooks around, and enjoy tailoring
          every field and calculation to exactly your liking, LogTen will likely make you happier than
          anything lighter &mdash; this one included. It&rsquo;s a power tool, and for power users that&rsquo;s a
          compliment. Two things in particular it does better: it holds your whole logbook on the device
          for true offline entry, and it can pull your roster straight from an airline crew-scheduling
          feed. If that&rsquo;s how you log, that alone can decide it. No comparison page should pretend
          otherwise.
        </p>

        <h2>Where this one fits better</h2>
        <p>
          The case here is simpler, on purpose. You want to open your logbook on a work laptop and a
          phone without thinking about which platform you&rsquo;re on. You fly under more than one authority
          and want that handled without a configuration project. You&rsquo;d rather pay a few dollars a month,
          or once, than carry another subscription for the rest of your career. If that&rsquo;s you, the trade
          runs the other way.
        </p>

        <h2>Switching takes about two minutes</h2>
        <p>
          Export your LogTen data and import it here. The app maps your columns and reconciles the
          totals against the ones LogTen shows you before it saves anything, so you can confirm your
          history came across cleanly rather than hope it did. Nothing to re-type, and nothing lost if
          you decide to go back.
        </p>
      </Article>

      <Faq
        items={[
          {
            q: "Can I import my LogTen logbook?",
            a: "Yes. Export from LogTen and import the file here. Your columns are mapped and the totals are reconciled against LogTen's before anything is saved, so you can confirm it matched first.",
          },
          {
            q: "Is this as powerful as LogTen?",
            a: "It's more focused, not more configurable. LogTen wins on depth and customization. This wins on running anywhere, handling more than one authority out of the box, price, and getting set up in minutes rather than an evening.",
          },
          {
            q: "Does it run on Windows or Android?",
            a: "Yes. It's web-based, so it runs in any modern browser on Windows, Mac, Android, iPhone and iPad. There's no Apple requirement.",
          },
          {
            q: "Can I export in a format my regulator accepts?",
            a: "Yes. Exports are shaped for Transport Canada (CARs), EASA and FAA formats, with more added as pilots need them. LogTen is strong for FAA and EASA filing; this covers those and more, which matters when you fly under several authorities.",
          },
          {
            q: "Does it read airline crew schedules like LogTen?",
            a: "Not directly — that's a genuine LogTen strength. This imports from spreadsheets, CSV, and ForeFlight, LogTen or Apple Numbers exports, and reconciles them against your totals before saving. If your roster reaches you as a crew-scheduling feed, LogTen has the edge there.",
          },
          {
            q: "If I stop paying, do I lose my logbook?",
            a: "No. You can export your full logbook at any time, so it's never locked in. And the $249 lifetime option lets you own the app outright — it keeps opening whether or not you hold a subscription.",
          },
          {
            q: "What does it cost?",
            a: "Free up to 100 flights with no card, then $4.99/month, $49/year, or $249 once for lifetime access.",
          },
        ]}
      />

      <CtaBand title={<>Bring your LogTen export. Watch it reconcile.</>} />
    </MarketingShell>
  );
}
