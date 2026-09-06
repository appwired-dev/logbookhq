"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
// CircleCheck is not in components/ui/icons yet (read-only for this change) — fold it in later.
import { CircleCheck } from "@/components/ui/icons";
import { Button, Card, Icon, PageHeader, buttonClass } from "@/components/ui";
import type { Locale } from "@/lib/i18n";
import type { Analysis, ColumnMapping } from "@/lib/import/types";
// Pure module — keeps SheetJS/Anthropic (reachable via the "@/lib/import" barrel) out of the client bundle.
import { targetKey } from "@/lib/import/mapping";
import { analyzeImportAction, arbitrateImportAction, commitImportAction, previewImportAction } from "./actions";
import { LEGACY_FORMAT_NAMES, makeStrings, type ImportStrings } from "./import-strings";
import StepUpload from "./StepUpload";
import StepMapping, { reviewCols } from "./StepMapping";
import StepReconcile from "./StepReconcile";
import {
  MAX_FILE_BYTES, isActionError, isAllowedExtension,
  type ActionResult, type CommitData, type ImportMode, type PreviewData,
} from "./wizard-types";

type Step = 1 | 2 | 3;
type Busy = null | "analyze" | "ai" | "preview" | "commit";
export type AiNotice = { tone: "info" | "good" | "warn"; text: string };

const stripExt = (name: string) => name.replace(/\.[^.]+$/, "");

/**
 * Three-step import wizard: Upload → Review mapping → Reconcile & import.
 *
 * The browser keeps the File; every server round-trip re-sends it together
 * with the JSON `analysis` and the (possibly edited) `mapping`, so nothing is
 * persisted server-side until the user commits.
 */
export default function ImportWizard({ locale, augHalfCredit }: { locale: Locale; augHalfCredit: boolean }) {
  const s = useMemo(() => makeStrings(locale), [locale]);

  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  /** JSON of the mapping the current preview was computed with — skips a round-trip when unchanged. */
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  /** Display name of the format/template whose mapping was applied without review. */
  const [autoApplied, setAutoApplied] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>("append");
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [result, setResult] = useState<CommitData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<AiNotice | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [announce, setAnnounce] = useState("");

  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepNames = [s("step1"), s("step2"), s("step3")];

  function goTo(n: Step) {
    setStep(n);
    setError(null);
    setAnnounce(s("stepAnnounce", { n, name: stepNames[n - 1] }));
  }

  // Move focus to the step heading whenever the visible step (or the success
  // panel) changes — never on first paint.
  const focusKey = useRef(`${step}:${result ? 1 : 0}`);
  useEffect(() => {
    const key = `${step}:${result ? 1 : 0}`;
    if (focusKey.current === key) return;
    focusKey.current = key;
    const id = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [step, result]);

  /** Run a server action; surfaces `{ error }` and network failures via setError. */
  async function run<T>(fn: () => Promise<ActionResult<T>>): Promise<T | null> {
    try {
      const r = await fn();
      if (isActionError(r)) { setError(r.error); return null; }
      return r;
    } catch (e: unknown) {
      // Server actions are fetched under the hood; flaky mobile connections
      // surface as "Failed to fetch" (Chrome) / "Load failed" (Safari).
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg === "Failed to fetch" || msg === "Load failed" ? s("errNetwork") : msg || s("errGeneric"));
      return null;
    }
  }

  // ---- step 1 -------------------------------------------------------------

  function pickFile(f: File | null) {
    setError(null);
    if (!f) { setFile(null); return; }
    if (!isAllowedExtension(f.name)) { setFile(null); setError(s("errType")); return; }
    if (f.size > MAX_FILE_BYTES) { setFile(null); setError(s("errTooLarge", { size: (f.size / 1024 / 1024).toFixed(1) })); return; }
    setFile(f);
  }

  async function analyze() {
    if (!file) { setError(s("errNoFile")); return; }
    setBusy("analyze");
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    const r = await run(() => analyzeImportAction(fd));
    setBusy(null);
    if (!r) return;
    const { analysis: a, ...pv } = r;
    setAnalysis(a);
    setMapping(a.mapping);
    setPreview(pv);
    setPreviewKey(JSON.stringify(a.mapping));
    setTemplateName(stripExt(file.name));
    setSaveTemplate(false);
    setMode("append");
    setAiNotice(null);

    // Known export or a remembered layout with nothing unclear: skip review.
    const legacyName = a.legacyFormat ? (LEGACY_FORMAT_NAMES[a.legacyFormat] ?? a.legacyFormat) : null;
    const templateName = a.templateId && a.lowConfidenceCols.length === 0 ? (a.templateName ?? a.templateId) : null;
    const auto = legacyName ?? templateName;
    setAutoApplied(auto);
    goTo(auto ? 3 : 2);
  }

  // ---- step 2 -------------------------------------------------------------

  function changeMapping(m: ColumnMapping) {
    setMapping(m);
    setAutoApplied(null);
    setAiNotice(null);
  }

  function resetMapping() {
    if (!analysis) return;
    setMapping(analysis.mapping);
    setAiNotice(null);
  }

  async function askAi() {
    if (!analysis || !mapping) return;
    const cols = reviewCols(analysis, mapping);
    if (cols.length === 0) { setAiNotice({ tone: "info", text: s("aiNoChange") }); return; }
    setBusy("ai");
    setError(null);
    setAiNotice(null);
    const fd = new FormData();
    fd.set("analysis", JSON.stringify(analysis));
    fd.set("onlyCols", JSON.stringify(cols));
    try {
      const r = await arbitrateImportAction(fd);
      if (isActionError(r)) {
        setAiNotice({ tone: "warn", text: /not enabled/i.test(r.error) ? s("aiUnavailable") : r.error });
        return;
      }
      // Merge only the columns we asked about; everything else stays as the user left it.
      const asked = new Set(cols);
      const byCol = new Map(r.mapping.columns.map((c) => [c.col, c]));
      let changed = 0;
      const columns = mapping.columns.map((c) => {
        if (!asked.has(c.col)) return c;
        const next = byCol.get(c.col);
        if (!next) return c;
        if (targetKey(next.target) !== targetKey(c.target)) changed++;
        return next;
      });
      setMapping({ ...mapping, columns, conventions: { ...mapping.conventions, ...(r.mapping.conventions ?? {}) } });
      setAutoApplied(null);
      setAiNotice(changed > 0 ? { tone: "good", text: s("aiApplied", { n: changed }) } : { tone: "info", text: s("aiNoChange") });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setAiNotice({ tone: "warn", text: msg === "Failed to fetch" || msg === "Load failed" ? s("errNetwork") : msg || s("errGeneric") });
    } finally {
      setBusy(null);
    }
  }

  async function continueToReconcile() {
    if (!file || !analysis || !mapping) return;
    const key = JSON.stringify(mapping);
    if (preview && key === previewKey) { goTo(3); return; }
    setBusy("preview");
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("analysis", JSON.stringify(analysis));
    fd.set("mapping", key);
    const r = await run(() => previewImportAction(fd));
    setBusy(null);
    if (!r) return;
    setPreview(r);
    setPreviewKey(key);
    goTo(3);
  }

  // ---- step 3 -------------------------------------------------------------

  async function commit() {
    if (!file || !analysis || !mapping) return;
    setBusy("commit");
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("analysis", JSON.stringify(analysis));
    fd.set("mapping", JSON.stringify(mapping));
    fd.set("mode", mode);
    if (saveTemplate && !analysis.templateId) {
      fd.set("saveTemplate", "1");
      fd.set("templateName", templateName.trim() || stripExt(file.name));
    }
    const r = await run(() => commitImportAction(fd));
    setBusy(null);
    if (!r) return;
    setResult(r);
    setAnnounce(s("successTitle", { n: r.inserted }));
  }

  function resetAll() {
    setFile(null);
    setAnalysis(null);
    setMapping(null);
    setPreview(null);
    setPreviewKey(null);
    setAutoApplied(null);
    setMode("append");
    setSaveTemplate(false);
    setTemplateName("");
    setResult(null);
    setAiNotice(null);
    setBusy(null);
    goTo(1);
  }

  // ---- render -------------------------------------------------------------

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={s("title")} subtitle={s("subtitle")} />
      <p aria-live="polite" aria-atomic="true" className="sr-only">{announce}</p>

      {result ? (
        <SuccessPanel s={s} result={result} headingRef={headingRef} onReset={resetAll} />
      ) : (
        <Card padding="lg">
          <div className="pb-4 mb-5 border-b border-border">
            <Stepper s={s} step={step} />
          </div>

          {step === 1 && (
            <StepUpload
              s={s}
              file={file}
              onFile={pickFile}
              onAnalyze={analyze}
              busy={busy === "analyze"}
              error={error}
              headingRef={headingRef}
            />
          )}

          {step === 2 && analysis && mapping && (
            <StepMapping
              s={s}
              analysis={analysis}
              mapping={mapping}
              onMappingChange={changeMapping}
              onReset={resetMapping}
              onAskAi={askAi}
              aiBusy={busy === "ai"}
              aiNotice={aiNotice}
              onBack={() => goTo(1)}
              onContinue={continueToReconcile}
              continueBusy={busy === "preview"}
              error={error}
              headingRef={headingRef}
            />
          )}

          {step === 3 && analysis && mapping && preview && (
            <StepReconcile
              key={previewKey ?? "preview"}
              s={s}
              locale={locale}
              analysis={analysis}
              preview={preview}
              augHalfCredit={augHalfCredit}
              autoApplied={autoApplied}
              onReviewMapping={() => goTo(2)}
              onBack={() => goTo(2)}
              mode={mode}
              onMode={setMode}
              saveTemplate={saveTemplate}
              onSaveTemplate={setSaveTemplate}
              templateName={templateName}
              onTemplateName={setTemplateName}
              onImport={commit}
              importBusy={busy === "commit"}
              error={error}
              headingRef={headingRef}
            />
          )}
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Stepper({ s, step }: { s: ImportStrings; step: Step }) {
  const names = [s("step1"), s("step2"), s("step3")];
  return (
    <ol aria-label={s("stepsLabel")} className="flex items-center gap-2 sm:gap-3 flex-wrap">
      {names.map((name, i) => {
        const n = (i + 1) as Step;
        const state = n < step ? "done" : n === step ? "current" : "todo";
        const dot =
          state === "current" ? "bg-brand text-ink-inverse border-brand shadow-glow"
          : state === "done" ? "bg-good/10 text-good-ink border-good/40"
          : "bg-surface text-ink-3 border-border-strong";
        const text =
          state === "current" ? "font-semibold text-ink-1"
          : state === "done" ? "text-ink-2"
          : "text-ink-3";
        return (
          <li
            key={n}
            aria-current={state === "current" ? "step" : undefined}
            className="flex items-center gap-2 sm:gap-3 min-w-0"
          >
            <span
              aria-hidden
              className={`grid place-items-center w-7 h-7 rounded-full text-xs font-semibold border shrink-0 transition-colors duration-med ease-out ${dot}`}
            >
              {state === "done" ? <Icon.Check size={14} strokeWidth={2.5} /> : n}
            </span>
            <span className={`text-sm truncate ${text}`}>
              <span className="sr-only">{n}. </span>
              {name}
              {state === "done" && <span className="sr-only"> ({s("stepDone")})</span>}
            </span>
            {i < names.length - 1 && (
              <span aria-hidden className={`hidden sm:block h-px w-8 lg:w-14 ${n < step ? "bg-good/50" : "bg-border-strong"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function SuccessPanel({
  s, result, headingRef, onReset,
}: {
  s: ImportStrings;
  result: CommitData;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onReset: () => void;
}) {
  return (
    <div className="card p-10 text-center">
      <div className="mx-auto w-12 h-12 rounded-xl bg-good/10 text-good-ink grid place-items-center">
        <CircleCheck size={22} strokeWidth={1.75} aria-hidden />
      </div>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-4 text-lg font-semibold text-ink-1 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        {s("successTitle", { n: result.inserted.toLocaleString() })}
      </h2>
      {(result.deleted > 0 || result.templateSaved) && (
        <div className="mt-1.5 text-sm text-ink-2 max-w-md mx-auto space-x-1">
          {result.deleted > 0 && <span>{s("successReplaced", { d: result.deleted.toLocaleString() })}</span>}
          {result.templateSaved && <span>{s("successTemplate")}</span>}
        </div>
      )}
      <div className="mt-5 flex gap-2 justify-center flex-wrap">
        <Link href="/app" className={buttonClass("primary")}>{s("toDashboard")}</Link>
        <Link href="/app/flights" className={buttonClass()}>{s("toFlights")}</Link>
        <Button variant="ghost" onClick={onReset}>
          <Icon.RotateCcw size={16} strokeWidth={2} aria-hidden />{s("importAnother")}
        </Button>
      </div>
    </div>
  );
}
