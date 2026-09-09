"use server";

import { createClient } from "@/lib/supabase/server";
import { bucketKey, underLimit } from "@/lib/rate-limit";
import { notifyNewSupport } from "@/lib/notify";

export type SupportResult = { ok: true } | { error: string };

/**
 * File a support request from Settings. Writes one row to
 * `public.support_requests` (RLS: user_id = auth.uid()). Free channel — the
 * founder reads open requests in admin / Supabase and replies by email.
 * Rate-limited per user (fails open, like the auth limiter) so a stuck DB
 * never blocks a genuine message.
 */
export async function submitSupportRequest(formData: FormData): Promise<SupportResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in and try again." };

  const subject = String(formData.get("subject") ?? "").trim().slice(0, 200);
  const message = String(formData.get("message") ?? "").trim().slice(0, 5000);
  if (message.length < 5) return { error: "Please add a little more detail so we can help." };

  // Light anti-spam cap: at most 8 messages per hour per pilot.
  if (!(await underLimit(bucketKey("support", "email", user.email ?? user.id), 8, 3600))) {
    return { error: "You've sent several messages recently — please wait a bit before sending more." };
  }

  const { error } = await supabase.from("support_requests").insert({
    user_id: user.id,
    email: user.email ?? null,
    subject: subject || null,
    message,
  });
  if (error) return { error: "Couldn't send that right now. Please email us directly instead." };

  // Best-effort inbox notification (no-op unless Resend env is configured).
  await notifyNewSupport({ fromEmail: user.email ?? null, subject: subject || null, message });

  return { ok: true };
}
