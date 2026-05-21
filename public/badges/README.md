# Badge PNG drop-in

Drop PNG files here named after the badge `id`. The `BadgeMedallion` component
checks for `/public/badges/{id}.png` at first render and uses it instead of the
default Lucide medallion. Any badge without a PNG falls back to the medallion
automatically, so you can add files incrementally.

## Format

- **Filename**: `<badge-id>.png` (lowercase, hyphens — exact match to `id`)
- **Size**: 256×256 px recommended (renders at 56–112 px, retina-safe)
- **Background**: transparent
- **Style**: 3D-rendered, isometric, glowing platform — to match the rest

## Expected filenames

### Firsts
- `first-flight.png` — rocket on launch pad
- `first-solo.png` — eagle in flight
- `first-night.png` — crescent moon with stars
- `first-xc.png` — compass rose
- `first-ifr.png` — IFR cloud with lightning
- `first-me.png` — twin-engine aircraft
- `first-international.png` — globe pin

### Hour milestones (aircraft variant, by tier)
- `total-50.png` — bronze Cessna 152
- `total-100.png` — bronze Cirrus SR22
- `total-250.png` — silver Cirrus SR22
- `total-500.png` — silver King Air
- `total-1000.png` — gold Citation
- `total-1500.png` — gold Airbus A320
- `total-2500.png` — platinum Airbus A320
- `total-5000.png` — platinum Boeing 787
- `total-10000.png` — diamond Boeing 787

### PIC milestones (trophy variant, by tier)
- `pic-100.png` — bronze trophy
- `pic-500.png` — silver trophy
- `pic-1000.png` — gold trophy
- `pic-1500.png` — platinum trophy

### Certification
- `ppl.png` — basic license medal
- `night-rating.png` — moon rating wing
- `me-rating.png` — multi-engine rating wing
- `ifr-rating.png` — instrument rating wing
- `cpl.png` — commercial license medal
- `atpl.png` — gold ATPL target / dartboard

### Endurance
- `long-haul.png` — pocket watch
- `ultra-long.png` — globe with orbit arcs

### Aircraft types
- `types-5.png` — small plane cluster
- `types-10.png` — silver plane cluster
- `types-20.png` — gold sparkles / stars

## DALL-E 3 prompt template

If generating with ChatGPT/DALL-E:

> 3D-rendered isometric pilot achievement badge: **[SUBJECT]**, sitting on a
> glowing hexagonal platform, **[TIER]** metallic finish (bronze/silver/gold/
> platinum/diamond), centered on a transparent background, premium video-game
> trophy aesthetic, soft rim light, slight glow halo, no text.

Then run each output through [photoroom.com](https://photoroom.com) or
[remove.bg](https://remove.bg) to enforce a transparent background.
