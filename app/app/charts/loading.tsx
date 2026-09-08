import { Card, Skeleton } from "@/components/ui";
import LoadingStatus from "@/components/ui/LoadingStatus";

/**
 * Charts loading state. Mirrors ChartsClient: a PageHeader followed by four
 * `padding="md"` cards — flight globe, career flow, hours per aircraft type,
 * and the rolling 365-day total — each at roughly its settled height so the
 * page does not jump when the real charts arrive.
 */

/** CardHeader placeholder: eyebrow + title + meta, with optional trailing actions. */
function HeaderBones({ actions = null }: { actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
      <div className="min-w-0 space-y-1.5">
        <Skeleton className="h-2.5 w-28" />
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </div>
      {actions}
    </div>
  );
}

export default function ChartsLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <LoadingStatus />

      {/* PageHeader */}
      <div className="space-y-2" aria-hidden>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {/* Flight globe */}
      <Card padding="md" aria-hidden>
        <HeaderBones />
        <div className="grid place-items-center h-[420px] sm:h-[520px] lg:h-[600px] rounded-card bg-surface-2">
          <Skeleton className="w-[280px] sm:w-[380px] aspect-square rounded-full" />
        </div>
      </Card>

      {/* Career flow */}
      <Card padding="md" aria-hidden>
        <HeaderBones
          actions={
            <div className="flex gap-2 shrink-0">
              {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-3 w-10" />)}
            </div>
          }
        />
        <Skeleton className="h-3 w-full max-w-2xl mb-3" />
        <div className="flex gap-4 sm:gap-6 h-[420px] sm:h-[640px]">
          <div className="w-16 sm:w-28 flex flex-col justify-around">
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
          <Skeleton className="flex-1" />
          <div className="w-14 sm:w-24 flex flex-col justify-around">
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
        </div>
      </Card>

      {/* Hours per aircraft type */}
      <Card padding="md" aria-hidden>
        <HeaderBones actions={<Skeleton className="h-8 w-28 shrink-0" />} />
        <div className="space-y-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-24 sm:w-32 shrink-0" />
              <Skeleton className="h-5" style={{ width: `${88 - i * 9}%` }} />
            </div>
          ))}
        </div>
      </Card>

      {/* Rolling 365-day total */}
      <Card padding="md" aria-hidden>
        <HeaderBones />
        <div className="flex items-end gap-1.5 h-56">
          {Array.from({ length: 24 }, (_, i) => (
            <Skeleton key={i} className="flex-1" style={{ height: `${30 + ((i * 37) % 60)}%` }} />
          ))}
        </div>
      </Card>
    </div>
  );
}
