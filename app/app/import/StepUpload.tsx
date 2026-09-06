"use client";

import { useId, useState, type DragEvent, type RefObject } from "react";
// CloudUpload / FileSpreadsheet are not in components/ui/icons yet (read-only for this change).
import { CloudUpload, FileSpreadsheet } from "@/components/ui/icons";
import { Alert, Button, CardFooter, Icon, Pill, Skeleton } from "@/components/ui";
import type { ImportStrings } from "./import-strings";

const ACCEPT = [
  ".csv", ".tsv", ".txt", ".xlsx", ".xls",
  "text/csv", "text/tab-separated-values", "text/plain",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",");

const SUPPORTED = ["ForeFlight", "LogTen", "MyFlightbook", "LogbookHQ", "Apple Numbers"];

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function StepUpload({
  s, file, onFile, onAnalyze, busy, error, headingRef,
}: {
  s: ImportStrings;
  file: File | null;
  onFile: (file: File | null) => void;
  onAnalyze: () => void;
  busy: boolean;
  error: string | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const [dragging, setDragging] = useState(false);

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const f = e.dataTransfer.files?.[0] ?? null;
    if (f) onFile(f);
  }
  function onDragOver(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    if (!dragging && !busy) setDragging(true);
  }
  function onDragLeave(e: DragEvent<HTMLElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragging(false);
  }

  return (
    <div className="space-y-5">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold text-ink-1 tracking-tight rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        {s("step1")}
      </h2>

      <label
        htmlFor={inputId}
        className="dropzone"
        data-active={dragging || undefined}
        data-disabled={busy || undefined}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <input
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={busy}
          aria-label={s("fileInputLabel")}
          aria-describedby={hintId}
          onChange={(e) => {
            onFile(e.target.files?.[0] ?? null);
            // Allow re-selecting the same file after removing it.
            e.target.value = "";
          }}
        />
        <span aria-hidden className="w-11 h-11 rounded-xl bg-brand/10 text-brand grid place-items-center mb-1">
          <CloudUpload size={22} strokeWidth={1.75} />
        </span>
        <span className="text-sm font-semibold text-ink-1">{s("dropTitle")}</span>
        <span className="text-sm text-ink-2">{s("dropBody")}</span>
        <span id={hintId} className="text-xs text-ink-3">{s("dropHint")}</span>
      </label>

      {file && (
        <div className="flex items-center gap-3 rounded-control border border-border bg-surface-2/60 px-3 py-2">
          <FileSpreadsheet size={18} strokeWidth={1.75} aria-hidden className="text-brand-deep shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink-1 truncate">{file.name}</div>
            <div className="text-xs text-ink-3 num">{formatSize(file.size)}</div>
          </div>
          <Button variant="ghost" icon aria-label={s("removeFile")} onClick={() => onFile(null)} disabled={busy}>
            <Icon.X size={16} strokeWidth={2} aria-hidden />
          </Button>
        </div>
      )}

      {error && <Alert variant="bad">{error}</Alert>}

      {busy ? (
        <div aria-busy="true" className="space-y-2">
          <span role="status" className="sr-only">{s("readingColumns")}</span>
          <div aria-hidden className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-[92%]" />
            <Skeleton className="h-8 w-[84%]" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-ink-2 mr-1">{s("supported")}</span>
            {SUPPORTED.map((name) => <Pill key={name} variant="neutral">{name}</Pill>)}
          </div>

          <details className="group rounded-control border border-border bg-surface-2/40 px-3 py-2 text-sm">
            <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center gap-1.5 font-medium text-ink-2 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60">
              <Icon.ChevronDown size={14} strokeWidth={2} aria-hidden className="transition-transform duration-fast group-open:rotate-180" />
              {s("whereToExport")}
            </summary>
            <ul className="mt-2 space-y-1.5 text-xs text-ink-2 list-disc pl-5">
              <li>{s("helpLogbookhq")}</li>
              <li>{s("helpForeflight")}</li>
              <li>{s("helpLogten")}</li>
              <li>{s("helpMyflightbook")}</li>
              <li>{s("helpNumbers")}</li>
            </ul>
          </details>
        </>
      )}

      <CardFooter className="justify-end">
        <Button variant="primary" onClick={onAnalyze} loading={busy} disabled={!file}>
          {busy ? s("analyzing") : <>{s("analyze")}<Icon.ArrowRight size={16} strokeWidth={2} aria-hidden /></>}
        </Button>
      </CardFooter>
    </div>
  );
}
