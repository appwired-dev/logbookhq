-- Consolidate AUG into SIC (they share the same conceptual column),
-- add CHECK (Check Pilot) role, and add a check_pilot name column.
--
-- Idempotent: safe to run multiple times.

-- 1. Migrate any existing AUG roles → SIC.
update public.flights set role = 'SIC' where role = 'AUG';

-- 2. Replace the role check to add CHECK and drop AUG.
alter table public.flights drop constraint if exists flights_role_check;
alter table public.flights
  add constraint flights_role_check
  check (role in ('PIC','DUAL','FO','SIC','CHECK'));

-- 3. Add the check_pilot name column (free-text, like pic / copilot / third_pilot).
alter table public.flights add column if not exists check_pilot text;
