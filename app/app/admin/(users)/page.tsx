import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n-server";
import AdminClient, { type AdminUser } from "../AdminClient";
import { requireAdminPage } from "../admin-gate";

export const dynamic = "force-dynamic";

/**
 * Admin · Users (`/app/admin`). Lists every user with their tier and name,
 * with inline edit controls. The `(users)` route group keeps the URL at
 * /app/admin while scoping this page's skeleton (loading.tsx) to this tab
 * only, so it never wraps Support / Traffic / Maintenance.
 *
 * The admin layout also gates, but Next renders a layout and its page in
 * parallel, so the page gates itself. Non-admins are redirected to /app so
 * they can't even see this URL exists.
 */
export default async function AdminUsersPage() {
  await requireAdminPage();

  // Service-role client to read auth.users + ALL profiles (RLS would restrict
  // regular users to their own row).
  const admin = createAdminClient();
  const [{ data: profiles }, { data: authUsers }, locale] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, full_name, tier, is_admin, primary_regime, stripe_customer_id, last_seen_at"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    getLocale(),
  ]);

  // Join: profile rows + auth.users.created_at (signup date).
  const byId = new Map(profiles?.map((p) => [p.id, p]) ?? []);
  const users: AdminUser[] = (authUsers?.users ?? [])
    .map((u): AdminUser | null => {
      const p = byId.get(u.id);
      if (!p) return null;
      return {
        id: u.id,
        email: u.email ?? p.email ?? "",
        full_name: p.full_name ?? "",
        tier: (p.tier ?? "free") as AdminUser["tier"],
        is_admin: !!p.is_admin,
        primary_regime: p.primary_regime ?? null,
        has_stripe: !!p.stripe_customer_id,
        created_at: u.created_at ?? "",
        last_seen_at: p.last_seen_at ?? null,
      };
    })
    .filter((u): u is AdminUser => u !== null)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return <AdminClient users={users} locale={locale} />;
}
