# Aircraft registry source data

Drop the official open-data files here, then run:

```
npx tsx scripts/build-aircraft-registry.ts
```

It emits `data/aircraft-registry.json` (gitignore-able if you'd rather
re-generate per deploy). The Flight form's tail-# lookup uses that JSON to
auto-fill make/model for tails the pilot has never flown before.

## Files to drop in

### `ccarcs.csv` — Transport Canada
Source: <https://open.canada.ca/data/en/dataset/aaccdde7-9c33-4ddc-bd2d-2caf6a047cce>

About 30,000 aircraft. Refreshed quarterly. Free, no signup.

### `MASTER.txt` + `ACFTREF.txt` — FAA
Source: <https://registry.faa.gov/database/yearly/ReleasableAircraft.zip>

About 290,000 aircraft. Unzip into this folder. Refreshed monthly.

## Refresh cadence

Both registers change slowly (most aircraft don't re-register). Rebuilding
monthly is plenty. Aircraft missing from the bundled snapshot still get
caught by the user's own flight history (Tier 1 lookup).
