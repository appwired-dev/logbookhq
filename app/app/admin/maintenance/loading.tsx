import { Card, Skeleton } from "@/components/ui";
import LoadingStatus from "@/components/ui/LoadingStatus";

const RULE_WIDTHS = ["62%", "48%", "56%", "70%", "52%"];
const TABLE_WIDTHS = ["40%", "34%", "46%", "30%", "38%", "28%", "44%", "32%"];

/**
 * Maintenance loading state. Mirrors MaintenancePanel: page header, then two
 * columns — automatic clean-up (status, five-rule table, Run button) over
 * manual clean-up (two purge rows); storage (usage, meter, eight tables) over
 * data integrity — and the full-width activity table.
 */
export default function MaintenanceLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <LoadingStatus />

      <div className="space-y-2" aria-hidden>
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 items-start" aria-hidden>
        <div className="space-y-4 min-w-0">
          <Card padding="none" className="overflow-hidden">
            <div className="p-4 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-72 max-w-full" />
              <Skeleton className="mt-3 h-3.5 w-56 max-w-full" />
            </div>
            <div className="h-9 px-3 flex items-center gap-6 bg-surface-2/60 border-y border-border">
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-2.5 w-14 ml-auto" />
              <Skeleton className="h-2.5 w-16" />
            </div>
            {RULE_WIDTHS.map((w, i) => (
              <div key={i} className="h-10 px-3 flex items-center gap-6 border-b border-border">
                <Skeleton className="h-3" style={{ width: w, maxWidth: "14rem" }} />
                <Skeleton className="h-3 w-16 ml-auto shrink-0" />
                <Skeleton className="h-3 w-8 shrink-0" />
              </div>
            ))}
            <div className="p-4 flex sm:justify-end">
              <Skeleton className="h-11 sm:h-10 w-full sm:w-40" />
            </div>
          </Card>

          <Card padding="md">
            <Skeleton className="h-4 w-32 mb-4" />
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-end border-b border-border last:border-b-0">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-52 max-w-full" />
                  <Skeleton className="h-11 sm:h-10 w-full" />
                </div>
                <Skeleton className="h-11 sm:h-10 w-full sm:w-28 shrink-0" />
              </div>
            ))}
          </Card>
        </div>

        <div className="space-y-4 min-w-0">
          <Card padding="none" className="overflow-hidden">
            <div className="p-4 space-y-2">
              <Skeleton className="h-4 w-36" />
              <div className="flex items-center justify-between gap-3 pt-1">
                <Skeleton className="h-3.5 w-64 max-w-full" />
                <Skeleton className="h-3 w-10 shrink-0" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <div className="h-9 px-3 flex items-center gap-6 bg-surface-2/60 border-y border-border">
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-2.5 w-10 ml-auto" />
              <Skeleton className="h-2.5 w-20" />
            </div>
            {TABLE_WIDTHS.map((w, i) => (
              <div key={i} className="h-10 px-3 flex items-center gap-6 border-b border-border last:border-b-0">
                <Skeleton className="h-3" style={{ width: w, maxWidth: "12rem" }} />
                <Skeleton className="h-3 w-14 ml-auto shrink-0" />
                <Skeleton className="h-3 w-10 shrink-0" />
              </div>
            ))}
          </Card>

          <Card padding="md">
            <Skeleton className="h-4 w-28 mb-4" />
            <Skeleton className="h-5 w-20 rounded-pill" />
          </Card>
        </div>
      </div>

      <Card padding="none" className="overflow-hidden" aria-hidden>
        <div className="p-4"><Skeleton className="h-4 w-44" /></div>
        <div className="h-9 px-3 flex items-center gap-8 bg-surface-2/60 border-y border-border">
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="h-2.5 w-10" />
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-2.5 w-14" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-12 px-3 flex items-center gap-8 border-b border-border last:border-b-0">
            <Skeleton className="h-3 w-16 shrink-0" />
            <Skeleton className="h-3 w-36 shrink-0" />
            <Skeleton className="h-3 w-40 hidden sm:block" />
            <Skeleton className="h-5 w-20 rounded-pill hidden md:block" />
          </div>
        ))}
      </Card>
    </div>
  );
}
