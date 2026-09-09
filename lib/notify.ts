/**
 * Fire-and-forget email notification for a new support request, via Resend's
 * HTTP API (no SDK). It is a no-op unless RESEND_API_KEY and SUPPORT_NOTIFY_EMAIL
 * are set, so support always works without it. Nothing is hardcoded — recipient
 * and sender come from env, so the public repo never carries a personal address.
 *
 * Cheapest setup: a free Resend account, then RESEND_API_KEY + SUPPORT_NOTIFY_EMAIL
 * (your own email). Resend's default onboarding@resend.dev sender can deliver to
 * the account owner's own address without verifying a domain.
 */
export async function notifyNewSupport(input: {
  fromEmail: string | null;
  subject: string | null;
  message: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.SUPPORT_NOTIFY_EMAIL;
  if (!apiKey || !to) return;
  const from = process.env.SUPPORT_NOTIFY_FROM ?? "Pilot Logbook HQ <onboarding@resend.dev>";
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        reply_to: input.fromEmail || undefined,
        subject: `Support: ${input.subject || "(no subject)"}`,
        text: `From: ${input.fromEmail || "unknown"}\n\n${input.message}\n\n— Reply to this email to respond to the pilot; it goes to their address.`,
      }),
    });
  } catch {
    // A notification failure must never fail the support submission.
  }
}
