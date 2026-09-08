import { Card, Skeleton } from "@/components/ui";
import LoadingStatus from "@/components/ui/LoadingStatus";

/**
 * Settings loading state. Mirrors SettingsForm: page header, then the
 * two-column card grid — profile (avatar + four fields) and preferences on
 * the left; sharing, account, billing and backup on the right.
 */
export default function SettingsLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <LoadingStatus />

      <div className="space-y-2" aria-hidden>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 items-start" aria-hidden>
        <div className="space-y-4">
          <Card padding="md">
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-3 w-56 max-w-full mb-4" />
            <div className="flex items-center gap-4 mb-4">
              <Skeleton className="h-16 w-16 rounded-full shrink-0" />
              <div className="space-y-2"><Skeleton className="h-2.5 w-20" /><Skeleton className="h-11 sm:h-8 w-32" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 2 }, (_, i) => (
                <div key={i} className="space-y-1.5"><Skeleton className="h-2.5 w-20" /><Skeleton className="h-11 sm:h-10 w-full" /></div>
              ))}
              <div className="sm:col-span-2 space-y-1.5"><Skeleton className="h-2.5 w-36" /><Skeleton className="h-11 sm:h-10 w-full" /><Skeleton className="h-3 w-3/4" /></div>
            </div>
          </Card>
          <Card padding="md">
            <Skeleton className="h-4 w-24 mb-1" />
            <Skeleton className="h-3 w-48 mb-4" />
            <div className="flex items-start gap-3">
              <Skeleton className="h-6 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" /></div>
            </div>
          </Card>
          <div className="hidden lg:flex items-center justify-between">
            <Skeleton className="h-3 w-28" />
            <div className="flex gap-2"><Skeleton className="h-10 w-20" /><Skeleton className="h-10 w-32" /></div>
          </div>
        </div>

        <div className="space-y-4">
          <Card padding="md">
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-2/3 mb-4" />
            <div className="flex items-center justify-between gap-3"><Skeleton className="h-3 w-40" /><Skeleton className="h-11 sm:h-10 w-40" /></div>
          </Card>
          <Card padding="md">
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-3 w-32 mb-3" />
            <div className="divide-y divide-border">
              <div className="flex justify-between py-2"><Skeleton className="h-3 w-12" /><Skeleton className="h-3 w-40" /></div>
              <div className="flex justify-between py-2"><Skeleton className="h-3 w-10" /><Skeleton className="h-5 w-14 rounded-pill" /></div>
            </div>
          </Card>
          <Card padding="md">
            <Skeleton className="h-4 w-16 mb-1" />
            <Skeleton className="h-3 w-36 mb-3" />
            <Skeleton className="h-3 w-3/4 mb-3" />
            <Skeleton className="h-11 sm:h-10 w-36" />
          </Card>
          <Card padding="md">
            <Skeleton className="h-4 w-16 mb-1" />
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-4/5 mb-3" />
            <Skeleton className="h-3 w-56 mb-3" />
            <div className="flex items-center gap-3"><Skeleton className="h-11 sm:h-10 w-32" /><Skeleton className="h-3 w-16" /></div>
          </Card>
        </div>
      </div>
    </div>
  );
}
