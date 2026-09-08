import { Card, Skeleton } from "@/components/ui";
import LoadingStatus from "@/components/ui/LoadingStatus";

/**
 * Import & Export hub loading state. Mirrors transfer/page.tsx: page
 * header, the two link cards (icon tile, title, body, pill row), then the
 * embedded import wizard's first step (same geometry as import/loading.tsx).
 */
export default function TransferLoading() {
  return (
    <div className="max-w-5xl space-y-6" aria-busy="true">
      <LoadingStatus />

      <div className="space-y-2" aria-hidden>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-3 md:grid-cols-2" aria-hidden>
        {Array.from({ length: 2 }, (_, i) => (
          <Card key={i} padding="lg" className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Skeleton className="h-3 w-24 mr-1" />
              {Array.from({ length: i === 0 ? 5 : 2 }, (_, j) => <Skeleton key={j} className="h-5 w-20 rounded-pill" />)}
            </div>
          </Card>
        ))}
      </div>

      <div className="pt-6 border-t border-border space-y-6" aria-hidden>
        <Skeleton className="h-3 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Card padding="lg">
          <div className="pb-4 mb-5 border-b border-border flex items-center gap-3 flex-wrap">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-3 w-24" />
                {i < 2 && <Skeleton className="hidden sm:block h-px w-8 lg:w-14" />}
              </div>
            ))}
          </div>
          <Skeleton className="h-6 w-24 mb-5" />
          <Skeleton className="h-[196px] w-full rounded-card" />
          <div className="mt-5 flex items-center gap-2 flex-wrap">
            <Skeleton className="h-3 w-32 mr-1" />
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-5 w-20 rounded-pill" />)}
          </div>
          <Skeleton className="mt-5 h-9 w-full" />
          <div className="mt-4 pt-3 border-t border-border flex justify-end">
            <Skeleton className="h-10 w-28" />
          </div>
        </Card>
      </div>
    </div>
  );
}
