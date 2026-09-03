"use client";

import { useState, useTransition } from "react";
import { updateProfile, uploadAvatar } from "./actions";
import { generateShareToken, revokeShareToken } from "./share-actions";
import { REGIME_RULES, type Regime } from "@/lib/currency-rules";
import { makeT, type Locale } from "@/lib/i18n";

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

export default function SettingsForm({ profile, locale }: { profile: Profile; locale: Locale }) {
  const t = makeT(locale);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [uploading, setUploading] = useState(false);
  const [shareToken, setShareToken] = useState(profile.share_token);
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = shareToken
    ? (typeof window !== "undefined" ? `${window.location.origin}/share/${shareToken}` : `/share/${shareToken}`)
    : null;

  async function onGenerate() {
    setShareBusy(true);
    try {
      const r = await generateShareToken();
      if (r.token) setShareToken(r.token);
    } finally {
      setShareBusy(false);
    }
  }

  async function onRevoke() {
    if (!confirm(locale === "ko" ? "공유 링크를 해지하시겠습니까?" : locale === "zh" ? "撤销共享链接?" : locale === "es" ? "¿Revocar el enlace de compartir?" : "Revoke the share link?")) return;
    setShareBusy(true);
    try {
      await revokeShareToken();
      setShareToken(null);
    } finally {
      setShareBusy(false);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const r = await uploadAvatar(fd);
      if (r.error) setErr(r.error);
      else if (r.url) setAvatarUrl(r.url);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("settings.title")}</h1>
      </div>

      <form
        action={(fd) => {
          setMsg(null); setErr(null);
          startTransition(async () => {
            const r = await updateProfile(fd);
            if (r?.error) setErr(r.error);
            else setMsg(t("settings.saved"));
          });
        }}
        className="card overflow-hidden"
      >
        <div className="bg-gradient-to-br from-slate-50 to-sky-50/40 px-4 py-2.5 border-b border-slate-200/60">
          <h2 className="text-sm font-bold text-slate-800">{t("settings.profile")}</h2>
        </div>

        {/* Avatar */}
        <div className="px-4 pt-4 flex items-center gap-4">
          <div className="relative w-20 h-20 rounded-full overflow-hidden bg-slate-200 ring-2 ring-white shadow-md flex items-center justify-center text-slate-500 text-xl font-bold">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              (profile.full_name ?? profile.email).slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="flex-1">
            <label className="label">{t("settings.avatar")}</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onAvatarChange}
              disabled={uploading}
              className="block text-sm text-slate-700"
            />
            {uploading && <span className="ml-2 text-sky-600 text-xs">{t("docs.uploading")}</span>}
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">{t("settings.fullName")}</label>
            <input className="input" name="full_name" defaultValue={profile.full_name ?? ""} placeholder="Terrence Lin" />
          </div>
          <div>
            <label className="label">{t("settings.licenseNum")}</label>
            <input className="input" name="license_number" defaultValue={profile.license_number ?? ""} placeholder={t("export.licensePh")} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">{t("settings.primaryRegime")}</label>
            <select className="input" name="primary_regime" defaultValue={profile.primary_regime}>
              {(Object.keys(REGIME_RULES) as Regime[]).map((r) => (
                <option key={r} value={r}>
                  {r} — {REGIME_RULES[r].name} ({REGIME_RULES[r].reference})
                </option>
              ))}
            </select>
          </div>
          <label className="sm:col-span-2 flex items-start gap-2 text-sm text-slate-700 pt-1">
            <input type="checkbox" name="aug_half_credit" defaultChecked={profile.aug_half_credit} className="mt-0.5" />
            <span>
              <span className="font-medium">{t("settings.augCredit")}</span>
              <span className="block text-xs text-slate-500">{t("settings.augCreditHint")}</span>
            </span>
          </label>
        </div>
        <div className="px-4 py-3 border-t border-slate-200/60 flex items-center gap-3">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? t("common.saving") : t("common.save")}
          </button>
          {msg && <span className="text-sm text-emerald-700">{msg}</span>}
          {err && <span className="text-sm text-rose-600">{err}</span>}
        </div>
      </form>

      {/* Public read-only share link */}
      <div className="card p-4 space-y-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">
            {locale === "ko" ? "공유 링크" : locale === "zh" ? "共享链接" : locale === "es" ? "Enlace para Compartir" : "Public Share Link"}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {locale === "ko"
              ? "검사관, 고용주, 보험사에 보낼 수 있는 읽기 전용 로그북 스냅샷 URL."
              : locale === "zh"
                ? "可发给检查员、雇主或保险公司的只读飞行日志快照 URL。"
                : locale === "es"
                  ? "URL de instantánea de solo lectura para examinadores, empleadores o seguros."
                  : "Read-only logbook snapshot URL you can hand to an examiner, employer, or insurer. Rotate to invalidate."}
          </p>
        </div>
        {shareUrl ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="input flex-1 font-mono text-xs"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button type="button" className="btn whitespace-nowrap" onClick={copyShareUrl}>
                {copied ? "✓" : (locale === "ko" ? "복사" : locale === "zh" ? "复制" : locale === "es" ? "Copiar" : "Copy")}
              </button>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn text-xs" disabled={shareBusy} onClick={onGenerate}>
                {locale === "ko" ? "새 토큰 발급 (기존 무효화)" : locale === "zh" ? "重新生成 (使旧链接失效)" : locale === "es" ? "Regenerar (invalida el anterior)" : "Regenerate (invalidates current)"}
              </button>
              <button type="button" className="btn btn-danger text-xs" disabled={shareBusy} onClick={onRevoke}>
                {locale === "ko" ? "해지" : locale === "zh" ? "撤销" : locale === "es" ? "Revocar" : "Revoke"}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-primary" disabled={shareBusy} onClick={onGenerate}>
            {locale === "ko" ? "공유 링크 생성" : locale === "zh" ? "创建共享链接" : locale === "es" ? "Crear enlace de compartir" : "Create share link"}
          </button>
        )}
      </div>

      <div className="card p-4 space-y-2">
        <h2 className="text-sm font-bold text-slate-800">{t("settings.account")}</h2>
        <Row k={t("settings.email")} v={profile.email} />
        <Row k={t("settings.tier")} v={<span className="font-bold uppercase">{profile.tier}</span>} />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm border-b border-slate-100 pb-1.5 last:border-0">
      <span className="text-slate-500">{k}</span>
      <span className="text-slate-800">{v}</span>
    </div>
  );
}
