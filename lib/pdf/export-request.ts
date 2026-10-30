/**
 * The contract between the browser and POST /api/export/pdf, which renders
 * the PDF logbook on the server for paid accounts only (see that route for
 * the entitlement check and the second-user reasoning).
 *
 * The request carries display options only — layout, date range, the name and
 * licence printed on the cover, and the browser's local "generated" stamp.
 * It never carries flights, a user id or an avatar URL: the server reads
 * those from the signed-in user's own rows, so nothing in the body can select
 * whose logbook is rendered.
 *
 * Safe to import from both Server and Client Components: no server imports,
 * and LogbookPDF is imported for its type only (erased at compile time), so
 * @react-pdf/renderer never reaches a client bundle through this module.
 */
import type { PdfLayout } from "@/lib/pdf/LogbookPDF";
import type { FlightDerived } from "@/lib/types";

export const PDF_EXPORT_PATH = "/api/export/pdf";

/** Every layout LogbookPDF renders. A complete record over PdfLayout, so the
 *  compiler fails if a layout is added there and not accepted here. */
const LAYOUTS: Record<PdfLayout, true> = { comprehensive: true, faa: true, easa: true, cars: true };

/** Cover/footer text fields are free text the pilot types; cap them so a
 *  request can't make the server lay out megabytes of text. */
const MAX_TEXT = 200;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface PdfExportRequest {
  layout: PdfLayout;
  /** Inclusive YYYY-MM-DD bounds; "" = open-ended. */
  from: string;
  to: string;
  pilotName: string;
  licenseNumber: string;
  /** The browser's `new Date().toLocaleString()`, so the stamp printed on the
   *  PDF stays in the pilot's own locale and time zone, as before. */
  generatedAt: string;
}

/**
 * Validate an untrusted request body. The result is rebuilt from the known
 * fields only, so stray keys (`userId`, `flights`, `avatarUrl`, …) are
 * dropped and can never reach the renderer.
 */
export function parsePdfExportRequest(body: unknown): { ok: true; value: PdfExportRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Invalid request." };
  const b = body as Record<string, unknown>;
  if (typeof b.layout !== "string" || !Object.hasOwn(LAYOUTS, b.layout)) return { ok: false, error: "Unknown PDF layout." };
  for (const k of ["from", "to"] as const) {
    if (typeof b[k] !== "string" || (b[k] !== "" && !DATE_RE.test(b[k] as string))) return { ok: false, error: "Dates must be YYYY-MM-DD." };
  }
  for (const k of ["pilotName", "licenseNumber", "generatedAt"] as const) {
    if (typeof b[k] !== "string" || (b[k] as string).length > MAX_TEXT) return { ok: false, error: "Invalid text field." };
  }
  return {
    ok: true,
    value: {
      layout: b.layout as PdfLayout,
      from: b.from as string,
      to: b.to as string,
      pilotName: b.pilotName as string,
      licenseNumber: b.licenseNumber as string,
      generatedAt: b.generatedAt as string,
    },
  };
}

/** The export page's date-range filter. Shared with the server so the count
 *  the page shows is exactly the set of flights the PDF prints. */
export function inDateRange(f: Pick<FlightDerived, "date">, from: string, to: string): boolean {
  if (from && f.date < from) return false;
  if (to && f.date > to) return false;
  return true;
}

/**
 * The avatar is fetched by the server while rendering, and profiles.avatar_url
 * is a column the pilot can write. Only an image in our own public `avatars`
 * bucket is passed to the renderer; anything else is dropped (the cover just
 * renders without a photo) so the server never fetches an arbitrary URL.
 */
export function safeAvatarUrl(url: string | null | undefined, supabaseUrl: string | undefined): string | undefined {
  if (!url || !supabaseUrl) return undefined;
  try {
    const u = new URL(url);
    const ok = u.origin === new URL(supabaseUrl).origin
      && u.pathname.startsWith("/storage/v1/object/public/avatars/");
    return ok ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/** A refused or failed export; `status` is the HTTP status (403 = not a paid plan). */
export class PdfExportError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Ask the server for the PDF. Resolves to the PDF blob, or throws PdfExportError. */
export async function requestLogbookPdf(req: PdfExportRequest): Promise<Blob> {
  const res = await fetch(PDF_EXPORT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok || res.headers.get("content-type") !== "application/pdf") {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new PdfExportError(body?.error ?? `PDF export failed (${res.status}).`, res.status);
  }
  return res.blob();
}
