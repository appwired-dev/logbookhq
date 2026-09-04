import { Card, Skeleton } from "@/components/ui";
import LoadingStatus from "@/components/ui/LoadingStatus";

/** Alternating row widths so the table skeleton reads as data, not bars. */
const ROW_WIDTHS = ["82%", "64%", "74%", "58%", "88%", "66%", "70%"];

/**
 * Flights loading state. Mirrors FlightsClient: a filter toolbar followed by
 * the table card. Row height (h-9) matches the real px-3 py-1.5 table rows.
 */
export default function FlightsLoading() {
  return (
    <div className="space-y-3" aria-busy="true">
      <LoadingStatus />

      {/* Toolbar: search + three selects, count + primary button on the right */}
      <Card padding="none" className="h-14 px-3 flex items-center gap-2" aria-hidden>
        <Skeleton className="h-9 flex-1 min-w-[140px]" />
        <Skeleton className="h-9 w-[88px] hidden sm:block" />
        <Skeleton className="h-9 w-[88px] hidden sm:block" />
        <Skeleton className="h-9 w-[100px] hidden md:block" />
        <Skeleton className="h-3 w-24 ml-auto hidden md:block" />
        <Skeleton className="h-9 w-24" />
      </Card>

      {/* Table */}
      <Card padding="none" className="overflow-hidden" aria-hidden>
        <div className="h-9 px-3 flex items-center gap-4 border-b border-border bg-surface-2/60">
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2.5 w-28 hidden md:block" />
          <Skeleton className="h-2.5 w-20 hidden lg:block" />
          <Skeleton className="h-2.5 w-12 ml-auto" />
        </div>
        {Array.from({ length: 14 }, (_, i) => (
          <div key={i} className="h-9 px-3 flex items-center gap-4 border-t border-border first:border-t-0">
            <Skeleton className="h-3 w-16 shrink-0" />
            <Skeleton className="h-3" style={{ width: ROW_WIDTHS[i % ROW_WIDTHS.length], maxWidth: "40%" }} />
            <Skeleton className="h-4 w-10 rounded-pill hidden md:block" />
            <Skeleton className="h-3 w-10 ml-auto shrink-0" />
          </div>
        ))}
      </Card>
    </div>
  );
}
