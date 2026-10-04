import { Card, Skeleton } from "@/components/ui";
import LoadingStatus from "@/components/ui/LoadingStatus";

/** Card header placeholder: title + meta, with optional trailing actions. */
function HeaderBones({ wide = false }: { wide?: boolean }) {
  return (
    <div className="mb-3 space-y-1.5">
      <Skeleton className="h-4 w-36" />
      <Skeleton className={`h-3 ${wide ? "w-80" : "w-24"} max-w-full`} />
    </div>
  );
}

function ListBones({ rows = 6 }: { rows?: number }) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="px-4 pt-4 pb-3"><Skeleton className="h-4 w-24" /></div>
      <div className="h-9 px-3 flex items-center gap-6 bg-surface-2/60 border-y border-border">
        <Skeleton className="h-2.5 w-14" />
        <Skeleton className="h-2.5 w-10 ml-auto" />
        <Skeleton className="h-2.5 w-10" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-[52px] px-3 flex items-center gap-6 border-b border-border last:border-b-0">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3" style={{ width: `${70 - i * 8}%` }} />
            <Skeleton className="h-1 w-full" />
          </div>
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </Card>
  );
}

/**
 * Traffic loading state. Mirrors TrafficPanel: header, range control + opt-out,
 * four compact tiles, the daily chart, the arrivals Sankey with the Sources /
 * Pages lists, the globe beside Countries, then Devices.
 */
export default function TrafficLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <LoadingStatus />

      <div className="space-y-2" aria-hidden>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3" aria-hidden>
        <Skeleton className="h-11 md:h-9 w-56" />
        <Skeleton className="h-11 w-64 max-w-full" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} padding="none" className="p-3.5 pl-5 relative overflow-hidden">
            <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-surface-2" />
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="mt-2 h-6 w-12" />
            <Skeleton className="mt-3 h-[22px] w-[72px] ml-auto" />
          </Card>
        ))}
      </div>

      <Card padding="md" aria-hidden>
        <HeaderBones />
        <div className="mb-2 flex gap-1.5">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-11 sm:h-8 w-24 rounded-pill" />)}
        </div>
        <Skeleton className="h-56 w-full" />
      </Card>

      <Card padding="md" aria-hidden>
        <HeaderBones wide />
        <div className="flex gap-4 sm:gap-6 h-[260px]">
          <div className="w-20 sm:w-28 flex flex-col justify-around">
            {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
          <Skeleton className="flex-1" />
          <div className="w-20 sm:w-28 flex flex-col justify-around">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2" aria-hidden>
        <ListBones />
        <ListBones />
      </div>

      <div className="grid gap-4 lg:grid-cols-5" aria-hidden>
        <Card padding="md" className="lg:col-span-3">
          <HeaderBones wide />
          <div className="grid place-items-center h-[280px] sm:h-[360px] rounded-card bg-surface-2">
            <Skeleton className="w-[200px] sm:w-[260px] aspect-square rounded-full" />
          </div>
        </Card>
        <div className="lg:col-span-2"><ListBones rows={7} /></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2" aria-hidden>
        <ListBones rows={3} />
      </div>
    </div>
  );
}
