import type { Metadata } from "next";
import { MarketingShell, PageHero, Article, CompareTable, Faq, CtaBand, Yes, ReconcileVisual } from "@/components/marketing/kit";

// Pure static content — no per-request data. Prerender at build so these
// SEO pages are served from the CDN (instant TTFB, no serverless cost).
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "A ForeFlight logbook alternative for multi-authority pilots",
  description:
    "Looking for a logbook beyond ForeFlight? A web-based, multi-regime pilot logbook that imports your ForeFlight export and tracks currency under more than one authority. Honest comparison inside.",
  alternates: { canonical: "/foreflight-logbook-alternative" },
};

export default function ForeFlightAlternativePage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="ForeFlight logbook alternative"
        title={<>More than<br />a flight bag.</>}
        visual={<ReconcileVisual />}
        lede={
          <>
            ForeFlight is a superb electronic flight bag, and its logbook is a convenient part of it if
            you live in the Apple ecosystem and fly under the FAA. If either of those isn&rsquo;t quite you
            &mdash; you want your logbook on any device, or you fly under more than one authority &mdash; here&rsquo;s
            a straight comparison and an easy way to bring your history across.
          </>
        }
      />

      <Article>
        <p>
          First, the honest part: this isn&rsquo;t a knock on ForeFlight. It does something different. It&rsquo;s a
          flight bag &mdash; charts, planning, weather, plates, the tool you fly the aeroplane with &mdash; and
          the logbook rides along inside it. That&rsquo;s a real convenience. If your whole flying life is FAA
          and iPad, it may be all the logbook you need.
        </p>
        <p>
          This is a different thing on purpose: a dedicated logbook, on the web, built for pilots who
          don&rsquo;t fit the single-authority mould. Where that matters is below.
        </p>
      </Article>

      <CompareTable
        them="ForeFlight Logbook"
        rows={[
          ["What it is", "A dedicated pilot logbook", "A full electronic flight bag; the logbook is one feature"],
          ["Runs on", "Any browser — Mac, Windows, phone, tablet", "Primarily iPhone and iPad (Apple)"],
          ["Regulatory focus", "Multi-regime: CARs, FAR 117, EASA ORO.FTL and more", "Strongest for US / FAA operations"],
          ["Track more than one authority", <Yes key="a">Side by side, from one set of flights</Yes>, "Oriented around a single framework"],
          ["Bring your history in", "Reconciles your import against your own totals first", "Exports cleanly — easy to bring here"],
          ["Languages", "English, 한국어, 中文, Español", "English"],
          ["Price", "Free to 100 flights, then $4.99/mo · $49/yr · $249 once", "Subscription, bundled with its flight-bag plans"],
        ]}
      />

      <Article>
        <h2>Moving your ForeFlight logbook over</h2>
        <p>
          ForeFlight exports your logbook to a file, and that file is exactly what the import here reads.
          Drop it in and the app maps your columns, then reconciles the totals against the ones ForeFlight
          showed you &mdash; total time, PIC, night, approaches &mdash; so you can confirm every number matched
          before a single flight is saved. If something doesn&rsquo;t line up, you see it up front.
        </p>

        <h2>Where ForeFlight is the better choice</h2>
        <p>
          Plainly: in the cockpit. If what you want is one app to plan, brief and fly &mdash; moving map,
          weather, geo-referenced plates &mdash; a dedicated logbook doesn&rsquo;t replace that, and it isn&rsquo;t trying
          to. Many pilots fly with ForeFlight and keep their logbook here, and the export makes running
          both painless. Pick the tool for the job; they don&rsquo;t have to be the same one.
        </p>

        <h2>Where this one earns its place</h2>
        <p>
          If you fly under more than one authority, want your logbook on a laptop and a phone as readily
          as a tablet, or simply don&rsquo;t want your records living inside a subscription you keep for other
          reasons &mdash; that&rsquo;s the gap this fills. It reads the logbook you already have, so trying it
          costs you nothing but the minute it takes to export.
        </p>
      </Article>

      <Faq
        items={[
          {
            q: "Can I import my ForeFlight logbook?",
            a: "Yes. Export your logbook from ForeFlight and import the file here. The app maps your columns and reconciles the totals against ForeFlight's before saving, so you can confirm it all matched first.",
          },
          {
            q: "Do I have to stop using ForeFlight?",
            a: "No, and most pilots don't. ForeFlight is a flight bag; this is a logbook. It's common to fly with ForeFlight and keep your logbook here — the clean export makes running both easy.",
          },
          {
            q: "Does it work on Windows and Android?",
            a: "Yes. It runs in any modern browser — Windows, Mac, Android, iPhone, iPad — because it's web-based rather than a native app for one platform.",
          },
          {
            q: "What if I fly under the FAA and Transport Canada?",
            a: "That's exactly the case it's built for. Record each flight once and see your currency and rolling flight-time limits under each authority side by side, without a second logbook.",
          },
        ]}
      />

      <CtaBand title={<>Bring your ForeFlight export. See it reconcile.</>} />
    </MarketingShell>
  );
}
