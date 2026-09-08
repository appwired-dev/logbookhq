import { Card, Skeleton } from "@/components/ui";
import LoadingStatus from "@/components/ui/LoadingStatus";

/**
 * Export loading state. Mirrors ExportClient: page header, one card with the
 * two format radio cards, the options grid (four fields), the includes note
 * and the footer (summary + primary button).
 */
export default function ExportLoading() {
  return (
    <div className="max-w-3xl space-y-4" aria-busy="true">
      <LoadingStatus />

      <div className="space-y-2" aria-hidden>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <Card padding="lg" aria-hidden>
        <Skeleton className="h-2.5 w-14 mb-2" />
        <div className="grid sm:grid-cols-2 gap-2">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex items-start gap-3 rounded-control border border-border p-3">
              <Skeleton className="h-4 w-4 rounded-full shrink-0 mt-0.5" />
              <Skeleton className="h-5 w-5 shrink-0" />
              <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-4/5" /></div>
            </div>
          ))}
        </div>

        <Skeleton className="mt-5 h-4 w-16 mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-1.5"><Skeleton className="h-2.5 w-20" /><Skeleton className="h-11 sm:h-10 w-full" /></div>
          ))}
        </div>

        <Skeleton className="mt-4 h-3 w-4/5" />

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-3">
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-11 sm:h-10 w-36" />
        </div>
      </Card>
    </div>
  );
}
