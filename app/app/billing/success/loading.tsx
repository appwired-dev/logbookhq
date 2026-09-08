import { Card, Skeleton } from "@/components/ui";
import LoadingStatus from "@/components/ui/LoadingStatus";

/** Billing success loading state — the centred success panel's geometry. */
export default function BillingSuccessLoading() {
  return (
    <div className="max-w-xl mx-auto py-10 sm:py-16" aria-busy="true">
      <LoadingStatus />
      <Card padding="none" className="p-10 flex flex-col items-center" aria-hidden>
        <Skeleton className="h-12 w-12 rounded-xl" />
        <Skeleton className="mt-4 h-6 w-56 max-w-full" />
        <Skeleton className="mt-3 h-3 w-full max-w-md" />
        <Skeleton className="mt-1.5 h-3 w-4/5 max-w-sm" />
        <Skeleton className="mt-3 h-5 w-28 rounded-pill" />
        <div className="mt-5 flex gap-2 justify-center flex-wrap">
          <Skeleton className="h-11 sm:h-10 w-40" />
          <Skeleton className="h-11 sm:h-10 w-36" />
        </div>
      </Card>
    </div>
  );
}
