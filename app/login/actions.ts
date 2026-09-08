"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/app/auth/recovery";

/**
 * Turn a Supabase auth error into something a user can act on. The captcha
 * case matters here: if the security check didn't complete (widget still
 * solving, blocked, or expired) Supabase rejects the whole request, and the
 * raw "captcha verification process failed" reads like a server fault. Tell
 * the user to complete the check and retry instead.
 */
function friendlyAuthError(error: { message: string; code?: string }): string {
  const m = error.message.toLowerCase();
  if (error.code === "captcha_failed" || m.includes("captcha")) {
    return "Please complete the security check and try again.";
  }
  return error.message;
}

/**
 * Accept only same-origin relative paths.
 *
 * The URL parser strips ASCII tab/LF/CR before parsing, so a raw
 * `startsWith("//")` test is bypassable with `/\t/evil.com` — which resolved
 * to https://evil.com and made `?next=` on this page an open redirect. Strip
 * those characters, then parse and keep the result only if it stayed on the
 * throwaway base. Shared implementation lives in `app/auth/recovery.ts`.
 */

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/app"));
  const captchaToken = String(formData.get("cf-turnstile-response") ?? "") || undefined;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });
  if (error) return { error: friendlyAuthError(error) };

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "");

  const captchaToken = String(formData.get("cf-turnstile-response") ?? "") || undefined;
  const supabase = await createClient();
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, captchaToken },
  });
  if (error) return { error: friendlyAuthError(error) };

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/app");
  }

  // Email confirmation required — show a success message instead of redirecting.
  return { ok: true, message: "Check your email to confirm your account." };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
