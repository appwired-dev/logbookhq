"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFlight, updateFlight, deleteFlight, lookupRegistration } from "./actions";
import { makeT, type Locale } from "@/lib/i18n";
import type { Flight, FlightInput } from "@/lib/types";

function blank(): FlightInput {
  return {
    date: new Date().toISOString().slice(0, 10),
    make_model: "", registration: null, pic: null, copilot: null, third_pilot: null, check_pilot: null, route: null, remarks: null,
    category: "SE", role: "PIC",
    day_time: 0, night_time: 0, is_xcountry: false,
    actual_inst: 0, hood_inst: 0, sim_inst: 0, ifr_approaches: 0,
    // Migration 0009 — traditional logbook fields.
    precision_approaches: 0, non_precision_approaches: 0, holds: 0,
    cfi_time: 0,
    takeoffs_day: 1, takeoffs_night: 0, landings_day: 1, landings_night: 0,
    duty_time: 0,
  };
}

function fromFlight(f: Flight): FlightInput {
  const { id, user_id, created_at, updated_at, ...rest } = f;
  return rest as FlightInput;
}

export default function FlightForm({ flight, locale }: { flight?: Flight; locale: Locale }) {
  const router = useRouter();
  const t = makeT(locale);
  const editing = !!flight;
  const [f, setF] = useState<FlightInput>(flight ? fromFlight(flight) : blank());
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [regHint, setRegHint] = useState<string | null>(null);

  function set<K extends keyof FlightInput>(k: K, v: FlightInput[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  /**
   * When the registration field loses focus, look it up in the user's
   * own flight history. If found, auto-fill make/model + category, but
   * never overwrite values the user has already typed for those fields.
   */
  async function onRegBlur() {
    setRegHint(null);
    const reg = (f.registration ?? "").trim();
    if (reg.length < 3) return;
    const match = await lookupRegistration(reg);
    if (!match) { setRegHint(t("form.regHint.new")); return; }
    const tag = match.source === "registry" ? " (TC/FAA)" : "";
    setRegHint(`✓ ${match.make_model}${tag}`);
    setF((prev) => ({
      ...prev,
      make_model: prev.make_model.trim() ? prev.make_model : match.make_model,
      category: prev.category || match.category,
    }));
  }

  function submit() {
    setErr(null);
    startTransition(async () => {
      const r = editing ? await updateFlight(flight!.id, f) : await createFlight(f);
      if (r?.error) setErr(r.error);
    });
  }

  async function remove() {
    if (!editing) return;
    if (!confirm("Delete this flight?")) return;
    startTransition(async () => {
      const r = await deleteFlight(flight!.id);
      if (r?.error) setErr(r.error);
    });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{editing ? t("form.editFlight") : t("form.newFlight")}</h1>
        {editing && <div className="text-xs text-slate-500 font-mono">#{flight!.id}</div>}
      </div>
      {err && <p className="text-sm text-rose-600">{err}</p>}

      <Section title={t("form.section.flight")}>
        <Field label={t("flights.date")}><input className="input" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label={t("form.makeModel")}><input className="input" value={f.make_model} onChange={(e) => set("make_model", e.target.value)} placeholder="Cessna 172" /></Field>
        <Field label={t("form.registration")}>
          <input
            className="input"
            value={f.registration ?? ""}
            onChange={(e) => set("registration", e.target.value || null)}
            onBlur={onRegBlur}
            placeholder="C-GXBG"
          />
          {regHint && (
            <p className={`text-xs mt-1 ${regHint.startsWith("✓") ? "text-emerald-600" : "text-slate-500"}`}>
              {regHint}
            </p>
          )}
        </Field>
        <Field label={t("flights.route")}><input className="input" value={f.route ?? ""} onChange={(e) => set("route", e.target.value || null)} placeholder="CYVR-CYYZ" /></Field>
        <Field label={t("form.pic")}><input className="input" value={f.pic ?? ""} onChange={(e) => set("pic", e.target.value || null)} /></Field>
        <Field label={t("form.copilot")}><input className="input" value={f.copilot ?? ""} onChange={(e) => set("copilot", e.target.value || null)} /></Field>
        <Field label={t("form.thirdPilot")}><input className="input" value={f.third_pilot ?? ""} onChange={(e) => set("third_pilot", e.target.value || null)} /></Field>
        <Field label={t("form.checkPilot")}><input className="input" value={f.check_pilot ?? ""} onChange={(e) => set("check_pilot", e.target.value || null)} /></Field>
        <Field label={t("form.remarks")} full><input className="input" value={f.remarks ?? ""} onChange={(e) => set("remarks", e.target.value || null)} /></Field>
      </Section>

      <Section title={t("form.section.time")}>
        <Field label={t("form.category")}>
          <select className="input" value={f.category} onChange={(e) => set("category", e.target.value as any)}>
            <option value="SE">{t("dash.singleEngine")}</option>
            <option value="ME">{t("dash.multiEngine")}</option>
            <option value="SES">{t("cat.ses")}</option>
            <option value="MES">{t("cat.mes")}</option>
            <option value="HELI">{t("cat.heli")}</option>
            <option value="SIM">{t("bd.sim")}</option>
          </select>
        </Field>
        <Field label={t("form.role")}>
          <select className="input" value={f.role} onChange={(e) => set("role", e.target.value as any)}>
            <option value="PIC">{t("form.pic")}</option>
            <option value="DUAL">{t("role.dual")}</option>
            <option value="FO">{t("role.foCopilot")}</option>
            <option value="SIC">{t("form.thirdPilot")}</option>
            <option value="CHECK">{t("form.checkPilot")}</option>
          </select>
        </Field>
        <Field label={t("form.dayTime")}><input className="input" type="number" step="0.1" min="0" value={f.day_time} onChange={(e) => set("day_time", parseFloat(e.target.value) || 0)} /></Field>
        <Field label={t("form.nightTime")}><input className="input" type="number" step="0.1" min="0" value={f.night_time} onChange={(e) => set("night_time", parseFloat(e.target.value) || 0)} /></Field>
        <Field label={t("form.xc")}>
          <label className="flex items-center gap-2 text-sm h-9">
            <input type="checkbox" checked={f.is_xcountry} onChange={(e) => set("is_xcountry", e.target.checked)} />
            <span>{t("form.xcCheck")}</span>
          </label>
        </Field>
        <Field label={t("form.dutyTime")}>
          <input className="input" type="number" step="0.1" min="0" value={f.duty_time} onChange={(e) => set("duty_time", parseFloat(e.target.value) || 0)} />
        </Field>
        <Field label={t("form.cfiTime")}>
          <input className="input" type="number" step="0.1" min="0" value={f.cfi_time} onChange={(e) => set("cfi_time", parseFloat(e.target.value) || 0)} />
        </Field>
      </Section>

      <Section title={t("form.section.inst")}>
        <Field label={t("bd.actual")}><input className="input" type="number" step="0.1" min="0" value={f.actual_inst} onChange={(e) => set("actual_inst", parseFloat(e.target.value) || 0)} /></Field>
        <Field label={t("bd.hood")}><input className="input" type="number" step="0.1" min="0" value={f.hood_inst} onChange={(e) => set("hood_inst", parseFloat(e.target.value) || 0)} /></Field>
        <Field label={t("bd.sim")}><input className="input" type="number" step="0.1" min="0" value={f.sim_inst} onChange={(e) => set("sim_inst", parseFloat(e.target.value) || 0)} /></Field>
        <Field label={`# ${t("bd.approaches")}`}><input className="input" type="number" step="1" min="0" value={f.ifr_approaches} onChange={(e) => set("ifr_approaches", parseInt(e.target.value) || 0)} /></Field>
        <Field label={t("form.precApproaches")}><input className="input" type="number" step="1" min="0" value={f.precision_approaches} onChange={(e) => set("precision_approaches", parseInt(e.target.value) || 0)} /></Field>
        <Field label={t("form.nonPrecApproaches")}><input className="input" type="number" step="1" min="0" value={f.non_precision_approaches} onChange={(e) => set("non_precision_approaches", parseInt(e.target.value) || 0)} /></Field>
        <Field label={`# ${t("form.holds")}`}><input className="input" type="number" step="1" min="0" value={f.holds} onChange={(e) => set("holds", parseInt(e.target.value) || 0)} /></Field>
      </Section>

      <Section title={t("form.section.tol")}>
        <Field label={`T/O ${t("flights.day")}`}><input className="input" type="number" step="1" min="0" value={f.takeoffs_day} onChange={(e) => set("takeoffs_day", parseInt(e.target.value) || 0)} /></Field>
        <Field label={`T/O ${t("flights.night")}`}><input className="input" type="number" step="1" min="0" value={f.takeoffs_night} onChange={(e) => set("takeoffs_night", parseInt(e.target.value) || 0)} /></Field>
        <Field label={`Ldg ${t("flights.day")}`}><input className="input" type="number" step="1" min="0" value={f.landings_day} onChange={(e) => set("landings_day", parseInt(e.target.value) || 0)} /></Field>
        <Field label={`Ldg ${t("flights.night")}`}><input className="input" type="number" step="1" min="0" value={f.landings_night} onChange={(e) => set("landings_night", parseInt(e.target.value) || 0)} /></Field>
      </Section>

      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={submit} disabled={pending}>{pending ? t("common.saving") : t("common.save")}</button>
        <button className="btn" onClick={() => router.back()}>{t("common.cancel")}</button>
        {editing && <button className="btn btn-danger ml-auto" onClick={remove}>{t("common.delete")}</button>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="bg-gradient-to-br from-slate-50 to-sky-50/40 px-4 py-2.5 border-b border-slate-200/60">
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2 lg:col-span-3" : ""}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
