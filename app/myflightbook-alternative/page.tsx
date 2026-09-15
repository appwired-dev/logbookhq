import type { Metadata } from "next";
import { MarketingShell, PageHero, Article, CompareTable, Faq, CtaBand, Yes, ReconcileVisual, Breadcrumb } from "@/components/marketing/kit";

// Pure static content — no per-request data. Prerender at build so these
// SEO pages are served from the CDN (instant TTFB, no serverless cost).
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "MyFlightbook alternative for multi-authority pilots",
  description:
    "A MyFlightbook alternative for pilots who fly under more than one authority: a lighter, multi-regime logbook that imports your MyFlightbook CSV export.",
  alternates: { canonical: "/myflightbook-alternative" },
  openGraph: {
    title: "MyFlightbook alternative for multi-authority pilots",
    description: "A MyFlightbook alternative for pilots who fly under more than one authority: a lighter, multi-regime logbook that imports your MyFlightbook CSV export.",
    url: "/myflightbook-alternative",
  },
};

export default function MyFlightbookAlternativePage() {
  return (
    <MarketingShell>
      <Breadcrumb name="MyFlightbook alternative" path="/myflightbook-alternative" />
      <PageHero
        eyebrow="MyFlightbook alternative"
        title={<>Lighter on<br />its feet.</>}
        visual={<ReconcileVisual />}
        lede={
          <>
            MyFlightbook is free, open-source, and has been kept up for well over a decade &mdash; no
            upsell, no catch. This isn&rsquo;t a case against it. It&rsquo;s for the pilots who&rsquo;d trade the
            longest feature list for a lighter, quicker logbook that tracks more than one authority
            out of the box &mdash; and since it reads your MyFlightbook export, trying it costs a minute.
          </>
        }
      />

      <Article>
        <p>
          Credit where it&rsquo;s due first. MyFlightbook is free, open-source, and has been quietly
          maintained for years &mdash; a full logbook with no paywall waiting a few screens in. If you&rsquo;ve
          used it, you know how much it packs in. Any honest MyFlightbook alternative has to open by
          saying so.
        </p>
        <p>
          So this page is about one gap, not a verdict. MyFlightbook grew feature by feature over a long
          time, and it shows: the interface is dense and built for function over finish, and its currency
          engine, deep as it is, grew up around FAA rules. This is a logbook built more recently around
          two things instead &mdash; an interface that stays out of your way, and currency and rolling
          limits under more than one authority, side by side &mdash; and it reads the logbook you already
          keep.
        </p>
      </Article>

      <CompareTable
        them="MyFlightbook"
        rows={[
          ["What it is", "A lean, dedicated logbook", "A free, open-source logbook with a huge feature set"],
          ["Interface", "Built recently — quick and uncluttered", "Dense and utilitarian; function over finish"],
          ["Track more than one authority", <Yes key="a">Side by side, from one set of flights</Yes>, "Deep, customisable currency — FAA-first"],
          ["Bring your history in", "Reconciles your import against your own totals first", "Exports to CSV — read directly here"],
          ["Feature breadth", "Focused: logging, currency, multi-regime limits", "Vast — endorsements, attachments, deadlines, sharing"],
          ["Languages", "English, 한국어, 中文, Español", "English-first"],
          ["Price", "Free to 100 flights, then $4.99/mo · $49/yr · $249 once", "Free and open-source; donations welcome"],
        ]}
      />

      <Article>
        <h2>Moving your MyFlightbook logbook over</h2>
        <p>
          MyFlightbook exports your flights to a CSV file, and that file is exactly what the import here
          reads. Drop it in, the app maps your columns, and it reconciles the totals against the ones
          MyFlightbook shows you &mdash; total time, PIC, night, approaches &mdash; so every number is confirmed
          matched before a single flight is saved. If a column doesn&rsquo;t line up, you catch it on day one,
          not three months later.
        </p>

        <h2>Where MyFlightbook is the better choice</h2>
        <p>
          Two places, and neither is small. On price: it&rsquo;s free and open-source, and nothing here beats
          free &mdash; if cost is the deciding factor, the comparison is over and MyFlightbook wins it. On
          depth: if you lean on its breadth &mdash; endorsement tracking, image and document attachments,
          deadlines, sharing, the sheer number of things it can record &mdash; it does more than this logbook
          does, and it does it for nothing. If that depth is what you need, keep it. This isn&rsquo;t out to
          talk you off a tool that already fits.
        </p>

        <h2>Where this one earns its place</h2>
        <p>
          The case for this one is narrower, on purpose. You want a logbook that feels quick and
          uncluttered the fiftieth time you open it, not one you fight. You fly under more than one
          authority &mdash; the CARs and the FAA, say, or EASA on top &mdash; and want currency and rolling
          limits tracked side by side without wiring it up yourself. Maybe you&rsquo;d rather keep your records
          in Korean, Chinese or Spanish than in English. If that&rsquo;s you, the export turns trying it into a
          two-minute job &mdash; and if you decide MyFlightbook was right for you all along, you&rsquo;ve lost
          nothing but the two minutes.
        </p>
      </Article>

      <Faq
        items={[
          {
            q: "Can I import my MyFlightbook logbook?",
            a: "Yes. Export your flights from MyFlightbook as a CSV and import that file here. The app maps your columns and reconciles the totals against the ones MyFlightbook shows you before anything is saved, so you can confirm your history came across cleanly first.",
          },
          {
            q: "Isn't MyFlightbook more feature-complete?",
            a: "In raw breadth, yes — and it's free. MyFlightbook tracks more distinct things than this does. Where this one is ahead: a lighter, faster interface, currency and rolling flight-time limits under more than one authority out of the box, an import that reconciles before it saves, and the interface in four languages.",
          },
          {
            q: "MyFlightbook is free — why would I pay for this?",
            a: "Often you shouldn't, and that's a fair answer. Pay for this only if a faster interface, multi-authority tracking, or the reconciling import are worth a few dollars to you. It's free up to 100 flights with no card, then $4.99/month, $49/year, or $249 once for lifetime access.",
          },
          {
            q: "Does it run on my phone?",
            a: "Yes. It's web-based, so it runs in any modern browser on Windows, Mac, Android, iPhone and iPad — nothing to install, and the same logbook on every one of them.",
          },
        ]}
      />

      <CtaBand title={<>Bring your MyFlightbook export. See it reconcile.</>} />
    </MarketingShell>
  );
}
