"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { Alert, Button, Field, buttonClass } from "@/components/ui";
import { recoveryStrings } from "@/app/auth/recovery-strings";
import { MIN_PASSWORD_LENGTH } from "@/app/auth/recovery";
import type { Locale } from "@/lib/i18n";
import { updatePassword, type ResetPasswordResult } from "./actions";

/** `.input` / `.btn` are h-10; phones get the 44px touch target. */
const CONTROL = "h-11 sm:h-10";

type FieldErrors = { password?: string; confirm?: string };

/**
 * Two password fields, matched client-side before the round trip and again in
 * the server action (the client check is a courtesy, not the rule).
 *
 * Outcomes:
 *   success  — the action redirects to /app?password=updated, so nothing
 *              returns here and the form simply unmounts.
 *   expired  — the recovery session died mid-form; swap the whole form for the
 *              "ask for a new link" dead end rather than letting the pilot
 *              retype a password that can't be saved.
 *   others   — an Alert above the form that takes focus.
 */
export default function ResetPasswordForm({ locale }: { locale: Locale }) {
  const s = recoveryStrings(locale);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<ResetPasswordResult["status"] | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const errorRef = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  // A submit handler rather than the `action` prop: React 19 resets an
  // uncontrolled form once a form action returns, which would clear both
  // password fields on every recoverable error.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(null);
      setFieldErrors({ password: s("tooShort", { n: MIN_PASSWORD_LENGTH }) });
      passwordRef.current?.focus();
      return;
    }
    if (password !== confirm) {
      setFormError(null);
      setFieldErrors({ confirm: s("mismatch") });
      confirmRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setFormError(null); // drop the previous attempt's alert while this one runs
    startTransition(async () => {
      const result = await updatePassword(formData);
      // Success never lands here — the action redirects.
      if (result.status === "short") {
        setFieldErrors({ password: s("tooShort", { n: MIN_PASSWORD_LENGTH }) });
        passwordRef.current?.focus();
        return;
      }
      if (result.status === "mismatch") {
        setFieldErrors({ confirm: s("mismatch") });
        confirmRef.current?.focus();
        return;
      }
      setFormError(result.status);
    });
  }

  if (formError === "expired") {
    return (
      <div className="space-y-4">
        <div
          ref={errorRef}
          tabIndex={-1}
          className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <Alert variant="warn" title={s("expiredTitle")}>{s("expiredBody")}</Alert>
        </div>
        <Link href="/forgot-password" className={buttonClass("primary", "md", `w-full ${CONTROL}`)}>
          {s("requestNewLink")}
        </Link>
      </div>
    );
  }

  const alertBody =
    formError === "same" ? s("samePassword")
      : formError === "weak" ? s("weakPassword")
        : s("updateFailedBody");

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending || undefined} className="space-y-4">
      {formError && (
        <div
          ref={errorRef}
          tabIndex={-1}
          className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bad/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <Alert variant="bad" title={s("updateFailedTitle")}>{alertBody}</Alert>
        </div>
      )}

      <Field
        label={s("newPassword")}
        hint={s("lengthHint", { n: MIN_PASSWORD_LENGTH })}
        error={fieldErrors.password}
        required
      >
        <input
          ref={passwordRef}
          className={`input ${CONTROL}`}
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          autoFocus
          onChange={() => fieldErrors.password && setFieldErrors({})}
        />
      </Field>

      <Field label={s("confirmPassword")} error={fieldErrors.confirm} required>
        <input
          ref={confirmRef}
          className={`input ${CONTROL}`}
          type="password"
          name="confirm"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          onChange={() => fieldErrors.confirm && setFieldErrors({})}
        />
      </Field>

      <Button type="submit" variant="primary" className={`w-full ${CONTROL}`} loading={pending}>
        {pending ? s("saving") : s("savePassword")}
      </Button>

      <p className="text-xs text-ink-3 text-center">{s("signOutNote")}</p>
    </form>
  );
}
