"use client";

import { useMemo, useState, useTransition } from "react";
import { updateUserTier, updateUserName, toggleUserAdmin, createUserAccount, resetUserPassword, deleteUserAccount } from "./actions";

export type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  tier: "free" | "pro" | "lifetime";
  is_admin: boolean;
  primary_regime: string | null;
  has_stripe: boolean;
  created_at: string;
};

const TIER_PILL: Record<AdminUser["tier"], string> = {
  free:     "bg-slate-100 text-slate-700 border-slate-200",
  pro:      "bg-sky-50 text-sky-700 border-sky-200",
  lifetime: "bg-violet-50 text-violet-700 border-violet-200",
};

/** Sign-in URL used in the credential-copy strings. Prefers the configured
 *  NEXT_PUBLIC_APP_URL so a staging/preview admin doesn't paste a prod URL
 *  into the new user's onboarding message. */
function loginUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL
    ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/$/, "")}/login`;
}

export default function AdminClient({ users }: { users: AdminUser[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!q.trim()) return users;
    const needle = q.toLowerCase();
    return users.filter((u) =>
      u.email.toLowerCase().includes(needle) ||
      (u.full_name ?? "").toLowerCase().includes(needle)
    );
  }, [users, q]);

  const counts = useMemo(() => ({
    total: users.length,
    free: users.filter((u) => u.tier === "free").length,
    pro: users.filter((u) => u.tier === "pro").length,
    lifetime: users.filter((u) => u.tier === "lifetime").length,
  }), [users]);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Admin · Users</h1>
        <div className="text-xs text-slate-500 tabular-nums">
          {counts.total} total ·{" "}
          <span className="text-slate-600">{counts.free} free</span> ·{" "}
          <span className="text-sky-700">{counts.pro} pro</span> ·{" "}
          <span className="text-violet-700">{counts.lifetime} lifetime</span>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <input
          className="input max-w-md flex-1"
          placeholder="Search by email or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <CreateUserButton />
      </div>

      <div className="card overflow-x-auto scrollbar-always">
        <table className="min-w-max w-full text-sm">
          <thead className="bg-gradient-to-b from-slate-100 to-slate-50 text-[10px] uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Tier</th>
              <th className="px-3 py-2 text-left">Regime</th>
              <th className="px-3 py-2 text-center">Stripe</th>
              <th className="px-3 py-2 text-center">Admin</th>
              <th className="px-3 py-2 text-left">Signed up</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, idx) => (
              <UserRow key={u.id} u={u} striped={idx % 2 === 1} />
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-12 text-center text-slate-400">
                No users match &ldquo;{q}&rdquo;.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateUserButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [tier, setTier] = useState<AdminUser["tier"]>("lifetime");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ tempPassword: string } | null>(null);

  function reset() {
    setEmail(""); setFullName(""); setTier("lifetime"); setErr(null); setResult(null);
  }

  function submit() {
    setErr(null);
    startTransition(async () => {
      try {
        const r = await createUserAccount({ email, fullName, tier });
        if (r?.error) { setErr(r.error); return; }
        if (r?.ok) setResult({ tempPassword: r.tempPassword });
      } catch (e) {
        const msg = e instanceof Error
          ? (e.message === "Load failed" ? "Network error — try again." : e.message)
          : String(e);
        setErr(msg);
      }
    });
  }

  return (
    <>
      <button className="btn btn-primary whitespace-nowrap" onClick={() => setOpen(true)}>
        + Create user
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
             onClick={() => { setOpen(false); reset(); }}>
          <div className="card max-w-md w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            {result ? (
              <>
                <h2 className="text-lg font-bold text-slate-900">Account created ✓</h2>
                <p className="text-sm text-slate-700">
                  Share these credentials with <strong>{email}</strong> securely (e.g. password manager,
                  encrypted message). They should change the password on first login.
                </p>
                <div className="space-y-2">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-500">Email</div>
                    <div className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">{email}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-500">Temporary password</div>
                    <div className="font-mono text-sm bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                      {result.tempPassword}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `Email: ${email}\nPassword: ${result.tempPassword}\nSign in: ${loginUrl()}`
                      );
                    }}
                  >
                    Copy credentials
                  </button>
                  <button className="btn btn-primary ml-auto" onClick={() => { setOpen(false); reset(); }}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-slate-900">Create new user</h2>
                <p className="text-xs text-slate-500">
                  Account is auto-confirmed — the user can sign in immediately with the temp password
                  we&rsquo;ll generate.
                </p>
                {err && <p className="text-sm text-rose-600">{err}</p>}
                <div className="space-y-3">
                  <div>
                    <label className="label">Email</label>
                    <input className="input" type="email" value={email}
                           onChange={(e) => setEmail(e.target.value)}
                           placeholder="pilot@example.com" />
                  </div>
                  <div>
                    <label className="label">Full name</label>
                    <input className="input" value={fullName}
                           onChange={(e) => setFullName(e.target.value)}
                           placeholder="Jane Pilot" />
                  </div>
                  <div>
                    <label className="label">Tier</label>
                    <select className="input" value={tier}
                            onChange={(e) => setTier(e.target.value as AdminUser["tier"])}>
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="lifetime">Lifetime</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn" onClick={() => { setOpen(false); reset(); }}>Cancel</button>
                  <button className="btn btn-primary ml-auto" onClick={submit} disabled={pending || !email}>
                    {pending ? "Creating…" : "Create user"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function UserRow({ u, striped }: { u: AdminUser; striped: boolean }) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(u.full_name);
  const [resetResult, setResetResult] = useState<{ tempPassword: string } | null>(null);

  // Server-action calls happen via fetch under the hood; on Safari + flaky
  // networks they throw `TypeError: Load failed`. We catch in every handler
  // so the error becomes a user-facing message instead of an unhandled
  // rejection that Sentry captures as noise.
  function netErr(e: unknown): string {
    if (e instanceof Error) {
      if (e.message === "Load failed" || e.message.startsWith("Failed to fetch")) {
        return "Network error — try again. (Your connection may be flaky.)";
      }
      return e.message;
    }
    return String(e);
  }

  function setTier(tier: AdminUser["tier"]) {
    setErr(null);
    startTransition(async () => {
      try {
        const r = await updateUserTier(u.id, tier);
        if (r?.error) setErr(r.error);
      } catch (e) {
        setErr(netErr(e));
      }
    });
  }

  function saveName() {
    setErr(null);
    startTransition(async () => {
      try {
        const r = await updateUserName(u.id, nameDraft);
        if (r?.error) setErr(r.error);
        else setEditingName(false);
      } catch (e) {
        setErr(netErr(e));
      }
    });
  }

  function flipAdmin() {
    if (!confirm(
      u.is_admin
        ? `Remove admin from ${u.email}?`
        : `Grant admin to ${u.email}? Admins can edit every user.`
    )) return;
    setErr(null);
    startTransition(async () => {
      try {
        const r = await toggleUserAdmin(u.id, !u.is_admin);
        if (r?.error) setErr(r.error);
      } catch (e) {
        setErr(netErr(e));
      }
    });
  }

  function resetPw() {
    if (!confirm(`Generate a NEW temporary password for ${u.email}? Their current password will stop working immediately.`)) return;
    setErr(null);
    startTransition(async () => {
      try {
        const r = await resetUserPassword(u.id);
        if ("tempPassword" in r) setResetResult({ tempPassword: r.tempPassword });
        else if (r.error) setErr(r.error);
      } catch (e) {
        setErr(netErr(e));
      }
    });
  }

  function deleteUser() {
    if (!confirm(`DELETE ${u.email} permanently? This wipes their account, flights, documents, everything. No undo.`)) return;
    if (!confirm(`Are you absolutely sure? Type the email in the next prompt to confirm.`)) return;
    const typed = prompt(`Type "${u.email}" exactly to confirm deletion:`);
    if (typed !== u.email) { alert("Email didn't match. Cancelled."); return; }
    setErr(null);
    startTransition(async () => {
      try {
        const r = await deleteUserAccount(u.id);
        if ("error" in r && typeof r.error === "string") setErr(r.error);
        // Row disappears on next render after revalidatePath
      } catch (e) {
        setErr(netErr(e));
      }
    });
  }

  return (
    <tr className={`border-t border-slate-100/70 ${striped ? "bg-slate-50/40" : ""} ${pending ? "opacity-60" : ""}`}>
      <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-slate-700">
        {u.email}
        {err && <div className="text-[10px] text-rose-600 mt-0.5">{err}</div>}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        {editingName ? (
          <div className="flex gap-1">
            <input
              className="input h-7 text-xs py-0.5"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
            />
            <button className="text-xs text-sky-700 hover:text-sky-900 font-medium" onClick={saveName}>Save</button>
            <button className="text-xs text-slate-500 hover:text-slate-700" onClick={() => { setEditingName(false); setNameDraft(u.full_name); }}>Cancel</button>
          </div>
        ) : (
          <button
            className="text-left text-slate-800 hover:text-sky-700"
            onClick={() => setEditingName(true)}
            title="Click to edit"
          >
            {u.full_name || <span className="text-slate-400 italic">—</span>}
          </button>
        )}
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <select
          className={`text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${TIER_PILL[u.tier]} cursor-pointer`}
          value={u.tier}
          onChange={(e) => setTier(e.target.value as AdminUser["tier"])}
          disabled={pending}
        >
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="lifetime">Lifetime</option>
        </select>
      </td>
      <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-slate-600">
        {u.primary_regime ?? "—"}
      </td>
      <td className="px-3 py-2 text-center">
        {u.has_stripe ? <span className="text-emerald-600 text-sm" title="Stripe customer linked">✓</span> : <span className="text-slate-300">—</span>}
      </td>
      <td className="px-3 py-2 text-center">
        <button
          className={u.is_admin ? "text-amber-600 hover:text-amber-700" : "text-slate-300 hover:text-amber-600"}
          onClick={flipAdmin}
          title={u.is_admin ? "Click to revoke admin" : "Click to grant admin"}
          disabled={pending}
        >
          {u.is_admin ? "★" : "☆"}
        </button>
      </td>
      <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-slate-500">
        {u.created_at ? u.created_at.slice(0, 10) : "—"}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <button
          className="text-xs text-sky-700 hover:text-sky-900 font-medium mr-3 disabled:opacity-40"
          onClick={resetPw}
          disabled={pending}
          title="Generate a new temporary password"
        >
          Reset PW
        </button>
        <button
          className="text-xs text-rose-600 hover:text-rose-800 font-medium disabled:opacity-40"
          onClick={deleteUser}
          disabled={pending}
          title="Delete this account permanently"
        >
          Delete
        </button>
      </td>

      {/* Floating modal showing the new temp password after a reset. */}
      {resetResult && (
        <td colSpan={0}>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
               onClick={() => setResetResult(null)}>
            <div className="card max-w-md w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-slate-900">New password for {u.email}</h2>
              <p className="text-sm text-slate-700">
                Their old password is now invalid. Share this with them securely.
                They should change it on first login.
              </p>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">Temporary password</div>
                <div className="font-mono text-sm bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                  {resetResult.tempPassword}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Email: ${u.email}\nPassword: ${resetResult.tempPassword}\nSign in: ${loginUrl()}`
                    );
                  }}
                >
                  Copy credentials
                </button>
                <button className="btn btn-primary ml-auto" onClick={() => setResetResult(null)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </td>
      )}
    </tr>
  );
}
