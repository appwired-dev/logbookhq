import { Card, Skeleton } from "@/components/ui";
import LoadingStatus from "@/components/ui/LoadingStatus";

const ROW_WIDTHS = ["72%", "58%", "66%", "48%", "80%", "62%", "70%", "54%"];

/**
 * Admin loading state. Mirrors AdminClient: page header with the primary
 * button, four compact stat tiles, the search field, then the users table
 * card — header row (h-9) and eight rows (h-12).
 */
export default function AdminLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <LoadingStatus />

      <div className="flex items-end justify-between gap-3 flex-wrap" aria-hidden>
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 sm:h-10 w-36" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} padding="none" className="p-3.5 pl-5 relative overflow-hidden">
            <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-surface-2" />
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="mt-2 h-6 w-12" />
          </Card>
        ))}
      </div>

      <Skeleton className="h-11 sm:h-10 w-full max-w-md" aria-hidden />

      <Card padding="none" className="overflow-hidden" aria-hidden>
        <div className="h-9 px-3 flex items-center gap-6 bg-surface-2/60 border-b border-border">
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="h-2.5 w-10" />
          <Skeleton className="h-2.5 w-14 hidden md:block" />
          <Skeleton className="h-2.5 w-12 hidden lg:block" />
          <Skeleton className="h-2.5 w-16 ml-auto" />
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-12 px-3 flex items-center gap-6 border-b border-border last:border-b-0">
            <Skeleton className="h-3 w-40 shrink-0" />
            <Skeleton className="h-3" style={{ width: ROW_WIDTHS[i % ROW_WIDTHS.length], maxWidth: "8rem" }} />
            <Skeleton className="h-5 w-16 rounded-pill shrink-0" />
            <Skeleton className="h-5 w-12 rounded-pill shrink-0 hidden md:block" />
            <Skeleton className="h-3 w-20 shrink-0 hidden lg:block" />
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
