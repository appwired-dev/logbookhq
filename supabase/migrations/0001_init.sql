-- Logbook HQ initial schema.
--
-- Design philosophy carried over from the personal-app prototype at ~/pilot-logbook:
-- store BASE FACTS only (category, role, day/night split, x-country flag) and
-- derive the 18-column traditional logbook layout on read.
--
-- Multi-regime extensibility: regime-specific fields live in flight_field_values
-- keyed by field_definitions. Never add regime-specific columns to flights.

-- =============================================================================
-- profiles: one row per auth.users entry, holds preferences/billing tier.
-- =============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  license_number text,
  primary_regime text not null default 'CA' check (primary_regime in ('CA','ICAO','FAA','EASA')),
  tier text not null default 'free' check (tier in ('free','pro','lifetime')),
  is_admin boolean not null default false,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_stripe on public.profiles(stripe_customer_id);

-- Auto-create profile when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================================================
-- flights: one row per flight (a "leg"). Base facts only.
-- =============================================================================
create table public.flights (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,

  date date not null,
  make_model text not null,
  registration text,
  pic text,
  copilot text,
  route text,
  remarks text,

  category text not null check (category in ('SE','ME','SIM')),
  role text not null check (role in ('PIC','DUAL','FO','AUG')),
  day_time numeric(5,1) not null default 0 check (day_time >= 0),
  night_time numeric(5,1) not null default 0 check (night_time >= 0),
  is_xcountry boolean not null default false,

  actual_inst numeric(5,1) not null default 0 check (actual_inst >= 0),
  hood_inst numeric(5,1) not null default 0 check (hood_inst >= 0),
  sim_inst numeric(5,1) not null default 0 check (sim_inst >= 0),
  ifr_approaches integer not null default 0 check (ifr_approaches >= 0),

  takeoffs_day integer not null default 0,
  takeoffs_night integer not null default 0,
  landings_day integer not null default 0,
  landings_night integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_flights_user_date on public.flights(user_id, date desc);
create index idx_flights_user_make_model on public.flights(user_id, make_model);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_flights_updated
  before update on public.flights
  for each row execute procedure public.set_updated_at();

create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- =============================================================================
-- field_definitions / flight_field_values: regime-specific extensibility.
-- Field defs are global per regime; values are per-flight, per-user.
-- =============================================================================
create table public.field_definitions (
  id bigserial primary key,
  regime text not null check (regime in ('CA','ICAO','FAA','EASA')),
  key text not null,
  label text not null,
  data_type text not null check (data_type in ('number','integer','text','boolean','date')),
  unique (regime, key)
);

create table public.flight_field_values (
  flight_id bigint not null references public.flights(id) on delete cascade,
  field_id bigint not null references public.field_definitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value_text text,
  value_number numeric,
  value_boolean boolean,
  value_date date,
  primary key (flight_id, field_id)
);

create index idx_ffv_user_flight on public.flight_field_values(user_id, flight_id);

-- =============================================================================
-- Row-Level Security: every authenticated user sees only their own data.
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.flights enable row level security;
alter table public.flight_field_values enable row level security;
alter table public.field_definitions enable row level security;

-- profiles
create policy "users see own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "users update own profile"
  on public.profiles for update using (auth.uid() = id);

-- flights — full CRUD on own rows only
create policy "users see own flights"
  on public.flights for select using (auth.uid() = user_id);
create policy "users insert own flights"
  on public.flights for insert with check (auth.uid() = user_id);
create policy "users update own flights"
  on public.flights for update using (auth.uid() = user_id);
create policy "users delete own flights"
  on public.flights for delete using (auth.uid() = user_id);

-- flight_field_values — same pattern
create policy "users see own field values"
  on public.flight_field_values for select using (auth.uid() = user_id);
create policy "users insert own field values"
  on public.flight_field_values for insert with check (auth.uid() = user_id);
create policy "users update own field values"
  on public.flight_field_values for update using (auth.uid() = user_id);
create policy "users delete own field values"
  on public.flight_field_values for delete using (auth.uid() = user_id);

-- field_definitions are read-only to all authenticated users (admin seeds them)
create policy "all users read field defs"
  on public.field_definitions for select using (auth.role() = 'authenticated');
