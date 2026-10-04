import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n-server";
import { PageHeader } from "@/components/ui";
import { requireAdminPage } from "../admin-gate";
import { adminOpsStrings } from "../admin-ops-strings";
import MaintenancePanel, {
  type AuditActor, type AuditDetail, type AuditEntry, type MaintenanceData, type StorageTable,
} from "./MaintenancePanel";
import { errorRules, isRecord, ruleCounts, sumCounts, toCount } from "./housekeeping-core";

export const dynamic = "force-dynamic";

/** Same threshold as the Maintenance tab's attention dot (admin layout). */
const OVERDUE_MS = 36 * 60 * 60 * 1000;
/** listUsers page size — the same 1 000-account ceiling as the Users tab. */
const USER_CAP = 1000;
const STORAGE_TABLES = 8;
const AUDIT_ROWS = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Admin = ReturnType<typeof createAdminClient>;
type AuditRow = { id: number; created_at: string; actor_id: string | null; action: string; target: string | null; detail: unknown };

/**
 * The 20 newest audit rows (minus the nightly heartbeat, which the clean-up
 * card already summarises) plus the emails behind their actor/target ids.
 * The email lookup needs the rows first, so it is chained here and the whole
 * chain still runs alongside the page's other reads.
 */
async function loadAudit(admin: Admin): Promise<{ rows: AuditRow[]; emails: Map<string, string> } | null> {
  try {
    const { data, error } = await admin
      .from("admin_audit_log")
      .select("id, created_at, actor_id, action, target, detail")
      .neq("action", "housekeeping.scheduled")
      .order("created_at", { ascending: false })
      .limit(AUDIT_ROWS);
    if (error || !Array.isArray(data)) return null;
    const rows = data as AuditRow[];
    // Support targets are numeric ids; only uuids can be profile ids (a non-uuid in .in() would fail the query).
    const ids = [...new Set(rows.flatMap((r) => [r.actor_id, r.target]))]
      .filter((v): v is string => typeof v === "string" && UUID_RE.test(v));
    const emails = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profiles } = await admin.from("profiles").select("id, email").in("id", ids);
      for (const p of (profiles ?? []) as { id: string; email: string | null }[]) if (p.email) emails.set(p.id, p.email);
    }
    return { rows, emails };
  } catch {
    return null;
  }
}

function parseTables(v: unknown): StorageTable[] {
  if (!Array.isArray(v)) return [];
  const out: StorageTable[] = [];
  for (const t of v) {
    if (!isRecord(t) || typeof t.name !== "string" || !t.name) continue;
    out.push({ name: t.name.slice(0, 63), bytes: toCount(t.bytes) ?? 0, estRows: toCount(t.est_rows) ?? 0 });
  }
  return out.sort((a, b) => b.bytes - a.bytes).slice(0, STORAGE_TABLES);
}

/** Never-run is not overdue ("hasn't run yet") — the same rule as the tab dot. */
function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && Date.now() - t > OVERDUE_MS;
}

/** Only whitelisted scalars reach the client; the audit log never holds free text, and this keeps it that way on screen. */
function auditDetail(action: string, raw: unknown): AuditDetail {
  if (!isRecord(raw)) return {};
  if (action.startsWith("housekeeping.")) return { deleted: sumCounts(ruleCounts(raw)) };
  const out: AuditDetail = {};
  const deleted = toCount(raw.deleted);
  if (deleted !== null) out.deleted = deleted;
  const days = toCount(raw.days);
  if (days !== null) out.days = days;
  if (raw.tier === "free" || raw.tier === "pro" || raw.tier === "lifetime") out.tier = raw.tier;
  if (typeof raw.admin === "boolean") out.admin = raw.admin;
  return out;
}

/**
 * Admin · Maintenance. Every read here is service-role and read-only — the
 * clean-up preview is run_housekeeping's dry run, which deletes nothing.
 * Writes happen only through ../ops-actions.
 */
export default async function MaintenancePage() {
  await requireAdminPage();
  const admin = createAdminClient();

  const [locale, dryRun, lastRunRes, lastScheduledRes, audit, authRes, profilesRes] = await Promise.all([
    getLocale(),
    admin.rpc("run_housekeeping", { p_actor: null, p_dry_run: true }),
    admin
      .from("admin_audit_log")
      .select("action, created_at, detail")
      .like("action", "housekeeping.%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("admin_audit_log")
      .select("created_at")
      .eq("action", "housekeeping.scheduled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadAudit(admin),
    admin.auth.admin.listUsers({ perPage: USER_CAP }),
    admin.from("profiles").select("id", { count: "exact" }),
  ]);

  // Clean-up preview + storage (one dry-run RPC).
  if (dryRun.error) console.error("[admin/maintenance] run_housekeeping dry run failed:", dryRun.error.message.slice(0, 200));
  const dry = !dryRun.error && isRecord(dryRun.data) ? dryRun.data : null;
  const dueCounts = dry ? ruleCounts(dry.counts) : null;
  const dbBytes = dry ? toCount(dry.db_bytes) : null;

  // Last run (scheduled or by hand) and overdue (scheduled only).
  const last = lastRunRes.error ? null : (lastRunRes.data as { created_at: string; detail: unknown } | null);
  const lastScheduled = lastScheduledRes.error ? null : (lastScheduledRes.data as { created_at: string } | null);

  // Integrity: auth accounts vs profile rows. Either list can be cut off at
  // 1 000 (listUsers page, PostgREST max rows); a "missing" partner may then
  // just be on the next page, so the mismatch counts are withheld and only the
  // truncation warning shows.
  const authUsers = authRes.error ? null : authRes.data.users;
  const profileRows = profilesRes.error ? null : ((profilesRes.data ?? []) as { id: string }[]);
  let integrity: MaintenanceData["integrity"] = null;
  if (authUsers && profileRows) {
    const authIds = new Set(authUsers.map((u) => u.id));
    const profileIds = new Set(profileRows.map((p) => p.id));
    const userCapHit = authUsers.length >= USER_CAP || (profilesRes.count ?? 0) > profileRows.length;
    integrity = userCapHit
      ? { authWithoutProfile: null, profileWithoutAuth: null, userCapHit }
      : {
          authWithoutProfile: [...authIds].filter((id) => !profileIds.has(id)).length,
          profileWithoutAuth: [...profileIds].filter((id) => !authIds.has(id)).length,
          userCapHit,
        };
  }

  // Activity: actor and target emails (profiles first, then the auth list).
  const authEmails = new Map<string, string>();
  for (const u of authUsers ?? []) if (u.email) authEmails.set(u.id, u.email);
  const emailOf = (id: string) => audit?.emails.get(id) ?? authEmails.get(id) ?? null;
  const entries: AuditEntry[] | null = audit
    ? audit.rows.map((r) => {
        const action = typeof r.action === "string" ? r.action : "unknown.action";
        const email = r.actor_id ? emailOf(r.actor_id) : null;
        // A null actor is the nightly job, or an admin whose account was deleted (FK on delete set null).
        const actor: AuditActor = email
          ? { kind: "user", email }
          : r.actor_id === null && action === "housekeeping.scheduled" ? { kind: "scheduled" } : { kind: "former" };
        let target: string | null = null;
        if (r.target && action.startsWith("support.") && /^\d+$/.test(r.target)) target = `#${r.target}`;
        else if (r.target && UUID_RE.test(r.target)) target = emailOf(r.target) ?? `${r.target.slice(0, 8)}…`;
        return { id: r.id, at: r.created_at, action, actor, target, detail: auditDetail(action, r.detail) };
      })
    : null;

  const data: MaintenanceData = {
    due: dueCounts ? { counts: dueCounts, total: sumCounts(dueCounts) } : null,
    storage: dry && dbBytes !== null ? { dbBytes, tables: parseTables(dry.tables) } : null,
    lastRun: last
      ? {
          at: last.created_at,
          removed: sumCounts(ruleCounts(last.detail)),
          errorRules: errorRules(isRecord(last.detail) ? last.detail.errors : null),
        }
      : null,
    overdue: isOverdue(lastScheduled?.created_at),
    integrity,
    audit: entries,
  };

  const o = adminOpsStrings(locale);
  return (
    <div className="space-y-4">
      <PageHeader title={o("maintTitle")} subtitle={o("maintSubtitle")} />
      <MaintenancePanel data={data} locale={locale} />
    </div>
  );
}
