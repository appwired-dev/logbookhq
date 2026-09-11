"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { updateUserTier, updateUserName, toggleUserAdmin, createUserAccount, resetUserPassword, deleteUserAccount } from "./actions";
import type { Locale } from "@/lib/i18n";
import { Alert, Button, Card, CardFooter, CardHeader, Field, Icon, PageHeader, Pill, StatTile } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";
import { adminStrings, type AdminStringKey, type AdminT } from "./admin-strings";

export type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  tier: "free" | "pro" | "lifetime";
  is_admin: boolean;
  primary_regime: string | null;
  has_stripe: boolean;
  created_at: string;
  last_seen_at: string | null;
};
type Tier = AdminUser["tier"];

const TIERS: Tier[] = ["free", "pro", "lifetime"];
const TIER_KEY: Record<Tier, AdminStringKey> = { free: "tierFree", pro: "tierPro", lifetime: "tierLifetime" };
/** Full class strings so Tailwind's purge keeps every variant. */
const TIER_SELECT: Record<Tier, string> = { free: "pill-neutral", pro: "pill-pic", lifetime: "pill-sic-role" };

/** `.input` is h-10; phones get the 44px touch target. */
const INPUT = "input h-11 sm:h-10";
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const DANGER_GHOST = "text-bad-ink hover:bg-bad/10 hover:text-bad-ink";

type Credentials = { kind: "created" | "reset"; email: string; password: string };
type ConfirmKind = "admin" | "reset" | "delete";
type Confirm = { kind: ConfirmKind; user: AdminUser } | null;

/** Sign-in URL used in the credential-copy text. Prefers the configured
 *  NEXT_PUBLIC_APP_URL so a staging/preview admin doesn't paste a prod URL
 *  into the new user's onboarding message. */
function loginUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL
    ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/$/, "")}/login`;
}

/** Server-action calls go over fetch; Safari on a flaky network throws `Load failed`. */
function netErr(e: unknown, s: AdminT): string {
  if (e instanceof Error) {
    if (e.message === "Load failed" || e.message.startsWith("Failed to fetch")) return s("errNetwork");
    return e.message || s("errUnexpected");
  }
  return s("errUnexpected");
}

export default function AdminClient({ users, locale }: { users: AdminUser[]; locale: Locale }) {
  const s = adminStrings(locale);
  const toast = useToast();
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  // `confirm` outlives `confirmOpen` so the dialog keeps its copy while it animates closed.
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, startConfirming] = useTransition();
  const createRef = useRef<HTMLButtonElement>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((u) => u.email.toLowerCase().includes(needle) || (u.full_name ?? "").toLowerCase().includes(needle));
  }, [users, q]);

  const counts = useMemo(() => ({
    total: users.length,
    free: users.filter((u) => u.tier === "free").length,
    pro: users.filter((u) => u.tier === "pro").length,
    lifetime: users.filter((u) => u.tier === "lifetime").length,
  }), [users]);

  const fail = (message: string) => toast.push({ tone: "bad", title: message });

  function runConfirm() {
    if (!confirm) return;
    const { kind, user } = confirm;
    startConfirming(async () => {
      try {
        if (kind === "admin") {
          const r = await toggleUserAdmin(user.id, !user.is_admin);
          if (r?.error) fail(r.error);
          else toast.push({ tone: "good", title: s(user.is_admin ? "adminRevoked" : "adminGranted"), description: user.email });
        } else if (kind === "reset") {
          const r = await resetUserPassword(user.id);
          if ("tempPassword" in r) {
            setCredentials({ kind: "reset", email: user.email, password: r.tempPassword });
            toast.push({ tone: "good", title: s("resetDone"), description: user.email });
          } else fail(r.error);
        } else {
          const r = await deleteUserAccount(user.id);
          if ("error" in r) fail(r.error);
          else toast.push({ tone: "good", title: s("deleted"), description: s("deletedBody", { email: user.email }) });
        }
      } catch (e) {
        fail(netErr(e, s));
      } finally {
        setConfirmOpen(false);
      }
    });
  }

  function askConfirm(kind: ConfirmKind, user: AdminUser) {
    setConfirm({ kind, user });
    setConfirmOpen(true);
  }

  async function copyCredentials(c: Credentials) {
    try {
      await navigator.clipboard.writeText(`${s("email")}: ${c.email}\n${s("password")}: ${c.password}\n${s("signIn")}: ${loginUrl()}`);
      toast.push({ tone: "good", title: s("credentialsCopied") });
    } catch {
      toast.push({ tone: "warn", title: s("copyFailed") });
    }
  }

  const confirmCopy = confirm ? CONFIRM_COPY[confirm.kind](confirm.user, s) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={s("title")}
        subtitle={s("subtitle")}
        actions={
          // Plain <button>: it takes focus back when the create form closes.
          <button
            ref={createRef}
            type="button"
            className={`btn ${createOpen ? "" : "btn-primary"} h-11 sm:h-10`}
            aria-expanded={createOpen}
            onClick={() => setCreateOpen((v) => !v)}
          >
            {createOpen
              ? <><Icon.X size={16} strokeWidth={2} aria-hidden />{s("cancel")}</>
              : <><Icon.Plus size={16} strokeWidth={2} aria-hidden />{s("createUser")}</>}
          </button>
        }
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile variant="compact" accent="brand" label={s("statTotal")} value={counts.total} decimals={0} />
        <StatTile variant="compact" accent="neutral" label={s("statFree")} value={counts.free} decimals={0} />
        <StatTile variant="compact" accent="pic" label={s("statPro")} value={counts.pro} decimals={0} />
        <StatTile variant="compact" accent="sic" label={s("statLifetime")} value={counts.lifetime} decimals={0} />
      </section>

      {createOpen && (
        <CreateUserForm
          s={s}
          onCreated={(c) => {
            setCredentials(c);
            setCreateOpen(false);
            toast.push({ tone: "good", title: s("created"), description: c.email });
            requestAnimationFrame(() => createRef.current?.focus());
          }}
          onCancel={() => {
            setCreateOpen(false);
            requestAnimationFrame(() => createRef.current?.focus());
          }}
        />
      )}

      {credentials && (
        <CredentialsPanel
          c={credentials}
          s={s}
          onCopy={() => copyCredentials(credentials)}
          onDismiss={() => setCredentials(null)}
        />
      )}

      <div className="relative max-w-md">
        <Icon.Search size={16} strokeWidth={2} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
        <input
          type="search"
          aria-label={s("search")}
          placeholder={s("searchPh")}
          className={`${INPUT} pl-9`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Card padding="none" className="overflow-x-auto scrollbar-always">
        <table className="data-table w-full min-w-[960px] text-sm">
          <thead>
            <tr>
              <th scope="col">{s("colEmail")}</th>
              <th scope="col">{s("colName")}</th>
              <th scope="col">{s("colTier")}</th>
              <th scope="col">{s("colRegime")}</th>
              <th scope="col" className="!text-center">{s("colStripe")}</th>
              <th scope="col" className="!text-center">{s("colAdmin")}</th>
              <th scope="col">{s("colSignedUp")}</th>
              <th scope="col">{s("colLastSeen")}</th>
              <th scope="col" className="!text-right">{s("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <UserRow
                key={u.id}
                u={u}
                s={s}
                locale={locale}
                busy={confirming && confirm?.user.id === u.id}
                onConfirm={(kind) => askConfirm(kind, u)}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="!px-3 !py-12 text-center text-ink-3">
                  {q.trim() ? s("noMatch", { q: q.trim() }) : s("noUsers")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title={confirmCopy?.title ?? ""}
        body={confirmCopy?.body ?? ""}
        confirmLabel={confirmCopy?.confirm ?? ""}
        tone="danger"
        pending={confirming}
        locale={locale}
        onConfirm={runConfirm}
        onCancel={() => { if (!confirming) setConfirmOpen(false); }}
      />
    </div>
  );
}

/** Title / body / button copy for each destructive confirmation. */
const CONFIRM_COPY: Record<ConfirmKind, (u: AdminUser, s: AdminT) => { title: string; body: string; confirm: string }> = {
  admin: (u, s) => u.is_admin
    ? { title: s("revokeTitle", { email: u.email }), body: s("revokeBody"), confirm: s("revokeConfirm") }
    : { title: s("grantTitle", { email: u.email }), body: s("grantBody"), confirm: s("grantConfirm") },
  reset: (u, s) => ({ title: s("resetTitle", { email: u.email }), body: s("resetBody"), confirm: s("resetConfirm") }),
  delete: (u, s) => ({ title: s("deleteTitle", { email: u.email }), body: s("deleteBody"), confirm: s("deleteConfirm") }),
};

/* ------------------------------------------------------------------------ */
/* Create user                                                               */
/* ------------------------------------------------------------------------ */

function CreateUserForm({ s, onCreated, onCancel }: {
  s: AdminT;
  onCreated: (c: Credentials) => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [tier, setTier] = useState<Tier>("lifetime");
  const [attempted, setAttempted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const emailRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const emailError = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? undefined : s("errEmail");

  useEffect(() => { emailRef.current?.focus(); }, []);
  useEffect(() => { if (serverError) errorRef.current?.focus(); }, [serverError]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setAttempted(true);
    setServerError(null);
    if (emailError) {
      emailRef.current?.focus();
      return;
    }
    startTransition(async () => {
      try {
        const r = await createUserAccount({ email: email.trim(), fullName: fullName.trim(), tier });
        if (r && "error" in r && r.error) {
          setServerError(r.error);
          return;
        }
        if (r && "ok" in r && r.ok) onCreated({ kind: "created", email: email.trim().toLowerCase(), password: r.tempPassword });
      } catch (err) {
        setServerError(netErr(err, s));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending || undefined} className="card p-4 animate-fade-up motion-reduce:animate-none">
      <CardHeader title={s("createTitle")} meta={s("createDesc")} />
      {serverError && (
        <div
          ref={errorRef}
          tabIndex={-1}
          className="mb-3 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bad/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <Alert variant="bad">{serverError}</Alert>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label={s("email")} required error={attempted ? emailError : undefined}>
          <input
            ref={emailRef}
            type="email"
            className={`${INPUT} mono`}
            value={email}
            placeholder="pilot@example.com"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label={s("fullName")}>
          <input className={INPUT} value={fullName} placeholder="Jane Pilot" autoComplete="off" onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label={s("tier")}>
          <select className={INPUT} value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
            {TIERS.map((v) => <option key={v} value={v}>{s(TIER_KEY[v])}</option>)}
          </select>
        </Field>
      </div>
      <CardFooter className="justify-end">
        <Button variant="ghost" className="h-11 sm:h-10" onClick={onCancel} disabled={pending}>{s("cancel")}</Button>
        <Button type="submit" variant="primary" className="h-11 sm:h-10" loading={pending}>
          {pending ? s("creating") : <><Icon.Plus size={16} strokeWidth={2} aria-hidden />{s("createUser")}</>}
        </Button>
      </CardFooter>
    </form>
  );
}

/* ------------------------------------------------------------------------ */
/* Credentials panel (after create / reset)                                  */
/* ------------------------------------------------------------------------ */

function CredentialsPanel({ c, s, onCopy, onDismiss }: { c: Credentials; s: AdminT; onCopy: () => void; onDismiss: () => void }) {
  const headingRef = useRef<HTMLDivElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, [c]);
  return (
    <Card padding="md" role="status" className="border-good/30 bg-good/5">
      <div ref={headingRef} tabIndex={-1} className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-1.5">
              <Icon.CircleCheck size={16} strokeWidth={2} aria-hidden className="text-good-ink" />
              {s(c.kind === "created" ? "created" : "resetDone")}
            </span>
          }
          meta={s(c.kind === "created" ? "createdBody" : "resetDoneBody", { email: c.email })}
          actions={
            <Button variant="ghost" icon className="h-11 w-11 sm:h-9 sm:w-9" aria-label={s("dismiss")} onClick={onDismiss}>
              <Icon.X size={16} strokeWidth={2} aria-hidden />
            </Button>
          }
        />
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="label">{s("email")}</dt>
          <dd className="mono text-sm text-ink-1 rounded-control bg-surface border border-border px-2.5 py-1.5 break-all">{c.email}</dd>
        </div>
        <div>
          <dt className="label">{s("tempPassword")}</dt>
          <dd className="mono text-sm font-semibold text-ink-1 rounded-control bg-warn/10 border border-warn/30 px-2.5 py-1.5 break-all">{c.password}</dd>
        </div>
      </dl>
      <CardFooter>
        <Button className="h-11 sm:h-10" onClick={onCopy}>
          <Icon.Copy size={16} strokeWidth={1.75} aria-hidden />{s("copyCredentials")}
        </Button>
        <Button variant="primary" className="h-11 sm:h-10 ml-auto" onClick={onDismiss}>{s("dismiss")}</Button>
      </CardFooter>
    </Card>
  );
}

/* ------------------------------------------------------------------------ */
/* Row                                                                       */
/* ------------------------------------------------------------------------ */

function UserRow({ u, s, locale, busy, onConfirm }: {
  u: AdminUser;
  s: AdminT;
  locale: Locale;
  /** A confirmation for this user is in flight (dims the row). */
  busy: boolean;
  onConfirm: (kind: ConfirmKind) => void;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(u.full_name);
  const [arming, setArming] = useState(false);
  const [typed, setTyped] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const editNameRef = useRef<HTMLButtonElement>(null);
  const armInputRef = useRef<HTMLInputElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const dim = pending || busy;

  useEffect(() => { if (editingName) nameInputRef.current?.focus(); }, [editingName]);
  useEffect(() => {
    if (arming) armInputRef.current?.focus();
    else setTyped("");
  }, [arming]);

  function setTier(tier: Tier) {
    startTransition(async () => {
      try {
        const r = await updateUserTier(u.id, tier);
        if (r?.error) toast.push({ tone: "bad", title: r.error });
        else toast.push({ tone: "good", title: s("tierUpdated", { tier: s(TIER_KEY[tier]) }), description: u.email });
      } catch (e) {
        toast.push({ tone: "bad", title: netErr(e, s) });
      }
    });
  }

  function saveName() {
    startTransition(async () => {
      try {
        const r = await updateUserName(u.id, nameDraft);
        if (r?.error) toast.push({ tone: "bad", title: r.error });
        else {
          setEditingName(false);
          toast.push({ tone: "good", title: s("nameSaved"), description: u.email });
          requestAnimationFrame(() => editNameRef.current?.focus());
        }
      } catch (e) {
        toast.push({ tone: "bad", title: netErr(e, s) });
      }
    });
  }

  function cancelName() {
    setEditingName(false);
    setNameDraft(u.full_name);
    requestAnimationFrame(() => editNameRef.current?.focus());
  }

  function closeArm() {
    setArming(false);
    requestAnimationFrame(() => deleteRef.current?.focus());
  }

  function onNameKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); saveName(); }
    if (e.key === "Escape") { e.preventDefault(); cancelName(); }
  }

  const armed = typed.trim().toLowerCase() === u.email.toLowerCase();

  return (
    <>
      <tr data-pending={dim || undefined} className="hover:bg-surface-2/40 transition-colors duration-fast motion-reduce:transition-none">
        <td className="mono text-xs text-ink-1 whitespace-nowrap">{u.email}</td>
        <td className="whitespace-nowrap">
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={nameInputRef}
                className="input input-sm h-11 sm:h-8 w-44"
                aria-label={s("nameLabel")}
                value={nameDraft}
                disabled={pending}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={onNameKeyDown}
              />
              <Button size="sm" variant="primary" className="h-11 sm:h-8" loading={pending} onClick={saveName}>{s("save")}</Button>
              <Button size="sm" variant="ghost" className="h-11 sm:h-8" disabled={pending} onClick={cancelName}>{s("cancel")}</Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className={u.full_name ? "text-ink-1" : "text-ink-3"}>{u.full_name || "—"}</span>
              <button
                ref={editNameRef}
                type="button"
                className={`btn btn-ghost btn-icon h-11 w-11 sm:h-8 sm:w-8 text-ink-3 hover:text-ink-1 ${FOCUS_RING}`}
                aria-label={s("editName", { email: u.email })}
                disabled={dim}
                onClick={() => setEditingName(true)}
              >
                <Icon.Pencil size={14} strokeWidth={2} aria-hidden />
              </button>
            </div>
          )}
        </td>
        <td className="whitespace-nowrap">
          {/* Pill-styled select: the pill IS the control, with a chevron so it reads as one. */}
          <span className="relative inline-flex items-center">
            <select
              aria-label={s("tierLabel", { email: u.email })}
              className={`${TIER_SELECT[u.tier]} appearance-none h-11 sm:h-7 pl-2 pr-6 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS_RING}`}
              value={u.tier}
              disabled={dim}
              onChange={(e) => setTier(e.target.value as Tier)}
            >
              {TIERS.map((v) => <option key={v} value={v}>{s(TIER_KEY[v])}</option>)}
            </select>
            <Icon.ChevronDown size={12} strokeWidth={2.5} aria-hidden className="pointer-events-none absolute right-1.5 text-ink-3" />
          </span>
        </td>
        <td className="whitespace-nowrap">
          {u.primary_regime ? <Pill variant="neutral" className="mono">{u.primary_regime}</Pill> : <span className="text-ink-3">—</span>}
        </td>
        <td className="text-center">
          {u.has_stripe ? (
            <span className="inline-flex text-good-ink" title={s("stripeLinked")}>
              <Icon.Check size={16} strokeWidth={2.5} aria-hidden /><span className="sr-only">{s("stripeLinked")}</span>
            </span>
          ) : (
            <span className="text-ink-3" title={s("stripeNone")}>—<span className="sr-only"> {s("stripeNone")}</span></span>
          )}
        </td>
        <td className="text-center">
          <button
            type="button"
            className={`btn btn-ghost btn-icon h-11 w-11 sm:h-8 sm:w-8 ${u.is_admin ? "text-warn-ink hover:text-warn-ink" : "text-ink-3 hover:text-ink-1"} ${FOCUS_RING}`}
            aria-pressed={u.is_admin}
            aria-label={s(u.is_admin ? "revokeAdmin" : "grantAdmin", { email: u.email })}
            title={s(u.is_admin ? "isAdmin" : "notAdmin")}
            disabled={dim}
            onClick={() => onConfirm("admin")}
          >
            <Icon.ShieldCheck size={16} strokeWidth={u.is_admin ? 2.25 : 1.75} aria-hidden />
          </button>
        </td>
        <td className="mono text-xs text-ink-2 whitespace-nowrap">{u.created_at ? u.created_at.slice(0, 10) : "—"}</td>
        <td className="whitespace-nowrap"><LastActive iso={u.last_seen_at} locale={locale} /></td>
        <td className="whitespace-nowrap">
          <div className="flex items-center justify-end gap-1">
            <Button size="sm" variant="ghost" className="h-11 sm:h-8" disabled={dim} onClick={() => onConfirm("reset")}>
              <Icon.RotateCcw size={14} strokeWidth={2} aria-hidden />{s("resetPw")}
            </Button>
            <button
              ref={deleteRef}
              type="button"
              className={`btn btn-ghost btn-sm h-11 sm:h-8 ${DANGER_GHOST}`}
              aria-expanded={arming}
              disabled={dim}
              onClick={() => (arming ? closeArm() : setArming(true))}
            >
              <Icon.X size={14} strokeWidth={2} aria-hidden />{s("deleteUser")}
            </button>
          </div>
        </td>
      </tr>

      {arming && (
        <tr className="bg-bad/5">
          <td colSpan={9} className="!py-3">
            <div
              role="group"
              aria-label={s("deleteArmTitle", { email: u.email })}
              onKeyDown={(e) => {
                if (e.key === "Escape" && !dim) { e.preventDefault(); e.stopPropagation(); closeArm(); }
              }}
              className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
            >
              <div className="min-w-0 max-w-prose">
                <p className="text-sm font-semibold text-ink-1">{s("deleteArmTitle", { email: u.email })}</p>
                <p className="mt-0.5 text-xs text-ink-2 whitespace-normal">{s("deleteArmBody")}</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                <Field label={s("deleteTypeLabel")}>
                  <input
                    ref={armInputRef}
                    className="input h-11 sm:h-10 mono w-64"
                    value={typed}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && armed) { e.preventDefault(); onConfirm("delete"); } }}
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" className="h-11 sm:h-10" disabled={dim} onClick={closeArm}>{s("cancel")}</Button>
                  <Button variant="danger" className="h-11 sm:h-10" disabled={!armed || dim} onClick={() => onConfirm("delete")}>
                    {s("deleteContinue")}
                  </Button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Relative "last active" time, admin-only. Rendered client-side after mount to
 * avoid a hydration mismatch (Date.now / timezone differ server<->client);
 * before mount it shows the deterministic ISO date so SSR and first paint agree.
 */
function LastActive({ iso, locale }: { iso: string | null; locale: Locale }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!iso) return <span className="text-ink-3">—</span>;
  if (!mounted) return <span className="mono text-xs text-ink-2">{iso.slice(0, 10)}</span>;
  const then = new Date(iso);
  const t = then.getTime();
  if (Number.isNaN(t)) return <span className="text-ink-3">—</span>;
  const sec = (t - Date.now()) / 1000;
  const a = Math.abs(sec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const rel =
    a < 60 ? rtf.format(Math.round(sec), "second")
    : a < 3600 ? rtf.format(Math.round(sec / 60), "minute")
    : a < 86400 ? rtf.format(Math.round(sec / 3600), "hour")
    : a < 2592000 ? rtf.format(Math.round(sec / 86400), "day")
    : a < 31536000 ? rtf.format(Math.round(sec / 2592000), "month")
    : rtf.format(Math.round(sec / 31536000), "year");
  return <span className="text-xs text-ink-2 whitespace-nowrap" title={then.toLocaleString(locale)}>{rel}</span>;
}
