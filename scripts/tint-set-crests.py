"""Generate bronze/gold variants of mod set crests.

The WFCD `*Header.png` set crests are silvery-grey silhouettes with full
internal shading (highlights, midtones, shadows). For Common (bronze) and
Rare (gold) mods the silver tone clashes — but a runtime `mask-image`
tint flattens the shading into a single flat colour and looks awful.

This script does it once, offline, the right way: for each source PNG in
`apps/web/public/mod-set-icons/*Header.png`, emit `*Header-bronze.png`
and `*Header-gold.png` by multiplying the RGB channels by the tint
colour (alpha preserved). Uncommon / Legendary / etc. keep using the
unmodified silvery source.

Re-run only when WFCD ships new crests:
    uv run --with pillow python scripts/tint-set-crests.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ICONS_DIR = ROOT / "apps" / "web" / "public" / "mod-set-icons"

# Tint = the colour a fully-white source pixel becomes after multiply,
# so darker pixels stay proportionally darker.
#
# These are deliberately a touch more saturated than the frame-bottom
# specular highlights — sampling those directly (`#D7BFAA` / `#FAEFBF`)
# gave a pale, washed-out crest because the source PNGs are mostly
# midtones, not highlights. These richer tones keep the crest's body
# warm without pushing the highlights into glowing territory.
TINTS: dict[str, tuple[int, int, int]] = {
    "bronze": (0xC8, 0x99, 0x70),
    "gold": (0xE7, 0xC7, 0x6B),
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
