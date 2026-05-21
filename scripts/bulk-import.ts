/**
 * One-off CSV bulk-import via service-role key. Bypasses RLS + HTTP timeouts.
 *
 * Usage:
 *   npm run import:bulk -- <email> <path/to/csv>
 *
 * Wipes the user's existing flights then bulk-inserts from CSV in small batches.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { importCsvText } from "../lib/csv.js";

const envPath = resolve(".env.local");
try {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
} catch {
  console.error("Could not read .env.local");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  process.exit(1);
}

const email = process.argv[2];
const csvPath = process.argv[3];
if (!email || !csvPath) {
  console.error("Usage: npm run import:bulk -- <email> <path/to/csv>");
  process.exit(1);
}

const BATCH = 100;

async function main() {
  const admin = createClient(url!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: list } = await admin.auth.admin.listUsers();
  const user = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) { console.error(`No user with email ${email}`); process.exit(1); }
  console.log(`User ${email} (${user.id})`);

  const text = readFileSync(resolve(csvPath), "utf8");
  const parsed = importCsvText(text);
  console.log(`Parsed ${parsed.length} flights from ${csvPath}`);

  console.log("Deleting existing flights for user...");
  const { error: delErr } = await admin.from("flights").delete().eq("user_id", user.id);
  if (delErr) { console.error(`Delete failed: ${delErr.message}`); process.exit(1); }

  console.log(`Inserting in batches of ${BATCH}...`);
  let inserted = 0;
  for (let i = 0; i < parsed.length; i += BATCH) {
    const slice = parsed.slice(i, i + BATCH).map((f) => ({ ...f, user_id: user.id }));
    const { error } = await admin.from("flights").insert(slice);
    if (error) {
      console.error(`Insert failed at row ${i}: ${error.message}`);
      console.log(`Successfully inserted ${inserted} rows before failure.`);
      process.exit(1);
    }
    inserted += slice.length;
    process.stdout.write(`\r  ${inserted} / ${parsed.length}`);
  }
  process.stdout.write("\n");
  console.log(`Done. ${inserted} flights now in Supabase for ${email}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
