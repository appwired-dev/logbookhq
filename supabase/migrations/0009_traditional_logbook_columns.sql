-- 0009: expand the flights schema to cover the full traditional logbook layout
-- (FAA/ICAO style). Adds:
--   * holds                     count of holding patterns flown
--   * precision_approaches      precision approach count (ILS, PAR, etc.)
--   * non_precision_approaches  non-precision count (LNAV, VOR, NDB, etc.)
--   * cfi_time                  hours acting as flight instructor
--
-- Existing `ifr_approaches` is retained as the total/aggregate count. Old rows
-- still display correctly; new rows can use the more granular split.
--
-- Also expands the category check to allow sea and helicopter categories:
--   SE   single engine land    (existing)
--   ME   multi engine land     (existing)
--   SES  single engine sea     (new — float plane, amphibian)
--   MES  multi engine sea      (new)
--   HELI helicopter            (new)
--   SIM  simulator             (existing)
--
-- Note: an earlier draft of this migration also added `solo_time`. That
-- column was removed before launch (solo time is functionally identical to
-- PIC for a single-crew flight; the redundancy added form clutter without
-- analytic value). The drop-if-exists below cleans up if the older draft
-- was already applied.

alter table public.flights drop column if exists solo_time;

alter table public.flights
  add column if not exists holds                    integer      not null default 0,
  add column if not exists precision_approaches     integer      not null default 0,
  add column if not exists non_precision_approaches integer      not null default 0,
  add column if not exists cfi_time                 numeric(5,1) not null default 0;

alter table public.flights drop constraint if exists flights_category_check;
alter table public.flights add constraint flights_category_check
  check (category in ('SE','ME','SES','MES','HELI','SIM'));
