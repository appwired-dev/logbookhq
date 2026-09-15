import type { Metadata } from "next";
import { MarketingShell, PageHero, Article, CompareTable, Faq, CtaBand, Yes, ReconcileVisual, Breadcrumb } from "@/components/marketing/kit";

// Pure static content — no per-request data. Prerender at build so these
// SEO pages are served from the CDN (instant TTFB, no serverless cost).
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "LogTen Pro alternative — web-based and multi-regime",
  description:
    "A LogTen Pro alternative that runs in any browser, not just on Apple: multi-authority currency built in, regulator-layout exports, and a $249 lifetime option instead of a subscription.",
  alternates: { canonical: "/logten-pro-alternative" },
  openGraph: {
    title: "LogTen Pro alternative — web-based and multi-regime",
    description: "Runs in any browser, not just on Apple: multi-authority currency built in, regulator-layout exports, and a $249 lifetime option instead of a subscription.",
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
            A logbook that opens on every device you own, tracks currency under whichever authority you fly, and
            prints in your regulator&rsquo;s column layout &mdash; without an Apple device, an evening of setup, or a
            subscription that never ends. It reads your LogTen export in about a minute.
          </>
        }
      />

      <Article>
        <p>
          LogTen is a powerful, Apple-only logbook, and power users tailor it to a fine edge. This is the
          opposite bet: run anywhere, handle more than one authority out of the box, and let you own it
          outright. If you&rsquo;d rather your logbook just worked on a laptop and a phone than spend a weekend
          configuring one, this is the trade for you &mdash; here&rsquo;s where the difference lands.
        </p>
      </Article>

      <CompareTable
        them="LogTen Pro"
        rows={[
          ["Runs on", <Yes key="r">Any browser — Mac, Windows, phone, tablet</Yes>, "Apple only — Mac, iPad, iPhone"],
          ["Multi-authority rules", <Yes key="a">Built in — pick the regimes you fly</Yes>, "Configurable, FAA-oriented defaults"],
          ["Currency & rolling limits", <Yes key="c">CARs, FAR 117, EASA ORO.FTL — pick yours, switch anytime</Yes>, "Capable once configured"],
          ["Regulator-layout export", <Yes key="e">FAA, EASA (AMC1 FCL.050) & Transport Canada layouts</Yes>, "PDF and CSV export"],
          ["Set-up", <Yes key="s">Import and go</Yes>, "Deep and configurable — rewards time spent"],
          ["Import reconciles first", <Yes key="i">Checks totals before it saves</Yes>, "Imports logbook data"],
          ["Airline crew schedules", "Not directly — import CSV, ForeFlight & LogTen exports", <Yes key="b">Reads crew schedules directly</Yes>],
          ["Languages", <Yes key="l">English, 한국어, 中文, Español</Yes>, "English"],
          ["Price", <Yes key="p">Free to 100 flights, then $4.99/mo · $49/yr · $249 once</Yes>, "Subscription"],
        ]}
      />

      <Article>
        <h2>Every device, nothing to install</h2>
        <p>
          Your logbook opens in a browser, so the work laptop that runs Windows, the shared computer at the
          flying club, the Android phone in your pocket &mdash; each shows the same logbook, because there&rsquo;s
          nothing to install and nothing tied to one platform. A native Apple app keeps everything on one
          device; a logbook you can reach from any of them is the one you&rsquo;ll actually keep up to date.
        </p>

        <h2>Currency that already knows the rulebook</h2>
        <p>
          Being legal under the FAA tells you nothing certain about EASA, and a passenger-currency window
          under one authority isn&rsquo;t the same window under another. This tracks currency and rolling
          flight-time limits &mdash; the last 28, 90 and 365 days under CARs, FAR 117 and ORO.FTL &mdash; for each
          authority you fly, from one set of flights, and turns a window amber before it lapses rather than
          after. The regimes arrive already built; you don&rsquo;t spend an evening wiring them up.
        </p>

        <h2>Print in your regulator&rsquo;s column layout</h2>
        <p>
          When you need it on paper, export a PDF in the arrangement the authority in front of you expects:
          the FAA layout, the EASA standard column order from AMC1 FCL.050, or the Transport Canada layout &mdash;
          the same underlying flights, laid out the way an examiner reads without translating. It&rsquo;s a
          formatting convenience for handover, not a certified filing, and it covers several frameworks so
          you aren&rsquo;t keeping a second tool for the odd authority out.
        </p>

        <h2>An import that proves itself first</h2>
        <p>
          Most apps import your history and ask you to trust it worked. This one reconciles before it saves.
          Point it at your LogTen export, a spreadsheet, a CSV or an Apple Numbers file &mdash; headers in
          another language included &mdash; and it maps the columns, then checks its totals against the ones you
          already keep: total time, PIC, night, approaches. If a figure is off by an hour, you see it before
          anything is committed, not three months later when a form disagrees with you.
        </p>

        <h2>Own it, don&rsquo;t rent it</h2>
        <p>
          A logbook is a record you&rsquo;ll want for forty years, and one that stops opening the month a payment
          lapses is a strange thing to trust with a career. So there&rsquo;s a way to own it: free to your first
          100 flights, then $4.99 a month or $49 a year if you&rsquo;d rather pay as you go &mdash; or $249 once, and
          you never see a bill again. Export the whole logbook anytime, in a format another app can read;
          coming or going, nothing is stranded.
        </p>

        <h2>Where LogTen still wins</h2>
        <p>
          Two things, said plainly: if you&rsquo;re all-Apple and want to tailor every field and calculation to
          the last detail, LogTen goes deeper than this does; and its import reads an airline crew-scheduling
          feed directly, which a spreadsheet-based import can&rsquo;t. If your roster arrives that way, that alone
          can decide it. Everywhere else &mdash; devices, multiple authorities, price, setup &mdash; the trade runs
          the other way.
        </p>
      </Article>

      <Faq
        items={[
          {
            q: "Can I import my LogTen logbook?",
            a: "Yes. Export from LogTen and import the file here. Your columns are mapped and the totals are reconciled against LogTen's before anything is saved, so you can confirm it matched first.",
          },
          {
            q: "Does it run on Windows or Android?",
            a: "Yes. It's web-based, so it runs in any modern browser on Windows, Mac, Android, iPhone and iPad. There's no Apple requirement.",
          },
          {
            q: "Can I export in my regulator's layout?",
            a: "Yes. Export a PDF in the FAA, EASA (AMC1 FCL.050) or Transport Canada column layout — the arrangement an examiner expects. It's the standard layout for handover, not a certified filing; a couple of EASA-specific cells are inferred or omitted and shown on the export screen.",
          },
          {
            q: "Is this as powerful as LogTen?",
            a: "It's more focused, not more configurable. LogTen wins on depth of customization and reading crew schedules directly. This wins on running anywhere, handling more than one authority out of the box, regulator-layout export, price, and getting set up in minutes.",
          },
          {
            q: "Does it read airline crew schedules like LogTen?",
            a: "Not directly — that's a real LogTen strength. This imports from spreadsheets, CSV, and ForeFlight, LogTen or Apple Numbers exports, and reconciles them against your totals before saving. If your roster reaches you as a crew-scheduling feed, LogTen has the edge there.",
          },
          {
            q: "What does it cost?",
            a: "Free up to 100 flights with no card, then $4.99/month, $49/year, or $249 once for lifetime access.",
          },
        ]}
      />

      <CtaBand title={<>Bring your LogTen export. Own your logbook.</>} />
    </MarketingShell>
  );
}
