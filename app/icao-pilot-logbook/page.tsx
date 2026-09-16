import type { Metadata } from "next";
import { RelatedLinks, MarketingShell, PageHero, Article, Faq, CtaBand, ReconcileVisual, Breadcrumb } from "@/components/marketing/kit";
import { OG_BASE } from "@/lib/seo";

// Pure static content — prerendered at build, served from the CDN.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "ICAO pilot logbook — recency, limits & multi-regime export",
  description:
    "An ICAO pilot logbook for internationally-flying pilots: a clean Annex 1-style record and a typical reference set of limits, that switches to your actual authority (Transport Canada, FAA, EASA, UK CAA) for the exact rules.",
  alternates: { canonical: "/icao-pilot-logbook" },
  openGraph: {
    ...OG_BASE,
    title: "ICAO pilot logbook — recency, limits & multi-regime export",
    description: "A clean ICAO-style record and typical reference limits, that switches to your actual authority (CA/FAA/EASA/UK) for the exact rules.",
    url: "/icao-pilot-logbook",
  },
};

export default function IcaoPage() {
  return (
    <MarketingShell>
      <Breadcrumb name="ICAO pilot logbook" path="/icao-pilot-logbook" />
      <PageHero
        eyebrow="ICAO pilot logbook"
        title={<>Log to<br />ICAO standards.</>}
        visual={<ReconcileVisual />}
        lede={
          <>
            Fly internationally and your logbook has to make sense under whichever authority is in front of
            you. ICAO sets the framework &mdash; the shape of recency in Annex 1, of flight-time limits in
            Annex 6 &mdash; while the State of the Operator sets the actual numbers. This logbook keeps a clean
            ICAO-style record, tracks a typical reference set, and switches to your real authority for the
            exact rules.
          </>
        }
      />

      <Article>
        <p>
          &ldquo;ICAO rules&rdquo; is a useful shorthand and a slight fiction: ICAO harmonises the framework
          that national authorities build on, but it doesn&rsquo;t publish the hour caps a pilot lives by. A
          logbook that pretends otherwise gives you false numbers. This one is honest about the split &mdash;
          and lets you pin down the authority that actually governs your flight.
        </p>

        <h2>ICAO sets the framework; your State sets the numbers</h2>
        <p>
          Annex 6, Part I (4.10) requires operators to set flight-time and duty limits, but leaves the
          figures to the State &mdash; so there is no single &ldquo;ICAO 100 hours.&rdquo; The app carries a clearly
          labelled <em>typical</em> reference set for a quick read, and lets you switch to your governing
          authority &mdash; Transport Canada, the FAA, EASA or the UK CAA &mdash; when you need the exact limits your
          operation is held to. No invented ceilings presented as law.
        </p>

        <h2>Recency in Annex 1 terms</h2>
        <p>
          The recency that keeps you legal to carry passengers &mdash; the recent takeoffs and landings, by day
          and by night, and instrument recency &mdash; tracked from the flights themselves and flagged before a
          window lapses. Where your State tightens or loosens the numbers, switch to it and the same flights
          are re-checked against its rules.
        </p>

        <h2>One logbook for a border-crossing career</h2>
        <p>
          Contract flying, ferry work, an airline that repositions crews across regions &mdash; international
          careers rarely sit under one flag. Instead of a spreadsheet per authority, you record each flight
          once and choose which rules the dashboard checks. Switch anytime; one logbook, no re-entry.
        </p>

        <h2>Bring the logbook you already keep</h2>
        <p>
          Import the spreadsheet or app export you already have &mdash; Excel, CSV, ForeFlight, LogTen, Apple
          Numbers, headers in another language included &mdash; and it maps your columns, then checks the
          imported totals against the ones you already trust before saving anything.
        </p>

        <h2>A note on staying legal</h2>
        <p>
          The typical reference set is a convenience, not a legal source. Your State&rsquo;s regulations and your
          operator&rsquo;s approved limits are the authority; currency is ultimately yours to confirm. What this
          does is keep the numbers in front of you and switch cleanly to the rules that actually apply.
        </p>
      </Article>

      <Faq
        items={[
          {
            q: "Does ICAO set the flight-time limits my logbook should track?",
            a: "Not the numbers. ICAO Annex 6 requires operators to have limits but leaves the figures to the State of the Operator. The app shows a clearly-labelled typical reference set, and lets you switch to your actual authority (Transport Canada, FAA, EASA, UK CAA) for the exact limits.",
          },
          {
            q: "I fly under several national rules. Can it handle that?",
            a: "That's what it's built for. Record each flight once, then set which authority the dashboard checks to see your currency and limits under its rules. Switch anytime in Settings — one logbook, no re-entry.",
          },
          {
            q: "Can I import my current logbook?",
            a: "Yes. Import from Excel, CSV, ForeFlight, LogTen or an Apple Numbers file — including sheets in another language. The import reconciles against your totals before saving so nothing lands wrong.",
          },
          {
            q: "Can I export a clean PDF for an authority or employer?",
            a: "Yes — export a PDF in the FAA, EASA (AMC1 FCL.050) or Transport Canada column layout. It's the standard layout for handover, not a certified filing.",
          },
        ]}
      />

      <RelatedLinks
        links={[
          { href: "/multi-regime-pilot-logbook", label: "Multi-regime logbook" },
          { href: "/faa-easa-logbook", label: "FAA + EASA logbook" },
          { href: "/uk-caa-pilot-logbook", label: "UK CAA pilot logbook" },
        ]}
      />

      <CtaBand title={<>One logbook, every authority you answer to.</>} />
    </MarketingShell>
  );
}
