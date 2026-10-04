import { Card, Skeleton } from "@/components/ui";
import LoadingStatus from "@/components/ui/LoadingStatus";

const SUBJECT_WIDTHS = ["14rem", "10rem", "12rem", "9rem", "11rem"];

/**
 * Admin · Support loading state. Mirrors support/page.tsx: page header, then
 * the inbox card — title + meta with the Open / Resolved / All filter, and
 * five message rows (subject + status pill, two message lines, sender and
 * date) with the row actions on the right. The admin tab bar stays visible
 * above it (it's rendered by the layout).
 */
export default function AdminSupportLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <LoadingStatus />

      <div className="space-y-2" aria-hidden>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <Card padding="md" aria-hidden>
        <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-11 md:h-9 w-64 max-w-full" />
        </div>
        <ul className="divide-y divide-border">
          {SUBJECT_WIDTHS.map((w, i) => (
            <li key={i} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3.5" style={{ width: w, maxWidth: "60%" }} />
                  <Skeleton className="h-5 w-14 rounded-pill shrink-0" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-40 max-w-full" />
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-14" />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
