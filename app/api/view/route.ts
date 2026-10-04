import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_BEACON_BYTES,
  SITE_ORIGIN,
  countryCode,
  deviceClass,
  isBotUA,
  parseViewBeacon,
  privacySignal,
  sourceLabel,
} from "@/lib/site-stats-core";

/**
 * First-party, cookieless page-view beacon (sent by components/SiteStats.tsx).
 * Each accepted beacon becomes exactly one record_page_view() call, which only
 * increments per-UTC-day, per-dimension totals (supabase/migrations/0021).
 *
 * Headers read: Origin, Sec-GPC / DNT, User-Agent and Sec-CH-UA-Mobile (in
 * memory only, for bot and device class, then dropped), Content-Length, and
 * the country code Vercel derives at its edge. Never read: the client IP or
 * any IP-bearing header, region/city/lat-long headers, cookies. Nothing is
 * logged. There is deliberately no per-IP rate limit (it would have to process
 * and store IPs); abuse is bounded by the origin allowlist, the validation in
 * parseViewBeacon, and the per-day caps and ceiling inside record_page_view.
 *
 * POST only. Every outcome returns the same empty 204, so a caller can't tell
 * a counted view from a dropped one.
 */
export const dynamic = "force-dynamic";

const done = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_STATS_ENABLED !== "1") return done(); // ship dark (inlined at build time)

  // Production: the live origin only. Locally: STATS_DEV_ORIGIN (e.g. http://localhost:3030).
  // STATS_DEV_ORIGIN is never set on Vercel, so preview deployments never count.
  const allowed = process.env.VERCEL_ENV === "production" ? SITE_ORIGIN : process.env.STATS_DEV_ORIGIN;
  const h = req.headers;
  if (!allowed || h.get("origin") !== allowed) return done(); // stops cross-site browser injection (not curl)
  if (privacySignal((name) => h.get(name))) return done(); // Sec-GPC: 1 / DNT: 1

  const ua = h.get("user-agent") ?? "";
  if (isBotUA(ua)) return done();

  const len = Number(h.get("content-length"));
  if (!Number.isFinite(len) || len <= 0 || len > MAX_BEACON_BYTES) return done(); // missing or oversize: drop unread

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return done(); // client aborted mid-body
  }
  const beacon = parseViewBeacon(raw);
  if (!beacon) return done();

  const args = {
    p_page: beacon.page,
    p_landing: beacon.landing,
    p_source: beacon.landing ? sourceLabel(beacon.ref, beacon.utmSource) : null,
    p_campaign: beacon.landing ? beacon.campaign : null,
    p_country: countryCode(h.get("x-vercel-ip-country")),
    p_device: deviceClass(ua, h.get("sec-ch-ua-mobile")),
  };

  // After the response, so the beacon never waits on the database. createAdminClient() throws
  // synchronously when its env is missing, so it is constructed inside the try. Best-effort, silent.
  after(async () => {
    try {
      await createAdminClient().rpc("record_page_view", args);
    } catch {
      // a lost count is acceptable; never surface it to the visitor
    }
  });

  return done();
}
