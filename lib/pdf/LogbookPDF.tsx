/**
 * LogbookHQ PDF document. Cover + landscape flight pages (18-col layout) + totals summary.
 * Ported from ~/pilot-logbook/src/pdf/LogbookPDF.tsx, adapted to use shared LogbookHQ types.
 */
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { FlightDerived, Totals } from "@/lib/types";

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
});

// Column widths trimmed (names + breakdowns down ~4pt each) to make room for
// the migration-0009 fields without overflowing A4 landscape (~840pt usable).
const COLS = [
  { key: "date",                    label: "Date",     w: 38, align: "center" as const },
  { key: "make_model",              label: "Aircraft", w: 42 },
  { key: "registration",            label: "Reg",      w: 38 },
  { key: "route",                   label: "Route",    w: 54 },
  { key: "pic",                     label: "PIC",      w: 36 },
  { key: "copilot",                 label: "Co-Pilot", w: 36 },
  { key: "category",                label: "Cat",      w: 18, align: "center" as const },
  { key: "role",                    label: "Role",     w: 22, align: "center" as const },
  { key: "se_dual_day",             label: "SE D Du",  w: 24, align: "right" as const },
  { key: "se_pic_day",              label: "SE D PIC", w: 24, align: "right" as const },
  { key: "se_dual_night",           label: "SE N Du",  w: 24, align: "right" as const },
  { key: "se_pic_night",            label: "SE N PIC", w: 24, align: "right" as const },
  { key: "me_dual_day",             label: "ME D Du",  w: 24, align: "right" as const },
  { key: "me_pic_day",              label: "ME D PIC", w: 24, align: "right" as const },
  { key: "me_fo_day",               label: "ME D FO",  w: 24, align: "right" as const },
  { key: "me_aug_day",              label: "ME D AU",  w: 24, align: "right" as const },
  { key: "me_dual_night",           label: "ME N Du",  w: 24, align: "right" as const },
  { key: "me_pic_night",            label: "ME N PIC", w: 24, align: "right" as const },
  { key: "me_fo_night",             label: "ME N FO",  w: 24, align: "right" as const },
  { key: "me_aug_night",            label: "ME N AU",  w: 24, align: "right" as const },
  { key: "actual_inst",             label: "Act In",   w: 22, align: "right" as const },
  { key: "hood_inst",               label: "Hood",     w: 20, align: "right" as const },
  { key: "sim_inst",                label: "Sim",      w: 20, align: "right" as const },
  { key: "ifr_approaches",          label: "App",      w: 18, align: "right" as const },
  // Migration 0009 additions — traditional logbook fields.
  { key: "precision_approaches",    label: "Prec",     w: 18, align: "right" as const },
  { key: "non_precision_approaches",label: "NPr",      w: 18, align: "right" as const },
  { key: "holds",                   label: "Hld",      w: 18, align: "right" as const },
  { key: "cfi_time",                label: "CFI",      w: 22, align: "right" as const },
  { key: "total_time",              label: "Total",    w: 26, align: "right" as const },
];
const NUMERIC_KEYS = COLS.filter((c) => c.align === "right").map((c) => c.key);

function fmtNum(n: number): string {
  if (!n) return "";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}
function valueOf(row: FlightDerived, key: string): string {
  if (key === "role") return row.role === "DUAL" ? "Du" : row.role === "PIC" ? "PIC" : row.role === "FO" ? "FO" : "AU";
  if (NUMERIC_KEYS.includes(key)) return fmtNum((row as any)[key] ?? 0);
  const v = (row as any)[key];
  return v == null ? "" : String(v);
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
}

export function LogbookPDF({ flights, totals, pilotName, licenseNumber, fromDate, toDate, generatedAt, avatarUrl }: Props) {
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
          {avatarUrl && (
            // @react-pdf/renderer fetches and embeds the image at render time.
            <Image src={avatarUrl} style={{ width: 70, height: 70, borderRadius: 35 }} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.coverTitle}>Pilot Logbook HQ</Text>
            <Text style={s.coverMeta}>{pilotName || "—"}</Text>
            {licenseNumber && <Text style={s.coverMeta}>License: {licenseNumber}</Text>}
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
        const sub = subtotal(rows);
        return (
          <Page key={pi} size="A4" orientation="landscape" style={s.page}>
            <View style={s.pageHeader}>
              <Text style={s.pageTitle}>{pilotName || "Pilot Logbook HQ"} — {dateRangeLabel}</Text>
              <Text style={s.pageMeta}>Page {pi + 2} of {totalPages}</Text>
            </View>

            <View style={s.table}>
              <View style={s.thRow}>
                {COLS.map((c) => (
                  <Text key={c.key} style={[s.th, { width: c.w, textAlign: c.align ?? "left" }]}>{c.label}</Text>
                ))}
              </View>
              {rows.map((r, ri) => (
                <View style={[s.tr, ri % 2 === 1 ? s.trAlt : {}]} key={r.id}>
                  {COLS.map((c) => (
                    <Text key={c.key} style={[s.td, { width: c.w, textAlign: c.align ?? "left" }]}>{valueOf(r, c.key)}</Text>
                  ))}
                </View>
              ))}
              <View style={s.subtotalRow}>
                {COLS.map((c, ci) => (
                  <Text key={c.key} style={[s.subtotalCell, { width: c.w, textAlign: c.align ?? "left" }]}>
                    {ci === 0 ? "Page subtotal" : NUMERIC_KEYS.includes(c.key) ? fmtNum(sub[c.key] ?? 0) : ""}
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

/**
 * Grand totals page — same conditional logic as the cover summary, plus a
 * couple of extras (Total FO is always shown here since this is the
 * career-level summary). Mirrors the labels used in summaryRows for
 * consistency between the cover sheet and the back-page totals.
 */
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
  // Conditionally include sea/heli/CFI/holds rows only when non-zero — keeps
  // the cover summary clean for typical airline pilots who never log them.
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

function subtotal(rows: FlightDerived[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of NUMERIC_KEYS) out[k] = 0;
  for (const r of rows) {
    for (const k of NUMERIC_KEYS) out[k] += Number((r as any)[k] ?? 0);
  }
  for (const k of NUMERIC_KEYS) out[k] = Math.round(out[k] * 10) / 10;
  return out;
}
