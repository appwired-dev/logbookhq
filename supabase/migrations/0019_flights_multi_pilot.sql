-- EASA (AMC1 FCL.050) distinguishes single-pilot vs multi-pilot operation time.
-- Add an explicit flag so the EASA export can split SP SE/ME from MP faithfully,
-- instead of inferring it from crew role.
ALTER TABLE public.flights
  ADD COLUMN IF NOT EXISTS multi_pilot boolean NOT NULL DEFAULT false;

-- Backfill: FO/SIC function is inherently a multi-crew operation.
UPDATE public.flights SET multi_pilot = true
  WHERE role IN ('FO', 'SIC') AND multi_pilot = false;
