"use client";

import { useState } from "react";
import JSZip from "jszip";
import { pdf } from "@react-pdf/renderer";
import { LogbookPDF } from "@/lib/pdf/LogbookPDF";
import { exportFlightsCsv } from "@/lib/csv-export";
import { deriveFlight, computeTotals } from "@/lib/derive";
import { makeT, type Locale } from "@/lib/i18n";
import type { Flight } from "@/lib/types";

/**
 * "Backup now" card — bundles the user's entire logbook into a ZIP
 * containing:
 *   - flights.csv  (round-trips through our importer)
 *   - logbook.pdf  (ATPL-style 18-column PDF)
 *   - README.txt   (timestamp + counts so the user knows what's inside)
 *
 * Everything happens in the browser — no server round trip beyond loading
 * the page itself. Drop the ZIP into Dropbox/Drive/iCloud manually for now;
 * scheduled auto-upload is Phase 2.
 */
export default function BackupCard({
  flights, defaultName, defaultLicense, avatarUrl, locale,
}: {
  flights: Flight[];
  defaultName: string;
  defaultLicense: string;
  avatarUrl: string | null;
  locale: Locale;
}) {
  const t = makeT(locale);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  async function downloadBackup() {
    setBusy(true);
    setErr(null);
    try {
      const csv = exportFlightsCsv(flights);
      const derived = flights.map(deriveFlight);
      const totals = computeTotals(derived);
      const pdfBlob = await pdf(
        <LogbookPDF
          flights={derived}
          totals={totals}
          pilotName={defaultName}
          licenseNumber={defaultLicense}
          fromDate=""
          toDate=""
          generatedAt={new Date().toLocaleString()}
          avatarUrl={avatarUrl ?? undefined}
        />,
      ).toBlob();

      const stamp = new Date().toISOString().slice(0, 10);
      const readme = [
        "LogbookHQ backup",
        "================",
        `Generated:        ${new Date().toISOString()}`,
        `Pilot:            ${defaultName || "(unset)"}`,
        `License #:        ${defaultLicense || "(unset)"}`,
        `Flights included: ${flights.length.toLocaleString()}`,
        `Total hours:      ${totals.total_time.toFixed(1)}`,
        "",
        "Contents:",
        "  flights.csv  — every flight, round-trips through Settings → Import",
        "  logbook.pdf  — 18-column ATPL-style PDF, hand to a hiring office",
        "",
        "Tip: drop the whole folder into Dropbox/Drive/iCloud for off-site safety.",
      ].join("\n");

      const zip = new JSZip();
      zip.file("flights.csv", csv);
      zip.file("logbook.pdf", pdfBlob);
      zip.file("README.txt", readme);
      const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `logbookhq-${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setLastBackup(new Date().toLocaleString());
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <div>
        <h2 className="text-sm font-bold text-slate-800">
          {locale === "ko" ? "백업" : locale === "zh" ? "备份" : locale === "es" ? "Copia de Seguridad" : "Backup"}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {locale === "ko"
            ? "모든 비행과 PDF를 ZIP 파일로 다운로드합니다. Dropbox/Drive에 드래그하여 백업하세요."
            : locale === "zh"
              ? "下载所有飞行记录和 PDF 的 ZIP 文件。拖入 Dropbox/Drive 即可离站备份。"
              : locale === "es"
                ? "Descargue un ZIP con todos sus vuelos y el PDF. Arrástrelo a Dropbox/Drive para tener una copia fuera del sitio."
                : "Download every flight + the ATPL-style PDF as a single ZIP. Drag into Dropbox/Drive/iCloud for off-site safekeeping."}
        </p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || flights.length === 0}
          onClick={downloadBackup}
        >
          {busy
            ? (locale === "ko" ? "생성 중…" : locale === "zh" ? "正在生成…" : locale === "es" ? "Generando…" : "Generating…")
            : (locale === "ko" ? "지금 백업" : locale === "zh" ? "立即备份" : locale === "es" ? "Copia ahora" : "Backup now")}
        </button>
        <span className="text-xs text-slate-500 tabular-nums">
          {flights.length.toLocaleString()} {locale === "ko" ? "비행" : locale === "zh" ? "次飞行" : locale === "es" ? "vuelos" : "flights"}
        </span>
        {lastBackup && (
          <span className="text-xs text-emerald-600">
            ✓ {locale === "ko" ? "마지막 백업" : locale === "zh" ? "上次备份" : locale === "es" ? "Último" : "Last"}: {lastBackup}
          </span>
        )}
      </div>
      {err && <p className="text-xs text-rose-600 whitespace-pre-wrap">{err}</p>}
    </div>
  );
}
