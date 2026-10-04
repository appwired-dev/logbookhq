import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n-server";
import { Alert, PageHeader } from "@/components/ui";
import { requireAdminPage } from "../admin-gate";
import { adminStrings } from "../admin-strings";
import SupportInbox, {
  SUPPORT_LIMIT, isResolvedStatus, parseSupportFilter, type SupportRow,
} from "../SupportInbox";

export const dynamic = "force-dynamic";

/**
 * Admin · Support (`/app/admin/support?status=open|resolved|all`, default
 * open). Resolved requests stay out of the default view; Reopen and the
 * resolution date live in the inbox rows.
 */
export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  await requireAdminPage();
  const filter = parseSupportFilter((await searchParams).status);

  const admin = createAdminClient();
  const base = admin
    .from("support_requests")
    .select("id, email, subject, message, status, created_at, resolved_at");
  const filtered =
    filter === "open" ? base.neq("status", "resolved")
    : filter === "resolved" ? base.eq("status", "resolved")
    : base;

  const [rowsRes, openRes, totalRes, locale] = await Promise.all([
    filtered.order("created_at", { ascending: false }).limit(SUPPORT_LIMIT),
    admin.from("support_requests").select("id", { count: "exact", head: true }).neq("status", "resolved"),
    admin.from("support_requests").select("id", { count: "exact", head: true }),
    getLocale(),
  ]);
  const s = adminStrings(locale);

  const header = <PageHeader title={s("supportTitle")} subtitle={s("supportSubtitle")} />;

  if (rowsRes.error) {
    // An empty inbox here would read as "no messages" — say it failed instead.
    return (
      <div className="space-y-4">
        {header}
        <Alert variant="bad">{s("errUnexpected")}</Alert>
      </div>
    );
  }

  const rows = (rowsRes.data ?? []) as SupportRow[];
  // Head counts normally succeed with the row read; if one doesn't, fall back
  // to what the loaded rows can tell us rather than showing nothing.
  const loadedOpen = rows.filter((r) => !isResolvedStatus(r.status)).length;
  const open = openRes.count ?? (filter === "resolved" ? 0 : loadedOpen);
  const total = Math.max(totalRes.count ?? rows.length, open);

  return (
    <div className="space-y-4">
      {header}
      <SupportInbox requests={rows} locale={locale} filter={filter} counts={{ open, total }} />
    </div>
  );
}
