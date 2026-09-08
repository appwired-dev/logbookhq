"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { Alert, Button, Field } from "@/components/ui";
import { recoveryStrings } from "@/app/auth/recovery-strings";
import { looksLikeEmail } from "@/app/auth/recovery";
import type { Locale } from "@/lib/i18n";
import { requestPasswordReset, type ForgotPasswordResult } from "./actions";

/** `.input` / `.btn` are h-10; phones get the 44px touch target. */
const CONTROL = "h-11 sm:h-10";
const LINK =
  "text-brand hover:underline rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

type Outcome = Extract<ForgotPasswordResult, { status: "sent" | "cooldown" | "error" }>["status"];

/**
 * Email field → server action → one of three outcomes, all rendered in place
 * of the form so the page has a single, unambiguous state:
 *
 *   sent      — identical for registered and unregistered addresses.
 *   cooldown  — this browser asked moments ago.
 *   error     — generic; the real reason is in the server logs.
 *
 * The outcome block takes focus so a screen reader lands on the answer rather
 * than back at the top of the form.
 */
export default function ForgotPasswordForm({ locale }: { locale: Locale }) {
  const s = recoveryStrings(locale);
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [submitted, setSubmitted] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const outcomeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (outcome) outcomeRef.current?.focus();
  }, [outcome]);

  // A submit handler rather than the `action` prop: React 19 resets an
  // uncontrolled form once a form action returns, which would wipe the address
  // the pilot just typed every time the outcome is "try again".
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    if (!looksLikeEmail(email)) {
      setFieldError(s("invalidEmail"));
      inputRef.current?.focus();
      return;
    }
    setFieldError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if (result.status === "invalid") {
        setFieldError(s("invalidEmail"));
        inputRef.current?.focus();
        return;
      }
      setSubmitted(email);
      setOutcome(result.status);
    });
  }

  if (outcome) {
    const good = outcome === "sent";
    return (
      <div className="space-y-4">
        <div
          ref={outcomeRef}
          tabIndex={-1}
          className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {outcome === "sent" && (
            <Alert variant="good" title={s("sentTitle")}>{s("sentBody", { email: submitted })}</Alert>
          )}
          {outcome === "cooldown" && (
            <Alert variant="warn" title={s("cooldownTitle")}>{s("cooldownBody")}</Alert>
          )}
          {outcome === "error" && (
            <Alert variant="bad" title={s("sendFailedTitle")}>{s("sendFailedBody")}</Alert>
          )}
        </div>

        {good && (
          <ul className="space-y-1.5 text-xs text-ink-3">
            <li>{s("sameDeviceHint")}</li>
            <li>{s("sentHint")}</li>
          </ul>
        )}

        <Button
          variant={good ? "default" : "primary"}
          className={`w-full ${CONTROL}`}
          onClick={() => setOutcome(null)}
        >
          {s("sendAnother")}
        </Button>
        <p className="text-sm text-ink-3 text-center">
          <Link href="/login" className={LINK}>{s("backToSignIn")}</Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending || undefined} className="space-y-4">
      <Field label={s("emailLabel")} hint={s("emailHint")} error={fieldError} required>
        <input
          ref={inputRef}
          className={`input ${CONTROL}`}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          defaultValue={submitted}
          onChange={() => fieldError && setFieldError(null)}
        />
      </Field>

      <Button type="submit" variant="primary" className={`w-full ${CONTROL}`} loading={pending}>
        {pending ? s("sending") : s("sendLink")}
      </Button>

      <p className="text-sm text-ink-3 text-center">
        <Link href="/login" className={LINK}>{s("backToSignIn")}</Link>
      </p>
    </form>
  );
}
