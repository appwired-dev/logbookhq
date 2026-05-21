import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const raw = readFileSync(resolve(".env.local"), "utf8");
for (const line of raw.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const code = process.argv[2] ?? "CPL";

async function main() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await admin.from("flights")
    .select("date,make_model,route,remarks")
    .like("route", `%${code}%`)
    .limit(20);
  console.log(`Flights with "${code}" in route:`, data?.length);
  for (const r of data ?? []) console.log(r);
}
main();
