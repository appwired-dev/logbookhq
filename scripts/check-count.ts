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
  const email = "appwired@gmail.com";
  const { data: list } = await admin.auth.admin.listUsers();
  const user = list?.users?.find((u) => u.email?.toLowerCase() === email);
  console.log("user_id:", user?.id);

  const { count } = await admin.from("flights").select("*", { count: "exact", head: true }).eq("user_id", user!.id);
  console.log("count for user:", count);

  const { count: totalCount } = await admin.from("flights").select("*", { count: "exact", head: true });
  console.log("total rows in flights table:", totalCount);

  const { data: latest } = await admin.from("flights").select("date, make_model").eq("user_id", user!.id).order("date", { ascending: false }).limit(3);
  console.log("latest 3:", latest);
}
main();
