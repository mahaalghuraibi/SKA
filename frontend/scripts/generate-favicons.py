#!/usr/bin/env python3
"""
Build tab favicons from the full SKA logo (no horizontal crop — avoids clipping the mascot).

Pipeline:
  - Trim global alpha bbox.
  - Letterbox into a square (transparent) so the entire artwork stays visible.
  - Scale each output size with a modest inner margin (safe padding, centered).

Run from ska-system/frontend:
  python3 scripts/generate-favicons.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src/assets/images/ska-logo.png"
OUT = ROOT / "public"

# Per-edge margin inside each output size (inset for safe anti-alias, not tight crop).
MARGIN_RATIO = 0.05

# Transparent breathing room around trimmed artwork so glow / soft edges are not sheared off.
CONTENT_PAD_RATIO = 0.028


def extract_full_logo_square(src: Path) -> Image.Image:
    """
    Full logo, uncropped, centered on the smallest square that contains it.
    Transparent background outside the original aspect ratio.

    After alpha trim, adds a small transparent border so downscaling does not clip
    semi-transparent edge pixels (common “favicon is cut off” report).
    """
    im = Image.open(src).convert("RGBA")
    alpha = im.split()[3]
    bb = alpha.getbbox()
    if not bb:
        return im
    im = im.crop(bb)
    w, h = im.size
    pad = max(2, int(round(max(w, h) * CONTENT_PAD_RATIO)))
    bordered = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    bordered.paste(im, (pad, pad), im)
    im = bordered
    w, h = im.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - w) // 2
    oy = (side - h) // 2
    canvas.paste(im, (ox, oy), im)
    return canvas


def render_size(base_sq: Image.Image, size: int) -> Image.Image:
    """Uniform scale into square canvas; small inset padding; centered."""
    inner = max(1, int(round(size * (1 - 2 * MARGIN_RATIO))))
    img = base_sq.copy()
    img.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ox = (size - img.width) // 2
    oy = (size - img.height) // 2
    canvas.paste(img, (ox, oy), img)
    return canvas


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"Missing source logo: {SRC}")

    OUT.mkdir(parents=True, exist_ok=True)

    base = extract_full_logo_square(SRC)

    i16 = render_size(base, 16)
    i32 = render_size(base, 32)
    i48 = render_size(base, 48)
    i64 = render_size(base, 64)

    for s, img in [(16, i16), (32, i32), (48, i48), (64, i64)]:
        dest = OUT / f"favicon-{s}x{s}.png"
        img.save(dest, format="PNG", optimize=True)
        print(f"Wrote {dest.relative_to(ROOT)}")

    # Primary PNG: 48×48 — good balance for HiDPI tabs (full logo visible, not as cramped as 32).
    favicon_png = OUT / "favicon.png"
    i48.save(favicon_png, format="PNG", optimize=True)
    print(f"Wrote {favicon_png.relative_to(ROOT)} (primary alias: 48×48)")

    apple = render_size(base, 180)
    apple_path = OUT / "apple-touch-icon.png"
    apple.save(apple_path, format="PNG", optimize=True)
    print(f"Wrote {apple_path.relative_to(ROOT)}")

    ico_path = OUT / "favicon.ico"
    # Prefer larger decoded bitmaps first for sharpness on HiDPI / Windows shell.
    i48.save(ico_path, format="ICO", append_images=[i64, i32, i16])
    print(f"Wrote {ico_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
