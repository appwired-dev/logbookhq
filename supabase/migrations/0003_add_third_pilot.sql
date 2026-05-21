-- Add third_pilot column to flights.
-- For augmented-crew operations (long-haul, freighter, charter) where a
-- third pilot rides along — typically the relief/cruise pilot.
--
-- Idempotent: only adds the column if it doesn't already exist.

alter table public.flights add column if not exists third_pilot text;
