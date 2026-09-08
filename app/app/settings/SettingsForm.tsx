"use client";

import {
  useEffect, useId, useRef, useState, useSyncExternalStore, useTransition,
  type ChangeEvent, type FormEvent, type ReactNode,
} from "react";
import { updateProfile, uploadAvatar } from "./actions";
import { generateShareToken, revokeShareToken } from "./share-actions";
import { REGIME_RULES, type Regime } from "@/lib/currency-rules";
import { makeT, type Locale } from "@/lib/i18n";
import { Alert, Button, Card, CardHeader, Field, Icon, PageHeader, Pill, buttonClass } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";
import { settingsStrings } from "./settings-strings";

interface Profile {
  full_name: string | null;
  email: string;
  license_number: string | null;
  primary_regime: Regime;
  tier: string;
  is_admin: boolean;
  avatar_url: string | null;
  share_token: string | null;
  aug_half_credit: boolean;
}

/** The editable subset of the profile; compared against `initial` for dirty tracking. */
type Values = {
  full_name: string;
  license_number: string;
  primary_regime: Regime;
  aug_half_credit: boolean;
};

const TIER_PILL: Record<string, string> = { free: "neutral", pro: "pic", lifetime: "sic" };

/** `.input` is h-10; phones get the 44px touch target. */
const INPUT = "input h-11 sm:h-10";
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const valuesOf = (p: Profile): Values => ({
  full_name: p.full_name ?? "",
  license_number: p.license_number ?? "",
  primary_regime: p.primary_regime,
  aug_half_credit: Boolean(p.aug_half_credit),
});

/* ---- window.location.origin without a hydration mismatch ---- */
const subscribeNoop = () => () => {};
const emptyString = () => "";
const readOrigin = () => window.location.origin;
/** "" during SSR/hydration, the real origin afterwards. */
const useOrigin = () => useSyncExternalStore(subscribeNoop, readOrigin, emptyString);

export default function SettingsForm({
  profile, locale, billing, backup, support,
}: {
  profile: Profile;
  locale: Locale;
  /** Server-rendered billing card (holds the Stripe portal form action). */
  billing?: ReactNode;
  /** Backup card — a sibling client component the page composes. */
  backup?: ReactNode;
  /** Support card — an in-app message form the page composes. */
  support?: ReactNode;
}) {
  const t = makeT(locale);
  const s = settingsStrings(locale);
  const toast = useToast();
  const formId = useId();

  /* ---- profile + preferences ---- */
  const [initial, setInitial] = useState<Values>(() => valuesOf(profile));
  const [values, setValues] = useState<Values>(initial);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const errorRef = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const set = <K extends keyof Values>(k: K, v: Values[K]) => setValues((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (serverError) errorRef.current?.focus();
  }, [serverError]);

  // Hard navigations / tab close while edits are pending: the browser's own prompt.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || !dirty) return;
    setServerError(null);
    // Same FormData shape updateProfile has always read.
    const fd = new FormData();
    fd.set("full_name", values.full_name);
    fd.set("license_number", values.license_number);
    fd.set("primary_regime", values.primary_regime);
    if (values.aug_half_credit) fd.set("aug_half_credit", "on");
    const snapshot = values;
    startSaving(async () => {
      try {
        const r = await updateProfile(fd);
        if (r?.error) {
          setServerError(r.error);
          return;
        }
        setInitial(snapshot);
        toast.push({ tone: "good", title: s("savedToast"), description: s("savedToastBody") });
      } catch {
        setServerError(s("errUnexpected"));
      }
    });
  }

  function discard() {
    setValues(initial);
    setServerError(null);
  }

  /* ---- avatar ---- */
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [uploading, setUploading] = useState(false);
  const avatarInputId = `${formId}-avatar`;

  async function onAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const r = await uploadAvatar(fd);
      if (r.error) toast.push({ tone: "bad", title: s("avatarFailed"), description: r.error });
      else {
        if (r.url) setAvatarUrl(r.url);
        toast.push({ tone: "good", title: s("avatarUploaded") });
      }
    } catch {
      toast.push({ tone: "bad", title: s("avatarFailed"), description: s("errUnexpected") });
    } finally {
      setUploading(false);
    }
  }

  /* ---- sharing ---- */
  const origin = useOrigin();
  const [shareToken, setShareToken] = useState(profile.share_token);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareConfirm, setShareConfirm] = useState<null | "regenerate" | "revoke">(null);
  const shareUrl = shareToken ? `${origin}/share/${shareToken}` : null;

  async function createOrRotate(rotating: boolean) {
    setShareBusy(true);
    try {
      const r = await generateShareToken();
      if (r.error || !r.token) {
        toast.push({ tone: "bad", title: s("shareFailed"), description: r.error });
        return;
      }
      setShareToken(r.token);
      toast.push({ tone: "good", title: s(rotating ? "regenerated" : "linkCreated") });
    } catch {
      toast.push({ tone: "bad", title: s("shareFailed"), description: s("errUnexpected") });
    } finally {
      setShareBusy(false);
      setShareConfirm(null);
    }
  }

  async function revoke() {
    setShareBusy(true);
    try {
      const r = await revokeShareToken();
      if (r.error) {
        toast.push({ tone: "bad", title: s("shareFailed"), description: r.error });
        return;
      }
      setShareToken(null);
      toast.push({ tone: "info", title: s("revoked") });
    } catch {
      toast.push({ tone: "bad", title: s("shareFailed"), description: s("errUnexpected") });
    } finally {
      setShareBusy(false);
      setShareConfirm(null);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.push({ tone: "good", title: s("copied"), description: s("copiedBody") });
    } catch {
      toast.push({ tone: "warn", title: s("copyFailed") });
    }
  }

  /* ---- derived ---- */
  const regime = REGIME_RULES[values.primary_regime];
  const initialLetter = (profile.full_name ?? profile.email).slice(0, 1).toUpperCase();
  const statusLine = (
    <p role="status" className={`flex items-center gap-1.5 text-xs font-medium ${dirty ? "text-warn-ink" : "text-good-ink"}`}>
      {dirty
        ? <Icon.TriangleAlert size={14} strokeWidth={2} aria-hidden className="shrink-0" />
        : <Icon.Check size={14} strokeWidth={2} aria-hidden className="shrink-0" />}
      <span>{dirty ? s("unsavedChanges") : s("noChanges")}</span>
    </p>
  );
  const saveLabel = saving ? t("common.saving") : s("saveChanges");

  return (
    <div className="space-y-4">
      <PageHeader title={t("settings.title")} subtitle={s("subtitle")} />

      <div className="grid gap-4 lg:grid-cols-2 items-start [&>*]:min-w-0">
        {/* ------------------------------------------------------------ */}
        {/* Left: profile + preferences (one form)                        */}
        {/* ------------------------------------------------------------ */}
        <form id={formId} onSubmit={onSubmit} noValidate aria-busy={saving || undefined} className="space-y-4">
          {serverError && (
            <div
              ref={errorRef}
              tabIndex={-1}
              className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bad/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <Alert variant="bad" title={s("saveFailed")}>{serverError}</Alert>
            </div>
          )}

          <Card padding="md">
            <CardHeader title={t("settings.profile")} meta={s("profileDesc")} />

            {/* Avatar */}
            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-16 h-16 rounded-full overflow-hidden bg-surface-2 ring-2 ring-surface shadow-card grid place-items-center text-ink-2 text-lg font-semibold shrink-0">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={s("avatarAlt")} className="w-full h-full object-cover" />
                ) : (
                  <span aria-hidden>{initialLetter}</span>
                )}
              </div>
              <div className="min-w-0">
                <span className="label">{t("settings.avatar")}</span>
                <label
                  htmlFor={avatarInputId}
                  aria-busy={uploading || undefined}
                  className={buttonClass("default", "sm", `h-11 sm:h-8 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/60 has-[:focus-visible]:ring-offset-2 ${uploading ? "opacity-80 cursor-progress" : ""}`)}
                >
                  <Icon.Upload size={14} strokeWidth={2} aria-hidden />
                  {uploading ? t("docs.uploading") : avatarUrl ? t("settings.replacePhoto") : t("settings.uploadPhoto")}
                  <input
                    id={avatarInputId}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={uploading}
                    onChange={onAvatarChange}
                  />
                </label>
                <p className="mt-1 text-xs text-ink-3">{s("avatarHint")}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t("settings.fullName")}>
                <input
                  className={INPUT}
                  value={values.full_name}
                  autoComplete="name"
                  onChange={(e) => set("full_name", e.target.value)}
                />
              </Field>
              <Field label={t("settings.licenseNum")}>
                <input
                  className={`${INPUT} mono`}
                  value={values.license_number}
                  placeholder={t("export.licensePh")}
                  autoComplete="off"
                  onChange={(e) => set("license_number", e.target.value)}
                />
              </Field>
              <Field
                label={t("settings.primaryRegime")}
                className="sm:col-span-2"
                hint={<>
                  <span className="font-medium text-ink-2">{s("regimeHint", { authority: regime.authority, reference: regime.reference })}</span>
                  {" · "}{s("regimeMeta")}
                </>}
              >
                <select
                  className={INPUT}
                  value={values.primary_regime}
                  onChange={(e) => set("primary_regime", e.target.value as Regime)}
                >
                  {(Object.keys(REGIME_RULES) as Regime[]).map((r) => (
                    <option key={r} value={r}>{r} — {REGIME_RULES[r].name}</option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>

          <Card padding="md">
            <CardHeader title={s("preferences")} meta={s("preferencesDesc")} />
            <Field label={<span className="sr-only">{t("settings.augCredit")}</span>} hint={t("settings.augCreditHint")}>
              <Switch checked={values.aug_half_credit} onChange={(v) => set("aug_half_credit", v)}>
                {t("settings.augCredit")}
              </Switch>
            </Field>
          </Card>

          {/* lg+: footer row; below lg the sticky bar takes over */}
          <div className="hidden lg:flex items-center justify-between gap-3">
            {statusLine}
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={discard} disabled={!dirty || saving}>{s("discard")}</Button>
              <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>{saveLabel}</Button>
            </div>
          </div>
        </form>

        {/* ------------------------------------------------------------ */}
        {/* Right: sharing · account · billing · backup                   */}
        {/* ------------------------------------------------------------ */}
        <div className="space-y-4">
          <Card padding="md">
            <CardHeader title={s("sharing")} meta={s("sharingDesc")} />
            {shareUrl ? (
              <div className="space-y-3">
                <Field label={s("shareLinkLabel")}>
                  <input
                    readOnly
                    value={shareUrl}
                    className={`${INPUT} mono text-xs`}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button className="h-11 sm:h-10" onClick={copyShareUrl}>
                    <Icon.Copy size={16} strokeWidth={1.75} aria-hidden />{s("copyLink")}
                  </Button>
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClass("ghost", "md", "h-11 sm:h-10")}
                  >
                    {s("openLink")}<Icon.ArrowUpRight size={16} strokeWidth={2} aria-hidden />
                  </a>
                  <span className="flex-1" />
                  <Button variant="ghost" className="h-11 sm:h-10" disabled={shareBusy} onClick={() => setShareConfirm("regenerate")}>
                    <Icon.RotateCcw size={16} strokeWidth={1.75} aria-hidden />{s("regenerate")}
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-11 sm:h-10 text-bad-ink hover:bg-bad/10 hover:text-bad-ink"
                    disabled={shareBusy}
                    onClick={() => setShareConfirm("revoke")}
                  >
                    <Icon.X size={16} strokeWidth={2} aria-hidden />{s("revoke")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-2">{s("noLink")}</p>
                <Button variant="primary" className="h-11 sm:h-10" loading={shareBusy} onClick={() => createOrRotate(false)}>
                  {shareBusy ? s("creating") : <><Icon.Plus size={16} strokeWidth={2} aria-hidden />{s("createLink")}</>}
                </Button>
              </div>
            )}
          </Card>

          <Card padding="md">
            <CardHeader title={t("settings.account")} meta={s("accountDesc")} />
            <dl className="divide-y divide-border text-sm">
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-ink-2">{t("settings.email")}</dt>
                <dd className="text-ink-1 truncate">{profile.email}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-ink-2">{t("settings.tier")}</dt>
                <dd className="flex items-center gap-1.5">
                  <Pill variant={TIER_PILL[profile.tier] ?? "neutral"}>{profile.tier}</Pill>
                  {profile.is_admin && <Pill variant="warn">{t("nav.admin")}</Pill>}
                </dd>
              </div>
            </dl>
          </Card>

          {billing}
          {backup}
          {support}
        </div>
      </div>

      {/* Below lg: sticky save bar, only while there is something to save. */}
      <div className="save-bar lg:hidden" hidden={!dirty && !saving}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">{statusLine}</div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" className="h-11" onClick={discard} disabled={!dirty || saving}>{s("discard")}</Button>
            <Button type="submit" form={formId} variant="primary" className="h-11" loading={saving} disabled={!dirty}>{saveLabel}</Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={shareConfirm === "regenerate"}
        title={s("regenerateTitle")}
        body={s("regenerateBody")}
        confirmLabel={s("regenerateConfirm")}
        tone="danger"
        pending={shareBusy}
        locale={locale}
        onConfirm={() => createOrRotate(true)}
        onCancel={() => { if (!shareBusy) setShareConfirm(null); }}
      />
      <ConfirmDialog
        open={shareConfirm === "revoke"}
        title={s("revokeTitle")}
        body={s("revokeBody")}
        confirmLabel={s("revokeConfirm")}
        tone="danger"
        pending={shareBusy}
        locale={locale}
        onConfirm={revoke}
        onCancel={() => { if (!shareBusy) setShareConfirm(null); }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Switch — same control as the flight form's cross-country toggle           */
/* ------------------------------------------------------------------------ */

function Switch({
  id, checked, onChange, children, "aria-describedby": describedBy,
}: {
  id?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  "aria-describedby"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-describedby={describedBy}
      onClick={() => onChange(!checked)}
      className={`inline-flex min-h-11 sm:min-h-10 max-w-full items-start gap-3 rounded-control -mx-1 px-1 py-1 text-left text-sm text-ink-1 cursor-pointer select-none ${FOCUS_RING}`}
    >
      <span
        aria-hidden
        className={`relative mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors duration-fast ease-out motion-reduce:transition-none ${
          checked ? "bg-brand border-brand" : "bg-surface-2 border-border-strong"
        }`}
      >
        <span
          className={`absolute left-0.5 h-5 w-5 rounded-full bg-surface shadow-sm transition-transform duration-fast ease-out motion-reduce:transition-none ${
            checked ? "translate-x-3.5" : ""
          }`}
        />
      </span>
      <span className="min-w-0 font-medium">{children}</span>
    </button>
  );
}
