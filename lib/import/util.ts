/**
 * Low-level helpers shared by the import pipeline.
 *
 * `num`, `parseTimeValue`, the multi/sim aircraft regexes and the legacy
 * takeoff/landing defaults are copies of private helpers in
 * lib/import-formats.ts — kept byte-for-byte compatible so the new pipeline
 * and the legacy parsers agree on numbers, dates and derived fields.
 */

export const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Trim + collapse internal whitespace (incl. NBSP). */
export function collapse(s: string): string {
  return s.replace(/[\s ]+/g, " ").trim();
}

/**
 * Parse a numeric cell, handling US ("1.6", "1,234.56") and European /
 * Korean ("1,6", "0,9") decimal conventions. Copy of import-formats.ts:num.
 */
export function num(v: string | undefined): number {
  const s = (v ?? "").trim();
  if (!s) return 0;
  if (/^-?\d+,\d{1,2}$/.test(s)) {
    const n = parseFloat(s.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  const n = parseFloat(s.replace(/[,$]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Duration text → decimal hours. "1:30" → 1.5, "0130" → 1.5, "1,5" → 1.5,
 * "1.5" → 1.5. Copy of import-formats.ts:parseTimeValue.
 */
export function parseTimeValue(s: string): number {
  const t = (s ?? "").toString().trim();
  if (!t) return 0;
  const hm = t.match(/^(\d{1,3}):(\d{1,2})(?::\d{1,2})?$/);
  if (hm) {
    const h = parseInt(hm[1], 10);
    const mm = parseInt(hm[2], 10);
    if (mm < 60) return h + mm / 60;
  }
  if (/^\d{4}$/.test(t)) {
    const h = parseInt(t.slice(0, 2), 10);
    const mm = parseInt(t.slice(2), 10);
    if (h < 24 && mm < 60) return h + mm / 60;
  }
  return num(t);
}

/** Clock time-of-day → minutes since midnight ("08:30" → 510, "0830" → 510). */
export function parseClockMinutes(s: string): number | null {
  const t = (s ?? "").toString().trim();
  if (!t) return null;
  const hm = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hm) {
    const h = parseInt(hm[1], 10);
    const mm = parseInt(hm[2], 10);
    if (h < 24 && mm < 60) return h * 60 + mm;
  }
  if (/^\d{4}$/.test(t)) {
    const h = parseInt(t.slice(0, 2), 10);
    const mm = parseInt(t.slice(2), 10);
    if (h < 24 && mm < 60) return h * 60 + mm;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  // A few non-English abbreviations that differ from English.
  ene: 1, abr: 4, ago: 8, dic: 12, // es
  mai: 5, okt: 10, dez: 12,        // de
  fév: 2, fev: 2, avr: 4, juin: 6, juil: 7, aoû: 8, aou: 8, déc: 12, // fr
};

function monthFromName(name: string): number | null {
  const key = name.toLowerCase().replace(/\.$/, "");
  if (MONTHS[key] != null) return MONTHS[key];
  const short = key.slice(0, 3);
  return MONTHS[short] ?? null;
}

/** Two-digit year: 00-50 → 2000s, 51-99 → 1900s (same rule as the legacy parsers). */
function expandYear(y: string): number {
  if (y.length === 4) return parseInt(y, 10);
  const n = parseInt(y, 10);
  return n > 50 ? 1900 + n : 2000 + n;
}

export function isValidYMD(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isoDate(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export interface DateReading {
  iso: string;
  /**
   * Present for purely numeric two-part-then-year forms ("05/03/2024") where
   * day and month can be confused. Each reading is null when it is not a
   * valid calendar date, so a column can vote on the convention.
   */
  numeric?: { dayFirstIso: string | null; monthFirstIso: string | null; defaultDayFirst: boolean };
}

/**
 * Parse a date written in any of the common logbook conventions. Returns
 * null when the text is not a date.
 *
 *   ISO 2024-09-27 (optionally followed by a time)      2024.09.27  2024/09/27
 *   27/09/2024  09/27/2024  27.09.2024  27-09-2024  (2- or 4-digit year)
 *   Sep 27, 2024   27 SEP 2024   06-Jun-13   27-sep-2024
 *   2024년 3월 5일   2024年3月5日   2024. 3. 5.
 *
 * `preferDayFirst` decides ambiguous numeric forms; when undefined the
 * separator decides ("/" → month-first, "." and "-" → day-first).
 */
export function parseDateText(input: string, preferDayFirst?: boolean): DateReading | null {
  let t = collapse(input ?? "");
  if (!t) return null;
  // Strip a trailing time component ("2024-05-12 14:30", "5/12/2024 2:30 PM").
  t = t.replace(/[T\s]+\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\s*(?:[ap]\.?m\.?)?(?:z|[+-]\d{2}:?\d{2})?$/i, "").trim();

  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return ymd(+m[1], +m[2], +m[3]);

  m = t.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})\.?$/);
  if (m) return ymd(+m[1], +m[2], +m[3]);

  // Korean / Japanese / Chinese: 2024년 3월 5일, 2024年3月5日
  m = t.match(/^(\d{4})\s*[년年]\s*(\d{1,2})\s*[월月]\s*(\d{1,2})\s*[일日]?$/);
  if (m) return ymd(+m[1], +m[2], +m[3]);

  // Korean Excel short date "2024. 3. 5." (spaces after the dots).
  m = t.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/);
  if (m) return ymd(+m[1], +m[2], +m[3]);

  // Numeric d/m/y or m/d/y with "/", "." or "-".
  m = t.match(/^(\d{1,2})([/.\-])(\d{1,2})\2(\d{2}|\d{4})$/);
  if (m) {
    const a = +m[1], b = +m[3], y = expandYear(m[4]);
    const dayFirstIso = isValidYMD(y, b, a) ? isoDate(y, b, a) : null;
    const monthFirstIso = isValidYMD(y, a, b) ? isoDate(y, a, b) : null;
    if (!dayFirstIso && !monthFirstIso) return null;
    const defaultDayFirst = preferDayFirst ?? m[2] !== "/";
    const iso = defaultDayFirst ? (dayFirstIso ?? monthFirstIso) : (monthFirstIso ?? dayFirstIso);
    return { iso: iso as string, numeric: { dayFirstIso, monthFirstIso, defaultDayFirst } };
  }

  // "Sep 27, 2024", "September 27 2024", "Sep. 27, 2024"
  m = t.match(/^([A-Za-zÀ-ÿ]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2}|\d{4})$/);
  if (m) {
    const mo = monthFromName(m[1]);
    if (mo) return ymd(expandYear(m[3]), mo, +m[2]);
  }

  // "27 SEP 2024", "27 September 2024", "27-Sep-2024", "06-Jun-13", "27.Sep.2024"
  m = t.match(/^(\d{1,2})[\s\-./]+([A-Za-zÀ-ÿ]+)\.?[\s\-./,]+(\d{2}|\d{4})$/);
  if (m) {
    const mo = monthFromName(m[2]);
    if (mo) return ymd(expandYear(m[3]), mo, +m[1]);
  }

  // "Jun-06-13" / "Jun 06 2013"
  m = t.match(/^([A-Za-zÀ-ÿ]+)\.?[\s\-./]+(\d{1,2})[\s\-./,]+(\d{2}|\d{4})$/);
  if (m) {
    const mo = monthFromName(m[1]);
    if (mo) return ymd(expandYear(m[3]), mo, +m[2]);
  }

  // 20240512
  m = t.match(/^((?:19|20)\d{2})(\d{2})(\d{2})$/);
  if (m) return ymd(+m[1], +m[2], +m[3]);

  return null;
}

function ymd(y: number, m: number, d: number): DateReading | null {
  return isValidYMD(y, m, d) ? { iso: isoDate(y, m, d) } : null;
}

/** Legacy-compatible convenience: text → ISO or null (default separator conventions). */
export function parseAnyDate(s: string): string | null {
  return parseDateText(s)?.iso ?? null;
}

/** Excel serial (1900 date system) → ISO. 45000 → 2023-03-15. */
export function excelSerialToISO(n: number): string | null {
  if (!Number.isFinite(n) || n < 1 || n > 80000) return null;
  const ms = Math.round((n - 25569) * 86_400_000);
  const d = new Date(ms);
  return isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Plausible Excel serial for a logbook date (1954 … 2064). */
export function looksLikeExcelSerial(n: number): boolean {
  return Number.isFinite(n) && n >= 20000 && n <= 60000;
}

/**
 * JS Date (as produced by SheetJS with `cellDates`) → ISO calendar date using
 * local components. A 30 s nudge absorbs the 23:59:59.999 float artefacts
 * SheetJS occasionally produces for whole-day serials.
 */
export function dateObjectToISO(d: Date): string | null {
  if (Number.isNaN(d.getTime())) return null;
  const n = new Date(d.getTime() + 30_000);
  const y = n.getFullYear(), m = n.getMonth() + 1, day = n.getDate();
  return isValidYMD(y, m, day) ? isoDate(y, m, day) : null;
}

/** Today's local calendar date as ISO (for future-date checks). */
export function todayISO(): string {
  const t = new Date();
  return isoDate(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

// ---------------------------------------------------------------------------
// Aircraft / row heuristics shared by apply + reconcile
// ---------------------------------------------------------------------------

/** Same test the legacy Numbers parsers use to call a row a simulator session. */
export const SIM_MAKE_RE = /^sim$|^ftd$|sim|alsim/i;

/**
 * Common multi-engine type codes / names (copy of the legacy
 * deriveRoleAndCategory regex; no trailing \b on purpose).
 */
export const MULTI_MAKE_RE = /\b(king\s?air|seneca|baron|navajo|duchess|twin|multi[-\s]?engine|crj|dh[c]?8|dhc|atr|a3\d|a32|a33|a34|a35|a38|b7\d{2}|md\d|e\d{3}|ea\d{2}|cl65)/i;

/** Text that marks a totals / subtotal / header-repeat row. */
export const TOTAL_ROW_RE = /^(?:sub\s*)?totals?\b|^grand\s*total|^sum(?:me)?\b|^합계|^총\s*계|^총계|^소계|^总计|^總計|^合计|^合計|^小计|^gesamt|^summe|^totale?s?\b|^carried\s*forward|^brought\s*forward|^c\/f\b|^b\/f\b/i;

/** Truthy flag cell ("Y", "yes", "✓", "x", "1", "true"). */
export function isTruthyFlag(v: string | number): boolean {
  if (typeof v === "number") return v > 0;
  const s = v.trim().toLowerCase();
  if (!s) return false;
  return /^(y|yes|true|t|x|✓|✔|☑|o|ok|1|예|네|是|sí|si|ja|oui)$/.test(s);
}

/** Falsy flag cell ("N", "no", "0", "false", "-"). */
export function isFalsyFlag(v: string | number): boolean {
  if (typeof v === "number") return v === 0;
  const s = v.trim().toLowerCase();
  return /^(n|no|false|f|0|아니오|否|nein|non)$/.test(s);
}

// ---------------------------------------------------------------------------
// Header text normalisation (shared by mapping, templates, fingerprint)
// ---------------------------------------------------------------------------

/**
 * Normalise one header segment for matching / fingerprinting: NFKC, split
 * camelCase ("DayLandingsFullStop" → "day landings full stop") and
 * snake_case, lowercase, punctuation → space, collapse whitespace.
 * Letters, digits and CJK are kept; everything else becomes a space.
 */
export function normaliseHeader(s: string): string {
  return (s ?? "")
    .normalize("NFKC")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// SHA-1 (pure TypeScript)
// ---------------------------------------------------------------------------
//
// The fingerprint has to be computable wherever `@/lib/import` is imported —
// the wizard's client components pull the barrel in, so Node's `crypto`
// module is off the table. This is the standard FIPS 180-1 algorithm over
// the UTF-8 bytes of the input; the fixture test cross-checks it against
// `node:crypto`.

export function sha1Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  // Pad: 0x80, zeros, 64-bit big-endian length; total a multiple of 64 bytes.
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x1_0000_0000));
  view.setUint32(padded.length - 4, bitLen >>> 0);

  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  const rotl = (x: number, n: number) => ((x << n) | (x >>> (32 - n))) >>> 0;

  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const t = (rotl(a, 5) + (f >>> 0) + e + k + w[i]) >>> 0;
      e = d; d = c; c = rotl(b, 30); b = a; a = t;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((x) => x.toString(16).padStart(8, "0")).join("");
}
