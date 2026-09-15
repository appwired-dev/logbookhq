import type { Metadata } from "next";
import { RelatedLinks, MarketingShell, PageHero, Article, CompareTable, Faq, CtaBand, Yes, ReconcileVisual, Breadcrumb } from "@/components/marketing/kit";

// Pure static content — no per-request data. Prerender at build so these
// SEO pages are served from the CDN (instant TTFB, no serverless cost).
import { OG_BASE } from "@/lib/seo";
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "ForeFlight logbook alternative for multi-authority pilots",
  description:
    "A ForeFlight logbook alternative for multi-authority pilots: one logbook on every device, currency under whichever regulator you fly, and your ForeFlight export read in a minute.",
  alternates: { canonical: "/foreflight-logbook-alternative" },
  openGraph: {
    ...OG_BASE,
    title: "ForeFlight logbook alternative for multi-authority pilots",
    description: "One logbook on every device, currency under whichever regulator you fly, and your ForeFlight export read in a minute.",
    url: "/foreflight-logbook-alternative",
  },
};

export default function ForeFlightAlternativePage() {
  return (
    <MarketingShell>
      <Breadcrumb name="ForeFlight alternative" path="/foreflight-logbook-alternative" />
      <PageHero
        eyebrow="ForeFlight logbook alternative"
        title={<>Off the tablet.<br />Across every regulator.</>}
        visual={<ReconcileVisual />}
        lede={
          <>
            Your logbook shouldn&rsquo;t be locked to one tablet or wired to one regulator. ForeFlight&rsquo;s
            logbook lives inside an iPad subscription built around the FAA &mdash; fine until you fly under a
            second authority or open a laptop. This is a dedicated logbook that runs on every device, tracks
            currency under whichever authority you fly, and reads your ForeFlight export in about a minute.
          </>
        }
      />

      <Article>
        <p>
          A logbook is a career-long record. It should open on any device you own, count your hours under
          every authority you answer to, and leave with you if you ever go. A logbook bundled inside a
          flight bag &mdash; on one platform, under one regulator, behind a subscription &mdash; does none of those
          three. That gap is the whole reason to keep your logbook here instead.
        </p>
      </Article>

      <CompareTable
        them="ForeFlight Logbook"
        rows={[
          ["What it is", "A dedicated pilot logbook", "A flight bag; the logbook is one bundled feature"],
          ["Runs on", <Yes key="r">Any browser — Mac, Windows, phone, tablet</Yes>, "Primarily iPhone and iPad (Apple)"],
          ["Track more than one authority", <Yes key="a">CARs, FAR 117, EASA ORO.FTL and more — pick yours, switch anytime</Yes>, "Oriented around the FAA"],
          ["Import your history", <Yes key="i">Reconciles your import against your own totals first</Yes>, "Exports cleanly — easy to bring here"],
          ["Take your data out", <Yes key="e">Full spreadsheet export, anytime, no lock-in</Yes>, "Exports your logbook data"],
          ["Languages", <Yes key="l">English, 한국어, 中文, Español</Yes>, "English"],
          ["Price", <Yes key="p">Free to 100 flights, then $4.99/mo · $49/yr · $249 once</Yes>, "Subscription, bundled with flight-bag plans"],
        ]}
      />

      <Article>
        <h2>Currency and limits under every authority you fly</h2>
        <p>
          This is the part a logbook built around one framework was never meant to do. Set the authority
          you fly and it runs those rules against your flights: passenger and IFR recency, and the rolling
          flight-time windows &mdash; the last 28, 90 and 365 days &mdash; measured against the real limit, whether
          that&rsquo;s CAR 700.28, FAR 117 or EASA ORO.FTL. Each window stays green until it doesn&rsquo;t, and the
          dates that matter turn amber before they lapse, not after. Fly under a different authority next
          month? Switch it in Settings and the same flights are re-checked against those rules &mdash; one
          logbook, no re-entry.
        </p>

        <h2>One logbook, every device</h2>
        <p>
          It runs in a browser, so the same logbook opens on a work laptop, a home Mac, an Android phone
          and an iPad &mdash; one copy, nothing to install, nothing tied to whichever platform you happen to
          own. Log your flights from wherever you actually do the paperwork, not only from the one tablet
          that has the app.
        </p>

        <h2>Your ForeFlight export, read in a minute</h2>
        <p>
          ForeFlight exports your logbook to a file, and that file is what the import reads directly &mdash; no
          cleanup pass in a spreadsheet first. It maps your columns, then reconciles the totals against the
          ones ForeFlight showed you: total time, PIC, night, cross-country, the approach count. Every named
          total has to agree before a single flight is saved, so if a column lands wrong or a figure drifts
          by an hour, you see it up front and fix it &mdash; nothing is quietly rounded, dropped, or discovered
          a year later.
        </p>

        <h2>Pay once, and stop paying</h2>
        <p>
          It&rsquo;s free up to 100 flights with no card. After that it&rsquo;s $4.99 a month, $49 a year, or $249
          once &mdash; and the once is the one to notice: buy it that way and the logbook is simply yours, with
          nothing left to renew to keep it open. A flight bag can&rsquo;t offer that, and shouldn&rsquo;t &mdash; its
          charts and weather have to stay current, so the logbook is stuck riding along inside a subscription
          that never ends. Your record shouldn&rsquo;t be.
        </p>

        <h2>Your records leave when you do</h2>
        <p>
          Export the whole logbook to an ordinary spreadsheet whenever you like &mdash; a plain file you can open
          anywhere and hand to an examiner, an employer or another app. Cancel and you walk away with
          everything. Coming or going, your records are never the thing that traps you.
        </p>

        <h2>Keep ForeFlight for the cockpit</h2>
        <p>
          None of this is a shot at ForeFlight &mdash; for planning, briefing and flying, a moving map with live
          weather and geo-referenced plates is exactly what you want, and nothing here replaces it. Plenty
          of pilots fly with ForeFlight and keep their logbook here; the clean export makes running both
          effortless. Fly with the flight bag. Just keep the logbook somewhere it can follow you across
          authorities and devices, and somewhere you can always walk away with it.
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
            a: "No — fly with it. ForeFlight is a flight bag; this is a logbook. Plenty of pilots fly with ForeFlight and keep their logbook here, and the clean export makes running both easy.",
          },
          {
            q: "Does it work on Windows and Android?",
            a: "Yes. It runs in any modern browser — Windows, Mac, Android, iPhone, iPad — because it's web-based rather than a native app for one platform.",
          },
          {
            q: "What if I fly under the FAA and Transport Canada?",
            a: "That's exactly what it's built for. Record each flight once; set your authority and see your currency and rolling flight-time limits under its rules. Switch between them anytime in Settings — one logbook, no re-entry.",
          },
          {
            q: "Can I get my logbook back out later?",
            a: "Anytime. Export the whole logbook to a standard spreadsheet you can open anywhere or move into another app. Nothing is locked in, and if you cancel you leave with everything.",
          },
          {
            q: "What does it cost?",
            a: "Free up to 100 flights with no card. After that it's $4.99/month, $49/year, or $249 once for lifetime access — buy it once and the logbook stays yours with nothing to renew.",
          },
        ]}
      />

      <RelatedLinks
        links={[
          { href: "/multi-regime-pilot-logbook", label: "Multi-regime logbook" },
          { href: "/logten-pro-alternative", label: "LogTen Pro alternative" },
          { href: "/myflightbook-alternative", label: "MyFlightbook alternative" },
        ]}
      />

      <CtaBand title={<>Bring your ForeFlight export. Keep your logbook for good.</>} />
    </MarketingShell>
  );
}
