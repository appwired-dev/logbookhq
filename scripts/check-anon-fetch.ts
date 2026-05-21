/**
 * Simulates what the dashboard fetches — through the anon role (not service role).
 * Verifies if PostgREST's row cap is the issue.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const raw = readFileSync(resolve(".env.local"), "utf8");
for (const line of raw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  // Sign in as the user to get a session JWT, mimicking the dashboard's view.
  const { data: list } = await admin.auth.admin.listUsers();
  const user = list?.users?.find((u) => u.email?.toLowerCase() === "appwired@gmail.com");
  if (!user) { console.error("no user"); process.exit(1); }

  // Use service-role with .range to see if range respected:
  const a = await admin.from("flights").select("id", { count: "exact" }).range(0, 99999);
  console.log(`service+range(0, 99999): returned=${a.data?.length}, count=${a.count}`);

  const b = await admin.from("flights").select("id", { count: "exact" });
  console.log(`service no range: returned=${b.data?.length}, count=${b.count}`);

  const c = await admin.from("flights").select("id").limit(5000);
  console.log(`service limit(5000): returned=${c.data?.length}`);
}
main();
