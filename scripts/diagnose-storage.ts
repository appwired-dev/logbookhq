/**
 * Diagnose why document uploads are failing with the
 * "new row violates row-level security policy" error.
 *
 * Uses the service role key (which bypasses RLS) to:
 *   1. Confirm the bucket exists and is reachable.
 *   2. Try a test upload to a synthetic user folder.
 *   3. If the upload works as service role but fails for the signed-in user,
 *      the diagnosis is "storage.objects RLS policies are missing".
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

  console.log("1. Bucket check:");
  const { data: buckets } = await admin.storage.listBuckets();
  const docBucket = buckets?.find((b) => b.name === "documents");
  if (!docBucket) { console.log("   ✗ documents bucket missing"); process.exit(1); }
  console.log(`   ✓ documents bucket exists (public=${docBucket.public})`);

  console.log("\n2. Service-role upload test (bypasses RLS):");
  const testPath = `diagnose-${Date.now()}/test.txt`;
  const testBody = new Blob(["diagnostic write"], { type: "text/plain" });
  const { error: upErr } = await admin.storage
    .from("documents").upload(testPath, testBody, { upsert: true });
  if (upErr) {
    console.log(`   ✗ Service-role upload FAILED: ${upErr.message}`);
    console.log("     Bucket config is the problem, not RLS. Check bucket settings.");
    process.exit(1);
  }
  console.log("   ✓ Service-role upload succeeded — bucket itself works");
  await admin.storage.from("documents").remove([testPath]);
  console.log("   ✓ Test file cleaned up");

  console.log("\n3. Diagnosis:");
  console.log("   The bucket works as admin, so the failing user-side upload");
  console.log("   means storage.objects RLS policies are missing for bucket");
  console.log("   'documents'. Apply supabase/migrations/0006_storage_policies.sql");
  console.log("   via the Supabase SQL editor.");
  console.log("");
  console.log("   Dashboard URL:");
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!
    .replace("https://", "").replace(".supabase.co", "");
  console.log(`     https://supabase.com/dashboard/project/${projectRef}/sql/new`);
}
main();
