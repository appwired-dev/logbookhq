"use client";

import { useState, useTransition } from "react";
import { importCsvAction } from "./actions";
import { makeT, type Locale } from "@/lib/i18n";

export default function ImportClient({ locale }: { locale: Locale }) {
  const t = makeT(locale);
  const [file, setFile] = useState<File | null>(null);
  const [replace, setReplace] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("import.title")}</h1>
        <p className="text-sm text-slate-500 mt-1">{t("import.subtitle")}</p>
      </div>

      <form
        action={(fd) => {
          setErr(null);
          if (!file) { setErr(t("import.pickFirst")); return; }
          fd.set("file", file);
          fd.set("replace", replace ? "on" : "");
          startTransition(async () => {
            // try/catch covers the network layer — server actions are fetched
            // under the hood and can throw `TypeError: Failed to fetch` (Edge/
            // Chrome) or `TypeError: Load failed` (Safari) on flaky mobile
            // connections. Without this, the rejection bubbles to Sentry as
            // an unhandled error.
            try {
              const r = await importCsvAction(fd);
              if (r?.error) setErr(r.error);
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              const friendly = (msg === "Failed to fetch" || msg === "Load failed")
                ? "Network error during upload — try again. (Often happens on flaky mobile connections; try Wi-Fi or a smaller file.)"
                : msg;
              setErr(friendly);
            }
          });
        }}
        className="card p-5 space-y-4"
      >
        <div>
          <label className="label">{t("import.csvFile")}</label>
          <input
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,.ods,.xlsm,.xlsb,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block text-sm text-slate-700"
          />
          {file && (
            <p className="text-xs text-slate-500 mt-1">
              {t("import.selected", { name: file.name, size: (file.size / 1024).toFixed(1) })}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-1">
            Accepts <strong>.csv</strong>, <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.ods</strong>, .tsv.
            For Apple Numbers files: open in Numbers → File → Export To → CSV.
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => setReplace(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">{t("import.replace")}</span>{t("import.replaceHint")}
          </span>
        </label>

        {err && <p className="text-sm text-rose-600 whitespace-pre-wrap">{err}</p>}

        <div className="flex gap-2">
          <button className="btn btn-primary" type="submit" disabled={pending || !file}>
            {pending ? t("import.importing") : t("import.button")}
          </button>
        </div>
      </form>

      <div className="text-xs text-slate-500 space-y-1.5">
        <p>{t("import.logbookhq")}</p>
        <p>{t("import.foreflight")}</p>
        <p>{t("import.logten")}</p>
        <p>{t("import.myflightbook")}</p>
      </div>
    </div>
  );
}
