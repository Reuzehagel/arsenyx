"""Generate bronze/gold variants of mod set crests.

The `*Header.png` set crests are silvery-grey silhouettes with full
internal shading (highlights, midtones, shadows). For Common (bronze) and
Rare (gold) mods the silver tone clashes — but a runtime `mask-image`
tint flattens the shading into a single flat colour and looks awful.

This script does it once, offline, the right way: for each source PNG in
`apps/web/public/mod-set-icons/*Header.png`, emit `*Header-bronze.png`
and `*Header-gold.png` by multiplying the RGB channels by the tint
colour (alpha preserved). Uncommon / Legendary / etc. keep using the
unmodified silvery source.

Re-run only when new set crests ship:
    uv run --with pillow python scripts/tint-set-crests.py

The per-pixel loop is interpreted Python — fine for the 18 small (128×64)
icons here. If you ever want to tint a batch of larger sprites, rewrite
with numpy array ops first; the current implementation will not scale.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ICONS_DIR = ROOT / "apps" / "web" / "public" / "mod-set-icons"

# Tint = the colour a fully-white source pixel becomes after multiply,
# so darker pixels stay proportionally darker.
#
# Hue comes from the most-saturated bright pixel in the matching frame
# bottom (BronzeFrameBottom.webp / GoldFrameBottom.webp): 23° for bronze,
# 41° for gold — the "true" metal hue stripped of specular wash-out.
# Saturation is moderated below the raw frame chroma (~0.5 vs 0.75-0.95)
# so the crest reads as metal rather than neon, and value is lifted to
# near-peak so multiplied highlights stay bright.
TINTS: dict[str, tuple[int, int, int]] = {
    "bronze": (0xD8, 0x95, 0x6C),  # HSV(23°, 0.50, 0.85)
    "gold": (0xED, 0xC1, 0x63),  # HSV(41°, 0.58, 0.93)
}


def tint(src: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    src = src.convert("RGBA")
    out = Image.new("RGBA", src.size)
    src_px = src.load()
    out_px = out.load()
    tr, tg, tb = rgb
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = src_px[x, y]
            # Multiply blend: source × tint / 255. Preserves shading.
            out_px[x, y] = (
                (r * tr) // 255,
                (g * tg) // 255,
                (b * tb) // 255,
                a,
            )
    return out


def main() -> None:
    sources = sorted(
        p
        for p in ICONS_DIR.glob("*Header.png")
        if "-bronze" not in p.stem and "-gold" not in p.stem
    )
    if not sources:
        raise SystemExit(f"no source crests under {ICONS_DIR}")

    for src_path in sources:
        src = Image.open(src_path)
        for name, rgb in TINTS.items():
            out = tint(src, rgb)
            out_path = src_path.with_name(f"{src_path.stem}-{name}.png")
            out.save(out_path, optimize=True)
            print(f"  {out_path.relative_to(ROOT)}")
        print(f"tinted {src_path.name}")


if __name__ == "__main__":
    main()
