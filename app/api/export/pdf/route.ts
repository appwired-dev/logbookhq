import { createClient } from "@/lib/supabase/server";
import { computeTotals, deriveFlight } from "@/lib/derive";
import { fetchAllFlights } from "@/lib/fetch-flights";
import { isFreeTier } from "@/lib/limits";
import { bucketKey, underLimit } from "@/lib/rate-limit";
import { inDateRange, parsePdfExportRequest, safeAvatarUrl } from "@/lib/pdf/export-request";
import { renderLogbookPdf } from "@/lib/pdf/render";

/**
 * PDF logbook export — a paid-plan feature, enforced here rather than in the
 * browser. The Export page and the Settings backup both POST their display
 * options (lib/pdf/export-request.ts) and get the rendered PDF back; the PDF
 * toolchain is no longer shipped to the client at all.
 *
 * Order: who is asking (session) → may they (tier) → what do they want (body)
 * → render. A free account is refused before a single flight is read.
 *
 * Second-user case — user B must never receive user A's flights:
 *   - Identity comes only from B's session cookie, verified by
 *     auth.getUser() against Supabase Auth. The body has no user id, flight
 *     ids or flight rows; the parser drops any it is sent.
 *   - Flights and the profile are read with the per-request client built from
 *     B's cookies (anon key + B's JWT), so RLS (`auth.uid() = user_id`)
 *     applies, and the queries also filter on B's id explicitly. Never the
 *     service-role client, which would bypass RLS.
 *   - Nothing is cached: the client and the data live inside this request,
 *     the route is dynamic, and the response is `private, no-store`, so no
 *     shared cache can hand A's PDF to B.
 *   - tier is not writable by the pilot (migration 0015 column grants; no
 *     INSERT/DELETE policy on profiles), so B cannot self-upgrade either.
 */
export const dynamic = "force-dynamic";
// Rendering is linear in flights: ~9 ms each on an M1 (3,000 flights ≈ 27 s,
// ~0.6 MB of PDF per 1,000). The project runs on fluid compute, where a Hobby
// function may run 300 s.
export const maxDuration = 300;

/**
 * Above this, one render risks the 2 GB function memory and Vercel's 4.5 MB
 * response cap (both bite around 7,000 flights). Refuse cleanly instead of
 * crashing; a date range still works. Largest production logbook on
 * 2026-10-30: 2,679 flights.
 */
const MAX_PDF_FLIGHTS = 6000;

const NO_STORE = { "Cache-Control": "private, no-store" };
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail(401, "Sign in to export your logbook.");

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("tier, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr) return fail(500, "Couldn't check your plan. Try again.");
  // No profile row reads as free: fail closed.
  if (isFreeTier(profile?.tier)) return fail(403, "PDF export is a paid-plan feature.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid request.");
  }
  const parsed = parsePdfExportRequest(body);
  if (!parsed.ok) return fail(400, parsed.error);
  const opts = parsed.value;

  // Rendering costs server CPU now, so cap it per account. Fails open.
  if (!(await underLimit(bucketKey("pdf", "email", user.id), 30, 3600))) {
    return fail(429, "Too many PDF exports in the last hour. Try again later.");
  }

  const flights = (await fetchAllFlights(supabase, { orderAsc: true, userId: user.id }))
    .map(deriveFlight)
    .filter((f) => inDateRange(f, opts.from, opts.to));
  if (flights.length === 0) return fail(422, "No flights in that date range.");
  if (flights.length > MAX_PDF_FLIGHTS) {
    return fail(413, `A single PDF can hold up to ${MAX_PDF_FLIGHTS.toLocaleString("en-US")} flights. Choose a date range and export it in parts.`);
  }

  let pdf: Buffer;
  try {
    pdf = await renderLogbookPdf({
      flights,
      totals: computeTotals(flights),
      pilotName: opts.pilotName,
      licenseNumber: opts.licenseNumber,
      fromDate: opts.from,
      toDate: opts.to,
      generatedAt: opts.generatedAt,
      avatarUrl: safeAvatarUrl(profile?.avatar_url, process.env.NEXT_PUBLIC_SUPABASE_URL),
      layout: opts.layout,
    });
  } catch (e) {
    console.error("[export/pdf] render failed:", e instanceof Error ? e.message : String(e));
    return fail(500, "PDF rendering failed. Try again.");
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      ...NO_STORE,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="logbookhq-logbook-${opts.layout}.pdf"`,
    },
  });
}
