#!/usr/bin/env python3
"""
Strip the near-white background from every PNG in /public/badges/.

The AI-generated badges arrive as flat RGB on a white canvas. The badges page
needs an alpha channel so the medallion blends cleanly with the card
background, otherwise you see a square white halo behind each piece.

Algorithm:
  - Flood-fill from each of the four corners using a 240+ brightness
    threshold (tolerant of slight JPEG-ish noise around pure white).
  - Anything flood-reached becomes alpha=0; the rest keeps its pixels.
  - Light anti-alias smoothing on the alpha border softens the cut edge.

Safe to re-run. Skips files that already have an alpha channel.
"""
from PIL import Image, ImageFilter
from collections import deque
from pathlib import Path

BADGES_DIR = Path(__file__).resolve().parent.parent / "public" / "badges"
WHITE_THRESHOLD = 235  # pixels brighter than this are considered "background"

def strip(path: Path) -> bool:
    img = Image.open(path)
    already_alpha = False
    if img.mode == "RGBA":
        alpha = img.split()[-1]
        if alpha.getextrema()[0] < 250:
            already_alpha = True
    img = img.convert("RGBA")
    w, h = img.size

    # If the file was already de-backgrounded on a prior pass, skip the
    # expensive flood-fill but still re-crop to content bbox (cheap).
    if already_alpha:
        bbox = img.getbbox()
        if bbox and (bbox != (0, 0, w, h)):
            margin = 8
            img = img.crop((
                max(0, bbox[0] - margin), max(0, bbox[1] - margin),
                min(w, bbox[2] + margin), min(h, bbox[3] + margin),
            ))
            img.save(path, "PNG", optimize=True)
            return True
        return False
    px = img.load()

    # BFS flood fill from the four corners. Mark transparent cells in `mask`.
    mask = [[False] * h for _ in range(w)]
    stack = deque()
    for sx, sy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        stack.append((sx, sy))

    def is_bg(r, g, b):
        return r >= WHITE_THRESHOLD and g >= WHITE_THRESHOLD and b >= WHITE_THRESHOLD

    while stack:
        x, y = stack.popleft()
        if x < 0 or x >= w or y < 0 or y >= h or mask[x][y]:
            continue
        r, g, b, _ = px[x, y]
        if not is_bg(r, g, b):
            continue
        mask[x][y] = True
        stack.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    # Apply mask to alpha channel.
    for x in range(w):
        for y in range(h):
            if mask[x][y]:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 0)

    # Soften the cut edge with a slight blur on the alpha channel only.
    r, g, b, a = img.split()
    a = a.filter(ImageFilter.GaussianBlur(radius=0.5))
    img = Image.merge("RGBA", (r, g, b, a))

    # Auto-crop to the bounding box of non-transparent content, with a small
    # margin. Without this, designs with lots of negative space (e.g. star
    # clusters spread wide) render tiny inside the badge frame.
    bbox = img.getbbox()
    if bbox:
        w2, h2 = img.size
        margin = 8  # px breathing room so the soft edge isn't clipped
        x0 = max(0, bbox[0] - margin)
        y0 = max(0, bbox[1] - margin)
        x1 = min(w2, bbox[2] + margin)
        y1 = min(h2, bbox[3] + margin)
        img = img.crop((x0, y0, x1, y1))

    img.save(path, "PNG", optimize=True)
    return True

def main():
    pngs = sorted(p for p in BADGES_DIR.glob("*.png"))
    print(f"Processing {len(pngs)} PNG files in {BADGES_DIR}")
    for p in pngs:
        changed = strip(p)
        status = "stripped ✓" if changed else "skipped (already transparent)"
        print(f"  {p.name:35s} {status}")

if __name__ == "__main__":
    main()
