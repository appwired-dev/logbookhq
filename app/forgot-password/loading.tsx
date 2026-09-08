import Brand from "@/components/Brand";
import { Skeleton } from "@/components/ui";
import LoadingStatus from "@/components/ui/LoadingStatus";

/**
 * Route loading state for /forgot-password. Mirrors AuthShell (brand header,
 * centred max-w-md card with p-8) around a skeleton of the single-field form:
 * `.label` (h-3 + mb-1.5), `.input` (h-11 on phones), hint line, full-width
 * button and the footer link.
 */
export default function ForgotPasswordLoading() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5">
        <Brand size="sm" tone="dark" href="/" />
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md card p-8" aria-busy="true">
          <LoadingStatus />
          <div aria-hidden>
            <Skeleton className="h-7 w-48 mb-2" />
            <Skeleton className="h-4 w-64 max-w-full mb-6" />
            <div className="space-y-4">
              <div>
                <Skeleton className="h-3 w-16 mb-1.5" />
                <Skeleton className="h-11 sm:h-10 w-full" />
                <Skeleton className="h-3 w-40 mt-1" />
              </div>
              <Skeleton className="h-11 sm:h-10 w-full" />
              <Skeleton className="h-4 w-32 mx-auto" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
