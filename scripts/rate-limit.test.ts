/**
 * Unit tests for the auth rate limiter's pure core.
 *
 *   npm run test:rate
 *
 * Covers the pieces that need no database:
 *   1. Bucket-key construction — the two independent dimensions (IP, email)
 *      and email normalisation, so casing/whitespace can't split a counter.
 *   2. `underLimitWith` fail-open behaviour — a thrown RPC, an error result,
 *      or a surprising shape all resolve to "allowed"; only an explicit
 *      `false` blocks. A fake client is injected; no live database is touched.
 *
 * The DB-backed math (window start, on-conflict increment) lives in SQL
 * (supabase/migrations/0013_auth_rate_limit.sql) and is not exercised here.
 *
 * These import lib/rate-limit-core (no `server-only` marker), NOT
 * lib/rate-limit — the latter's `import "server-only"` cannot resolve outside
 * Next.js.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  bucketKey,
  normalizeEmailForBucket,
  underLimitWith,
  type RateLimitClient,
} from "../lib/rate-limit-core";

let passed = 0;
let failed = 0;
const pending: Promise<void>[] = [];

function test(name: string, fn: () => void | Promise<void>): void {
  pending.push(
    Promise.resolve()
      .then(fn)
      .then(() => {
        passed++;
        console.log(`PASS  ${name}`);
      })
      .catch((e) => {
        failed++;
        console.log(`FAIL  ${name}`);
        console.log(`      ${e instanceof Error ? e.message : String(e)}\n`);
      }),
  );
}

// A client whose rpc always resolves to a fixed shape.
function clientReturning(result: { data: unknown; error: unknown }): RateLimitClient {
  return { rpc: async () => result };
}

// A client whose rpc rejects — simulates the DB being unreachable.
function clientThrowing(message: string): RateLimitClient {
  return {
    rpc: async () => {
      throw new Error(message);
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Bucket-key construction
// ---------------------------------------------------------------------------

test("bucketKey composes scope:dimension:value for IPs verbatim", () => {
  assert.equal(bucketKey("login", "ip", "1.2.3.4"), "login:ip:1.2.3.4");
  assert.equal(bucketKey("signup", "ip", "unknown"), "signup:ip:unknown");
  assert.equal(bucketKey("pwreset", "ip", "2001:db8::1"), "pwreset:ip:2001:db8::1");
  assert.equal(bucketKey("pwupdate", "ip", "203.0.113.9"), "pwupdate:ip:203.0.113.9");
});

test("bucketKey normalises the email dimension so casing can't split the bucket", () => {
  const canonical = "login:email:pilot@example.com";
  assert.equal(bucketKey("login", "email", "pilot@example.com"), canonical);
  assert.equal(bucketKey("login", "email", "PILOT@EXAMPLE.COM"), canonical);
  assert.equal(bucketKey("login", "email", "  Pilot@Example.Com  "), canonical);
  assert.equal(bucketKey("pwreset", "email", "Foo@Bar.CA"), "pwreset:email:foo@bar.ca");
});

test("normalizeEmailForBucket lowercases and trims", () => {
  assert.equal(normalizeEmailForBucket("  ME@Host.IO "), "me@host.io");
  assert.equal(normalizeEmailForBucket("already@lower.com"), "already@lower.com");
});

test("the IP and email dimensions are independent keys", () => {
  const ipKey = bucketKey("login", "ip", "1.2.3.4");
  const emailKey = bucketKey("login", "email", "pilot@example.com");
  assert.notEqual(ipKey, emailKey);
  // The same email under different scopes never collides across endpoints.
  assert.notEqual(
    bucketKey("login", "email", "pilot@example.com"),
    bucketKey("pwreset", "email", "pilot@example.com"),
  );
});

// ---------------------------------------------------------------------------
// 2. underLimitWith — fail OPEN on anything but an explicit `false`
// ---------------------------------------------------------------------------

test("underLimitWith returns true (allowed) when the function returns true", async () => {
  const ok = await underLimitWith(clientReturning({ data: true, error: null }), "b", 5, 900);
  assert.equal(ok, true);
});

test("underLimitWith returns false (blocked) ONLY on an explicit false", async () => {
  const blocked = await underLimitWith(clientReturning({ data: false, error: null }), "b", 5, 900);
  assert.equal(blocked, false);
});

test("underLimitWith fails OPEN when the rpc returns an error", async () => {
  const ok = await underLimitWith(
    clientReturning({ data: null, error: { message: "function check_rate_limit does not exist" } }),
    "b",
    5,
    900,
  );
  assert.equal(ok, true, "a missing/errored RPC must allow, not lock users out");
});

test("underLimitWith fails OPEN when the rpc throws (DB unreachable)", async () => {
  const ok = await underLimitWith(clientThrowing("ECONNREFUSED"), "b", 5, 900);
  assert.equal(ok, true, "a thrown RPC must allow, not lock users out");
});

test("underLimitWith fails OPEN on a surprising (non-boolean) shape", async () => {
  const nullish = await underLimitWith(clientReturning({ data: null, error: null }), "b", 5, 900);
  const undef = await underLimitWith(clientReturning({ data: undefined, error: null }), "b", 5, 900);
  assert.equal(nullish, true);
  assert.equal(undef, true);
});

test("underLimitWith forwards the bucket, max and window to the RPC", async () => {
  let seen: Record<string, unknown> | undefined;
  const client: RateLimitClient = {
    rpc: async (_fn, args) => {
      seen = args;
      return { data: true, error: null };
    },
  };
  await underLimitWith(client, "login:email:pilot@example.com", 8, 900);
  assert.deepEqual(seen, {
    p_bucket: "login:email:pilot@example.com",
    p_max: 8,
    p_window_seconds: 900,
  });
});

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await Promise.all(pending);
  console.log(`\n${passed + failed} test(s) — ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

void main();
test("login is rate-limited by IP only — no attacker-suppliable per-email lockout", () => {
  const src = readFileSync(join(import.meta.dirname, "..", "app/login/actions.ts"), "utf8");
  // The login action must build only an ip bucket. A per-email login limit is a
  // targeted account-lockout weapon (see the 2026-09 review); it must not return.
  assert.ok(/bucketKey\("login", "ip"/.test(src), "login keeps its per-IP limit");
  assert.ok(!/bucketKey\("login", "email"/.test(src), "login must NOT rate-limit per email");
});

