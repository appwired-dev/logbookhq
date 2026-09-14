import type { Metadata } from "next";
import { MarketingShell, PageHero, Article, CompareTable, Faq, CtaBand, Yes, ReconcileVisual } from "@/components/marketing/kit";

// Pure static content — no per-request data. Prerender at build so these
// SEO pages are served from the CDN (instant TTFB, no serverless cost).
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "A LogTen Pro alternative — web-based, multi-regime, simpler",
  description:
    "A lighter, web-based alternative to LogTen Pro for pilots who want their logbook on any device and rules for more than one authority out of the box. Honest comparison and an easy import.",
  alternates: { canonical: "/logten-pro-alternative" },
};

export default function LogTenAlternativePage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="LogTen Pro alternative"
        title={<>All the power.<br />Any device.</>}
        visual={<ReconcileVisual />}
        lede={
          <>
            LogTen is one of the most capable logbooks ever built, and if you live entirely in Apple&rsquo;s
            world and love configuring things, it&rsquo;s hard to beat. This is for the pilots on the other
            side of that sentence: you want your logbook on any device, and you&rsquo;d rather multi-authority
            rules just worked than spend an evening building them.
          </>
        }
      />

      <Article>
        <p>
          Credit where it&rsquo;s due: LogTen is deep, mature, and beloved for good reason. You can shape it
          into almost anything. The flip side of that power is that it lives on Apple devices, leans on a
          subscription, and asks you to do the shaping. Whether that&rsquo;s a fair trade depends entirely on
          how you fly and what you own.
        </p>
      </Article>

      <CompareTable
        them="LogTen Pro"
        rows={[
          ["Runs on", "Any browser — Mac, Windows, phone, tablet", "Apple only — Mac, iPad, iPhone"],
          ["Multi-authority rules", <Yes key="a">Built in — pick the regimes you fly</Yes>, "Powerful, but you configure it"],
          ["Currency & rolling limits", "CARs, FAR 117, EASA ORO.FTL — side by side", "Highly capable, FAA-oriented defaults"],
          ["Setup", "Import and go", "Deep, configurable — rewards time spent"],
          ["Bring your history", "Reconciles your import against your own totals", "Imports logbook data"],
          ["Languages", "English, 한국어, 中文, Español", "English"],
          ["Price", "Free to 100 flights, then $4.99/mo · $49/yr · $249 once", "Subscription"],
        ]}
      />

      <Article>
        <h2>Where LogTen is the better choice</h2>
        <p>
          If you&rsquo;re all-Apple, want the most configurable logbook on the market, and enjoy tailoring
          every field and calculation to exactly your liking, LogTen will likely make you happier than
          anything lighter &mdash; this one included. It&rsquo;s a power tool, and for power users that&rsquo;s a
          compliment. No comparison page should pretend otherwise.
        </p>

        <h2>Where this one fits better</h2>
        <p>
          The case here is simpler, on purpose. You want to open your logbook on a work laptop and a
          phone without thinking about which platform you&rsquo;re on. You fly under more than one authority
          and want that handled without a configuration project. You&rsquo;d rather pay a few dollars a month,
          or once, than hold another subscription. If that&rsquo;s you, the trade runs the other way.
        </p>

        <h2>Switching is a two-minute job</h2>
        <p>
          Export your LogTen data and import it here. The app maps your columns and reconciles the totals
          against the ones LogTen shows you before it saves anything, so you can confirm your history came
          across cleanly rather than hope it did. Nothing to re-type, and nothing lost if you decide to
          go back.
        </p>
      </Article>

      <Faq
        items={[
          {
            q: "Can I import my LogTen logbook?",
            a: "Yes. Export from LogTen and import the file here. Your columns are mapped and the totals are reconciled against LogTen's before saving, so you can confirm it matched first.",
          },
          {
            q: "Is this as powerful as LogTen?",
            a: "It's more focused, not more configurable. LogTen wins on depth and customization. This wins on running anywhere, handling multiple authorities out of the box, price, and getting set up in minutes rather than an evening.",
          },
          {
            q: "Does it run on Windows or Android?",
            a: "Yes — it's web-based, so it runs in any modern browser on Windows, Mac, Android, iPhone and iPad. There's no Apple requirement.",
          },
          {
            q: "What does it cost?",
            a: "Free up to 100 flights with no card, then $4.99/month, $49/year, or $249 once for lifetime access.",
          },
        ]}
      />

      <CtaBand title={<>Try it with your own LogTen export.</>} />
    </MarketingShell>
  );
}
