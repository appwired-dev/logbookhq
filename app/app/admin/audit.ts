import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin activity written from server actions. housekeeping.manual,
 * housekeeping.scheduled, support.purge and traffic.purge are written in SQL
 * (0021), in the same transaction as the change they describe.
 */
export type AdminAction =
  | "support.resolve"
  | "support.reopen"
  | "support.delete"
  | "user.tier"
  | "user.name"
  | "user.admin"
  | "user.create"
  | "user.password_reset"
  | "user.delete";

/**
 * Best-effort audit row: ids and small scalars only — never an email, a name,
 * message text or a password. A failure here must never fail or block the
 * action that already succeeded, so every error is swallowed.
 */
export async function logAdminAction(
  actorId: string,
  action: AdminAction,
  target?: string | null,
  detail?: Record<string, string | number | boolean>,
): Promise<void> {
  try {
    await createAdminClient()
      .from("admin_audit_log")
      .insert({ actor_id: actorId, action, target: target ?? null, detail: detail ?? {} });
  } catch {
    // swallowed on purpose (see above)
  }
}
