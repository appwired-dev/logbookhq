/**
 * LogbookHQ PDF document. Cover + landscape flight pages + totals summary.
 *
 * Supports selectable column LAYOUTS so the same flights can be printed in the
 * arrangement a given authority expects:
 *   - comprehensive : the full LogbookHQ detail layout (default, unchanged).
 *   - faa           : conventional US 14 CFR 61.51 layout.
 *   - easa          : EASA AMC1 FCL.050 standard column order (the "EASA layout").
 *   - cars          : conventional Transport Canada (CAR 401.08) layout.
 *
 * Honesty note: none of these are "certified/approved" formats. FAA/TC prescribe
 * required PARTICULARS (not a rigid grid); the EASA column format is AMC1
 * FCL.050 — an Acceptable Means of Compliance, i.e. the standard/recommended
 * layout, not a legal mandate. A few EASA cells we can't populate faithfully yet
 * (departure/arrival clock times; a true single-vs-multi-pilot flag; IFR-flight
 * time) are left blank or approximated and disclosed in the UI.
 */
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { FlightDerived, Totals } from "@/lib/types";
import { parseRoute } from "@/lib/routes";

export type PdfLayout = "comprehensive" | "faa" | "easa" | "cars";

const ROWS_PER_PAGE = 24;

const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 28, paddingHorizontal: 22, fontSize: 7, fontFamily: "Helvetica", color: "#0f172a" },
  cover: { paddingTop: 80, paddingHorizontal: 60, fontFamily: "Helvetica" },
  coverTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  coverMeta: { fontSize: 11, color: "#475569", marginBottom: 2 },
  coverSection: { marginTop: 36, marginBottom: 16 },
  coverSectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 6, color: "#0f172a", textTransform: "uppercase", letterSpacing: 1 },
  statRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottom: "1pt solid #e2e8f0" },
  statLabel: { fontSize: 10, color: "#475569" },
  statValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  certBlock: { marginTop: 60, paddingTop: 20, borderTop: "1pt solid #cbd5e1" },
  certText: { fontSize: 9, color: "#475569", marginBottom: 30 },
  sigLine: { borderTop: "1pt solid #0f172a", paddingTop: 4, fontSize: 9, width: 240 },

  pageHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  pageTitle: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  pageMeta: { fontSize: 7, color: "#475569" },

  table: { borderTop: "1pt solid #94a3b8", borderLeft: "1pt solid #94a3b8" },
  thRow: { flexDirection: "row", backgroundColor: "#0f172a", color: "#ffffff", borderBottom: "1pt solid #94a3b8" },
  th: { paddingHorizontal: 2, paddingVertical: 3, fontSize: 6, fontFamily: "Helvetica-Bold", borderRight: "1pt solid #94a3b8", textAlign: "center" },
  tr: { flexDirection: "row", borderBottom: "1pt solid #cbd5e1" },
  trAlt: { backgroundColor: "#f8fafc" },
  td: { paddingHorizontal: 2, paddingVertical: 2, fontSize: 6, borderRight: "1pt solid #e2e8f0" },
  subtotalRow: { flexDirection: "row", borderTop: "1pt solid #0f172a", borderBottom: "1pt solid #0f172a", backgroundColor: "#f1f5f9" },
  subtotalCell: { paddingHorizontal: 2, paddingVertical: 3, fontSize: 6, fontFamily: "Helvetica-Bold", borderRight: "1pt solid #94a3b8", textAlign: "right" },
  pageFooter: { position: "absolute", bottom: 14, left: 22, right: 22, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#64748b" },
  remarksRow: { borderBottom: "1pt solid #cbd5e1", backgroundColor: "#fbfcfe", paddingHorizontal: 3, paddingVertical: 2 },
  remarksText: { fontSize: 6, color: "#334155", fontStyle: "italic" },
});

type Align = "center" | "right";
interface Col {
  label: string;
  w: number;
  align?: Align;
  key?: string;                          // direct FlightDerived field
  calc?: (r: FlightDerived) => number | string; // derived value (number => numeric column)
  snug?: boolean;                        // keep width fixed (don't stretch to fill)
}

function fmtNum(n: number): string {
  if (!n) return "";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}
const num = (r: FlightDerived, k: string): number => Number((r as FlightDerived & Record<string, unknown>)[k] ?? 0) || 0;
const T = (r: FlightDerived): number => num(r, "total_time");
const inCat = (r: FlightDerived, ...cats: string[]): boolean => cats.includes(r.category as string);
const roleTime = (r: FlightDerived, ...roles: string[]): number => (roles.includes(r.role as string) ? T(r) : 0);
function fromTo(r: FlightDerived): [string, string] {
  const arcs = parseRoute(r.route);
  if (!arcs.length) return ["", ""];
  return [arcs[0][0], arcs[arcs.length - 1][1]];
}

// ---- comprehensive (unchanged default) ----
const COLS_COMPREHENSIVE: Col[] = [
  { key: "date", label: "Date", w: 38, align: "center" },
  { key: "make_model", label: "Aircraft", w: 34, snug: true },
  { key: "registration", label: "Reg", w: 38 },
  { key: "route", label: "Route", w: 54 },
  { key: "pic", label: "PIC", w: 36 },
  { key: "copilot", label: "Co-Pilot", w: 36 },
  { key: "category", label: "Cat", w: 18, align: "center" },
  { key: "role", label: "Role", w: 22, align: "center" },
  { key: "se_dual_day", label: "SE D Du", w: 24, align: "right" },
  { key: "se_pic_day", label: "SE D PIC", w: 24, align: "right" },
  { key: "se_dual_night", label: "SE N Du", w: 24, align: "right" },
  { key: "se_pic_night", label: "SE N PIC", w: 24, align: "right" },
  { key: "me_dual_day", label: "ME D Du", w: 24, align: "right" },
  { key: "me_pic_day", label: "ME D PIC", w: 24, align: "right" },
  { key: "me_fo_day", label: "ME D FO", w: 24, align: "right" },
  { key: "me_aug_day", label: "ME D AU", w: 24, align: "right" },
  { key: "me_dual_night", label: "ME N Du", w: 24, align: "right" },
  { key: "me_pic_night", label: "ME N PIC", w: 24, align: "right" },
  { key: "me_fo_night", label: "ME N FO", w: 24, align: "right" },
  { key: "me_aug_night", label: "ME N AU", w: 24, align: "right" },
  { key: "actual_inst", label: "Act In", w: 22, align: "right" },
  { key: "hood_inst", label: "Hood", w: 20, align: "right" },
  { key: "sim_inst", label: "Sim", w: 20, align: "right" },
  { key: "ifr_approaches", label: "App", w: 18, align: "right" },
  { key: "precision_approaches", label: "Prec", w: 18, align: "right" },
  { key: "non_precision_approaches", label: "NPr", w: 18, align: "right" },
  { key: "holds", label: "Hld", w: 18, align: "right" },
  { key: "cfi_time", label: "CFI", w: 22, align: "right" },
  { key: "total_time", label: "Total", w: 26, align: "right" },
];

// ---- FAA — conventional 14 CFR 61.51 ----
const COLS_FAA: Col[] = [
  { key: "date", label: "Date", w: 38, align: "center" },
  { key: "make_model", label: "Make/Model", w: 34, snug: true },
  { key: "registration", label: "Ident", w: 34 },
  { calc: (r) => fromTo(r)[0], label: "From", w: 30, align: "center" },
  { calc: (r) => fromTo(r)[1], label: "To", w: 30, align: "center" },
  { calc: (r) => (inCat(r, "SE") ? T(r) : 0), label: "ASEL", w: 24, align: "right" },
  { calc: (r) => (inCat(r, "ME") ? T(r) : 0), label: "AMEL", w: 24, align: "right" },
  { calc: (r) => (inCat(r, "SES") ? T(r) : 0), label: "ASES", w: 22, align: "right" },
  { calc: (r) => (inCat(r, "MES") ? T(r) : 0), label: "AMES", w: 22, align: "right" },
  { calc: (r) => (inCat(r, "HELI") ? T(r) : 0), label: "Heli", w: 22, align: "right" },
  { calc: (r) => roleTime(r, "PIC"), label: "PIC", w: 24, align: "right" },
  { calc: (r) => roleTime(r, "SIC", "FO"), label: "SIC", w: 24, align: "right" },
  { calc: (r) => roleTime(r, "DUAL"), label: "Dual", w: 24, align: "right" },
  { key: "cfi_time", label: "CFI", w: 22, align: "right" },
  { key: "day_time", label: "Day", w: 24, align: "right" },
  { key: "night_time", label: "Night", w: 24, align: "right" },
  { calc: (r) => num(r, "xc_day") + num(r, "xc_night"), label: "XC", w: 24, align: "right" },
  { key: "actual_inst", label: "Act Inst", w: 22, align: "right" },
  { key: "hood_inst", label: "Sim Inst", w: 22, align: "right" },
  { key: "sim_inst", label: "FTD", w: 20, align: "right" },
  { key: "ifr_approaches", label: "Appr", w: 18, align: "right" },
  { key: "landings_day", label: "Ldg D", w: 20, align: "right" },
  { key: "landings_night", label: "Ldg N", w: 20, align: "right" },
  { key: "total_time", label: "Total", w: 26, align: "right" },
];

// ---- EASA — AMC1 FCL.050 standard column order ----
const COLS_EASA: Col[] = [
  { key: "date", label: "Date", w: 38, align: "center" },
  { calc: (r) => fromTo(r)[0], label: "Dep", w: 30, align: "center" },
  { calc: (r) => fromTo(r)[1], label: "Arr", w: 30, align: "center" },
  { key: "make_model", label: "Make/Model", w: 34, snug: true },
  { key: "registration", label: "Reg", w: 34 },
  { calc: (r) => (!r.multi_pilot && inCat(r, "SE", "SES") ? T(r) : 0), label: "SP SE", w: 24, align: "right" },
  { calc: (r) => (!r.multi_pilot && inCat(r, "ME", "MES") ? T(r) : 0), label: "SP ME", w: 24, align: "right" },
  { calc: (r) => (r.multi_pilot ? T(r) : 0), label: "MP", w: 24, align: "right" },
  { key: "total_time", label: "Total", w: 26, align: "right" },
  { calc: (r) => (r.role === "PIC" ? "SELF" : (r.pic ?? "")) as string, label: "PIC name", w: 44 },
  { key: "landings_day", label: "Ldg D", w: 20, align: "right" },
  { key: "landings_night", label: "Ldg N", w: 20, align: "right" },
  { key: "night_time", label: "Night", w: 24, align: "right" },
  { key: "actual_inst", label: "IFR", w: 24, align: "right" },
  { calc: (r) => roleTime(r, "PIC"), label: "Fn PIC", w: 24, align: "right" },
  { calc: (r) => roleTime(r, "FO", "SIC"), label: "Fn Co", w: 24, align: "right" },
  { calc: (r) => roleTime(r, "DUAL"), label: "Fn Dual", w: 24, align: "right" },
  { key: "cfi_time", label: "Fn Instr", w: 24, align: "right" },
  { key: "sim_inst", label: "FSTD", w: 24, align: "right" },
];

// ---- CARs — conventional Transport Canada (CAR 401.08) ----
const COLS_CARS: Col[] = [
  { key: "date", label: "Date", w: 36, align: "center" },
  { key: "make_model", label: "Type", w: 32, snug: true },
  { key: "registration", label: "Reg", w: 32 },
  { key: "pic", label: "PIC", w: 36 },
  { key: "copilot", label: "Co-Pilot", w: 36 },
  { calc: (r) => fromTo(r)[0], label: "From", w: 26, align: "center" },
  { calc: (r) => fromTo(r)[1], label: "To", w: 26, align: "center" },
  { key: "se_dual_day", label: "SE D Du", w: 22, align: "right" },
  { key: "se_pic_day", label: "SE D PIC", w: 22, align: "right" },
  { key: "se_dual_night", label: "SE N Du", w: 22, align: "right" },
  { key: "se_pic_night", label: "SE N PIC", w: 22, align: "right" },
  { key: "me_dual_day", label: "ME D Du", w: 22, align: "right" },
  { key: "me_pic_day", label: "ME D PIC", w: 22, align: "right" },
  { key: "me_dual_night", label: "ME N Du", w: 22, align: "right" },
  { key: "me_pic_night", label: "ME N PIC", w: 22, align: "right" },
  { key: "xc_day", label: "XC D", w: 22, align: "right" },
  { key: "xc_night", label: "XC N", w: 22, align: "right" },
  { key: "landings_day", label: "Ldg D", w: 20, align: "right" },
  { key: "landings_night", label: "Ldg N", w: 20, align: "right" },
  { key: "actual_inst", label: "Act", w: 20, align: "right" },
  { key: "hood_inst", label: "Hood", w: 20, align: "right" },
  { key: "sim_inst", label: "Sim", w: 20, align: "right" },
  { key: "ifr_approaches", label: "App", w: 18, align: "right" },
  { key: "holds", label: "Hld", w: 18, align: "right" },
  { key: "cfi_time", label: "Instr", w: 22, align: "right" },
  { key: "total_time", label: "Total", w: 26, align: "right" },
];

const LAYOUTS: Record<PdfLayout, { cols: Col[]; label: string }> = {
  comprehensive: { cols: COLS_COMPREHENSIVE, label: "Comprehensive layout" },
  faa: { cols: COLS_FAA, label: "FAA layout (conventional 14 CFR 61.51)" },
  easa: { cols: COLS_EASA, label: "EASA layout (AMC1 FCL.050 standard)" },
  cars: { cols: COLS_CARS, label: "Transport Canada layout (CAR 401.08)" },
};

function isNumericCol(c: Col): boolean {
  return c.align === "right";
}
function cellText(r: FlightDerived, c: Col): string {
  if (c.calc) {
    const v = c.calc(r);
    return typeof v === "number" ? fmtNum(v) : String(v ?? "");
  }
  if (c.key === "role") return r.role === "DUAL" ? "Du" : r.role === "PIC" ? "PIC" : r.role === "FO" ? "FO" : r.role;
  if (isNumericCol(c) && c.key) return fmtNum(num(r, c.key));
  const v = c.key ? (r as FlightDerived & Record<string, unknown>)[c.key] : "";
  return v == null ? "" : String(v);
}
function cellNumber(r: FlightDerived, c: Col): number {
  if (c.calc) { const v = c.calc(r); return typeof v === "number" ? v : 0; }
  return c.key ? num(r, c.key) : 0;
}

interface Props {
  flights: FlightDerived[];
  totals: Totals;
  pilotName: string;
  licenseNumber: string;
  fromDate: string;
  toDate: string;
  generatedAt: string;
  avatarUrl?: string;
  layout?: PdfLayout;
}

const USABLE = 806; // A4 landscape usable width (842 - 2*22 padding, minus a hair)
// Stretch non-snug columns to fill the freed width so the grid isn't cramped;
// snug columns (make/model) keep their tight width.
function fitCols(base: Col[]): Col[] {
  const sum = base.reduce((a, c) => a + c.w, 0);
  if (sum >= USABLE) return base;
  const flexSum = base.filter((c) => !c.snug).reduce((a, c) => a + c.w, 0);
  if (flexSum <= 0) return base;
  const extra = USABLE - sum;
  return base.map((c) => (c.snug ? c : { ...c, w: Math.round(c.w + (extra * c.w) / flexSum) }));
}

export function LogbookPDF({ flights, totals, pilotName, licenseNumber, fromDate, toDate, generatedAt, avatarUrl, layout = "comprehensive" }: Props) {
  const { cols: baseCols, label: layoutLabel } = LAYOUTS[layout] ?? LAYOUTS.comprehensive;
  const cols = fitCols(baseCols);
  const pages: FlightDerived[][] = [];
  for (let i = 0; i < flights.length; i += ROWS_PER_PAGE) {
    pages.push(flights.slice(i, i + ROWS_PER_PAGE));
  }
  const totalPages = pages.length + 2;
  const dateRangeLabel = fromDate || toDate ? `${fromDate || "earliest"} → ${toDate || "latest"}` : "All-time";

  return (
    <Document>
      <Page size="A4" style={s.cover}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16, marginBottom: 8 }}>
          {avatarUrl && <Image src={avatarUrl} style={{ width: 70, height: 70, borderRadius: 35 }} />}
          <View style={{ flex: 1 }}>
            <Text style={s.coverTitle}>Pilot Logbook HQ</Text>
            <Text style={s.coverMeta}>{pilotName || "—"}</Text>
            {licenseNumber && <Text style={s.coverMeta}>License: {licenseNumber}</Text>}
            <Text style={s.coverMeta}>Format: {layoutLabel}</Text>
            <Text style={s.coverMeta}>Date range: {dateRangeLabel}</Text>
            <Text style={s.coverMeta}>Flights included: {flights.length}</Text>
            <Text style={s.coverMeta}>Generated: {generatedAt}</Text>
          </View>
        </View>

        <View style={s.coverSection}>
          <Text style={s.coverSectionTitle}>Summary (Range)</Text>
          {summaryRows(totals).map(([k, v]) => (
            <View style={s.statRow} key={k}>
              <Text style={s.statLabel}>{k}</Text>
              <Text style={s.statValue}>{v}</Text>
            </View>
          ))}
        </View>

        <View style={s.certBlock}>
          <Text style={s.certText}>I certify that the entries in this logbook are true and accurate to the best of my knowledge.</Text>
          <Text style={s.sigLine}>Signature / Date</Text>
        </View>
      </Page>

      {pages.map((rows, pi) => {
        const sub = subtotal(rows, cols);
        return (
          <Page key={pi} size="A4" orientation="landscape" style={s.page}>
            <View style={s.pageHeader}>
              <Text style={s.pageTitle}>{pilotName || "Pilot Logbook HQ"} — {dateRangeLabel} — {layoutLabel}</Text>
              <Text style={s.pageMeta}>Page {pi + 2} of {totalPages}</Text>
            </View>

            <View style={s.table}>
              <View style={s.thRow}>
                {cols.map((c, ci) => (
                  <Text key={ci} style={[s.th, { width: c.w, textAlign: c.align ?? "left" }]}>{c.label}</Text>
                ))}
              </View>
              {rows.flatMap((r, ri) => {
                const els = [
                  <View style={[s.tr, ri % 2 === 1 ? s.trAlt : {}]} key={r.id}>
                    {cols.map((c, ci) => (
                      <Text key={ci} style={[s.td, { width: c.w, textAlign: c.align ?? "left" }]}>{cellText(r, c)}</Text>
                    ))}
                  </View>,
                ];
                if (r.remarks && r.remarks.trim()) {
                  els.push(
                    <View style={s.remarksRow} key={`${r.id}-rem`}>
                      <Text style={s.remarksText}>Remarks: {r.remarks}</Text>
                    </View>,
                  );
                }
                return els;
              })}
              <View style={s.subtotalRow}>
                {cols.map((c, ci) => (
                  <Text key={ci} style={[s.subtotalCell, { width: c.w, textAlign: c.align ?? "left" }]}>
                    {ci === 0 ? "Page subtotal" : isNumericCol(c) ? fmtNum(sub[ci] ?? 0) : ""}
                  </Text>
                ))}
              </View>
            </View>

            <View style={s.pageFooter}>
              <Text>{pilotName || ""}{licenseNumber ? ` · ${licenseNumber}` : ""}</Text>
              <Text>{generatedAt}</Text>
            </View>
          </Page>
        );
      })}

      <Page size="A4" style={s.cover}>
        <Text style={s.coverTitle}>Grand Totals</Text>
        <Text style={s.coverMeta}>{pilotName || "—"}</Text>
        <Text style={s.coverMeta}>Date range: {dateRangeLabel}</Text>

        <View style={s.coverSection}>
          <Text style={s.coverSectionTitle}>Time</Text>
          {grandTotalRows(totals).map(([k, v]) => (
            <View style={s.statRow} key={String(k)}>
              <Text style={s.statLabel}>{k}</Text>
              <Text style={s.statValue}>{typeof v === "number" ? v.toFixed(1) : v}</Text>
            </View>
          ))}
        </View>

        <View style={s.certBlock}>
          <Text style={s.certText}>I certify that the entries in this logbook are true and accurate to the best of my knowledge.</Text>
          <Text style={s.sigLine}>Signature / Date</Text>
        </View>
      </Page>
    </Document>
  );
}

function grandTotalRows(t: Totals): [string, number | string][] {
  const rows: [string, number | string][] = [
    ["Total Time", t.total_time],
    ["Total PIC", t.total_pic],
    ["Total FO", t.total_fo ?? 0],
    ["Single Engine", t.se_total],
    ["Multi-Engine", t.me_total],
  ];
  if ((t.ses_total ?? 0) > 0)  rows.push(["Single Engine Sea", t.ses_total]);
  if ((t.mes_total ?? 0) > 0)  rows.push(["Multi-Engine Sea", t.mes_total]);
  if ((t.heli_total ?? 0) > 0) rows.push(["Helicopter", t.heli_total]);
  rows.push(
    ["Cross-Country", t.xc_total],
    ["Instrument", t.inst_total],
    ["IFR Approaches", t.ifr_approaches],
  );
  if ((t.total_precision ?? 0) > 0)     rows.push(["  Precision", t.total_precision]);
  if ((t.total_non_precision ?? 0) > 0) rows.push(["  Non-Precision", t.total_non_precision]);
  if ((t.total_holds ?? 0) > 0)         rows.push(["Holds", t.total_holds]);
  if ((t.total_cfi ?? 0) > 0)           rows.push(["CFI Time", t.total_cfi]);
  return rows;
}

function summaryRows(t: Totals): [string, string][] {
  const rows: [string, string][] = [
    ["Total Time", t.total_time.toFixed(1)],
    ["PIC", t.total_pic.toFixed(1)],
    ["FO", (t.total_fo ?? 0).toFixed(1)],
    ["Single Engine", t.se_total.toFixed(1)],
    ["Multi-Engine", t.me_total.toFixed(1)],
  ];
  if ((t.ses_total ?? 0) > 0)  rows.push(["Single Engine Sea", t.ses_total.toFixed(1)]);
  if ((t.mes_total ?? 0) > 0)  rows.push(["Multi-Engine Sea", t.mes_total.toFixed(1)]);
  if ((t.heli_total ?? 0) > 0) rows.push(["Helicopter", t.heli_total.toFixed(1)]);
  rows.push(
    ["Cross-Country", t.xc_total.toFixed(1)],
    ["Instrument", t.inst_total.toFixed(1)],
    ["IFR Approaches", String(t.ifr_approaches)],
  );
  if ((t.total_precision ?? 0) > 0)     rows.push(["  Precision", String(t.total_precision)]);
  if ((t.total_non_precision ?? 0) > 0) rows.push(["  Non-Precision", String(t.total_non_precision)]);
  if ((t.total_holds ?? 0) > 0)         rows.push(["Holds", String(t.total_holds)]);
  if ((t.total_cfi ?? 0) > 0)           rows.push(["CFI Time", t.total_cfi.toFixed(1)]);
  return rows;
}

function subtotal(rows: FlightDerived[], cols: Col[]): Record<number, number> {
  const out: Record<number, number> = {};
  cols.forEach((c, ci) => {
    if (!isNumericCol(c)) return;
    let sum = 0;
    for (const r of rows) sum += cellNumber(r, c);
    out[ci] = Math.round(sum * 10) / 10;
  });
  return out;
}
