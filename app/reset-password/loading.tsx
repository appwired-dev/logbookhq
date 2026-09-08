import Brand from "@/components/Brand";
import { Skeleton } from "@/components/ui";
import LoadingStatus from "@/components/ui/LoadingStatus";

/**
 * Route loading state for /reset-password (the page awaits getUser() before
 * it can decide between the form and the expired-link screen). Mirrors
 * AuthShell around a skeleton of the two-field form.
 */
export default function ResetPasswordLoading() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5">
        <Brand size="sm" tone="dark" href="/" />
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md card p-8" aria-busy="true">
          <LoadingStatus />
          <div aria-hidden>
            <Skeleton className="h-7 w-44 mb-2" />
            <Skeleton className="h-4 w-64 max-w-full mb-6" />
            <div className="space-y-4">
              <div>
                <Skeleton className="h-3 w-24 mb-1.5" />
                <Skeleton className="h-11 sm:h-10 w-full" />
                <Skeleton className="h-3 w-32 mt-1" />
              </div>
              <div>
                <Skeleton className="h-3 w-32 mb-1.5" />
                <Skeleton className="h-11 sm:h-10 w-full" />
              </div>
              <Skeleton className="h-11 sm:h-10 w-full" />
              <Skeleton className="h-3 w-52 mx-auto" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
