"use client";

import { useMemo, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { LogbookPDF } from "@/lib/pdf/LogbookPDF";
import { computeTotals } from "@/lib/derive";
import { makeT, type Locale } from "@/lib/i18n";
import type { FlightDerived } from "@/lib/types";

export default function ExportClient({ flights, defaultName, defaultLicense, avatarUrl, locale }: {
  flights: FlightDerived[]; defaultName: string; defaultLicense: string; avatarUrl: string | null; locale: Locale;
}) {
  const t = makeT(locale);
  const [name, setName] = useState(defaultName);
  const [license, setLicense] = useState(defaultLicense);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return flights.filter((f) => {
      if (from && f.date < from) return false;
      if (to && f.date > to) return false;
      return true;
    });
  }, [flights, from, to]);

  const totals = useMemo(() => computeTotals(filtered), [filtered]);

  async function generate() {
    setBusy(true);
    setErr(null);
    try {
      const blob = await pdf(
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
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("export.title")}</h1>
        <p className="text-sm text-slate-500">{t("export.subtitle")}</p>
      </div>

      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">{t("export.pilotName")}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Terrence Lin" />
          </div>
          <div>
            <label className="label">{t("export.licenseOpt")}</label>
            <input className="input" value={license} onChange={(e) => setLicense(e.target.value)} placeholder={t("export.licensePh")} />
          </div>
          <div>
            <label className="label">{t("export.fromDate")}</label>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("export.toDate")}</label>
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="text-sm text-slate-500 tabular-nums">
          {t("export.inRange", { flights: filtered.length, hours: totals.total_time.toFixed(1) })}
        </div>
        <button className="btn btn-primary" disabled={busy || filtered.length === 0} onClick={generate}>
          {busy ? t("export.generating") : t("export.generate")}
        </button>
        {err && <p className="text-sm text-rose-600 whitespace-pre-wrap">{err}</p>}
      </div>
    </div>
  );
}
