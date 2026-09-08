import { Card, Skeleton } from "@/components/ui";
import LoadingStatus from "@/components/ui/LoadingStatus";
import { getServerIsDesktop } from "@/lib/device-hint";

/** Alternating widths so the skeletons read as data, not bars. */
const ROW_WIDTHS = ["82%", "64%", "74%", "58%", "88%", "66%", "70%"];

/**
 * Flights loading state. Branches on the same request device hint as
 * page.tsx so the skeleton has the shape of what will replace it: phones get
 * the two-row toolbar and the card list, everything else the sticky toolbar
 * (title + subtitle, search, year, two segmented controls, primary button)
 * followed by the table card — group row (h-7), column row (h-9), 12 rows (h-10).
 */
export default async function FlightsLoading() {
  const isDesktop = await getServerIsDesktop();
  return (
    <div className="space-y-3" aria-busy="true">
      <LoadingStatus />
      {isDesktop ? <TableSkeleton /> : <CardsSkeleton />}
    </div>
  );
}

function TableSkeleton() {
  return (
    <>
      <div className="toolbar" aria-hidden>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-11 md:h-10 w-32 justify-self-end xl:col-start-3" />
          <div className="col-span-2 flex flex-col gap-2 md:flex-row md:items-center xl:col-span-1 xl:col-start-2 xl:row-start-1">
            <Skeleton className="h-11 md:h-9 w-full md:w-60 lg:w-72 md:shrink-0" />
            <div className="flex items-center gap-2 overflow-hidden py-1">
              <Skeleton className="h-11 md:h-9 w-28 shrink-0" />
              <Skeleton className="h-11 md:h-9 w-48 shrink-0" />
              <Skeleton className="h-11 md:h-9 w-60 shrink-0 hidden sm:block" />
            </div>
          </div>
        </div>
      </div>

      <Card padding="none" className="overflow-hidden" aria-hidden>
        <div className="h-7 px-3 flex items-center gap-8 border-b border-border/60">
          <Skeleton className="h-2 w-12" />
          <Skeleton className="h-2 w-10" />
          <Skeleton className="h-2 w-10 hidden sm:block" />
          <Skeleton className="h-2 w-16 hidden md:block" />
        </div>
        <div className="h-9 px-3 flex items-center gap-4 border-b border-border">
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2.5 w-28 hidden md:block" />
          <Skeleton className="h-2.5 w-20 hidden lg:block" />
          <Skeleton className="h-2.5 w-12 ml-auto" />
        </div>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="h-10 px-3 flex items-center gap-4 border-b border-border/60 last:border-b-0">
            <Skeleton className="h-3 w-16 shrink-0" />
            <Skeleton className="h-3" style={{ width: ROW_WIDTHS[i % ROW_WIDTHS.length], maxWidth: "40%" }} />
            <Skeleton className="h-4 w-10 rounded-pill hidden md:block" />
            <Skeleton className="h-4 w-12 rounded-pill hidden md:block" />
            <Skeleton className="h-3 w-10 ml-auto shrink-0" />
          </div>
        ))}
      </Card>
    </>
  );
}

/** Phone: two-row toolbar (search + New / summary + chips) and the card list (FlightsCards). */
function CardsSkeleton() {
  return (
    <>
      <div className="toolbar" aria-hidden>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-28 justify-self-end" />
          <div className="col-span-2 flex items-center gap-3 min-w-0 overflow-hidden py-1">
            <Skeleton className="h-3 w-32 shrink-0" />
            <Skeleton className="h-11 w-24 shrink-0" />
            <Skeleton className="h-11 w-40 shrink-0" />
            <Skeleton className="h-11 w-44 shrink-0" />
          </div>
        </div>
      </div>

      <div className="space-y-2" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <Card key={i} padding="sm">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-16 shrink-0" />
              <Skeleton className="h-3" style={{ width: ROW_WIDTHS[i % ROW_WIDTHS.length], maxWidth: "30%" }} />
              <Skeleton className="h-3 w-24 ml-auto shrink-0" />
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <Skeleton className="h-4 w-10 rounded-pill" />
              <Skeleton className="h-4 w-12 rounded-pill" />
              <Skeleton className="h-5 w-14 ml-auto" />
            </div>
            <Skeleton className="mt-2 h-2.5" style={{ width: ROW_WIDTHS[(i + 3) % ROW_WIDTHS.length] }} />
          </Card>
        ))}
      </div>
    </>
  );
}
