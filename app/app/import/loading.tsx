import { Card, Skeleton } from "@/components/ui";
import LoadingStatus from "@/components/ui/LoadingStatus";

/**
 * Import wizard loading state. Mirrors ImportWizard's step 1: page header,
 * a card with the 3-step stepper, the drop zone, the "supported" pill row
 * and the footer button, so the swap to real content causes no layout shift.
 */
export default function ImportLoading() {
  return (
    <div className="max-w-5xl space-y-6" aria-busy="true">
      <LoadingStatus />

      <div className="space-y-2" aria-hidden>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Card padding="lg" aria-hidden>
        {/* Stepper */}
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
        {/* Drop zone */}
        <Skeleton className="h-[196px] w-full rounded-card" />

        {/* Supported pills */}
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
  );
}
