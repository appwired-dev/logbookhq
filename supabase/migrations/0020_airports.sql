-- Reference table for airport coordinate lookups (globe arcs + route
-- validation on /app/charts). Replaces loading the full 70k-entry
-- data/airports.json into memory (~31MB heap) on that route: the charts page
-- now queries only the codes the user actually flew.
create table if not exists public.airports (
  code    text primary key,
  lat     double precision not null,
  lon     double precision not null,
  name    text not null default '',
  country text not null default ''
);

-- Public reference data: any signed-in user may read; there is no write policy,
-- so inserts/updates/deletes are denied via the API. Rows are loaded
-- out-of-band by the maintainer (service role / SQL), which bypasses RLS.
alter table public.airports enable row level security;

drop policy if exists "airports_read_authenticated" on public.airports;
create policy "airports_read_authenticated"
  on public.airports for select
  to authenticated
  using (true);
