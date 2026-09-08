import type { ReactNode } from "react";
import { Card, CardHeader, CardFooter, Icon, Pill, categoryPill, rolePill } from "@/components/ui";
import type { Category, Role } from "@/lib/types";
import type { FlightSummary } from "./flight-validation";

export type SummaryStatus = { ready: boolean; text: string };

export type SummaryStrings = {
  title: string;
  totalTime: string;
  unit: string;
  night: string;
  instrument: string;
  approaches: string;
  xc: string;
  /** Pill text — matches the flights list's XC column label. */
  xcShort: string;
  yes: string;
  no: string;
};

/** "Ready to save" / "2 fields need attention" — shared by the card and the phone bar. */
export function SummaryStatusLine({ status, className = "" }: { status: SummaryStatus; className?: string }) {
  const Ico = status.ready ? Icon.Check : Icon.TriangleAlert;
  return (
    <p
      role="status"
      className={`flex items-center gap-1.5 text-xs font-medium ${status.ready ? "text-good-ink" : "text-warn-ink"} ${className}`}
    >
      <Ico size={14} strokeWidth={2} aria-hidden className="shrink-0" />
      <span>{status.text}</span>
    </p>
  );
}

function StatRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-ink-2">{label}</dt>
      <dd className="num font-medium text-ink-1">{value}</dd>
    </div>
  );
}

/**
 * Sticky right-hand summary (lg+): credited total, category/role pills, a few
 * stat rows, validation status, then the primary actions and (edit mode) the
 * delete control in the footer. Purely presentational — the form owns state.
 */
export function FlightSummaryCard({
  summary, category, role, categoryTitle, roleTitle, status, strings, actions, footer, className = "",
}: {
  summary: FlightSummary;
  category: Category;
  role: Role;
  categoryTitle: string;
  roleTitle: string;
  status: SummaryStatus;
  strings: SummaryStrings;
  actions: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card padding="md" className={className}>
      <CardHeader title={strings.title} />

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xs font-semibold uppercase tracking-[0.1em] text-ink-2">{strings.totalTime}</div>
          <div className="mt-1 flex items-baseline gap-1.5 text-ink-1">
            <span className="num text-num font-semibold">{summary.total.toFixed(1)}</span>
            <span className="text-xs text-ink-3">{strings.unit}</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <Pill variant={categoryPill(category)} title={categoryTitle}>{category}</Pill>
          <Pill variant={rolePill(role)} title={roleTitle}>{role}</Pill>
          {summary.xc && <Pill variant="xc" title={strings.xc}>{strings.xcShort}</Pill>}
        </div>
      </div>

      <dl className="mt-4 border-t border-border divide-y divide-border text-sm">
        <StatRow label={strings.night} value={`${summary.night.toFixed(1)} ${strings.unit}`} />
        <StatRow label={strings.instrument} value={`${summary.instrument.toFixed(1)} ${strings.unit}`} />
        <StatRow label={strings.approaches} value={summary.approaches} />
        <StatRow label={strings.xc} value={summary.xc ? strings.yes : strings.no} />
      </dl>

      <SummaryStatusLine status={status} className="mt-4" />
      <div className="mt-3 flex flex-col gap-2">{actions}</div>

      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}

/**
 * Below lg the summary collapses to this sticky bar: credited total + status
 * on the left, Cancel/Save on the right. Sits above the phone bottom nav
 * (--bottom-nav-h) and flush to the viewport bottom from md up. While
 * `prompt` is set (the unsaved-changes confirm) it takes the bar over in
 * place of the total/actions row.
 */
export function FlightActionBar({
  total, unit, totalLabel, status, children, prompt, className = "",
}: {
  total: number;
  unit: string;
  totalLabel: string;
  status: SummaryStatus;
  children: ReactNode;
  prompt?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`sticky bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] md:bottom-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 bg-canvas/85 backdrop-blur border-t border-border ${className}`}
    >
      {prompt ?? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 text-ink-1">
              <span className="sr-only">{totalLabel}: </span>
              <span className="num text-xl font-semibold">{total.toFixed(1)}</span>
              <span className="text-xs text-ink-3">{unit}</span>
            </div>
            <SummaryStatusLine status={status} />
          </div>
          <div className="flex items-center gap-2 shrink-0">{children}</div>
        </div>
      )}
    </div>
  );
}
