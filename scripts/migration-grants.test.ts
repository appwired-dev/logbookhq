/**
 * Data API grant guard for supabase/migrations.
 *
 *   npm run test:grants        (also runs before every `npm run build`)
 *
 * From 2026-10-30 Supabase no longer grants new `public` objects to anon /
 * authenticated / service_role automatically, and a database rebuilt from these
 * migrations (preview branch, `supabase db reset`, a new project) creates every
 * object new. An object without explicit grants then answers "permission denied"
 * there while production keeps working, so the gap only shows when it hurts.
 * 0022/0023 made every existing object explicit; this keeps new ones that way:
 *
 *  - every table and view is granted (or deliberately revoked) and reachable by
 *    service_role;
 *  - every serial column's sequence is granted, and to authenticated wherever
 *    authenticated can insert into the table (nextval() runs as the caller);
 *  - every function other than a trigger function is granted or revoked
 *    (triggers are checked for EXECUTE only at CREATE TRIGGER);
 *  - from 0022 on, the grants sit in the same migration as the object.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}`);
    console.log(`      ${e instanceof Error ? e.message : String(e)}\n`);
  }
}

/** Objects created up to this migration were granted afterwards, by 0022/0023. */
const GRANTED_RETROACTIVELY_THROUGH = "0021";

type Migration = { file: string; sql: string };
type Kind = "table" | "sequence" | "function";
type Created = { kind: Kind; name: string; file: string; serials: string[]; trigger: boolean };
type Privilege = { kind: Kind; names: string[]; roles: string[]; privs: string; grant: boolean; file: string };

/** Lower-case SQL with comments and dollar-quoted bodies removed, split into statements. */
function statements(sql: string): string[] {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\$([a-z_]*)\$[\s\S]*?\$\1\$/gi, "$$body$$")
    .toLowerCase()
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** `public.x` or a bare `x` (search_path puts it in public); null for any other schema. */
function publicName(ref: string): string | null {
  const r = ref.trim();
  if (r.includes(".") && !/^"?public"?\./.test(r)) return null;
  return /^(?:"?public"?\.)?"?([a-z0-9_]+)"?$/.exec(r)?.[1] ?? null;
}

const serialSeqs = (table: string, body: string) =>
  [...body.matchAll(/(?:^|[(,] ?)"?([a-z0-9_]+)"? (?:small|big)?serial\b/g)].map((s) => `${table}_${s[1]}_seq`);

/** Every grant problem in `migrations` (sorted by file name), as readable strings. */
function audit(migrations: Migration[]): string[] {
  const created: Created[] = [];
  const live = new Map<string, Created>(); // kind:name -> current creation
  const privileges: Privilege[] = [];
  const add = (c: Created) => {
    const key = `${c.kind}:${c.name}`;
    // `create or replace` keeps the existing ACL, so only a genuinely new object needs grants.
    if (live.has(key)) return;
    live.set(key, c);
    created.push(c);
  };

  for (const { file, sql } of [...migrations].sort((a, b) => a.file.localeCompare(b.file))) {
    for (const st of statements(sql)) {
      let m: RegExpExecArray | null;
      if ((m = /^create (?:unlogged )?table (?:if not exists )?([a-z0-9_."]+) ?(?:\(| as )/.exec(st))) {
        const name = publicName(m[1]);
        if (name) add({ kind: "table", name, file, serials: serialSeqs(name, st.slice(m[0].length - 1)), trigger: false });
      } else if ((m = /^create (?:or replace )?(?:materialized )?view (?:if not exists )?([a-z0-9_."]+)/.exec(st))) {
        const name = publicName(m[1]);
        if (name) add({ kind: "table", name, file, serials: [], trigger: false });
      } else if ((m = /^create sequence (?:if not exists )?([a-z0-9_."]+)/.exec(st))) {
        const name = publicName(m[1]);
        if (name) add({ kind: "sequence", name, file, serials: [], trigger: false });
      } else if ((m = /^create (?:or replace )?function ([a-z0-9_."]+) ?\(/.exec(st))) {
        const name = publicName(m[1]);
        if (name) add({ kind: "function", name, file, serials: [], trigger: / returns trigger\b/.test(st) });
      } else if ((m = /^alter table (?:if exists )?(?:only )?([a-z0-9_."]+) add (?:column )?(?:if not exists )?("?[a-z0-9_]+"? (?:small|big)?serial\b.*)$/.exec(st))) {
        const name = publicName(m[1]);
        const table = name ? live.get(`table:${name}`) : undefined;
        if (name && table) {
          // A serial added later needs its grant in the file that adds it.
          for (const seq of serialSeqs(name, m[2])) created.push({ kind: "sequence", name: seq, file, serials: [], trigger: false });
        }
      } else if ((m = /^drop (table|view|materialized view|sequence|function) (?:if exists )?(.+?)(?: cascade| restrict)?$/.exec(st))) {
        const kind: Kind = m[1] === "sequence" ? "sequence" : m[1] === "function" ? "function" : "table";
        for (const ref of m[2].replace(/\([^)]*\)/g, "").split(",")) {
          const name = publicName(ref);
          if (name) live.delete(`${kind}:${name}`);
        }
      } else if ((m = /^(grant|revoke) (.+?) on (table |sequence |function )?(.+?) (to|from) (.+)$/.exec(st))) {
        const kind: Kind = m[3] === "sequence " ? "sequence" : m[3] === "function " ? "function" : "table";
        const names = m[4].replace(/\([^)]*\)/g, "").split(",").map(publicName).filter((n): n is string => !!n);
        const roles = m[6].replace(/ (with grant option|granted by .+|cascade|restrict)$/, "").split(",").map((r) => r.trim());
        privileges.push({ kind, names, roles, privs: m[2], grant: m[1] === "grant", file });
      }
    }
  }

  const sameFileOnly = (file: string) => file.slice(0, 4) > GRANTED_RETROACTIVELY_THROUGH;
  const on = (kind: Kind, name: string, from: string) =>
    privileges.filter((p) => p.kind === kind && p.names.includes(name) && (sameFileOnly(from) ? p.file === from : p.file >= from));
  const where = (file: string) => (sameFileOnly(file) ? `in ${file}` : `in ${file} or later`);

  const problems: string[] = [];
  for (const c of created) {
    const ps = on(c.kind, c.name, c.file);
    if (c.kind === "function") {
      if (!c.trigger && ps.length === 0) problems.push(`function public.${c.name}: no grant/revoke execute ${where(c.file)}`);
      continue;
    }
    if (ps.length === 0) {
      problems.push(`${c.kind} public.${c.name}: no grants ${where(c.file)}`);
      continue;
    }
    if (c.kind === "table" && !ps.some((p) => p.grant && p.roles.includes("service_role")))
      problems.push(`table public.${c.name}: not granted to service_role ${where(c.file)}`);
    if (c.kind !== "table") continue;
    const authInserts = ps.some((p) => p.grant && p.roles.includes("authenticated") && /^all\b|\binsert\b/.test(p.privs));
    for (const seq of c.serials) {
      const seqPs = on("sequence", seq, c.file);
      if (seqPs.length === 0) problems.push(`sequence public.${seq}: no grants ${where(c.file)}`);
      else if (authInserts && !seqPs.some((p) => p.grant && p.roles.includes("authenticated")))
        problems.push(`sequence public.${seq}: authenticated can insert into ${c.name} but can't call nextval()`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
const DIR = join(__dirname, "..", "supabase", "migrations");
const repo: Migration[] = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .map((file) => ({ file, sql: readFileSync(join(DIR, file), "utf8") }));

test(`supabase/migrations (${repo.length} files): every table, view, sequence and function has explicit grants`, () => {
  assert.ok(repo.some((m) => /create table/i.test(m.sql)), "no migrations found");
  assert.deepEqual(audit(repo), []);
});

/** A fixture history: the repo's migrations plus `extra`, which sort after them. */
const withRepo = (...extra: Migration[]) => audit([...repo, ...extra]);
const GRANTED = `
  grant select, insert, update, delete on table public.logbook_notes to authenticated;
  grant all on table public.logbook_notes to service_role;`;

test("flags a new table with no grants", () => {
  assert.deepEqual(withRepo({ file: "0100_notes.sql", sql: "create table public.logbook_notes (id uuid primary key);" }), [
    "table public.logbook_notes: no grants in 0100_notes.sql",
  ]);
});

test("accepts a new table granted in the same migration", () => {
  assert.deepEqual(withRepo({ file: "0100_notes.sql", sql: `create table public.logbook_notes (id uuid primary key);${GRANTED}` }), []);
});

test("from 0022 on, grants in a later migration don't count", () => {
  assert.deepEqual(
    withRepo({ file: "0100_notes.sql", sql: "create table if not exists logbook_notes (id uuid primary key);" }, { file: "0101_fix.sql", sql: GRANTED }),
    ["table public.logbook_notes: no grants in 0100_notes.sql"],
  );
});

test("flags a table only anon/authenticated can reach", () => {
  assert.deepEqual(
    withRepo({ file: "0100_notes.sql", sql: "create table public.logbook_notes (id uuid);\ngrant select on public.logbook_notes to authenticated;" }),
    ["table public.logbook_notes: not granted to service_role in 0100_notes.sql"],
  );
});

test("flags a bigserial id authenticated can insert through but can't advance", () => {
  assert.deepEqual(withRepo({ file: "0100_notes.sql", sql: `create table public.logbook_notes (id bigserial primary key, body text);${GRANTED}\ngrant all on sequence public.logbook_notes_id_seq to service_role;` }), [
    "sequence public.logbook_notes_id_seq: authenticated can insert into logbook_notes but can't call nextval()",
  ]);
  assert.deepEqual(withRepo({ file: "0100_notes.sql", sql: `create table public.logbook_notes (id bigserial primary key);${GRANTED}` }), [
    "sequence public.logbook_notes_id_seq: no grants in 0100_notes.sql",
  ]);
  assert.deepEqual(
    withRepo({ file: "0100_notes.sql", sql: `create table public.logbook_notes (id bigserial primary key);${GRANTED}\ngrant usage, select on sequence public.logbook_notes_id_seq to authenticated, service_role;` }),
    [],
  );
});

test("identity columns need no sequence grant", () => {
  assert.deepEqual(withRepo({ file: "0100_notes.sql", sql: `create table public.logbook_notes (id bigint generated always as identity primary key);${GRANTED}` }), []);
});

test("flags a function without grants, but not a trigger function or a re-created one", () => {
  const fn = (name: string, returns: string) => `create or replace function public.${name}() returns ${returns} language sql as $$ select null $$;`;
  assert.deepEqual(withRepo({ file: "0100_fn.sql", sql: fn("flight_count", "bigint") }), ["function public.flight_count: no grant/revoke execute in 0100_fn.sql"]);
  assert.deepEqual(withRepo({ file: "0100_fn.sql", sql: fn("touch_row", "trigger") }), []);
  // check_rate_limit was granted in 0013; replacing it keeps that ACL.
  assert.deepEqual(withRepo({ file: "0100_fn.sql", sql: "create or replace function public.check_rate_limit(p_bucket text, p_max int, p_window_seconds int) returns boolean language sql as $$ select true $$;" }), []);
  // ...but dropping it first throws the ACL away.
  assert.deepEqual(
    withRepo({ file: "0100_fn.sql", sql: "drop function if exists public.check_rate_limit(text, int, int);\ncreate function public.check_rate_limit(p text) returns boolean language sql as $$ select true $$;" }),
    ["function public.check_rate_limit: no grant/revoke execute in 0100_fn.sql"],
  );
});

test("flags a new view; ignores other schemas, comments and function bodies", () => {
  assert.deepEqual(withRepo({ file: "0100_v.sql", sql: "create or replace view public.flight_totals as select 1;" }), ["table public.flight_totals: no grants in 0100_v.sql"]);
  assert.deepEqual(
    withRepo({
      file: "0100_misc.sql",
      sql: "create table private.ledger (id int);\n-- create table public.not_real (id int);\ncreate or replace function private.f() returns void language plpgsql as $$ begin create table public.temp_x (id int); end $$;",
    }),
    [],
  );
});

test("flags a serial column added to an existing table later", () => {
  assert.deepEqual(withRepo({ file: "0100_col.sql", sql: "alter table public.flights add column seq_no bigserial;" }), [
    "sequence public.flights_seq_no_seq: no grants in 0100_col.sql",
  ]);
});

console.log(`\n${passed + failed} test(s) — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
