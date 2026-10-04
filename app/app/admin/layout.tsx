import type { ReactNode } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n-server";
import { requireAdminPage } from "./admin-gate";
import AdminTabs from "./AdminTabs";

export const dynamic = "force-dynamic";

/** The nightly housekeeping job runs every 24 h; 36 h of silence means it stopped. */
const OVERDUE_MS = 36 * 60 * 60 * 1000;

type TabSignals = { openSupport: number; maintenanceAttention: boolean };

/**
 * Badge data for the tab bar: the open support count and whether the last
 * scheduled clean-up is overdue. Best-effort by design — a failed read shows
 * no badge rather than taking down every admin tab with it.
 *
 * "Hasn't run yet" (no scheduled row) is not overdue: a fresh deploy would
 * otherwise flag Maintenance before the first 03:15 UTC run.
 */
async function loadTabSignals(): Promise<TabSignals> {
  try {
    const admin = createAdminClient();
    const [open, lastRun] = await Promise.all([
      admin
        .from("support_requests")
        .select("id", { count: "exact", head: true })
        .neq("status", "resolved"),
      admin
        .from("admin_audit_log")
        .select("created_at")
        .eq("action", "housekeeping.scheduled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const lastAt = lastRun.error ? null : (lastRun.data?.created_at as string | null | undefined) ?? null;
    const lastMs = lastAt ? Date.parse(lastAt) : NaN;
    return {
      openSupport: open.error ? 0 : open.count ?? 0,
      maintenanceAttention: Number.isFinite(lastMs) && Date.now() - lastMs > OVERDUE_MS,
    };
  } catch {
    return { openSupport: 0, maintenanceAttention: false };
  }
}

/**
 * Admin shell: Users | Support | Traffic | Maintenance link tabs above every
 * admin page. The gate runs first so a non-admin never triggers the
 * service-role reads; each page still gates itself because Next renders a
 * layout and its page in parallel.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage();
  const [signals, locale] = await Promise.all([loadTabSignals(), getLocale()]);

  return (
    <div className="space-y-4">
      <AdminTabs
        locale={locale}
        openSupport={signals.openSupport}
        maintenanceAttention={signals.maintenanceAttention}
      />
      {children}
    </div>
  );
}
