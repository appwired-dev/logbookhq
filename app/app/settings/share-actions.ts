"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Generate (or rotate) the user's public share token. Returns the new
 * token so the UI can show the share URL immediately.
 *
 * Rotating is the only way to invalidate an existing share link — the URL
 * IS the secret. There's no per-recipient access; if you need to revoke
 * for one viewer you have to rotate and re-share with the others.
 */
export async function generateShareToken(): Promise<{ token?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const token = randomBytes(18).toString("base64url"); // ~24 chars, URL-safe
  const { error } = await supabase
    .from("profiles")
    .update({ share_token: token })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/app/settings");
  return { token };
}

/** Wipe the share token so the public URL stops working. */
export async function revokeShareToken(): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { error } = await supabase
    .from("profiles")
    .update({ share_token: null })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/app/settings");
  return { ok: true };
}
