-- Expand the regulatory regimes a user can pick as their primary.
--
-- Original constraint (0001_init.sql) allowed only CA/ICAO/FAA/EASA.
-- Add: UKCAA (UK), GCAA (UAE), GACA (Saudi Arabia), QCAA (Qatar),
-- HKCAD (Hong Kong), CAAC (China).

alter table public.profiles
  drop constraint if exists profiles_primary_regime_check;

alter table public.profiles
  add constraint profiles_primary_regime_check
  check (primary_regime in (
    'CA','ICAO','FAA','EASA','UKCAA','GCAA','GACA','QCAA','HKCAD','CAAC'
  ));
