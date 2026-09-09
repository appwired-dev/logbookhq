"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button, Card, CardHeader, Field } from "@/components/ui";

const T = {
  en: {
    title: "Sign-in & security", desc: "Change the email or password you sign in with.",
    email: "Email address", emailHint: "We'll send a confirmation link to the new address — the change takes effect once you click it.",
    updateEmail: "Update email", emailSent: "Check your new inbox to confirm the change.", emailSame: "That's already your email.",
    currentPw: "Current password", newPw: "New password", confirmPw: "Confirm new password",
    pwHint: "At least 8 characters.", updatePw: "Update password",
    pwUpdated: "Password updated.", pwMismatch: "The new passwords don't match.", pwShort: "Use at least 8 characters.",
    wrongCurrent: "Current password is incorrect.",
  },
  ko: {
    title: "로그인 및 보안", desc: "로그인에 사용하는 이메일 또는 비밀번호를 변경합니다.",
    email: "이메일 주소", emailHint: "새 주소로 확인 링크를 보냅니다 — 링크를 클릭하면 변경이 적용됩니다.",
    updateEmail: "이메일 변경", emailSent: "새 받은편지함에서 변경을 확인하세요.", emailSame: "이미 사용 중인 이메일입니다.",
    currentPw: "현재 비밀번호", newPw: "새 비밀번호", confirmPw: "새 비밀번호 확인",
    pwHint: "8자 이상.", updatePw: "비밀번호 변경",
    pwUpdated: "비밀번호가 변경되었습니다.", pwMismatch: "새 비밀번호가 일치하지 않습니다.", pwShort: "8자 이상 사용하세요.",
    wrongCurrent: "현재 비밀번호가 올바르지 않습니다.",
  },
  zh: {
    title: "登录与安全", desc: "更改用于登录的邮箱或密码。",
    email: "邮箱地址", emailHint: "我们会向新地址发送确认链接 — 点击后更改生效。",
    updateEmail: "更新邮箱", emailSent: "请在新邮箱中确认更改。", emailSame: "这已经是您的邮箱。",
    currentPw: "当前密码", newPw: "新密码", confirmPw: "确认新密码",
    pwHint: "至少 8 个字符。", updatePw: "更新密码",
    pwUpdated: "密码已更新。", pwMismatch: "两次输入的新密码不一致。", pwShort: "请至少使用 8 个字符。",
    wrongCurrent: "当前密码不正确。",
  },
  es: {
    title: "Acceso y seguridad", desc: "Cambia el correo o la contraseña con la que inicias sesión.",
    email: "Correo electrónico", emailHint: "Enviaremos un enlace de confirmación a la nueva dirección; el cambio se aplica al hacer clic.",
    updateEmail: "Actualizar correo", emailSent: "Revisa tu nueva bandeja para confirmar el cambio.", emailSame: "Ese ya es tu correo.",
    currentPw: "Contraseña actual", newPw: "Nueva contraseña", confirmPw: "Confirmar nueva contraseña",
    pwHint: "Al menos 8 caracteres.", updatePw: "Actualizar contraseña",
    pwUpdated: "Contraseña actualizada.", pwMismatch: "Las nuevas contraseñas no coinciden.", pwShort: "Usa al menos 8 caracteres.",
    wrongCurrent: "La contraseña actual es incorrecta.",
  },
} as const;

type Msg = { tone: "good" | "bad"; text: string } | null;

export default function AccountSecurityCard({ currentEmail, locale }: { currentEmail: string; locale: Locale }) {
  const t = T[locale] ?? T.en;
  const supabase = createClient();
  const [emailMsg, setEmailMsg] = useState<Msg>(null);
  const [emailPending, startEmail] = useTransition();
  const [pwMsg, setPwMsg] = useState<Msg>(null);
  const [pwPending, startPw] = useTransition();

  function onEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setEmailMsg(null);
    if (email.toLowerCase() === currentEmail.toLowerCase()) { setEmailMsg({ tone: "bad", text: t.emailSame }); return; }
    startEmail(async () => {
      const { error } = await supabase.auth.updateUser({ email });
      setEmailMsg(error ? { tone: "bad", text: error.message } : { tone: "good", text: t.emailSent });
    });
  }

  function onPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const current = String(fd.get("current") ?? "");
    const next = String(fd.get("next") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    setPwMsg(null);
    if (next.length < 8) { setPwMsg({ tone: "bad", text: t.pwShort }); return; }
    if (next !== confirm) { setPwMsg({ tone: "bad", text: t.pwMismatch }); return; }
    startPw(async () => {
      // Verify the current password (defence against a hijacked session) before
      // changing it — Supabase's updateUser doesn't require the old one.
      const { error: reauth } = await supabase.auth.signInWithPassword({ email: currentEmail, password: current });
      if (reauth) { setPwMsg({ tone: "bad", text: t.wrongCurrent }); return; }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) { setPwMsg({ tone: "bad", text: error.message }); return; }
      form.reset();
      setPwMsg({ tone: "good", text: t.pwUpdated });
    });
  }

  return (
    <Card padding="md">
      <CardHeader title={t.title} meta={t.desc} />

      <form onSubmit={onEmail} className="space-y-2.5">
        <Field label={t.email} hint={t.emailHint}>
          <input className="input" type="email" name="email" autoComplete="email" defaultValue={currentEmail} required />
        </Field>
        {emailMsg && <Alert variant={emailMsg.tone}>{emailMsg.text}</Alert>}
        <Button type="submit" variant="default" loading={emailPending}>{t.updateEmail}</Button>
      </form>

      <hr className="my-5 border-border" />

      <form onSubmit={onPassword} className="space-y-2.5">
        <Field label={t.currentPw}>
          <input className="input" type="password" name="current" autoComplete="current-password" required />
        </Field>
        <Field label={t.newPw} hint={t.pwHint}>
          <input className="input" type="password" name="next" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label={t.confirmPw}>
          <input className="input" type="password" name="confirm" autoComplete="new-password" minLength={8} required />
        </Field>
        {pwMsg && <Alert variant={pwMsg.tone}>{pwMsg.text}</Alert>}
        <Button type="submit" variant="default" loading={pwPending}>{t.updatePw}</Button>
      </form>
    </Card>
  );
}
