import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Only run the Supabase session middleware where it is actually needed: the
  // signed-in app and the auth/recovery routes. Public marketing pages no
  // longer trigger a per-request auth.getUser() (faster) and, freed from
  // middleware cookie-writes, can be statically prerendered + edge-cached.
  // Note: /app is ALSO gated in app/app/layout.tsx (defense in depth), so
  // narrowing here cannot un-gate the private area.
  matcher: [
    "/app",
    "/app/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/auth/:path*",
  ],
};
