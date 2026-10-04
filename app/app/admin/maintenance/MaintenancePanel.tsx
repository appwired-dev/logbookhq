"use client";

import { useId, useMemo, useState, useTransition, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { Alert, Card, CardHeader, Icon, Pill } from "@/components/ui";
import { buttonClass } from "@/components/ui/button-class";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { PURGE_DEFAULT, PURGE_OPTIONS, type PurgeKind } from "@/lib/site-stats-core";
import { RelativeTime } from "../RelativeTime";
import { adminOpsStrings, type AdminOpsKey, type AdminOpsT } from "../admin-ops-strings";
import { adminStrings, type AdminStringKey, type AdminT } from "../admin-strings";
import { previewPurge, runHousekeepingNow, runPurge, type OpsErrorCode } from "../ops-actions";
import {
  HOUSEKEEPING_RULES, RULE_RETENTION_DAYS, isHousekeepingRule, type HousekeepingRule, type RuleCounts,
} from "./housekeeping-core";

/* ------------------------------------------------------------------------ */
/* Data contract (built server-side in ./page.tsx)                           */
/* ------------------------------------------------------------------------ */

export type StorageTable = { name: string; bytes: number; estRows: number };
export type AuditTier = "free" | "pro" | "lifetime";
/** Whitelisted scalars only — never free text (the audit log stores ids and counts, nothing else). */
export type AuditDetail = { deleted?: number; days?: number; tier?: AuditTier; admin?: boolean };
export type AuditActor = { kind: "user"; email: string } | { kind: "scheduled" } | { kind: "former" };
export type AuditEntry = {
  id: number;
  at: string;
  action: string;
  actor: AuditActor;
  /** Display label for the target: the account's email, "#<support id>", or a short id. */
  target: string | null;
  detail: AuditDetail;
};
export type MaintenanceData = {
  /** run_housekeeping dry run: what each rule would delete now. null = the RPC failed. */
  due: { counts: RuleCounts; total: number } | null;
  storage: { dbBytes: number; tables: StorageTable[] } | null;
  /** Newest housekeeping.* audit row (scheduled or by hand). */
  lastRun: { at: string; removed: number; errorRules: string[] } | null;
  /** The newest scheduled run is older than 36 h (never-run is not overdue). */
  overdue: boolean;
  /** null = the user/profile reads failed. Counts are null when the lists were truncated. */
  integrity: { authWithoutProfile: number | null; profileWithoutAuth: number | null; userCapHit: boolean } | null;
  /** 20 newest audit rows other than housekeeping.scheduled. null = the read failed. */
  audit: AuditEntry[] | null;
};

/* ------------------------------------------------------------------------ */
/* Constants + formatting                                                    */
/* ------------------------------------------------------------------------ */

/** Supabase Free plan database limit. SI units (10^6 bytes) — errs early if the plan limit is binary. */
const DB_LIMIT_MB = 500;
const BYTES_PER_MB = 1_000_000;
const METER_WARN_PCT = 70;
const METER_BAD_PCT = 90;
/** The Users tab's listUsers ceiling (page.tsx flags it). */
const USER_CAP = 1000;

const RULE_LABEL: Record<HousekeepingRule, AdminOpsKey> = {
  rate_limit: "ruleRateLimit",
  traffic: "ruleTraffic",
  stripe_events: "ruleStripe",
  support_resolved: "ruleSupport",
  audit: "ruleAudit",
};

const ACTION_LABEL: Readonly<Record<string, AdminOpsKey>> = {
  "housekeeping.manual": "actHousekeepingManual",
  "traffic.purge": "actTrafficPurge",
  "support.purge": "actSupportPurge",
  "support.resolve": "actSupportResolve",
  "support.reopen": "actSupportReopen",
  "support.delete": "actSupportDelete",
  "user.create": "actUserCreate",
  "user.delete": "actUserDelete",
  "user.admin": "actUserAdmin",
  "user.password_reset": "actUserPassword",
  "user.tier": "actUserTier",
  "user.name": "actUserName",
};

const TIER_KEY: Record<AuditTier, AdminStringKey> = { free: "tierFree", pro: "tierPro", lifetime: "tierLifetime" };

const ERROR_KEY: Record<OpsErrorCode, AdminOpsKey> = { forbidden: "errForbidden", floor: "errFloor", failed: "errGeneric" };

/** Full class strings per tone so Tailwind's purge keeps them (same fills as the dashboard limit bars). */
const METER_TONE = {
  ok: { fill: "bar-fill-good", text: "text-ink-2" },
  warn: { fill: "bar-fill-warn", text: "text-warn-ink" },
  bad: { fill: "bar-fill-bad", text: "text-bad-ink" },
} as const;

/** aria-disabled (not disabled) keeps a control focusable, so focus survives a dialog closing onto it. */
const ARIA_DISABLED = "aria-disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:shadow-none aria-disabled:hover:brightness-100";

type Fmt = {
  int: (n: number) => string;
  /** A size in SI megabytes, 1 decimal. */
  mb: (mb: number) => string;
  /** Bytes → kB below 1 MB, else MB. */
  bytes: (b: number) => string;
  pct: (p: number) => string;
  /** A retention period: whole months from a year up, days below (locale-correct plurals). */
  keep: (days: number) => string;
  list: (items: string[]) => string;
};

function unitFormat(locale: Locale, opts: Intl.NumberFormatOptions): Intl.NumberFormat | null {
  try {
    return new Intl.NumberFormat(locale, opts);
  } catch {
    return null;
  }
}

function makeFmt(locale: Locale, o: AdminOpsT): Fmt {
  const nf = new Intl.NumberFormat(locale);
  const mbF = unitFormat(locale, { style: "unit", unit: "megabyte", maximumFractionDigits: 1 });
  const kbF = unitFormat(locale, { style: "unit", unit: "kilobyte", maximumFractionDigits: 0 });
  const pctF = unitFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const dayF = unitFormat(locale, { style: "unit", unit: "day", unitDisplay: "long" });
  const monthF = unitFormat(locale, { style: "unit", unit: "month", unitDisplay: "long" });
  let listF: Intl.ListFormat | null = null;
  try {
    listF = new Intl.ListFormat(locale, { style: "long", type: "conjunction" });
  } catch {
    listF = null;
  }
  const mb = (v: number) => (mbF ? mbF.format(v) : `${v.toFixed(1)} MB`);
  return {
    int: (n) => nf.format(n),
    mb,
    bytes: (b) => (b >= BYTES_PER_MB ? mb(b / BYTES_PER_MB) : kbF ? kbF.format(b / 1000) : `${Math.round(b / 1000)} kB`),
    pct: (p) => (pctF ? pctF.format(p / 100) : `${p.toFixed(1)}%`),
    keep: (days) => {
      if (days >= 365) {
        const months = Math.round(days / (365 / 12)); // 365 → 12, 395 → 13
        return monthF ? monthF.format(months) : o("keepMonths", { n: months });
      }
      return dayF ? dayF.format(days) : o("keepDays", { n: days });
    },
    list: (items) => (listF ? listF.format(items) : items.join(", ")),
  };
}

const ruleName = (rule: string, o: AdminOpsT) => (isHousekeepingRule(rule) ? o(RULE_LABEL[rule]) : rule);

/** Server-action calls go over fetch; Safari on a flaky network throws `Load failed`. */
function networkMessage(e: unknown, o: AdminOpsT, s: AdminT): string {
  if (e instanceof Error && (e.message === "Load failed" || e.message.startsWith("Failed to fetch"))) return s("errNetwork");
  return o("errGeneric");
}

/* ------------------------------------------------------------------------ */
/* Panel                                                                     */
/* ------------------------------------------------------------------------ */

type Ask =
  | { kind: "run"; count: number }
  | { kind: "purge"; purge: PurgeKind; days: number; n: number };

/**
 * Admin · Maintenance: automatic clean-up status and "Run now", database
 * storage, data integrity (read-only), the two bounded manual purges and the
 * recent admin activity. Every write goes through ./ops-actions (admin gate,
 * allowlist, SQL floors, audit row in the same transaction); the server
 * re-renders this panel with fresh numbers afterwards (revalidatePath).
 */
export default function MaintenancePanel({ data, locale }: { data: MaintenanceData; locale: Locale }) {
  const o = adminOpsStrings(locale);
  const s = adminStrings(locale);
  const fmt = useMemo(() => makeFmt(locale, adminOpsStrings(locale)), [locale]);
  const toast = useToast();

  // `ask` outlives `askOpen` so the dialog keeps its copy while it animates closed.
  const [ask, setAsk] = useState<Ask | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [confirming, startConfirming] = useTransition();
  const [previewing, startPreview] = useTransition();
  const [previewKind, setPreviewKind] = useState<PurgeKind | null>(null);
  const [purgeDays, setPurgeDays] = useState<Record<PurgeKind, number>>({ ...PURGE_DEFAULT });
  const busy = confirming || previewing;

  const fail = (code: OpsErrorCode) => toast.push({ tone: "bad", title: o(ERROR_KEY[code]) });
  const failThrown = (e: unknown) => toast.push({ tone: "bad", title: networkMessage(e, o, s) });

  function askRun() {
    if (busy || !data.due || data.due.total === 0) return;
    setAsk({ kind: "run", count: data.due.total });
    setAskOpen(true);
  }

  function askPurge(kind: PurgeKind) {
    if (busy) return;
    const days = purgeDays[kind];
    setPreviewKind(kind);
    startPreview(async () => {
      try {
        const r = await previewPurge(kind, days);
        if ("error" in r) fail(r.error);
        else if (r.n === 0) toast.push({ tone: "info", title: o("purgeNone") });
        else {
          setAsk({ kind: "purge", purge: kind, days, n: r.n });
          setAskOpen(true);
        }
      } catch (e) {
        failThrown(e);
      }
    });
  }

  function confirm() {
    if (!ask || confirming) return;
    const current = ask;
    startConfirming(async () => {
      try {
        if (current.kind === "run") {
          const r = await runHousekeepingNow();
          if ("error" in r) fail(r.error);
          else {
            toast.push({ tone: "good", title: o("runDone", { count: fmt.int(r.removed) }) });
            if (r.failedRules.length > 0) {
              toast.push({ tone: "warn", title: o("autoErrors", { rules: fmt.list(r.failedRules.map((x) => ruleName(x, o))) }) });
            }
          }
        } else {
          const r = await runPurge(current.purge, current.days);
          if ("error" in r) fail(r.error);
          else toast.push({ tone: "good", title: o("purgeDone", { n: fmt.int(r.n) }) });
        }
      } catch (e) {
        failThrown(e);
      } finally {
        setAskOpen(false);
      }
    });
  }

  const dialog = !ask
    ? null
    : ask.kind === "run"
      ? {
          title: o("runTitle"),
          body: ask.count === 1 ? o("runBodyOne") : o("runBody", { count: fmt.int(ask.count) }),
          confirm: o("runConfirm"),
          tone: "default" as const,
        }
      : {
          title: ask.n === 1
            ? o(ask.purge === "traffic" ? "purgeTitleTrafficOne" : "purgeTitleSupportOne")
            : o(ask.purge === "traffic" ? "purgeTitleTraffic" : "purgeTitleSupport", { n: fmt.int(ask.n) }),
          body: o("purgeBody"),
          confirm: o("purgeConfirm"),
          tone: "danger" as const,
        };

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <div className="space-y-4 min-w-0">
          <AutoCleanupCard
            o={o} locale={locale} fmt={fmt} data={data}
            running={confirming && ask?.kind === "run"}
            onRun={askRun}
          />
          <ManualCleanupCard
            o={o}
            days={purgeDays}
            onDaysChange={(kind, days) => setPurgeDays((d) => ({ ...d, [kind]: days }))}
            pendingKind={previewing ? previewKind : confirming && ask?.kind === "purge" ? ask.purge : null}
            onDelete={askPurge}
          />
        </div>
        <div className="space-y-4 min-w-0">
          <StorageCard o={o} fmt={fmt} storage={data.storage} />
          <IntegrityCard o={o} fmt={fmt} integrity={data.integrity} />
        </div>
      </div>

      <ActivityCard o={o} s={s} fmt={fmt} locale={locale} audit={data.audit} />

      <ConfirmDialog
        open={askOpen}
        title={dialog?.title ?? ""}
        body={dialog?.body ?? ""}
        confirmLabel={dialog?.confirm ?? ""}
        tone={dialog?.tone ?? "default"}
        pending={confirming}
        locale={locale}
        onConfirm={confirm}
        onCancel={() => { if (!confirming) setAskOpen(false); }}
      />
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Cards                                                                     */
/* ------------------------------------------------------------------------ */

function CardTitle({ icon: IconCmp, children }: { icon: Icon.LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <IconCmp size={15} strokeWidth={2} aria-hidden className="text-ink-3 shrink-0" />
      {children}
    </span>
  );
}

/** "Last run {when} · removed {count}" with a live relative time in place of {when}. */
function LastRun({ o, locale, fmt, lastRun }: { o: AdminOpsT; locale: Locale; fmt: Fmt; lastRun: MaintenanceData["lastRun"] }) {
  if (!lastRun) return <p className="text-sm text-ink-2">{o("lastRunNever")}</p>;
  const MARK = "\u0000";
  const [before, after = ""] = o("lastRun", { when: MARK, count: fmt.int(lastRun.removed) }).split(MARK);
  return (
    <p className="text-sm text-ink-2 [&>span]:!text-sm">
      {before}<RelativeTime iso={lastRun.at} locale={locale} />{after}
    </p>
  );
}

function AutoCleanupCard({ o, locale, fmt, data, running, onRun }: {
  o: AdminOpsT;
  locale: Locale;
  fmt: Fmt;
  data: MaintenanceData;
  running: boolean;
  onRun: () => void;
}) {
  const noteId = useId();
  const { due, lastRun, overdue } = data;
  const canRun = !!due && due.total > 0;

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="p-4 space-y-3">
        <CardHeader flush title={<CardTitle icon={Icon.RefreshCw}>{o("autoTitle")}</CardTitle>} meta={o("autoSchedule")} />
        <LastRun o={o} locale={locale} fmt={fmt} lastRun={lastRun} />
        {/* A sentence, not a badge: an Alert keeps it readable at 375 px. */}
        {overdue && <Alert variant="warn">{o("autoOverdue")}</Alert>}
        {lastRun && lastRun.errorRules.length > 0 && (
          <Alert variant="bad">{o("autoErrors", { rules: fmt.list(lastRun.errorRules.map((r) => ruleName(r, o))) })}</Alert>
        )}
        {!due && <Alert variant="warn">{o("errGeneric")}</Alert>}
      </div>

      {due && (
        <>
          <div className="overflow-x-auto border-t border-border">
            <table className="data-table w-full text-sm">
              <caption className="sr-only">{o("autoTitle")}</caption>
              <thead>
                <tr>
                  <th scope="col">{o("colData")}</th>
                  <th scope="col" className="!whitespace-normal">{o("colKeep")}</th>
                  <th scope="col" className="!whitespace-normal !text-right">{o("colDue")}</th>
                </tr>
              </thead>
              <tbody>
                {HOUSEKEEPING_RULES.map((rule) => {
                  const n = due.counts[rule];
                  return (
                    <tr key={rule}>
                      <td className="text-ink-1">{o(RULE_LABEL[rule])}</td>
                      <td className="text-ink-2 whitespace-nowrap">{fmt.keep(RULE_RETENTION_DAYS[rule])}</td>
                      <td className={`num text-right whitespace-nowrap ${n ? "font-semibold text-ink-1" : "text-ink-3"}`}>
                        {n === undefined ? "—" : fmt.int(n)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-end">
            {!canRun && <p id={noteId} className="text-xs text-ink-3 min-w-0 sm:mr-auto">{o("nothingDue")}</p>}
            <button
              type="button"
              aria-disabled={!canRun || undefined}
              aria-busy={running || undefined}
              aria-describedby={canRun ? undefined : noteId}
              onClick={() => { if (canRun && !running) onRun(); }}
              className={buttonClass("primary", "md", `h-11 sm:h-10 w-full sm:w-auto shrink-0 ${ARIA_DISABLED}`)}
            >
              {!running && <Icon.RefreshCw size={16} strokeWidth={2} aria-hidden />}
              {o("runNow")}
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

function StorageCard({ o, fmt, storage }: { o: AdminOpsT; fmt: Fmt; storage: MaintenanceData["storage"] }) {
  const title = <CardTitle icon={Icon.Database}>{o("dbTitle")}</CardTitle>;
  if (!storage) {
    return (
      <Card padding="md">
        <CardHeader title={title} />
        <Alert variant="warn">{o("errGeneric")}</Alert>
      </Card>
    );
  }
  const usedMb = storage.dbBytes / BYTES_PER_MB;
  const pct = Math.min(100, (usedMb / DB_LIMIT_MB) * 100);
  const tone = METER_TONE[pct >= METER_BAD_PCT ? "bad" : pct >= METER_WARN_PCT ? "warn" : "ok"];
  const usage = o("dbUsage", { used: fmt.mb(usedMb), limit: fmt.mb(DB_LIMIT_MB) });

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="p-4">
        <CardHeader title={title} />
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-ink-1 min-w-0">{usage}</span>
          <span className={`num text-xs font-semibold shrink-0 ${tone.text}`}>{fmt.pct(pct)}</span>
        </div>
        <div
          role="meter"
          aria-label={o("dbTitle")}
          aria-valuemin={0}
          aria-valuemax={DB_LIMIT_MB}
          aria-valuenow={Math.round(usedMb * 10) / 10}
          aria-valuetext={usage}
          className="bar-track mt-2 h-2 rounded-full overflow-hidden"
        >
          {/* At least a sliver once anything is stored, so a tiny database doesn't look empty. */}
          <div className={`h-full rounded-full bar-fill ${tone.fill}`} style={{ width: `${pct > 0 ? Math.max(pct, 1) : 0}%` }} />
        </div>
      </div>

      {storage.tables.length > 0 && (
        <div className="overflow-x-auto border-t border-border">
          <table className="data-table w-full text-sm">
            <caption className="sr-only">{o("dbTitle")}</caption>
            <thead>
              <tr>
                <th scope="col">{o("colTable")}</th>
                <th scope="col" className="!text-right">{o("colSize")}</th>
                <th scope="col" className="!text-right">{o("colRows")}</th>
              </tr>
            </thead>
            <tbody>
              {storage.tables.map((t) => (
                <tr key={t.name}>
                  <td className="mono text-xs text-ink-1 break-all">{t.name}</td>
                  <td className="num text-right whitespace-nowrap text-ink-2">{fmt.bytes(t.bytes)}</td>
                  <td className="num text-right whitespace-nowrap text-ink-2">{fmt.int(t.estRows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function IntegrityCard({ o, fmt, integrity }: { o: AdminOpsT; fmt: Fmt; integrity: MaintenanceData["integrity"] }) {
  const issues: { key: string; badge: string; text: string }[] = [];
  if (integrity) {
    const { authWithoutProfile: a, profileWithoutAuth: p, userCapHit } = integrity;
    if (a) issues.push({ key: "auth", badge: fmt.int(a), text: a === 1 ? o("healthAuthNoProfileOne") : o("healthAuthNoProfile", { n: fmt.int(a) }) });
    if (p) issues.push({ key: "profile", badge: fmt.int(p), text: p === 1 ? o("healthProfileNoAuthOne") : o("healthProfileNoAuth", { n: fmt.int(p) }) });
    if (userCapHit) issues.push({ key: "cap", badge: `${fmt.int(USER_CAP)}+`, text: o("healthUserCap") });
  }

  return (
    <Card padding="md">
      <CardHeader title={<CardTitle icon={Icon.ShieldCheck}>{o("healthTitle")}</CardTitle>} />
      {!integrity ? (
        <Alert variant="warn">{o("errGeneric")}</Alert>
      ) : issues.length === 0 ? (
        <Pill variant="good">{o("healthAllGood")}</Pill>
      ) : (
        <ul className="space-y-2.5">
          {issues.map((i) => (
            <li key={i.key} className="flex items-start gap-2.5 text-sm text-ink-1">
              <Pill variant="warn" className="num shrink-0 mt-px">{i.badge}</Pill>
              <span className="min-w-0">{i.text}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ManualCleanupCard({ o, days, onDaysChange, pendingKind, onDelete }: {
  o: AdminOpsT;
  days: Record<PurgeKind, number>;
  onDaysChange: (kind: PurgeKind, days: number) => void;
  /** The purge whose preview or delete is in flight. */
  pendingKind: PurgeKind | null;
  onDelete: (kind: PurgeKind) => void;
}) {
  return (
    <Card padding="md">
      <CardHeader title={<CardTitle icon={Icon.Trash2}>{o("purgeTitle")}</CardTitle>} />
      <div className="divide-y divide-border">
        <PurgeRow
          kind="support_resolved" label={o("purgeSupport")}
          optionLabel={(d) => o("resolvedOlderThan", { days: d })}
          o={o} days={days.support_resolved} onDaysChange={onDaysChange}
          pending={pendingKind === "support_resolved"} blocked={pendingKind !== null} onDelete={onDelete}
        />
        <PurgeRow
          kind="traffic" label={o("purgeTraffic")}
          optionLabel={(d) => (d === 0 ? o("purgeAll") : o("olderThan", { days: d }))}
          o={o} days={days.traffic} onDaysChange={onDaysChange}
          pending={pendingKind === "traffic"} blocked={pendingKind !== null} onDelete={onDelete}
        />
      </div>
    </Card>
  );
}

function PurgeRow({ kind, label, optionLabel, o, days, onDaysChange, pending, blocked, onDelete }: {
  kind: PurgeKind;
  label: string;
  optionLabel: (days: number) => string;
  o: AdminOpsT;
  days: number;
  onDaysChange: (kind: PurgeKind, days: number) => void;
  pending: boolean;
  /** Any purge is in flight (one at a time). */
  blocked: boolean;
  onDelete: (kind: PurgeKind) => void;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const selectId = `${id}-days`;
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <label id={labelId} htmlFor={selectId} className="block text-sm font-medium text-ink-1 mb-1.5">{label}</label>
        <select
          id={selectId}
          className="input h-11 sm:h-10"
          value={days}
          disabled={blocked}
          onChange={(e) => onDaysChange(kind, Number(e.target.value))}
        >
          {PURGE_OPTIONS[kind].map((d) => <option key={d} value={d}>{optionLabel(d)}</option>)}
        </select>
      </div>
      <button
        type="button"
        aria-describedby={labelId}
        aria-busy={pending || undefined}
        aria-disabled={(blocked && !pending) || undefined}
        onClick={() => { if (!blocked) onDelete(kind); }}
        className={buttonClass("default", "md", `h-11 sm:h-10 w-full sm:w-auto shrink-0 text-bad-ink hover:text-bad-ink ${ARIA_DISABLED}`)}
      >
        {!pending && <Icon.Trash2 size={16} strokeWidth={2} aria-hidden />}
        {o("purgeButton")}
      </button>
    </div>
  );
}

function detailParts(e: AuditEntry, o: AdminOpsT, s: AdminT, fmt: Fmt): string[] {
  const d = e.detail;
  const parts: string[] = [];
  if (d.days !== undefined) {
    parts.push(
      e.action === "traffic.purge" && d.days === 0 ? o("purgeAll")
        : e.action === "support.purge" ? o("resolvedOlderThan", { days: d.days })
        : o("olderThan", { days: d.days }),
    );
  }
  if (d.deleted !== undefined) parts.push(o("purgeDone", { n: fmt.int(d.deleted) }));
  if (d.tier) parts.push(s(TIER_KEY[d.tier]));
  if (d.admin !== undefined) parts.push(s(d.admin ? "isAdmin" : "notAdmin"));
  return parts;
}

function ActivityCard({ o, s, fmt, locale, audit }: {
  o: AdminOpsT;
  s: AdminT;
  fmt: Fmt;
  locale: Locale;
  audit: AuditEntry[] | null;
}) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="p-4">
        <CardHeader flush title={<CardTitle icon={Icon.History}>{o("auditTitle")}</CardTitle>} />
      </div>
      <div className="overflow-x-auto scrollbar-always border-t border-border">
        <table className="data-table w-full min-w-[560px] text-sm">
          <caption className="sr-only">{o("auditTitle")}</caption>
          <thead>
            <tr>
              <th scope="col">{o("colWhen")}</th>
              <th scope="col">{o("colWho")}</th>
              <th scope="col">{o("colAction")}</th>
              <th scope="col">{o("colDetails")}</th>
            </tr>
          </thead>
          <tbody>
            {audit === null ? (
              <tr><td colSpan={4} className="!py-8 text-center text-ink-3">{o("errGeneric")}</td></tr>
            ) : audit.length === 0 ? (
              <tr><td colSpan={4} className="!py-8 text-center text-ink-3">{o("auditEmpty")}</td></tr>
            ) : (
              audit.map((e) => {
                const labelKey = ACTION_LABEL[e.action];
                const parts = detailParts(e, o, s, fmt);
                return (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap"><RelativeTime iso={e.at} locale={locale} /></td>
                    <td>
                      {e.actor.kind === "user"
                        ? <span className="mono text-xs text-ink-1 whitespace-nowrap">{e.actor.email}</span>
                        : <span className="text-ink-3">{o(e.actor.kind === "scheduled" ? "auditScheduled" : "auditFormerUser")}</span>}
                    </td>
                    <td>
                      {/* A floor for the label column: table cells ignore min-width, a block inside them doesn't. */}
                      <div className="min-w-[11rem]">
                        {labelKey ? <span className="text-ink-1">{o(labelKey)}</span> : <span className="mono text-xs text-ink-2">{e.action}</span>}
                        {e.target && <div className="mono text-2xs text-ink-3 break-all mt-0.5">{e.target}</div>}
                      </div>
                    </td>
                    <td>
                      {parts.length === 0 ? (
                        <span className="text-ink-3">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {parts.map((p, i) => (
                            <span key={i} className="inline-flex items-center rounded-pill bg-surface-2 px-2 py-0.5 text-2xs text-ink-2 whitespace-nowrap">
                              {i > 0 && <span className="sr-only">, </span>}
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
