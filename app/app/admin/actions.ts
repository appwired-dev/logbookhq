"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin gate — every server action here re-verifies that the caller is an
 * admin. Don't trust the client; the page-level check is just UX.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." as const };
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return { error: "Forbidden — admin required." as const };
  return { ok: true as const };
}

export async function updateUserTier(userId: string, tier: "free" | "pro" | "lifetime") {
  const gate = await requireAdmin();
  if (!("ok" in gate)) return gate;
  if (!["free", "pro", "lifetime"].includes(tier)) return { error: "Invalid tier." };

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ tier }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/app/admin");
  return { ok: true };
}

export async function updateUserName(userId: string, fullName: string) {
  const gate = await requireAdmin();
  if (!("ok" in gate)) return gate;
  // null out empty strings so the dashboard greeting falls back gracefully.
  const value = fullName.trim() || null;

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ full_name: value }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/app/admin");
  return { ok: true };
}

export async function toggleUserAdmin(userId: string, makeAdmin: boolean) {
  const gate = await requireAdmin();
  if (!("ok" in gate)) return gate;

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ is_admin: makeAdmin }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/app/admin");
  return { ok: true };
}

/**
 * Create a new user via the Supabase admin SDK and immediately set their
 * profile tier + display name. Auto-confirms the email so the user can
 * sign in without clicking a verification link.
 *
 * Returns the generated temp password so the admin can share it with the
 * new user out-of-band (they should change it on first login).
 */
export async function createUserAccount(input: {
  email: string;
  fullName: string;
  tier: "free" | "pro" | "lifetime";
}) {
  const gate = await requireAdmin();
  if (!("ok" in gate)) return gate;

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Invalid email address." };
  if (!["free", "pro", "lifetime"].includes(input.tier)) return { error: "Invalid tier." };

  // Random 16-char password — admin shares it with the user, who should
  // immediately rotate via the password reset flow.
  const tempPassword = generateTempPassword(16);

  const admin = createAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true, // skip the email click-through for admin-created users
  });
  if (createErr) return { error: `Create failed: ${createErr.message}` };
  if (!created.user) return { error: "Create failed: no user returned." };

  // Upsert the profile row. Supabase's `handle_new_user` trigger inserts the
  // row synchronously when the auth user is created, so `update` works today;
  // we use upsert so we don't depend on that ordering staying synchronous.
  const { error: profileErr } = await admin
    .from("profiles")
    .upsert({
      id: created.user.id,
      email,
      tier: input.tier,
      full_name: fullName || null,
    }, { onConflict: "id" });
  if (profileErr) return { error: `Profile update failed: ${profileErr.message}` };

  revalidatePath("/app/admin");
  return { ok: true as const, tempPassword, userId: created.user.id };
}

function generateTempPassword(len: number): string {
  // Avoid ambiguous chars (0/O, 1/l/I) for easier sharing over voice/text.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

/**
 * Generate a new random password for a user and set it via the admin SDK.
 * Returns the new password so the admin can share it out-of-band. The user
 * should rotate it on first sign-in.
 *
 * Useful when the admin missed capturing the temp password from createUserAccount,
 * or when a user forgets their password and asks the admin to reset directly
 * rather than going through the email-based "forgot password" flow.
 */
export async function resetUserPassword(
  userId: string,
): Promise<{ error: string } | { ok: true; tempPassword: string }> {
  const gate = await requireAdmin();
  if (!("ok" in gate)) return gate; // forwards { error: string } as-is

  const tempPassword = generateTempPassword(16);
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: tempPassword });
  if (error) return { error: `Reset failed: ${error.message}` };
  return { ok: true as const, tempPassword };
}

/**
 * Permanently delete a user account — their auth row, profile, flights,
 * documents, storage objects, everything. Two guards: (a) admin gate; (b) the
 * caller can't delete themselves (protects against locking yourself out).
 *
 * Cascades:
 *   - auth.users delete → cascade FK on public.profiles, public.flights, public.documents
 *   - We also explicitly purge the user's storage folders so files don't
 *     linger as orphan blobs counting toward your Supabase storage quota.
 */
export async function deleteUserAccount(
  userId: string,
): Promise<{ error: string } | { ok: true }> {
  const gate = await requireAdmin();
  if (!("ok" in gate)) return gate;

  // Protect against self-deletion.
  const supabase = await createClient();
  const { data: { user: caller } } = await supabase.auth.getUser();
  if (caller?.id === userId) {
    return { error: "You can't delete your own admin account from this page." };
  }

  const admin = createAdminClient();

  // Purge storage objects under <user_id>/ in both buckets. List + remove.
  // Best-effort — failures don't block account deletion (files become orphans
  // at worst). Bucket prefix layout: <bucket>/<user_id>/<filename>.
  // Paginated: Supabase storage's list() caps at 1000 objects per call, so
  // we loop until we get an empty page (e.g. a long-tenured user with many
  // expired-medical archives).
  for (const bucket of ["documents", "avatars"] as const) {
    try {
      const PAGE = 1000;
      for (let offset = 0; ; offset += PAGE) {
        const { data: objs } = await admin.storage.from(bucket).list(userId, { limit: PAGE, offset });
        if (!objs || objs.length === 0) break;
        const paths = objs.map((o) => `${userId}/${o.name}`);
        await admin.storage.from(bucket).remove(paths);
        if (objs.length < PAGE) break;
      }
    } catch {
      // ignore — storage cleanup is best-effort
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: `Delete failed: ${error.message}` };

  revalidatePath("/app/admin");
  return { ok: true as const };
}
