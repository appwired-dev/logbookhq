/**
 * Create or upgrade an admin (master) user.
 *
 * Usage:
 *   npm run seed:admin -- you@example.com
 *
 *   You'll be prompted for the password (input is masked, not stored anywhere).
 *
 * Or non-interactive (good for CI but watch your shell history):
 *   ADMIN_PASSWORD='...' npm run seed:admin -- you@example.com
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local. The service-role key
 * bypasses RLS — never expose it to the client.
 */
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local manually (no dotenv dep).
const envPath = resolve(".env.local");
try {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
} catch {
  console.error("Could not read .env.local. Create it from .env.example first.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey || url.includes("placeholder") || serviceKey.includes("placeholder")) {
  console.error("Missing real SUPABASE_URL or SERVICE_ROLE_KEY in .env.local. See SETUP.md.");
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run seed:admin -- <email>");
  process.exit(1);
}

async function readPassword(): Promise<string> {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;

  return new Promise((res) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write("Admin password (input hidden): ");

    // Mask input by intercepting writes.
    const stdin = process.stdin as NodeJS.ReadStream & { isRaw?: boolean };
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let pw = "";
    const onData = (ch: string) => {
      if (ch === "\n" || ch === "\r" || ch === "") {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        rl.close();
        res(pw);
      } else if (ch === "") {
        process.exit(130);
      } else if (ch === "") {
        pw = pw.slice(0, -1);
      } else {
        pw += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const admin = createClient(url!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } });

  // Look for existing user by email.
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  let userId: string;
  if (existing) {
    console.log(`User ${email} already exists (${existing.id}). Promoting only — password unchanged.`);
    userId = existing.id;
  } else {
    // Only need a password when creating a fresh user.
    const password = await readPassword();
    if (password.length < 8) {
      console.error("Password must be at least 8 characters.");
      process.exit(1);
    }
    console.log(`Creating user ${email}.`);
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (error || !data.user) { console.error(error?.message); process.exit(1); }
    userId = data.user.id;
  }

  // Promote to admin + lifetime tier.
  const { error: pErr } = await admin
    .from("profiles")
    .upsert({ id: userId, email, is_admin: true, tier: "lifetime" }, { onConflict: "id" });
  if (pErr) { console.error(pErr.message); process.exit(1); }

  console.log(`OK. ${email} is now master (is_admin=true, tier=lifetime).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
