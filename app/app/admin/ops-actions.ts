"use server";

/**
 * Maintenance-tab server actions: run the nightly clean-up on demand, and the
 * two bounded manual purges (count preview, then the real delete).
 *
 *  - Every action re-checks admin access FIRST — a server action is a public
 *    endpoint, so the page-level gate proves nothing.
 *  - `kind` / `days` arrive from the client and are allowlisted against
 *    PURGE_OPTIONS before anything reaches SQL; admin_purge() enforces the
 *    floors again and raises below_floor / unknown_kind.
 *  - The audit rows (housekeeping.manual, support.purge, traffic.purge) are
 *    written by the SQL functions in the same transaction as the delete, so
 *    nothing here calls logAdminAction.
 *  - Failures come back as codes; the panel shows the localised message.
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPurgeKind, isPurgeOption, type PurgeKind } from "@/lib/site-stats-core";
import { requireAdmin } from "./admin-gate";
import { errorRules, isRecord, ruleCounts, sumCounts, toCount } from "./maintenance/housekeeping-core";

/** forbidden = not an admin · floor = kind/days not allowed (allowlist or SQL floor) · failed = anything else. */
export type OpsErrorCode = "forbidden" | "floor" | "failed";
export type OpsError = { error: OpsErrorCode };
export type HousekeepingRunResult = OpsError | { ok: true; removed: number; failedRules: string[] };
/** `n` = support requests for support_resolved, distinct UTC days for traffic. */
export type PurgeResult = OpsError | { ok: true; n: number };

/** below_floor / unknown_kind are expected refusals; anything else is logged (message only, capped). */
function fromSqlError(where: string, err: { message?: string } | null | undefined): OpsError {
  const message = err?.message ?? "";
  if (/\b(below_floor|unknown_kind)\b/.test(message)) return { error: "floor" };
  console.error(`[admin/ops] ${where} failed:`, message.slice(0, 200));
  return { error: "failed" };
}

function thrown(where: string, e: unknown): OpsError {
  console.error(`[admin/ops] ${where} threw:`, (e instanceof Error ? e.message : String(e)).slice(0, 200));
  return { error: "failed" };
}

/** Runs every retention rule now (same rules and code path as the nightly pg_cron job). */
export async function runHousekeepingNow(): Promise<HousekeepingRunResult> {
  const gate = await requireAdmin();
  if (!("ok" in gate)) return { error: "forbidden" };
  try {
    const { data, error } = await createAdminClient().rpc("run_housekeeping", {
      p_actor: gate.userId,
      p_dry_run: false,
    });
    if (error) return fromSqlError("run_housekeeping", error);
    const result = isRecord(data) ? data : {};
    // Layout scope: the Maintenance tab's attention dot reads the audit log too.
    revalidatePath("/app/admin", "layout");
    return { ok: true, removed: sumCounts(ruleCounts(result.counts)), failedRules: errorRules(result.errors) };
  } catch (e) {
    return thrown("run_housekeeping", e);
  }
}

async function purge(kind: PurgeKind, days: number, dryRun: boolean, actor: string): Promise<PurgeResult> {
  try {
    const { data, error } = await createAdminClient().rpc("admin_purge", {
      p_kind: kind,
      p_days: days,
      p_dry_run: dryRun,
      p_actor: actor,
    });
    if (error) return fromSqlError("admin_purge", error);
    const n = toCount(data);
    if (n === null) return thrown("admin_purge", new Error("unexpected result"));
    if (!dryRun) revalidatePath("/app/admin", "layout");
    return { ok: true, n };
  } catch (e) {
    return thrown("admin_purge", e);
  }
}

/** How many rows (support) or days (traffic) a purge would delete. Writes nothing. */
export async function previewPurge(kind: PurgeKind, days: number): Promise<PurgeResult> {
  const gate = await requireAdmin();
  if (!("ok" in gate)) return { error: "forbidden" };
  if (!isPurgeKind(kind) || !isPurgeOption(kind, days)) return { error: "floor" };
  return purge(kind, days, true, gate.userId);
}

/** Deletes for real; admin_purge writes the support.purge / traffic.purge audit row in the same transaction. */
export async function runPurge(kind: PurgeKind, days: number): Promise<PurgeResult> {
  const gate = await requireAdmin();
  if (!("ok" in gate)) return { error: "forbidden" };
  if (!isPurgeKind(kind) || !isPurgeOption(kind, days)) return { error: "floor" };
  return purge(kind, days, false, gate.userId);
}
