import Brand from "@/components/Brand";
import { Skeleton } from "@/components/ui";
import LoadingStatus from "@/components/ui/LoadingStatus";

/**
 * Skeleton of the sign-in form body: two labelled fields, a full-width
 * button, and the footer link line. Matches the real form's `space-y-4`,
 * `.label` (h-3 + mb-1.5) and `.input` (h-10) geometry.
 *
 * Exported so app/login/page.tsx can use it as its Suspense fallback.
 */
export function LoginFormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <LoadingStatus />
      <div aria-hidden>
        <Skeleton className="h-3 w-16 mb-1.5" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div aria-hidden>
        <Skeleton className="h-3 w-16 mb-1.5" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-4 w-48 mx-auto" />
    </div>
  );
}

/**
 * Route loading state for /login. Mirrors AuthShell (brand header, centred
 * max-w-md card with p-8) around the form skeleton.
 */
export default function LoginLoading() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5">
        <Brand size="sm" tone="dark" href="/" />
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md card p-8">
          <div aria-hidden>
            <Skeleton className="h-7 w-28 mb-2" />
            <Skeleton className="h-4 w-56 max-w-full mb-6" />
          </div>
          <LoginFormSkeleton />
        </div>
      </main>
    </div>
  );
}
