/**
 * Idempotent loader for the public.airports reference table (migration 0020).
 * Reads data/airports.json and upserts it in batches. Needs a service-role key
 * (bypasses RLS). Same .env.local fallback pattern as scripts/seed-admin.ts.
 *
 *   # local Supabase (uses .env.local):
 *   npx tsx scripts/load-airports.ts
 *
 *   # production (key stays in your shell; get it from Supabase → Settings → API):
 *   SUPABASE_URL=https://gxphjnkjayfeocuebokh.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role key> \
 *   npx tsx scripts/load-airports.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local manually (no dotenv dep) — only fills vars not already set,
// so explicit SUPABASE_URL/KEY in the shell win (that's how you target prod).
try {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
} catch { /* no .env.local — rely on shell env */ }

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY (shell env or .env.local).");
  process.exit(1);
}

interface Raw { lat: number; lon: number; name: string; country: string }

async function main() {
  const data = JSON.parse(
    readFileSync(resolve(process.cwd(), "data/airports.json"), "utf8"),
  ) as Record<string, Raw>;
  const rows = Object.entries(data).map(([code, a]) => ({
    code, lat: a.lat, lon: a.lon, name: a.name ?? "", country: a.country ?? "",
  }));
  console.log(`Loading ${rows.length} airports into ${url}`);

  const supabase = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });
  const CHUNK = 1000;
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from("airports").upsert(slice, { onConflict: "code" });
    if (error) { console.error(`\nBatch ${i}-${i + slice.length} failed: ${error.message}`); process.exit(1); }
    done += slice.length;
    process.stdout.write(`\r  ${done}/${rows.length}`);
  }
  console.log(`\nDone — ${done} airports upserted.`);
}
main();
