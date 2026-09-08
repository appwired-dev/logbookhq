"use client";

import { useState } from "react";
import JSZip from "jszip";
import { pdf } from "@react-pdf/renderer";
import { LogbookPDF } from "@/lib/pdf/LogbookPDF";
import { exportFlightsCsv } from "@/lib/csv-export";
import { deriveFlight, computeTotals } from "@/lib/derive";
import type { Locale } from "@/lib/i18n";
import type { Flight } from "@/lib/types";
import { Alert, Button, Card, CardHeader, Icon } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { settingsStrings } from "./settings-strings";

type Stage = "idle" | "pdf" | "zip";

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
  const s = settingsStrings(locale);
  const toast = useToast();
  const [stage, setStage] = useState<Stage>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const busy = stage !== "idle";
  const empty = flights.length === 0;

  async function downloadBackup() {
    setErr(null);
    try {
      setStage("pdf");
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

      setStage("zip");
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
        "  flights.csv  — every flight, round-trips through Import & Export → Import",
        "  logbook.pdf  — 18-column ATPL-style PDF, hand to a hiring office",
        "",
        "Tip: drop the whole folder into Dropbox/Drive/iCloud for off-site safety.",
      ].join("\n");

      const zip = new JSZip();
      zip.file("flights.csv", csv);
      zip.file("logbook.pdf", pdfBlob);
      zip.file("README.txt", readme);
      const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });

      const fileName = `logbookhq-${stamp}.zip`;
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setLastBackup(new Date().toLocaleString());
      toast.push({ tone: "good", title: s("backupDone"), description: s("backupDoneBody", { file: fileName, n: flights.length.toLocaleString() }) });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setStage("idle");
    }
  }

  const buttonLabel = stage === "pdf" ? s("backupRendering") : stage === "zip" ? s("backupZipping") : s("backupNow");

  return (
    <Card padding="md">
      <CardHeader title={s("backup")} meta={s("backupDesc")} />
      <p className="flex items-center gap-1.5 text-xs text-ink-3">
        <Icon.FileSpreadsheet size={14} strokeWidth={2} aria-hidden className="shrink-0" />{s("backupContents")}
      </p>

      {err && <Alert variant="bad" title={s("backupFailed")} className="mt-3 whitespace-pre-wrap">{err}</Alert>}
      {empty && <Alert variant="info" className="mt-3">{s("backupEmpty")}</Alert>}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="primary" className="h-11 sm:h-10" loading={busy} disabled={empty} onClick={downloadBackup}>
          {busy ? buttonLabel : <><Icon.Download size={16} strokeWidth={1.75} aria-hidden />{buttonLabel}</>}
        </Button>
        <span className="text-xs text-ink-3 num">{s("flightsCount", { n: flights.length.toLocaleString() })}</span>
        {lastBackup && (
          <span role="status" className="flex items-center gap-1 text-xs font-medium text-good-ink">
            <Icon.Check size={14} strokeWidth={2} aria-hidden />{s("lastBackup", { time: lastBackup })}
          </span>
        )}
      </div>
    </Card>
  );
}
