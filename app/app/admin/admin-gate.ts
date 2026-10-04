import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin gate shared by the admin layout, every admin page and every admin
 * server action.
 *
 * Next renders a layout and its page in parallel, so the layout's check does
 * NOT protect the page: each page calls requireAdminPage() itself. cache()
 * makes that one auth round trip per request however many callers ask.
 *
 * null = signed out; { userId: null } = signed in but not an admin.
 */
export const getAdminContext = cache(async (): Promise<{ userId: string | null } | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  return { userId: profile?.is_admin ? user.id : null };
});

/** For admin pages and the admin layout: non-admins never learn the page exists. */
export async function requireAdminPage(): Promise<string> {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/login");
  if (!ctx.userId) redirect("/app");
  return ctx.userId;
}

/** For server actions — never trust the page-level check. */
export async function requireAdmin(): Promise<{ error: string } | { ok: true; userId: string }> {
  const ctx = await getAdminContext();
  if (!ctx) return { error: "Not signed in." };
  if (!ctx.userId) return { error: "Forbidden — admin required." };
  return { ok: true, userId: ctx.userId };
}
