import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the auth session on every request and gates protected routes.
 * Routes under /app require an authenticated user; everything else is public.
 *
 * Two-way gating: /login, /signup and /forgot-password are the auth entry
 * points and bounce a signed-in user to /app. The rest of the password-
 * recovery flow (/auth/callback and /reset-password) is exempt from both
 * gates — the pilot arrives there holding a recovery session, so an auth-route
 * bounce would break the one flow it is meant to protect.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Tolerate Supabase unreachable (e.g. placeholder env vars) — treat as no user.
  let user = null as Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"];
  try {
    const r = await supabase.auth.getUser();
    user = r.data.user;
  } catch {
    user = null;
  }

  const path = request.nextUrl.pathname;

  // Segment-exact so sibling top-level routes that merely start with "app"
  // (the generated /apple-icon, for one) aren't swept into the signed-in area.
  const isAppRoute = path === "/app" || path.startsWith("/app/");

  // Entry points a signed-in user has no business seeing.
  //
  // /reset-password and /auth/** are deliberately absent: a recovery link
  // gives the pilot a session at /auth/callback, so by the time they reach the
  // "set a new password" form they ARE signed in. Gating those would bounce
  // them to /app and make the flow impossible to complete.
  // Segment-exact, same shape as isAppRoute above: bare prefix matching would
  // sweep any future route whose path merely starts with one of these names.
  const isAuthRoute = ["/login", "/signup", "/forgot-password"].some(
    (p) => path === p || path.startsWith(`${p}/`),
  );

  if (isAppRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return response;
}
