"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { MIN_PASSWORD_LENGTH, RECOVERY_COOKIE } from "@/app/auth/recovery";
import { bucketKey, clientIp, underLimit } from "@/lib/rate-limit";

/**
 * Set a new password for the session created by the recovery link.
 *
 * Requires BOTH an active session and the HttpOnly recovery marker that
 * /auth/callback sets after exchanging the emailed code. A session by itself
 * is not enough — otherwise any signed-in session (a stolen cookie, a shared
 * laptop) could set a new password without knowing the current one. The
 * marker is single-use and cleared as soon as the password changes.
 *
 * On success every *other* session is revoked (`scope: "others"`), so a
 * cookie stolen before the reset dies with it while the pilot doing the reset
 * stays signed in on this device. Confirmed available in the installed
 * @supabase/supabase-js 2.105.4 / auth-js (SignOut.scope: 'global' | 'local' |
 * 'others').
 */

export type ResetPasswordResult = {
  status:
    /** Shorter than the policy minimum (checked client-side too). */
    | "short"
    /** The two fields disagree (checked client-side too). */
    | "mismatch"
    /** No recovery session — the link expired or was already used. */
    | "expired"
    /** Supabase: the new password equals the current one. */
    | "same"
    /** Supabase rejected the password as too weak. */
    | "weak"
    /** Anything else; the real message stays in the logs. */
    | "error";
};

export async function updatePassword(formData: FormData): Promise<ResetPasswordResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) return { status: "short" };
  if (password !== confirm) return { status: "mismatch" };

  // Cap password-update attempts per source IP before the Supabase call.
  // Fails open (see lib/rate-limit) so a DB hiccup never blocks a genuine
  // reset that has a valid recovery session.
  const ip = await clientIp();
  if (!(await underLimit(bucketKey("pwupdate", "ip", ip), 15, 3600))) {
    return { status: "error" };
  }

  const jar = await cookies();
  // Same check the page makes, re-done here: the page render is not the
  // authorisation boundary, this action is.
  if (!jar.has(RECOVERY_COOKIE)) return { status: "expired" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "expired" };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const code = error.code ?? "";
    if (code === "same_password" || /different from the old password/i.test(error.message)) {
      return { status: "same" };
    }
    if (code === "weak_password" || /weak|at least \d+ characters/i.test(error.message)) {
      return { status: "weak" };
    }
    if (error.status === 401 || code === "session_not_found") return { status: "expired" };
    console.error("[reset-password] updateUser failed:", error.message);
    return { status: "error" };
  }

  // Kill every other session for this user. A failure here must not block the
  // (already successful) password change — log it and carry on.
  const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
  if (signOutError) {
    console.error("[reset-password] signOut(others) failed:", signOutError.message);
  }

  // Single use: the marker dies with the password change, so a lingering
  // recovery session cannot be replayed to set another password later.
  jar.delete(RECOVERY_COOKIE);

  revalidatePath("/", "layout");
  redirect("/app?password=updated");
}
