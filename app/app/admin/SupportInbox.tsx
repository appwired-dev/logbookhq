import Link from "next/link";
import LinkPending from "./LinkPending";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { Card, CardHeader, Pill } from "@/components/ui";
import { adminStrings } from "./admin-strings";
import SupportRowActions from "./SupportRowActions";

export type SupportRow = {
  id: number;
  email: string | null;
  subject: string | null;
  message: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
};

export const SUPPORT_FILTERS = ["open", "resolved", "all"] as const;
export type SupportFilter = (typeof SUPPORT_FILTERS)[number];

/** The inbox shows at most this many rows (newest first). */
export const SUPPORT_LIMIT = 200;

/** `?status=` → filter; anything unknown (or missing) is the default, open. */
export function parseSupportFilter(v: string | string[] | undefined): SupportFilter {
  const raw = Array.isArray(v) ? v[0] : v;
  return SUPPORT_FILTERS.find((f) => f === raw) ?? "open";
}

/** Every status other than 'resolved' counts as open (the DB default is 'open'). */
export const isResolvedStatus = (status: string) => status === "resolved";

/**
 * Render a "{date}" template with the date as a node (a <time>), so the
 * surrounding words stay translatable in any word order.
 */
function withDate(template: string, date: ReactNode): ReactNode {
  const i = template.indexOf("{date}");
  if (i < 0) return <>{template} {date}</>;
  return <>{template.slice(0, i)}{date}{template.slice(i + "{date}".length)}</>;
}

/** Open is the default, so it links to the bare URL the Support tab uses. */
const FILTER_HREF: Record<SupportFilter, string> = {
  open: "/app/admin/support",
  resolved: "/app/admin/support?status=resolved",
  all: "/app/admin/support?status=all",
};

/**
 * Admin support inbox — messages from the in-app Support form, newest first,
 * filtered to open / resolved / all, with the sender's email as a mailto so
 * you can reply directly, plus Resolve / Reopen / Delete. Server-rendered; the
 * service-role reads happen in support/page.tsx.
 *
 * `counts` are whole-table head counts (not the loaded rows), so the meta line
 * and the filter badges stay right whatever filter is showing.
 *
 * Times are shown in UTC with the zone named, so the server render is the
 * same everywhere and matches the rest of the admin area (UTC days, 03:15 UTC
 * clean-up).
 */
export default function SupportInbox({
  requests, locale, filter, counts, limit = SUPPORT_LIMIT,
}: {
  requests: SupportRow[];
  locale: Locale;
  filter: SupportFilter;
  counts: { open: number; total: number };
  limit?: number;
}) {
  const s = adminStrings(locale);
  const nf = new Intl.NumberFormat(locale);
  const sentFmt = new Intl.DateTimeFormat(locale, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "UTC", timeZoneName: "short",
  });
  const resolvedFmt = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  const fmtDate = (f: Intl.DateTimeFormat, iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : f.format(d);
  };

  const filterLabel: Record<SupportFilter, string> = {
    open: s("supportOpen"),
    resolved: s("supportResolved"),
    all: s("supportAll"),
  };
  const filterCount: Record<SupportFilter, number> = {
    open: counts.open,
    resolved: Math.max(0, counts.total - counts.open),
    all: counts.total,
  };

  return (
    <Card padding="md">
      <CardHeader
        title={s("supportInbox")}
        meta={s("supportMeta", { open: nf.format(counts.open), total: nf.format(counts.total) })}
        actions={
          <nav
            aria-label={s("supportFilter")}
            className="inline-flex h-11 md:h-9 max-w-full items-stretch rounded-control border border-border bg-surface p-0.5 shadow-sm"
          >
            {SUPPORT_FILTERS.map((f) => {
              const active = f === filter;
              return (
                <Link
                  key={f}
                  href={FILTER_HREF[f]}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 px-2.5 rounded-[calc(var(--r-control)_-_3px)] text-xs font-medium whitespace-nowrap cursor-pointer select-none
                    transition-colors duration-fast motion-reduce:transition-none
                    focus-visible:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand/60
                    ${active ? "bg-surface-inverse text-ink-inverse shadow-sm" : "text-ink-2 hover:text-ink-1 hover:bg-surface-2"}`}
                >
                  <LinkPending>
                    {filterLabel[f]}
                    <span className="num opacity-70">{nf.format(filterCount[f])}</span>
                  </LinkPending>
                </Link>
              );
            })}
          </nav>
        }
      />

      {requests.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-3">
          {counts.total === 0 ? s("supportEmpty") : s("supportEmptyFiltered")}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {requests.map((r) => {
            const resolved = isResolvedStatus(r.status);
            const subjectId = `support-${r.id}-subject`;
            return (
              <li key={r.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span id={subjectId} className="min-w-0 break-words font-medium text-ink-1">
                        {r.subject || s("supportNoSubject")}
                      </span>
                      {resolved
                        ? <Pill variant="neutral">{s("supportStatusResolved")}</Pill>
                        : <Pill variant="warn">{s("supportStatusOpen")}</Pill>}
                    </div>
                    <p className="mt-1 text-sm text-ink-2 whitespace-pre-wrap break-words">{r.message}</p>
                    <div className="mt-1">
                      {r.email
                        ? <a className="inline-flex items-center min-h-[44px] sm:min-h-0 text-xs text-brand-deep hover:underline break-all" href={`mailto:${r.email}?subject=Re: ${encodeURIComponent(r.subject || "your message")}`}>{r.email}</a>
                        : <span className="text-2xs text-ink-3">{s("supportUnknownSender")}</span>}
                      <div className="text-2xs text-ink-3">
                        <time dateTime={r.created_at}>{fmtDate(sentFmt, r.created_at)}</time>
                        {resolved && r.resolved_at && (
                          <>
                            <span aria-hidden> · </span>
                            <span>
                              {withDate(
                                s("supportResolvedOn"),
                                <time dateTime={r.resolved_at}>{fmtDate(resolvedFmt, r.resolved_at)}</time>,
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <SupportRowActions id={r.id} resolved={resolved} locale={locale} describedBy={subjectId} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {requests.length >= limit && (
        <p className="mt-3 border-t border-border pt-3 text-2xs text-ink-3">
          {s("supportShowing", { n: nf.format(limit) })}
        </p>
      )}
    </Card>
  );
}
