-- Add SIC (Second-In-Command) to the flights.role check constraint.
-- SIC is commonly paired with FO in airline terminology; some operators use
-- one or the other. Logbook HQ supports both.
--
-- Run this once in Supabase SQL Editor. Safe to run multiple times — uses
-- DROP IF EXISTS + ADD CONSTRAINT with the same name.

alter table public.flights drop constraint if exists flights_role_check;
alter table public.flights
  add constraint flights_role_check
  check (role in ('PIC','DUAL','FO','SIC','AUG'));
