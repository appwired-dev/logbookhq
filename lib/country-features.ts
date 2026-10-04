/**
 * ISO-3166 alpha-2 country codes ↔ the polygons in public/world-countries.json.
 *
 * Traffic rows store the two-letter code Vercel puts in `x-vercel-ip-country`
 * (see lib/site-stats-core.ts → countryCode). The GeoJSON behind the admin
 * Traffic globe (and the career globe in app/app/charts/Globe.tsx) only has an
 * English `properties.name`, in Natural Earth's abbreviated style
 * ("Dem. Rep. Congo", "Bosnia and Herz.", "United States of America").
 *
 * Names come from `Intl.DisplayNames(["en"], { type: "region" })`, plus an
 * explicit alias table for every feature whose Natural Earth name differs from
 * CLDR English — and for names CLDR has changed between releases (Czechia,
 * North Macedonia, Türkiye, Eswatini), so the mapping does not depend on the
 * ICU data of whichever browser renders it.
 *
 * Pure: no next/*, node:* or DOM imports — shared by the client globe and the
 * tsx test (scripts/country-features.test.ts), which checks every feature in
 * the real file resolves.
 */

/** Current ISO 3166-1 alpha-2 codes, plus XK (Kosovo — user-assigned, but sent by geo-IP providers). */
export const ISO2_CODES: readonly string[] = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
  "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG " +
  "UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW XK"
).split(" ");

/**
 * Feature names that differ from CLDR English, and names pinned because CLDR
 * renamed them between releases or engines disagree. Values are exactly as
 * they appear in public/world-countries.json.
 */
const FEATURE_ALIASES: Readonly<Record<string, string>> = {
  BA: "Bosnia and Herz.",
  BO: "Bolivia",
  CD: "Dem. Rep. Congo",
  CF: "Central African Rep.",
  CG: "Congo",
  CI: "Côte d'Ivoire",
  CZ: "Czechia",
  DO: "Dominican Rep.",
  EH: "W. Sahara",
  FK: "Falkland Is.",
  GB: "United Kingdom",
  GQ: "Eq. Guinea",
  IR: "Iran",
  KP: "North Korea",
  KR: "South Korea",
  LA: "Laos",
  MD: "Moldova",
  MK: "North Macedonia",
  MM: "Myanmar",
  PS: "Palestine",
  RU: "Russia",
  SB: "Solomon Is.",
  SS: "S. Sudan",
  SY: "Syria",
  SZ: "eSwatini",
  TF: "Fr. S. Antarctic Lands",
  TL: "Timor-Leste",
  TR: "Turkey",
  TT: "Trinidad and Tobago",
  TW: "Taiwan",
  TZ: "Tanzania",
  US: "United States of America",
  VE: "Venezuela",
  VN: "Vietnam",
  XK: "Kosovo",
};

const CODE_SET: ReadonlySet<string> = new Set(ISO2_CODES);

let displayNames: Intl.DisplayNames | null | undefined;
function englishRegionName(code: string): string | null {
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      displayNames = null; // very old engine: aliases only
    }
  }
  if (!displayNames) return null;
  try {
    const name = displayNames.of(code);
    return name && name !== code ? name : null;
  } catch {
    return null;
  }
}

/**
 * Comparison key: NFC, typographic apostrophes straightened, "&" spelled out,
 * case and whitespace folded — so "Côte d’Ivoire" (CLDR) meets "Côte d'Ivoire".
 */
export function normalizeCountryName(name: string): string {
  return name
    .normalize("NFC")
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * The world-countries.json feature name for an alpha-2 code (case-insensitive),
 * or null for anything that is not a current code ("XX" = unknown country).
 * A non-null result can still have no polygon — microstates (SG, MT, HK …) are
 * not in the 110 m dataset; on the feature side, match with iso2ForFeatureName.
 */
export function featureNameForIso2(code: string): string | null {
  if (typeof code !== "string") return null;
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c) || !CODE_SET.has(c)) return null;
  return FEATURE_ALIASES[c] ?? englishRegionName(c);
}

let reverseIndex: Map<string, string> | null = null;
function buildReverseIndex(): Map<string, string> {
  const m = new Map<string, string>();
  // Aliases first so they win any collision with a CLDR name.
  for (const [code, name] of Object.entries(FEATURE_ALIASES)) m.set(normalizeCountryName(name), code);
  for (const code of ISO2_CODES) {
    const name = englishRegionName(code);
    if (!name) continue;
    const key = normalizeCountryName(name);
    if (!m.has(key)) m.set(key, code);
  }
  return m;
}

/** The alpha-2 code for a world-countries.json feature name, or null (e.g. "N. Cyprus", "Somaliland"). */
export function iso2ForFeatureName(name: string | null | undefined): string | null {
  if (typeof name !== "string" || !name) return null;
  reverseIndex ??= buildReverseIndex();
  return reverseIndex.get(normalizeCountryName(name)) ?? null;
}
