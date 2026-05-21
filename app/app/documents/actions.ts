"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DocumentType } from "@/lib/types";

const ALLOWED_TYPES: DocumentType[] = [
  "MEDICAL", "LICENSE", "TYPE_RATING", "IPC", "RECURRENT", "PASSPORT", "VISA", "OTHER",
];

/**
 * All storage calls are wrapped in try/catch — the Supabase storage SDK can
 * THROW (not just return `{ error }`) on network failures, expired tokens, or
 * 5xx responses. Without the wrapper, those throws bubble through the server
 * action to the client as an unhandled rejection — Sentry captures them as
 * "Error: An unexpected response was received from the server.", which we saw
 * in production. Returning a structured error keeps the UI in friendly-alert
 * territory instead.
 */
function failure(prefix: string, e: unknown): { error: string } {
  const msg = e instanceof Error ? e.message : String(e);
  return { error: `${prefix}: ${msg}` };
}

export async function createDocument(formData: FormData) {
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Pick a file" };
    if (file.size > 10 * 1024 * 1024) return { error: "Max 10 MB" };

    const docType = String(formData.get("doc_type") ?? "OTHER") as DocumentType;
    if (!ALLOWED_TYPES.includes(docType)) return { error: "Invalid doc type" };

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "Name required" };

    const reference = String(formData.get("reference") ?? "").trim() || null;
    const issued_on = String(formData.get("issued_on") ?? "").trim() || null;
    const expires_on = String(formData.get("expires_on") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not signed in" };

    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `${user.id}/${docType.toLowerCase()}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage.from("documents").upload(path, buffer, {
      contentType: file.type, upsert: false,
    });
    if (upErr) return { error: `Upload failed: ${upErr.message}` };

    const { error: dbErr } = await supabase.from("documents").insert({
      user_id: user.id,
      doc_type: docType,
      name, reference, issued_on, expires_on, notes,
      storage_path: path,
      mime_type: file.type,
    });
    if (dbErr) {
      // Roll back the uploaded file if the DB row insert failed.
      await supabase.storage.from("documents").remove([path]).catch(() => {});
      return { error: `DB insert failed: ${dbErr.message}` };
    }

    revalidatePath("/app/documents");
    revalidatePath("/app");
    return { ok: true };
  } catch (e) {
    return failure("Upload failed", e);
  }
}

export async function deleteDocument(id: number, storagePath: string) {
  try {
    const supabase = await createClient();
    // Storage remove failure shouldn't block DB delete — if the file is
    // already gone, we still want to clean up the metadata row.
    await supabase.storage.from("documents").remove([storagePath]).catch(() => {});
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/app/documents");
    revalidatePath("/app");
    return { ok: true };
  } catch (e) {
    return failure("Delete failed", e);
  }
}

export async function signedUrlFor(storagePath: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(storagePath, 60 * 10);
    if (error) return { error: error.message };
    if (!data?.signedUrl) return { error: "Could not generate signed URL (file may have been removed)." };
    return { url: data.signedUrl };
  } catch (e) {
    return failure("Could not load file", e);
  }
}
