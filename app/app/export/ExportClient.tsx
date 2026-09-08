"use client";

import { useId, useMemo, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { LogbookPDF } from "@/lib/pdf/LogbookPDF";
import { exportFlightsCsv } from "@/lib/csv-export";
import { computeTotals } from "@/lib/derive";
import { makeT, type Locale } from "@/lib/i18n";
import type { FlightDerived } from "@/lib/types";
import { Alert, Button, Card, CardFooter, CardHeader, Field, Icon, PageHeader } from "@/components/ui";
import type { LucideIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { exportStrings, type ExportStringKey } from "./export-strings";

type Format = "pdf" | "csv";

const FORMATS: { value: Format; icon: LucideIcon; title: ExportStringKey; body: ExportStringKey }[] = [
  { value: "pdf", icon: Icon.FileBadge, title: "formatPdf", body: "formatPdfBody" },
  { value: "csv", icon: Icon.FileSpreadsheet, title: "formatCsv", body: "formatCsvBody" },
];

/** `.input` is h-10; phones get the 44px touch target. */
const INPUT = "input h-11 sm:h-10";

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function ExportClient({ flights, defaultName, defaultLicense, avatarUrl, locale }: {
  flights: FlightDerived[]; defaultName: string; defaultLicense: string; avatarUrl: string | null; locale: Locale;
}) {
  const t = makeT(locale);
  const s = exportStrings(locale);
  const toast = useToast();
  const ids = useId();
  const [format, setFormat] = useState<Format>("pdf");
  const [name, setName] = useState(defaultName);
  const [license, setLicense] = useState(defaultLicense);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => flights.filter((f) => {
    if (from && f.date < from) return false;
    if (to && f.date > to) return false;
    return true;
  }), [flights, from, to]);
  const totals = useMemo(() => computeTotals(filtered), [filtered]);
  const n = filtered.length;
  const stamp = () => new Date().toISOString().slice(0, 10);

  async function generate() {
    if (busy || n === 0) return;
    setErr(null);
    setBusy(true);
    try {
      if (format === "pdf") {
        // Open the tab synchronously so Safari's pop-up blocker doesn't eat
        // the navigation that happens after the render; fall back to a download.
        const win = window.open("", "_blank");
        let blob: Blob;
        try {
          blob = await pdf(
            <LogbookPDF
              flights={filtered}
              totals={totals}
              pilotName={name}
              licenseNumber={license}
              fromDate={from}
              toDate={to}
              generatedAt={new Date().toLocaleString()}
              avatarUrl={avatarUrl ?? undefined}
            />,
          ).toBlob();
        } catch (e) {
          win?.close();
          throw e;
        }
        if (win) {
          const url = URL.createObjectURL(blob);
          win.location.href = url;
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
          toast.push({ tone: "good", title: s("pdfReady"), description: s("pdfReadyBody", { n: n.toLocaleString() }) });
        } else {
          downloadBlob(blob, `logbookhq-logbook-${stamp()}.pdf`);
          toast.push({ tone: "warn", title: s("popupBlocked") });
        }
      } else {
        const fileName = `logbookhq-flights-${stamp()}.csv`;
        downloadBlob(new Blob([exportFlightsCsv(filtered)], { type: "text/csv;charset=utf-8" }), fileName);
        toast.push({ tone: "good", title: s("csvReady"), description: s("csvReadyBody", { file: fileName, n: n.toLocaleString() }) });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const includesId = `${ids}-includes`;

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title={s("title")} subtitle={s("subtitle")} />

      <Card padding="lg" aria-busy={busy || undefined}>
        {/* Format */}
        <fieldset className="space-y-2" disabled={busy}>
          <legend className="label">{s("format")}</legend>
          <div className="grid sm:grid-cols-2 gap-2">
            {FORMATS.map((f) => {
              const FormatIcon = f.icon;
              return (
                <label key={f.value} className="mode-card">
                  <input
                    type="radio"
                    name={`${ids}-format`}
                    value={f.value}
                    checked={format === f.value}
                    onChange={() => setFormat(f.value)}
                    className="mt-1 accent-brand"
                  />
                  <FormatIcon size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-brand-deep" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink-1">{s(f.title)}</span>
                    <span className="block text-xs text-ink-3">{s(f.body)}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Options */}
        <div className="mt-5">
          <CardHeader title={s("options")} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {format === "pdf" && (
              <>
                <Field label={t("export.pilotName")}>
                  <input className={INPUT} value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label={t("export.licenseOpt")}>
                  <input className={`${INPUT} mono`} value={license} placeholder={t("export.licensePh")} autoComplete="off" onChange={(e) => setLicense(e.target.value)} />
                </Field>
              </>
            )}
            <Field label={t("export.fromDate")} hint={s("rangeHint")}>
              <input className={`${INPUT} num`} type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={t("export.toDate")}>
              <input className={`${INPUT} num`} type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        </div>

        <p id={includesId} className="mt-4 flex gap-2 text-xs text-ink-2">
          <Icon.Info size={14} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-ink-3" />
          <span>{s(format === "pdf" ? "pdfIncludes" : "csvIncludes")}</span>
        </p>

        {err && <Alert variant="bad" title={s("failed")} className="mt-4 whitespace-pre-wrap">{err}</Alert>}
        {n === 0 && !err && <Alert variant="warn" className="mt-4">{s("noFlights")}</Alert>}

        <CardFooter className="justify-between">
          <p role="status" className="text-sm text-ink-2 num">
            {t("export.inRange", { flights: n.toLocaleString(), hours: totals.total_time.toFixed(1) })}
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {format === "pdf" && <span className="text-xs text-ink-3">{s("opensNewTab")}</span>}
            <Button variant="primary" className="h-11 sm:h-10" loading={busy} disabled={n === 0} onClick={generate} aria-describedby={includesId}>
              {busy
                ? t("export.generating")
                : format === "pdf"
                  ? <><Icon.FileBadge size={16} strokeWidth={1.75} aria-hidden />{s("generatePdf")}</>
                  : <><Icon.Download size={16} strokeWidth={1.75} aria-hidden />{s("downloadCsv")}</>}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
