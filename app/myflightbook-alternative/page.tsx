import type { Metadata } from "next";
import { RelatedLinks, MarketingShell, PageHero, Article, CompareTable, Faq, CtaBand, Yes, ReconcileVisual, Breadcrumb } from "@/components/marketing/kit";

// Pure static content — no per-request data. Prerender at build so these
// SEO pages are served from the CDN (instant TTFB, no serverless cost).
import { OG_BASE } from "@/lib/seo";
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "MyFlightbook alternative — modern, multi-regime, import-first",
  description:
    "A MyFlightbook alternative for pilots who fly under more than one authority: a faster, modern logbook with multi-regime currency and regulator-layout export that imports your MyFlightbook CSV.",
  alternates: { canonical: "/myflightbook-alternative" },
  openGraph: {
    ...OG_BASE,
    title: "MyFlightbook alternative — modern, multi-regime, import-first",
    description: "A faster, modern logbook with multi-regime currency and regulator-layout export that imports your MyFlightbook CSV.",
    url: "/myflightbook-alternative",
  },
};

export default function MyFlightbookAlternativePage() {
  return (
    <MarketingShell>
      <Breadcrumb name="MyFlightbook alternative" path="/myflightbook-alternative" />
      <PageHero
        eyebrow="MyFlightbook alternative"
        title={<>Lighter.<br />Multi-regime.</>}
        visual={<ReconcileVisual />}
        lede={
          <>
            A logbook that stays quick the fiftieth time you open it, tracks currency under more than one
            authority out of the box, and prints in your regulator&rsquo;s column layout &mdash; and it reads your
            MyFlightbook CSV export, so trying it costs about a minute.
          </>
        }
      />

      <Article>
        <p>
          MyFlightbook is free and packs in an enormous feature set built up over many years &mdash; and if
          free-and-exhaustive is what you&rsquo;re after, it&rsquo;s a genuinely good answer. This is a different
          one: a modern, focused logbook built around three things MyFlightbook wasn&rsquo;t &mdash; an interface
          that stays out of your way, currency and limits under whichever authority you fly (switch anytime), and an import
          that checks itself before it saves. Here&rsquo;s where that lands.
        </p>
      </Article>

      <CompareTable
        them="MyFlightbook"
        rows={[
          ["Interface", <Yes key="i">Built recently — quick and uncluttered</Yes>, "Dense; function over finish"],
          ["Multi-authority currency & limits", <Yes key="a">CARs, FAR 117, EASA ORO.FTL — pick yours, switch anytime</Yes>, "Deep, customisable — FAA-first"],
          ["Regulator-layout export", <Yes key="e">FAA, EASA (AMC1 FCL.050) & Transport Canada layouts</Yes>, "Exports data (CSV, and more)"],
          ["Import reconciles first", <Yes key="r">Checks totals before it saves</Yes>, "Imports logbook data"],
          ["Languages", <Yes key="l">English, 한국어, 中文, Español</Yes>, "English-first"],
          ["Feature breadth", "Focused: logging, currency, multi-regime limits", "Vast — endorsements, attachments, sharing"],
          ["Price", "Free to 100 flights, then $4.99/mo · $49/yr · $249 once", "Free and open-source"],
        ]}
      />

      <Article>
        <h2>Bring your MyFlightbook logbook over</h2>
        <p>
          MyFlightbook exports your flights to a CSV, and that file is exactly what the import here reads.
          Drop it in, the app maps your columns, and it reconciles the totals against the ones MyFlightbook
          shows you &mdash; total time, PIC, night, approaches &mdash; so every number is confirmed matched before a
          single flight is saved. If a column doesn&rsquo;t line up, you catch it on day one, not three months
          later.
        </p>

        <h2>A logbook that stays out of your way</h2>
        <p>
          MyFlightbook can do a great many things, and the interface shows it. This one is built the other
          way round: the common path &mdash; log a flight, check you&rsquo;re current, print what you need &mdash; is
          quick and uncluttered, on any device, in your language. You give up some of MyFlightbook&rsquo;s
          breadth for that; whether it&rsquo;s a fair trade depends on how much of that breadth you actually use.
        </p>

        <h2>Currency and export that speak your authorities</h2>
        <p>
          Tell it which authorities you fly and it runs each one&rsquo;s rules against the same flights &mdash;
          passenger and IFR recency, and the rolling 28-, 90- and 365-day limits under CARs, FAR 117 or
          ORO.FTL &mdash; and when you need it on paper, exports a PDF in the FAA, EASA (AMC1 FCL.050) or
          Transport Canada column layout. One logbook that counts and prints the way each authority expects,
          instead of a US-first tool you bend to fit.
        </p>

        <h2>Where MyFlightbook still fits</h2>
        <p>
          Honestly: if cost is the deciding factor, MyFlightbook is free and hard to argue with, and if you
          lean on its sheer breadth &mdash; endorsement tracking, attachments, the long tail of things it
          records &mdash; it does more than this does. This isn&rsquo;t here to pull you off a tool that already fits.
          It&rsquo;s here for the pilot who wants a lighter, multi-regime logbook and would happily pay a little
          for it &mdash; and the CSV import means finding out costs you two minutes, either way.
        </p>
      </Article>

      <Faq
        items={[
          {
            q: "Can I import my MyFlightbook logbook?",
            a: "Yes. Export your flights from MyFlightbook as a CSV and import that file here. The app maps your columns and reconciles the totals against the ones MyFlightbook shows you before anything is saved, so you can confirm your history came across cleanly first.",
          },
          {
            q: "MyFlightbook is free — why would I pay for this?",
            a: "Often you shouldn't, and that's fair. Pay for this only if a faster interface, multi-authority currency and limits, regulator-layout export, or the reconciling import are worth a few dollars to you. It's free up to 100 flights, then $4.99/month, $49/year, or $249 once for lifetime access.",
          },
          {
            q: "Does it handle more than one authority?",
            a: "Yes — that's the core of it. Record each flight once; set your authority and it tracks currency and rolling flight-time limits under CARs, FAR 117 or EASA ORO.FTL. Switch the authority anytime, and export in its column layout — one logbook, no re-entry.",
          },
          {
            q: "Does it run on my phone?",
            a: "Yes. It's web-based, so it runs in any modern browser on Windows, Mac, Android, iPhone and iPad — nothing to install, and the same logbook on every one of them.",
          },
        ]}
      />

      <RelatedLinks
        links={[
          { href: "/multi-regime-pilot-logbook", label: "Multi-regime logbook" },
          { href: "/foreflight-logbook-alternative", label: "ForeFlight alternative" },
          { href: "/logten-pro-alternative", label: "LogTen Pro alternative" },
        ]}
      />

      <CtaBand title={<>Bring your MyFlightbook export. See it reconcile.</>} />
    </MarketingShell>
  );
}
