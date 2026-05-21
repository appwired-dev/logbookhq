import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminClient, { type AdminUser } from "./AdminClient";

export const dynamic = "force-dynamic";

/**
 * Admin-only user management page. Lists every user with their tier and name,
 * with inline edit controls. Gated to is_admin profiles; non-admins get
 * redirected to /app so they can't even see this URL exists.
 */
export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) redirect("/app");

  // Need the service-role client to read auth.users + ALL profiles (RLS would
  // restrict regular users to their own row).
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name, tier, is_admin, primary_regime, stripe_customer_id");
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });

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
      };
    })
    .filter((u): u is AdminUser => u !== null)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return <AdminClient users={users} />;
}
