"use client";

import { useId, useMemo, useState, type RefObject } from "react";
import { Alert, Button, CardFooter, Icon, Pill, type PillVariant } from "@/components/ui";
import type { Analysis, CanonicalTarget, ColumnAssignment, ColumnMapping, HeaderPath } from "@/lib/import/types";
// Pure module — keeps SheetJS/Anthropic (reachable via the "@/lib/import" barrel) out of the client bundle.
import { CANONICAL_OPTIONS, describeTarget, parseTargetKey, targetKey } from "@/lib/import/mapping";
import { targetGroupLabel, targetLabel, type ImportStrings } from "./import-strings";
import type { AiNotice } from "./ImportWizard";

/** The slice of a CANONICAL_OPTIONS group this table reads. */
type OptionGroup = { group: string; options: { label: string; target: CanonicalTarget }[] };
type Option = OptionGroup["options"][number];

/**
 * Localised label for a target key, built client-side from the stable key
 * ("field:date", "time:me:night:fo"). Keys this locale file does not know
 * fall back to the library's English describeTarget().
 */
export function labelForTargetKey(key: string, s: ImportStrings): string {
  return targetLabel(s, key) ?? describeTarget(parseTargetKey(key));
}

/** Same, from a target object — keeps the exact target for the describeTarget() fallback. */
function labelForTarget(target: CanonicalTarget, s: ImportStrings): string {
  return targetLabel(s, targetKey(target)) ?? describeTarget(target);
}

// ---------------------------------------------------------------------------
// Row model
// ---------------------------------------------------------------------------

/**
 * A column still needs a human (or the AI) when the detector wasn't sure.
 * Anything the user or a template set is settled; an AI answer is settled
 * unless it was itself unsure.
 */
export function needsReview(a: ColumnAssignment, lowCols: Set<number>): boolean {
  if (a.source === "user" || a.source === "template") return false;
  if (a.source === "ai") return a.confidence < 0.6;
  return lowCols.has(a.col) || a.confidence < 0.6;
}

/** Column indices that still need review under the current mapping. */
export function reviewCols(analysis: Analysis, mapping: ColumnMapping): number[] {
  const low = new Set(analysis.lowConfidenceCols);
  return mapping.columns.filter((a) => needsReview(a, low)).map((a) => a.col);
}

interface Row {
  path: HeaderPath;
  assignment: ColumnAssignment;
  samples: string[];
  review: boolean;
}

const IGNORE: ColumnAssignment["target"] = { kind: "ignore" };
const IGNORE_KEY = targetKey(IGNORE);

/** Every key the grouped <select> lists — computed once; CANONICAL_OPTIONS is static. */
const LISTED_KEYS = new Set<string>(
  CANONICAL_OPTIONS.flatMap((g: OptionGroup) => g.options.map((o: Option) => targetKey(o.target))),
);

function buildRows(analysis: Analysis, mapping: ColumnMapping): Row[] {
  const byCol = new Map(mapping.columns.map((c) => [c.col, c]));
  const low = new Set(analysis.lowConfidenceCols);
  // `sample` rows are aligned with header.paths; fall back to sheet-column
  // indexing if a producer ever emits full-width rows instead.
  const aligned = (analysis.sample[0]?.length ?? 0) === analysis.header.paths.length;
  return analysis.header.paths.map((path, index) => {
    const assignment = byCol.get(path.col) ?? { col: path.col, target: IGNORE, confidence: 0, source: "shape" as const };
    const samples: string[] = [];
    for (const r of analysis.sample) {
      const v = String((aligned ? r[index] : r[path.col]) ?? "").trim();
      if (v) samples.push(v);
      if (samples.length === 3) break;
    }
    return { path, assignment, samples, review: needsReview(assignment, low) };
  });
}

/** 0 → A, 25 → Z, 26 → AA … like a spreadsheet. */
function colLetter(i: number): string {
  let out = "";
  let n = i;
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

function confidencePill(a: ColumnAssignment, s: ImportStrings): { variant: PillVariant; label: string } {
  if (a.source === "user" || a.source === "template") return { variant: "neutral", label: s("confSet") };
  if (a.confidence >= 0.85) return { variant: "good", label: s("confSure") };
  if (a.confidence >= 0.6) return { variant: "warn", label: s("confLikely") };
  return { variant: "bad", label: s("confCheck") };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StepMapping({
  s, analysis, mapping, onMappingChange, onReset, onAskAi, aiBusy, aiNotice,
  onBack, onContinue, continueBusy, error, headingRef,
}: {
  s: ImportStrings;
  analysis: Analysis;
  mapping: ColumnMapping;
  onMappingChange: (m: ColumnMapping) => void;
  onReset: () => void;
  onAskAi: () => void;
  aiBusy: boolean;
  aiNotice: AiNotice | null;
  onBack: () => void;
  onContinue: () => void;
  continueBusy: boolean;
  error: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const [showIgnored, setShowIgnored] = useState(false);
  const rows = useMemo(() => buildRows(analysis, mapping), [analysis, mapping]);
  const review = rows.filter((r) => r.review);
  const mapped = rows.filter((r) => !r.review && r.assignment.target.kind !== "ignore");
  const ignored = rows.filter((r) => !r.review && r.assignment.target.kind === "ignore");
  const mappedCount = rows.filter((r) => r.assignment.target.kind !== "ignore").length;
  const busy = aiBusy || continueBusy;

  function setTarget(col: number, key: string) {
    const target = parseTargetKey(key);
    const exists = mapping.columns.some((c) => c.col === col);
    const columns = exists
      ? mapping.columns.map((c) => (c.col === col ? { ...c, target, source: "user" as const, confidence: 1, reason: undefined } : c))
      : [...mapping.columns, { col, target, source: "user" as const, confidence: 1 }];
    onMappingChange({ ...mapping, columns });
  }

  const conv = mapping.conventions ?? {};
  const conventions = [
    conv.clockTimes && s("convClock"),
    conv.decimalComma && s("convDecimalComma"),
    conv.dayFirstDates && s("convDayFirst"),
    conv.blankAircraftIsSim && s("convBlankSim"),
  ].filter((x): x is string => Boolean(x));

  return (
    <div className="space-y-4">
      <div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold text-ink-1 tracking-tight rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          {s("step2")}
        </h2>
        <p className="text-xs text-ink-3 mt-0.5">
          {s("mappingMeta", { rows: analysis.rowCount.toLocaleString(), sheet: analysis.sheetName })}
          {" · "}
          <span className="mono">{analysis.filename}</span>
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-control border border-border bg-surface-2/50 px-3 py-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink-1 num">{s("mappedCount", { mapped: mappedCount, low: review.length })}</div>
          <div className="text-xs text-ink-3">{s("reviewHint")}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={onAskAi} loading={aiBusy} disabled={busy || review.length === 0}>
            <Icon.Sparkles size={14} strokeWidth={2} aria-hidden />
            {aiBusy ? s("askAiPending") : s("askAi")}
          </Button>
          <Button size="sm" variant="ghost" onClick={onReset} disabled={busy}>
            <Icon.RotateCcw size={14} strokeWidth={2} aria-hidden />
            {s("resetDetected")}
          </Button>
        </div>
      </div>

      {aiNotice && <Alert variant={aiNotice.tone}>{aiNotice.text}</Alert>}

      {/* Conventions the sheet appears to use (read-only) */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-ink-2 mr-1">{s("conventions")}</span>
        {conventions.length > 0
          ? conventions.map((label) => <Pill key={label} variant="xc">{label}</Pill>)
          : <span className="text-xs text-ink-3">{s("convNone")}</span>}
      </div>

      {/* Mapping table */}
      {/* Bleeds through the card's p-5 on phones so the table gets the full width. */}
      <div className="-mx-5 sm:mx-0 overflow-x-auto sm:rounded-control sm:border sm:border-border">
        <table className="import-table w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              <th scope="col">{s("colColumn")}</th>
              <th scope="col">{s("colSamples")}</th>
              <th scope="col">{s("colMapsTo")}</th>
              <th scope="col">{s("colConfidence")}</th>
            </tr>
          </thead>
          <tbody>
            {[...review, ...mapped].map((row) => (
              <MappingRow key={row.path.col} row={row} s={s} onChange={setTarget} disabled={busy} />
            ))}
            {ignored.length > 0 && (
              <tr>
                <td colSpan={4} className="!py-1 bg-surface-2/40">
                  <Button variant="ghost" size="sm" aria-expanded={showIgnored} onClick={() => setShowIgnored((v) => !v)}>
                    <Icon.ChevronDown size={14} strokeWidth={2} aria-hidden className={`transition-transform duration-fast motion-reduce:transition-none ${showIgnored ? "rotate-180" : ""}`} />
                    {showIgnored ? s("hideIgnored") : s("showIgnored", { n: ignored.length })}
                  </Button>
                </td>
              </tr>
            )}
            {showIgnored && ignored.map((row) => (
              <MappingRow key={row.path.col} row={row} s={s} onChange={setTarget} disabled={busy} />
            ))}
          </tbody>
        </table>
      </div>

      {error && <Alert variant="bad">{error}</Alert>}

      <CardFooter className="justify-between">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          <Icon.ArrowLeft size={16} strokeWidth={2} aria-hidden />{s("back")}
        </Button>
        <Button variant="primary" onClick={onContinue} loading={continueBusy} disabled={busy}>
          {continueBusy ? s("checking") : <>{s("continue")}<Icon.ArrowRight size={16} strokeWidth={2} aria-hidden /></>}
        </Button>
      </CardFooter>
    </div>
  );
}

// ---------------------------------------------------------------------------

function MappingRow({
  row, s, onChange, disabled,
}: {
  row: Row;
  s: ImportStrings;
  onChange: (col: number, key: string) => void;
  disabled: boolean;
}) {
  const id = useId();
  const { path, assignment, samples, review } = row;
  const currentKey = targetKey(assignment.target);
  const pill = confidencePill(assignment, s);
  const letter = colLetter(path.col);
  const confidenceTitle = `${Math.round(assignment.confidence * 100)}%${assignment.reason ? ` · ${assignment.reason}` : ""}`;

  return (
    <tr data-review={review || undefined}>
      <td>
        <div className="flex items-start gap-2">
          <span className="mono text-2xs text-ink-3 w-6 shrink-0 pt-0.5">{letter}</span>
          <div className="min-w-0">
            <Breadcrumbs path={path.path} />
            {assignment.reason && (
              <div className="text-2xs text-ink-3 mt-0.5 truncate max-w-[18rem]" title={assignment.reason}>{assignment.reason}</div>
            )}
          </div>
        </div>
      </td>
      <td>
        {samples.length > 0 ? (
          <ul className="space-y-0.5">
            {samples.map((v, i) => (
              <li key={i} className="mono text-xs text-ink-2 truncate max-w-[12rem]" title={v}>{v}</li>
            ))}
          </ul>
        ) : (
          <span className="text-xs text-ink-3">{s("noSamples")}</span>
        )}
      </td>
      <td>
        <label htmlFor={id} className="sr-only">{s("mapSelectLabel", { col: `${letter} · ${path.label}` })}</label>
        <select
          id={id}
          className="input input-sm h-11 sm:h-8 min-w-[12rem]"
          value={currentKey}
          disabled={disabled}
          onChange={(e) => onChange(path.col, e.target.value)}
        >
          {/* Safety net only — the library lists "ignore" in its own group, whose label is localised below. */}
          {!LISTED_KEYS.has(IGNORE_KEY) && <option value={IGNORE_KEY}>{s("ignoreOption")}</option>}
          {!LISTED_KEYS.has(currentKey) && currentKey !== IGNORE_KEY && (
            <option value={currentKey}>{labelForTarget(assignment.target, s)}</option>
          )}
          {CANONICAL_OPTIONS.map((g: OptionGroup) => (
            <optgroup key={g.group} label={targetGroupLabel(s, g.group)}>
              {g.options.map((o: Option) => {
                const k = targetKey(o.target);
                return <option key={`${g.group}:${k}`} value={k}>{labelForTargetKey(k, s)}</option>;
              })}
            </optgroup>
          ))}
        </select>
      </td>
      <td>
        <Pill variant={pill.variant} title={confidenceTitle}>{pill.label}</Pill>
      </td>
    </tr>
  );
}

/** Header path as breadcrumbs: Multi-Engine › Night › FO (last segment emphasised). */
function Breadcrumbs({ path }: { path: string[] }) {
  if (path.length === 0) return <span className="text-xs text-ink-3">—</span>;
  return (
    <span className="mono text-xs text-ink-2 break-words">
      {path.map((seg, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden className="text-ink-3 mx-1">›</span>}
          <span className={i === path.length - 1 ? "text-ink-1 font-medium" : ""}>{seg}</span>
        </span>
      ))}
    </span>
  );
}
