import { Card, Skeleton, SkeletonText } from "@/components/ui";

/**
 * Dashboard loading state. Mirrors app/app/page.tsx geometry (same grids,
 * gaps and card heights) so the swap to real content causes no layout shift.
 * Everything is aria-hidden except one visually-hidden status line.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-7" aria-busy="true">
      <span role="status" className="sr-only">Loading…</span>

      {/* Page header: title + subtitle, two buttons on the right */}
      <div className="flex items-end justify-between flex-wrap gap-3" aria-hidden>
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>

      {/* Hero tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <Card key={i} padding="md" className="h-[104px] flex flex-col justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-28" />
          </Card>
        ))}
      </div>

      {/* Compact tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i} padding="sm" className="h-[76px] flex flex-col justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-20" />
          </Card>
        ))}
      </div>

      {/* Recent flights */}
      <Card padding="lg" aria-hidden>
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="space-y-1">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-9 flex items-center gap-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 flex-1" style={{ maxWidth: `${52 - i * 6}%` }} />
              <Skeleton className="h-3 w-12 ml-auto" />
            </div>
          ))}
        </div>
      </Card>

      {/* Limits + heatmap */}
      <div className="grid lg:grid-cols-2 gap-3" aria-hidden>
        {Array.from({ length: 2 }, (_, i) => (
          <Card key={i} padding="md" className="h-[240px]">
            <div className="flex items-end justify-between mb-4">
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-4 w-44" />
              </div>
              <Skeleton className="h-3 w-20" />
            </div>
            <SkeletonText lines={4} />
          </Card>
        ))}
      </div>

      {/* Recency */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-hidden>
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} padding="sm" className="h-[120px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-1.5 w-full" />
          </Card>
        ))}
      </div>

      {/* Breakdowns */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} padding="none" className="h-[260px] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="p-4">
              <SkeletonText lines={6} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
