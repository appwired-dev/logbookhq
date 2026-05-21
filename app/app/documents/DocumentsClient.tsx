"use client";

import { useState, useTransition } from "react";
import { createDocument, deleteDocument, signedUrlFor } from "./actions";
import { makeT, type Locale, type TranslationKey } from "@/lib/i18n";
import type { PilotDocument, DocumentType } from "@/lib/types";

const TYPE_ICONS: Record<DocumentType, string> = {
  MEDICAL: "❤️", LICENSE: "📄", TYPE_RATING: "✈️", IPC: "☁️",
  RECURRENT: "🎓", PASSPORT: "🛂", VISA: "🗺️", OTHER: "📎",
};
const TYPE_LABEL_KEY: Record<DocumentType, TranslationKey> = {
  MEDICAL: "docs.type.medical", LICENSE: "docs.type.license",
  TYPE_RATING: "docs.type.typeRating", IPC: "docs.type.ipc",
  RECURRENT: "docs.type.recurrent", PASSPORT: "docs.type.passport",
  VISA: "docs.type.visa", OTHER: "docs.type.other",
};
const TYPE_ORDER: DocumentType[] = ["MEDICAL", "LICENSE", "TYPE_RATING", "IPC", "RECURRENT", "PASSPORT", "VISA", "OTHER"];

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(iso); target.setHours(0,0,0,0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export default function DocumentsClient({ documents, locale }: { documents: PilotDocument[]; locale: Locale }) {
  const t = makeT(locale);
  const [addOpen, setAddOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(fd: FormData) {
    setErr(null);
    startTransition(async () => {
      const r = await createDocument(fd);
      if (r && "error" in r && r.error) setErr(r.error);
      else setAddOpen(false);
    });
  }

  async function open(d: PilotDocument) {
    // try/catch is defensive — the server action returns structured errors,
    // but a network failure between client and server can still throw on
    // the await. We surface a friendly alert rather than letting it bubble
    // up to the global error handler (which then ships to Sentry).
    try {
      const r = await signedUrlFor(d.storage_path);
      if ("error" in r) { alert(r.error); return; }
      if (!r.url) { alert("Could not open file — try again in a moment."); return; }
      window.open(r.url, "_blank");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Could not open file: ${msg}`);
    }
  }

  async function remove(d: PilotDocument) {
    if (!confirm(t("docs.deleteConfirm", { name: d.name }))) return;
    startTransition(async () => {
      const r = await deleteDocument(d.id, d.storage_path);
      if (r && "error" in r && r.error) setErr(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("docs.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("docs.subtitle")}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddOpen((v) => !v)}>
          {addOpen ? t("docs.cancel") : t("docs.add")}
        </button>
      </div>

      {addOpen && (
        <form
          action={onSubmit}
          className="card overflow-hidden animate-fade-up"
        >
          <div className="bg-gradient-to-br from-sky-50 to-emerald-50/40 px-4 py-2.5 border-b border-slate-200/60">
            <h2 className="text-sm font-bold text-slate-800">{t("docs.new")}</h2>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">{t("docs.type")}</label>
              <select name="doc_type" className="input" defaultValue="MEDICAL">
                {TYPE_ORDER.map((v) => <option key={v} value={v}>{TYPE_ICONS[v]} {t(TYPE_LABEL_KEY[v])}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t("docs.name")}</label>
              <input name="name" className="input" required placeholder={t("docs.namePh")} />
            </div>
            <div>
              <label className="label">{t("docs.reference")}</label>
              <input name="reference" className="input" placeholder={t("docs.referencePh")} />
            </div>
            <div>
              <label className="label">{t("docs.issued")}</label>
              <input name="issued_on" type="date" className="input" />
            </div>
            <div>
              <label className="label">{t("docs.expires")}</label>
              <input name="expires_on" type="date" className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">{t("docs.notes")}</label>
              <input name="notes" className="input" placeholder={t("docs.notesPh")} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">{t("docs.file")}</label>
              <input name="file" type="file" accept=".pdf,image/*" required className="block text-sm text-slate-700" />
            </div>
          </div>
          <div className="px-4 py-3 border-t border-slate-200/60 flex items-center gap-3">
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? t("docs.uploading") : t("docs.save")}
            </button>
            {err && <span className="text-sm text-rose-600">{err}</span>}
          </div>
        </form>
      )}

      {documents.length === 0 && !addOpen && (
        <div className="card p-10 text-center space-y-2">
          <div className="text-4xl">📁</div>
          <h2 className="text-lg font-bold text-slate-800">{t("docs.empty.title")}</h2>
          <p className="text-sm text-slate-500">{t("docs.empty.body")}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {documents.map((d) => {
          const days = daysUntil(d.expires_on);
          const status =
            days == null ? null
            : days < 0 ? { color: "rose", label: t("docs.expired", { days: -days }) }
            : days <= 30 ? { color: "amber", label: t("docs.daysLeft", { days }) }
            : days <= 60 ? { color: "amber", label: t("docs.daysLeft", { days }) }
            : { color: "emerald", label: t("docs.daysLeft", { days }) };
          return (
            <div key={d.id} className="card card-hover p-4 flex flex-col">
              <div className="flex items-start gap-3 mb-2">
                <div className="text-2xl">{TYPE_ICONS[d.doc_type]}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t(TYPE_LABEL_KEY[d.doc_type])}</div>
                  <div className="font-bold text-slate-900 truncate">{d.name}</div>
                  {d.reference && <div className="text-xs text-slate-500 font-mono mt-0.5">{d.reference}</div>}
                </div>
              </div>
              <div className="text-xs text-slate-500 space-y-0.5 flex-1">
                {d.issued_on && <div>{t("docs.issued")} <span className="font-mono">{d.issued_on}</span></div>}
                {d.expires_on && <div>{t("docs.expires")} <span className="font-mono">{d.expires_on}</span></div>}
                {d.notes && <div className="italic">{d.notes}</div>}
              </div>
              {status && (
                <div className={`mt-3 inline-flex items-center gap-1.5 self-start text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md
                  ${status.color === "rose" ? "bg-rose-50 text-rose-700 border border-rose-200" : ""}
                  ${status.color === "amber" ? "bg-amber-50 text-amber-700 border border-amber-200" : ""}
                  ${status.color === "emerald" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : ""}`}>
                  {status.label}
                </div>
              )}
              <div className="mt-3 flex gap-2 pt-3 border-t border-slate-100">
                <button className="btn flex-1" onClick={() => open(d)}>{t("docs.viewBtn")}</button>
                <button className="btn btn-danger" onClick={() => remove(d)}>{t("docs.delete")}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
