/**
 * One-off check: list Supabase Storage buckets and confirm the ones the app
 * expects ("documents" and "avatars") exist.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const raw = readFileSync(resolve(".env.local"), "utf8");
for (const line of raw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) { console.error("List failed:", error.message); process.exit(1); }
  console.log("Buckets in this project:");
  for (const b of buckets ?? []) {
    console.log(`  - ${b.name}  (public=${b.public}, created ${b.created_at})`);
  }
  const needed = ["documents", "avatars"];
  for (const n of needed) {
    const ok = buckets?.some((b) => b.name === n);
    console.log(`  Need "${n}": ${ok ? "OK ✓" : "MISSING ✗"}`);
  }
}
main();
