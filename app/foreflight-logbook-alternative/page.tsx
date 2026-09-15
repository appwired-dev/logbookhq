import type { Metadata } from "next";
import { MarketingShell, PageHero, Article, CompareTable, Faq, CtaBand, Yes, ReconcileVisual, Breadcrumb } from "@/components/marketing/kit";

// Pure static content — no per-request data. Prerender at build so these
// SEO pages are served from the CDN (instant TTFB, no serverless cost).
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "ForeFlight logbook alternative for multi-authority pilots",
  description:
    "A ForeFlight logbook alternative for multi-authority pilots: import your ForeFlight export, track currency under each regulator, and take your data anywhere.",
  alternates: { canonical: "/foreflight-logbook-alternative" },
  openGraph: {
    title: "ForeFlight logbook alternative for multi-authority pilots",
    description: "A ForeFlight logbook alternative for multi-authority pilots: import your ForeFlight export, track currency under each regulator, and take your data anywhere.",
    url: "/foreflight-logbook-alternative",
  },
};

export default function ForeFlightAlternativePage() {
  return (
    <MarketingShell>
      <Breadcrumb name="ForeFlight alternative" path="/foreflight-logbook-alternative" />
      <PageHero
        eyebrow="ForeFlight logbook alternative"
        title={<>More than<br />a flight bag.</>}
        visual={<ReconcileVisual />}
        lede={
          <>
            ForeFlight is a superb electronic flight bag, and its logbook is a convenient part of it if you
            live on an iPad and fly under the FAA. If either of those isn&rsquo;t quite you &mdash; you want your
            logbook on any device, or you fly under more than one authority &mdash; here&rsquo;s a straight
            comparison and an easy way to bring your history across.
          </>
        }
      />

      <Article>
        <p>
          First, the honest part: this isn&rsquo;t a knock on ForeFlight. It does a different job. It&rsquo;s a flight
          bag &mdash; charts, planning, weather, plates, the tool you fly the aeroplane with &mdash; and the logbook
          rides along inside it. That&rsquo;s a real convenience, and if your whole flying life is FAA and iPad,
          it may be all the logbook you ever need.
        </p>
        <p>
          This is a different thing on purpose: a dedicated logbook, on the web, built for pilots who don&rsquo;t
          fit the single-authority mould. The differences that actually matter are below.
        </p>
      </Article>

      <CompareTable
        them="ForeFlight Logbook"
        rows={[
          ["What it is", "A dedicated pilot logbook", "A full electronic flight bag; the logbook is one feature"],
          ["Runs on", "Any browser — Mac, Windows, phone, tablet", "Primarily iPhone and iPad (Apple)"],
          ["Regulatory focus", "Multi-regime: CARs, FAR 117, EASA ORO.FTL and more", "Strongest for US / FAA operations"],
          ["Track more than one authority", <Yes key="a">Side by side, from one set of flights</Yes>, "Oriented around a single framework"],
          ["Fill it in with no signal", "A ground logbook — you log the flight after you land", "A flight bag built to run offline in the cockpit"],
          ["Bring your history in", "Reconciles your import against your own totals first", "Exports cleanly — easy to bring here"],
          ["Take your data out", <Yes key="e">Export to a spreadsheet anytime</Yes>, "Exports your logbook data"],
          ["Languages", "English, 한국어, 中文, Español", "English"],
          ["Price", "Free to 100 flights, then $4.99/mo · $49/yr · $249 once", "Subscription, bundled with its flight-bag plans"],
        ]}
      />

      <Article>
        <h2>What it costs, and the way to stop paying</h2>
        <p>
          Pricing is short, and it has a door most subscriptions don&rsquo;t: a way to stop paying without
          losing your logbook. It&rsquo;s free up to 100 flights, no card. After that it&rsquo;s $4.99 a month, $49 a
          year, or $249 once &mdash; and the once is the one to notice. Buy it that way and the logbook is simply
          yours, with nothing left to renew to keep it open. A flight bag can&rsquo;t sell you that, for a fair
          reason: its charts and weather have to stay current, so the subscription earns its keep and the
          logbook rides along inside it. Sensible for a flight bag &mdash; a little strange for a record you may
          want to open in twenty years.
        </p>

        <h2>One logbook, every device</h2>
        <p>
          It runs in a browser, so the same logbook opens on a work laptop, a home Mac, an Android phone or
          an iPad &mdash; one copy, no second app to install, nothing tied to whichever platform you happen to
          own. There&rsquo;s a real limit to that, and it&rsquo;s worth saying plainly: a web logbook needs a
          connection, so you fill it in on the ground, not at altitude. That trade is the right way round.
          The thing that has to keep working with no signal over the ocean is the flight bag &mdash; the moving
          map, the plates, the weather &mdash; and running offline in the cockpit is exactly what ForeFlight is
          built for. Logging the flight is ground work, and a logbook on every device beats one on a single
          tablet.
        </p>

        <h2>Moving your ForeFlight logbook over</h2>
        <p>
          ForeFlight exports your logbook to a file, and that file is what the import reads &mdash; directly, in
          its own column layout, with no cleanup pass in a spreadsheet first. The app maps your columns,
          then reconciles the totals against the ones ForeFlight showed you: total time, PIC, night,
          cross-country, the approach count. Each named total has to agree before a single flight is saved.
          If a column lands in the wrong place or a figure drifts by an hour, the mismatch shows up front
          and you fix the mapping &mdash; nothing is quietly rounded, dropped, or brought in wrong and discovered
          a year later.
        </p>

        <h2>Currency and rolling limits, per authority</h2>
        <p>
          This is the part a logbook built around one framework never set out to do. Tell it which
          authorities you fly and it runs each one&rsquo;s rules against the same flights: passenger and IFR
          recency under each set of regulations, and the rolling flight-time windows &mdash; the last 28, 90 and
          365 days &mdash; measured against the actual limit, whether that&rsquo;s CAR 700.28, FAR 117 or EASA
          ORO.FTL. Each window stays green until it doesn&rsquo;t, and the dates that matter turn amber before
          they lapse rather than after. It models the rules so you can see where you stand; signing for the
          flight is still yours, as it should be.
        </p>

        <h2>Your records leave when you do</h2>
        <p>
          A logbook is a career-long document, so it has no business being held hostage. Export the whole
          thing to an ordinary spreadsheet whenever you like &mdash; not a locked format, a plain file you can
          open anywhere and hand to an examiner, an employer or another app. Cancel and you walk away with
          everything. It&rsquo;s the same reason the import reconciles on the way in: coming or going, your
          records should never be the thing that traps you.
        </p>

        <h2>Where ForeFlight is the better choice</h2>
        <p>
          Plainly: in the cockpit. If what you want is one app to plan, brief and fly &mdash; moving map,
          weather, geo-referenced plates &mdash; a dedicated logbook doesn&rsquo;t replace that, and it isn&rsquo;t trying
          to. Plenty of pilots fly with ForeFlight and keep their logbook here, and the export makes running
          both painless. Pick the tool for the job; they don&rsquo;t have to be the same one.
        </p>

        <h2>Where this one earns its place</h2>
        <p>
          If you fly under more than one authority, want your logbook on a laptop and a phone as readily as
          on a tablet, or simply don&rsquo;t want your records living inside a subscription you keep for other
          reasons &mdash; that&rsquo;s the gap this fills. It reads the logbook you already have and hands it back the
          same way, so trying it costs nothing but the minute it takes to export.
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
            q: "Can I export my logbook back out later?",
            a: "Yes, anytime. Export the whole logbook to a standard spreadsheet you can open anywhere, hand to an examiner or employer, or move into another app. Nothing is locked in, and if you cancel you leave with everything.",
          },
          {
            q: "What if I fly under the FAA and Transport Canada?",
            a: "That's exactly the case it's built for. Record each flight once and see your currency and rolling flight-time limits under each authority side by side, without a second logbook.",
          },
          {
            q: "What does it cost?",
            a: "Free up to 100 flights with no card. After that it's $4.99/month, $49/year, or $249 once for lifetime access — buy it once and the logbook stays yours with nothing to renew.",
          },
        ]}
      />

      <CtaBand title={<>Bring your ForeFlight export. See it reconcile.</>} />
    </MarketingShell>
  );
}
