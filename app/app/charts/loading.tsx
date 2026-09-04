import { Card, Skeleton } from "@/components/ui";

/**
 * Charts loading state. Mirrors ChartsClient's three `.chart-stage` sections
 * (p-6, space-y-6): globe, aircraft/role sankey, rolling totals.
 */
export default function ChartsLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span role="status" className="sr-only">Loading…</span>

      {/* Globe */}
      <Card padding="none" className="p-6 h-[560px] flex flex-col" aria-hidden>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="flex-1 grid place-items-center min-h-0">
          <Skeleton className="w-[420px] h-[420px] max-w-full max-h-full aspect-square rounded-full" />
        </div>
      </Card>

      {/* Sankey */}
      <Card padding="none" className="p-6 h-[640px] flex flex-col" aria-hidden>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
        <div className="flex-1 flex gap-6 min-h-0">
          <div className="w-32 flex flex-col justify-around">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
          <Skeleton className="flex-1 h-full" />
          <div className="w-24 flex flex-col justify-around">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        </div>
      </Card>

      {/* Rolling totals */}
      <Card padding="none" className="p-6 h-[260px] flex flex-col" aria-hidden>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex-1 flex items-end gap-1.5 min-h-0">
          {Array.from({ length: 24 }, (_, i) => (
            <Skeleton key={i} className="flex-1" style={{ height: `${30 + ((i * 37) % 60)}%` }} />
          ))}
        </div>
      </Card>
    </div>
  );
}
