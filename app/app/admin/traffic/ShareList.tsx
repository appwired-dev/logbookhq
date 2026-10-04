import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui";

export type ShareListRow = {
  key: string;
  label: string;
  /** Full text for the title tooltip when the label is truncated (defaults to label). */
  title?: string;
  visits: number;
  /** Only rendered when the list has a views column. */
  views?: number;
  /** 0..1 — drives the thin bar and the share column. */
  share: number;
  /** Colour dot tying the row to its diagram node. */
  swatch?: string;
  /** This row is the current focus (or part of it). */
  pressed?: boolean;
  /** When present the label is a real <button> that toggles focus. */
  onSelect?: () => void;
  /** Accessible name for the button, when it should say more than the label. */
  selectLabel?: string;
};

/**
 * One "top N" card: a dense table whose first cell carries the label and a
 * thin share bar. Rows that drive a diagram's focus render their label as a
 * real <button> (keyboard, 44 px target, aria-pressed); the rest are text.
 *
 * Labels wrap on phones (long page paths would otherwise be cut to a few
 * letters) and truncate with a title tooltip from sm up.
 *
 * Hook-free, so the server page (Devices, Campaigns) and the client explorers
 * (Pages, Sources, Countries) all render it.
 */
export default function ShareList({
  title, meta, actions, rows, labelHeader, visitsHeader, viewsHeader, shareHeader,
  emptyText, fmtInt, fmtShare, barColor = "rgb(var(--chart-1))", scrollClassName = "", className = "",
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  rows: ShareListRow[];
  labelHeader: string;
  visitsHeader: string;
  /** Adds a page-views column. */
  viewsHeader?: string;
  shareHeader: string;
  emptyText: string;
  fmtInt: (n: number) => string;
  fmtShare: (s: number) => string;
  barColor?: string;
  /** e.g. "max-h-[360px] overflow-y-auto" for long lists (the header row stays put). */
  scrollClassName?: string;
  className?: string;
}) {
  const cols = viewsHeader ? 4 : 3;
  const scrolls = scrollClassName.length > 0;
  return (
    <Card padding="none" className={`min-w-0 overflow-hidden flex flex-col ${className}`}>
      <div className="px-4 pt-4 pb-3">
        <CardHeader flush title={title} meta={meta} actions={actions} />
      </div>
      <div className={`overflow-x-auto ${scrollClassName}`}>
        <table
          className={`data-table w-full text-sm ${scrolls ? "[&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-surface-2" : ""}`}
        >
          <thead>
            <tr>
              <th scope="col" className="w-full">{labelHeader}</th>
              <th scope="col" className="!text-right">{visitsHeader}</th>
              {viewsHeader && <th scope="col" className="!text-right">{viewsHeader}</th>}
              <th scope="col" className="!text-right">{shareHeader}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cols} className="!py-8 text-center text-ink-3">{emptyText}</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.key} className={r.pressed ? "bg-brand/[0.06]" : undefined}>
                  <td className="!py-1 max-w-0">
                    {r.onSelect ? (
                      <button
                        type="button"
                        onClick={r.onSelect}
                        aria-pressed={!!r.pressed}
                        aria-label={r.selectLabel}
                        title={r.title ?? r.label}
                        className="group -mx-1.5 flex w-[calc(100%+0.75rem)] min-h-11 flex-col justify-center gap-1 rounded-control px-1.5 py-1 text-left
                                   cursor-pointer transition-colors duration-fast motion-reduce:transition-none hover:bg-surface-2
                                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                      >
                        <RowLabel row={r} barColor={barColor} interactive />
                      </button>
                    ) : (
                      <div className="flex min-h-11 flex-col justify-center gap-1" title={r.title ?? r.label}>
                        <RowLabel row={r} barColor={barColor} />
                      </div>
                    )}
                  </td>
                  <td className="text-right num whitespace-nowrap text-ink-1">{fmtInt(r.visits)}</td>
                  {viewsHeader && <td className="text-right num whitespace-nowrap text-ink-2">{fmtInt(r.views ?? 0)}</td>}
                  <td className="text-right num whitespace-nowrap text-ink-3">{fmtShare(r.share)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RowLabel({ row, barColor, interactive = false }: { row: ShareListRow; barColor: string; interactive?: boolean }) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-2">
        {row.swatch && (
          <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-pill" style={{ background: row.swatch }} />
        )}
        <span
          className={`min-w-0 [overflow-wrap:anywhere] sm:truncate ${row.pressed ? "font-semibold text-brand-deep" : "font-medium text-ink-1"} ${interactive ? "group-hover:text-brand-deep" : ""}`}
        >
          {row.label}
        </span>
      </span>
      <span aria-hidden className="block h-1 w-full overflow-hidden rounded-pill bg-surface-2">
        <span
          className="block h-full rounded-pill"
          style={{ width: `${Math.max(row.share > 0 ? 1.5 : 0, row.share * 100)}%`, background: row.swatch ?? barColor }}
        />
      </span>
    </>
  );
}
