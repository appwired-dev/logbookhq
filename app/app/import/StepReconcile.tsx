"use client";

import Link from "next/link";
import { useEffect, useId, useState, type RefObject } from "react";
import { Alert, Button, CardFooter, Field, Icon, Pill, categoryPill, rolePill, type PillVariant } from "@/components/ui";
import type { LucideIcon } from "@/components/ui/icons";
import { makeT, type Locale } from "@/lib/i18n";
import type { Analysis, CheckStatus, ReconcileCheck } from "@/lib/import/types";
import { checkLabel, skipReasonLabel, type ImportStringKey, type ImportStrings } from "./import-strings";
import { explanationFor } from "./check-messages";
import type { ImportMode, PreviewData } from "./wizard-types";

const STATUS: Record<CheckStatus, { icon: LucideIcon; cls: string; key: ImportStringKey }> = {
  match:     { icon: Icon.CircleCheck,   cls: "text-good-ink", key: "statusMatch" },
  info:      { icon: Icon.Info,          cls: "text-ink-3",    key: "statusInfo" },
  explained: { icon: Icon.TriangleAlert, cls: "text-warn-ink", key: "statusExplained" },
  mismatch:  { icon: Icon.CircleX,       cls: "text-bad-ink",  key: "statusMismatch" },
};

const ROLE_VAR: Record<string, string> = { PIC: "role-pic", DUAL: "role-dual", FO: "role-fo", SIC: "role-sic", AUG: "role-sic", CHECK: "role-check" };
const CAT_VAR: Record<string, string> = { SE: "cat-se", ME: "cat-me", SES: "cat-heli", MES: "cat-heli", HELI: "cat-heli", SIM: "cat-sim" };

const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
/** Hours get one decimal; whole counts (approaches, landings) stay whole. */
const fmtNum = (n: number) => (Math.abs(n - Math.round(n)) < 1e-9 ? Math.round(n).toLocaleString() : fmt1(n));
const fmtDelta = (d: number) => `${d > 0 ? "+" : "−"}${fmtNum(Math.abs(d))}`;

export default function StepReconcile({
  s, locale, analysis, preview, augHalfCredit, autoApplied, onReviewMapping, onBack,
  mode, onMode, saveTemplate, onSaveTemplate, templateName, onTemplateName,
  onImport, importBusy, error, headingRef,
}: {
  s: ImportStrings;
  locale: Locale;
  analysis: Analysis;
  preview: PreviewData;
  augHalfCredit: boolean;
  autoApplied: string | null;
  onReviewMapping: () => void;
  onBack: () => void;
  mode: ImportMode;
  onMode: (m: ImportMode) => void;
  saveTemplate: boolean;
  onSaveTemplate: (v: boolean) => void;
  templateName: string;
  onTemplateName: (v: string) => void;
  onImport: () => void;
  importBusy: boolean;
  error: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const t = makeT(locale);
  const ids = useId();
  const checksId = `${ids}-checks`;
  const summaryId = `${ids}-summary`;
  const noteId = `${ids}-note`;
  const { report } = preview;
  const n = preview.flights;
  // With the 50 % AUG setting on, the headline is what the app will credit; the raw logged sum goes underneath.
  const hoursCredited =
    report.summary.creditedHours != null && Math.abs(report.summary.creditedHours - report.summary.totalHours) >= 0.05;
  const fromTemplate = Boolean(analysis.templateId);
  // Two things make the import a two-step: a failed check (never blocks, but
  // the first click only arms the button) and Replace mode when it would
  // delete existing flights. One arm covers both; Escape or switching the
  // mode disarms.
  const mismatch = !report.ok;
  const replaceDanger = mode === "replace" && preview.existingCount > 0;
  const requiresArm = mismatch || replaceDanger;
  const [armedState, setArmed] = useState(false);
  const armed = armedState && requiresArm;

  function clickImport() {
    if (requiresArm && !armedState) { setArmed(true); return; }
    onImport();
  }

  function changeMode(m: ImportMode) {
    if (m !== mode) setArmed(false);
    onMode(m);
  }

  useEffect(() => {
    if (!armed || importBusy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setArmed(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [armed, importBusy]);

  const existing = preview.existingCount.toLocaleString();
  const importLabel = importBusy
    ? s("importing")
    : armed && replaceDanger
      ? s("replaceArmed", { existing, n: n.toLocaleString() })
      : armed
        ? s("importAnyway")
        : s("importN", { n: n.toLocaleString() });

  return (
    <div className="space-y-5">
      <div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold text-ink-1 tracking-tight rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          {s("step3")}
        </h2>
        {fromTemplate && analysis.templateName && (
          <p className="text-xs text-ink-3 mt-0.5">{s("fromTemplate", { name: analysis.templateName })}</p>
        )}
      </div>

      {autoApplied && (
        <Alert variant="good">
          <span>{s("recognisedAs", { name: autoApplied })}</span>{" "}
          <button
            type="button"
            onClick={onReviewMapping}
            className="font-medium text-brand-deep underline underline-offset-2 hover:text-brand rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            {s("reviewAnyway")}
          </button>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
        {/* Checks */}
        <section aria-labelledby={checksId} className="min-w-0 space-y-4">
          <div>
            <h3 id={checksId} className="text-sm font-semibold text-ink-1">{s("checksTitle")}</h3>
            <p className="text-xs text-ink-3 mt-0.5">{s("checksBody")}</p>
          </div>
          {report.checks.length === 0 ? (
            <p className="text-sm text-ink-2 flex items-center gap-2">
              <Icon.Info size={16} strokeWidth={2} aria-hidden className="text-ink-3" />{s("checksNone")}
            </p>
          ) : (
            /* Labels: fixed invariants are localised via checkLabel(); declared totals keep the sheet's own text. */
            <ul className="rounded-control border border-border px-3">
              {report.checks.map((c) => <CheckRow key={c.id} c={c} s={s} augHalfCredit={augHalfCredit} />)}
            </ul>
          )}

          {preview.sampleFlights.length > 0 && (
            <div>
              <h3 className="text-2xs font-semibold uppercase tracking-[0.08em] text-ink-2 mb-1.5">{s("previewTitle")}</h3>
              <div className="overflow-x-auto rounded-control border border-border">
                <table className="import-table w-full min-w-[520px] text-sm">
                  <thead>
                    <tr>
                      <th scope="col">{t("flights.date")}</th>
                      <th scope="col">{t("flights.aircraft")}</th>
                      <th scope="col">{t("flights.route")}</th>
                      <th scope="col">{t("flights.role")}</th>
                      <th scope="col" className="!text-right">{t("flights.total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sampleFlights.map((f, i) => (
                      <tr key={`${f.date}-${i}`}>
                        <td className="mono text-xs text-ink-2 whitespace-nowrap">{f.date}</td>
                        <td className="font-medium text-ink-1 whitespace-nowrap">
                          {f.make_model}
                          {f.registration && <span className="mono text-xs text-ink-3 ml-1.5">{f.registration}</span>}
                        </td>
                        <td className="mono text-xs text-ink-2 whitespace-nowrap">{f.route || "—"}</td>
                        <td><Pill variant={rolePill(f.role)}>{f.role}</Pill></td>
                        <td className="num text-right text-ink-1">{fmt1(f.day_time + f.night_time)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Summary */}
        <aside aria-labelledby={summaryId} className="min-w-0 space-y-4 rounded-control border border-border bg-surface-2/40 p-3.5">
          <h3 id={summaryId} className="text-sm font-semibold text-ink-1">{s("summaryTitle")}</h3>
          <div className="grid grid-cols-3 gap-2">
            <Tile label={s("tileFlights")} value={n.toLocaleString()} accent="brand" />
            <Tile label={s("tileSkipped")} value={preview.skipped.toLocaleString()} accent={preview.skipped > 0 ? "warn" : "ink-3"} />
            <Tile
              label={hoursCredited ? s("tileHoursCredited") : s("tileHours")}
              value={fmt1(report.summary.creditedHours ?? report.summary.totalHours)}
              unit={s("hrs")}
              accent="good"
              sub={hoursCredited ? s("tileHoursLogged", { n: fmt1(report.summary.totalHours) }) : undefined}
            />
          </div>
          {preview.skipped > 0 && preview.skippedReasons.length > 0 && (
            <details className="group text-xs">
              <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center gap-1.5 font-medium text-ink-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60">
                <Icon.ChevronDown size={14} strokeWidth={2} aria-hidden className="transition-transform duration-fast motion-reduce:transition-none group-open:rotate-180" />
                {s("skipReasons")}
                <span className="text-ink-3 font-normal">· {s("ofRows", { total: analysis.rowCount.toLocaleString() })}</span>
              </summary>
              <ul className="mt-2 space-y-1">
                {preview.skippedReasons.map((r) => (
                  <li key={r.reason} className="flex items-baseline justify-between gap-3 text-ink-2">
                    <span>{skipReasonLabel(s, r.reason)}</span>
                    <span className="num text-ink-1 font-medium">{r.count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <Bars title={s("byRole")} data={report.summary.byRole} variantOf={rolePill} varOf={(k) => ROLE_VAR[k] ?? "ink-3"} />
          <Bars title={s("byCategory")} data={report.summary.byCategory} variantOf={categoryPill} varOf={(k) => CAT_VAR[k] ?? "ink-3"} />
        </aside>
      </div>

      {/* Mode */}
      <fieldset className="space-y-2">
        <legend className="label">{s("modeTitle")}</legend>
        <div className="grid sm:grid-cols-2 gap-2">
          <ModeCard name="mode" value="append" checked={mode === "append"} onChange={() => changeMode("append")} disabled={importBusy}
                    title={s("modeAppend")} body={s("modeAppendBody")} />
          <ModeCard name="mode" value="replace" checked={mode === "replace"} onChange={() => changeMode("replace")} disabled={importBusy}
                    title={s("modeReplace")} body={s("modeReplaceBody")} />
        </div>
        {mode === "replace" && (
          <Alert variant={preview.existingCount > 0 ? "bad" : "info"}>
            {preview.existingCount > 0
              ? s("replaceWarn", { n: preview.existingCount.toLocaleString() })
              : s("replaceWarnNone")}
          </Alert>
        )}
      </fieldset>

      {/* Template */}
      {!fromTemplate && (
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm text-ink-1 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 accent-brand"
              checked={saveTemplate}
              disabled={importBusy}
              onChange={(e) => onSaveTemplate(e.target.checked)}
            />
            <span>
              <span className="font-medium">{s("rememberTemplate")}</span>
              <span className="block text-xs text-ink-3">{s("templateHint")}</span>
            </span>
          </label>
          {saveTemplate && (
            <Field label={s("templateName")} className="max-w-sm">
              <input
                className="input"
                value={templateName}
                maxLength={120}
                disabled={importBusy}
                onChange={(e) => onTemplateName(e.target.value)}
              />
            </Field>
          )}
        </div>
      )}

      {n === 0 && <Alert variant="warn">{s("nothingToImport")}</Alert>}
      {error && <Alert variant="bad">{error}</Alert>}

      <CardFooter className="justify-between">
        <Button variant="ghost" onClick={onBack} disabled={importBusy}>
          <Icon.ArrowLeft size={16} strokeWidth={2} aria-hidden />{s("back")}
        </Button>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {armed && (
            <span id={noteId} role="status" className="text-sm font-medium text-right max-w-prose">
              {mismatch && <span className="block text-warn-ink">{s("mismatchNote")}</span>}
              {replaceDanger && <span className="block text-bad-ink">{s("replaceArmNote", { n: existing })}</span>}
            </span>
          )}
          <Button
            variant={armed ? "danger" : "primary"}
            onClick={clickImport}
            loading={importBusy}
            disabled={n === 0}
            aria-describedby={armed ? noteId : undefined}
          >
            {importLabel}
          </Button>
        </div>
      </CardFooter>
    </div>
  );
}

// ---------------------------------------------------------------------------

function CheckRow({ c, s, augHalfCredit }: { c: ReconcileCheck; s: ImportStrings; augHalfCredit: boolean }) {
  const st = STATUS[c.status] ?? STATUS.info;
  const StatusIcon = st.icon;
  // Explanations are rebuilt from the check's messageKey + vars; the label
  // stays the sheet's own text for declared totals (see checkLabel).
  const explanation = explanationFor(s, c);
  const delta = c.delta ?? (c.expected != null ? c.actual - c.expected : undefined);
  const showDelta = delta != null && Math.abs(delta) >= 0.05;
  return (
    <li className="flex gap-3 py-2.5 border-t border-border first:border-t-0">
      <StatusIcon size={18} strokeWidth={2} aria-hidden className={`mt-0.5 shrink-0 ${st.cls}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <span className="text-sm font-medium text-ink-1">
            {checkLabel(s, c)}<span className="sr-only">: {s(st.key)}</span>
          </span>
          <span className="num text-sm text-ink-1 whitespace-nowrap">
            {c.expected != null && (
              <>
                <span className="text-xs text-ink-3">{s("declared")} </span>{fmtNum(c.expected)}
                <span aria-hidden className="text-ink-3 mx-1.5">→</span>
              </>
            )}
            <span className="text-xs text-ink-3">{s("computed")} </span>
            <span className="font-semibold">{fmtNum(c.actual)}</span>
            {showDelta && (
              <span className={`ml-2 text-xs font-medium ${c.status === "mismatch" ? "text-bad-ink" : "text-warn-ink"}`}>
                {fmtDelta(delta)}
              </span>
            )}
          </span>
        </div>
        {explanation && <p className="mt-0.5 text-xs text-ink-2">{explanation}</p>}
        {c.suggestion?.kind === "aug_half_credit" && (
          <p className="mt-1.5 text-xs text-ink-2 rounded-control border border-brand/20 bg-brand/5 px-2.5 py-1.5">
            {s("augNote", { state: s(augHalfCredit ? "stateOn" : "stateOff") })}{" "}
            <Link
              href="/app/settings"
              className="font-medium text-brand-deep underline underline-offset-2 hover:text-brand rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            >
              {s("openSettings")}
            </Link>
          </p>
        )}
      </div>
    </li>
  );
}

function Tile({ label, value, unit, accent, sub }: { label: string; value: string; unit?: string; accent: string; sub?: string }) {
  return (
    <div className="relative overflow-hidden rounded-control border border-border bg-surface p-2.5 pl-3">
      <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r" style={{ background: `rgb(var(--${accent}))` }} />
      <div className="text-2xs font-semibold uppercase tracking-[0.08em] text-ink-2 truncate">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1 text-xl font-semibold text-ink-1 num">
        {value}{unit && <span className="text-xs font-normal text-ink-3">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 text-2xs text-ink-3 truncate num">{sub}</div>}
    </div>
  );
}

function Bars({
  title, data, variantOf, varOf,
}: {
  title: string;
  data: Record<string, number>;
  variantOf: (key: string) => PillVariant | string;
  varOf: (key: string) => string;
}) {
  const entries = Object.entries(data ?? {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (entries.length === 0) return null;
  const max = Math.max(...entries.map(([, v]) => v), 0.0001);
  return (
    <div>
      <h4 className="text-2xs font-semibold uppercase tracking-[0.08em] text-ink-2 mb-1.5">{title}</h4>
      <ul className="space-y-1.5">
        {entries.map(([k, v]) => (
          <li key={k} className="grid grid-cols-[4.5rem_minmax(0,1fr)_3.5rem] items-center gap-2">
            <Pill variant={variantOf(k)}>{k}</Pill>
            <div className="bar-track h-1.5 rounded-full overflow-hidden">
              <div className="h-full rounded-full bar-fill" style={{ width: `${(v / max) * 100}%`, background: `rgb(var(--${varOf(k)}))` }} />
            </div>
            <span className="num text-xs text-ink-1 text-right">{fmt1(v)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModeCard({
  name, value, checked, onChange, disabled, title, body,
}: {
  name: string; value: ImportMode; checked: boolean; onChange: () => void; disabled: boolean; title: string; body: string;
}) {
  return (
    <label className="mode-card">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} disabled={disabled} className="mt-0.5 accent-brand" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-1">{title}</span>
        <span className="block text-xs text-ink-3">{body}</span>
      </span>
    </label>
  );
}
