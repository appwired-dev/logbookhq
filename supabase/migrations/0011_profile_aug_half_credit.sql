-- Experience-credit convention for augmenting / cruise-relief (SIC) time.
-- When true, dashboard / type / Sankey totals count SIC time at 50%.
-- Flights keep the full logged time; regulatory flight-time limits and
-- XC / instrument / approach totals are unaffected.
alter table public.profiles
  add column if not exists aug_half_credit boolean not null default false;
