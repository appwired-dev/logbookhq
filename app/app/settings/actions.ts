"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { REGIME_RULES } from "@/lib/currency-rules";

export async function updateProfile(formData: FormData) {
  const full_name = String(formData.get("full_name") ?? "").trim() || null;
  const license_number = String(formData.get("license_number") ?? "").trim() || null;
  const primary_regime = String(formData.get("primary_regime") ?? "CA");

  // Validate against the single source of truth so adding a regime to
  // REGIME_RULES is all that's needed for it to be selectable.
  if (!Object.keys(REGIME_RULES).includes(primary_regime)) {
    return { error: "Invalid regime" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name, license_number, primary_regime })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Upload a profile avatar to the public `avatars` bucket in Supabase Storage
 * and write its public URL back to profiles.avatar_url.
 *
 * Requires the bucket to exist:
 *   Supabase → Storage → New bucket → name "avatars" → public.
 */
// Avatar bucket is public, so we want to be strict about what can land there.
// Anything not in this allowlist gets rejected even if the browser's `accept`
// attr is bypassed; the bucket would otherwise serve arbitrary user-uploaded
// files (HTML, SVG with scripts, etc.) from a *.supabase.co origin.
const AVATAR_MIME_ALLOW = new Set(["image/png", "image/jpeg", "image/webp"]);
const AVATAR_EXT_ALLOW = new Set(["png", "jpg", "jpeg", "webp"]);

export async function uploadAvatar(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No file" };
  if (file.size > 2 * 1024 * 1024) return { error: "Max 2 MB" };
  if (!AVATAR_MIME_ALLOW.has(file.type)) {
    return { error: "Avatar must be a PNG, JPEG, or WebP image." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const rawExt = file.name.split(".").pop()?.toLowerCase() || "png";
  // Pin the extension to the allowlist too — `file.type` is the source of
  // truth, but we don't want to store `../something.html` as a filename.
  const ext = AVATAR_EXT_ALLOW.has(rawExt) ? rawExt : "png";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from("avatars").upload(path, buffer, {
    contentType: file.type, upsert: true,
  });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };

  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
  const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
  if (dbErr) return { error: `DB update failed: ${dbErr.message}` };

  revalidatePath("/", "layout");
  return { ok: true, url: publicUrl };
}
