/**
 * One-off route-fix utility. Updates a single flight's route in Supabase
 * (matched by id) for the appwired user.
 *
 * Usage: npm run fix:route -- 2018-07-29 CYVR-CYYQ CYVR-CYQQ
 *   args: date, oldRoute, newRoute
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const raw = readFileSync(resolve(".env.local"), "utf8");
for (const line of raw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const [date, oldRoute, newRoute] = process.argv.slice(2);
if (!date || !oldRoute || !newRoute) {
  console.error("Usage: npm run fix:route -- <date> <oldRoute> <newRoute>");
  process.exit(1);
}

async function main() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: found } = await admin.from("flights")
    .select("id,date,make_model,registration,route,pic,copilot")
    .eq("date", date)
    .eq("route", oldRoute);
  if (!found || found.length === 0) { console.error(`No flight on ${date} with route ${oldRoute}`); process.exit(1); }
  console.log("Match(es):");
  for (const f of found) console.log(" ", f);
  for (const f of found) {
    const { error } = await admin.from("flights").update({ route: newRoute }).eq("id", f.id);
    if (error) { console.error("Update failed:", error.message); process.exit(1); }
    console.log(`Updated flight #${f.id}: ${oldRoute} → ${newRoute}`);
  }
}
main();
