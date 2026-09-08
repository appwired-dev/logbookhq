import { Card, Skeleton } from "@/components/ui";
import LoadingStatus from "@/components/ui/LoadingStatus";

/**
 * Documents loading state. Mirrors DocumentsClient: page header with the
 * primary button, then the 1 / 2 / 3-column card grid (icon tile, type
 * eyebrow, name, two date cells, footer buttons).
 */
export default function DocumentsLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <LoadingStatus />

      <div className="flex items-end justify-between gap-3 flex-wrap" aria-hidden>
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 sm:h-10 w-40" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i} padding="md">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5 min-w-0">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-4" style={{ width: `${68 - (i % 3) * 10}%` }} />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-pill shrink-0" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="space-y-1"><Skeleton className="h-2.5 w-12" /><Skeleton className="h-3 w-20" /></div>
              <div className="space-y-1"><Skeleton className="h-2.5 w-12" /><Skeleton className="h-3 w-20" /></div>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex gap-2">
              <Skeleton className="h-11 sm:h-8 flex-1" />
              <Skeleton className="h-11 sm:h-8 w-16" />
              <Skeleton className="h-11 sm:h-8 w-20" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
