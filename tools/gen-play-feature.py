#!/usr/bin/env python3
"""Compose the Google Play feature graphic: 1024x500, no alpha.

Uses images/bunny.png and the cream/coral/ink tokens. Play crops edges, so
copy stays in the center ~80%.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "store" / "play-feature-graphic.png"
BUNNY = ROOT / "images" / "bunny.png"

CREAM = (255, 246, 238)
CORAL = (224, 122, 106)
INK = (42, 33, 28)
MUTED = (90, 72, 64)

W, H = 1024, 500

FONT_CANDIDATES = [
    Path("/System/Library/AssetsV2/com_apple_MobileAsset_Font8/"
         "86ba2c91f017a3749571a82f2c6d890ac7ffb2fb.asset/AssetData/PingFang.ttc"),
    Path("/System/Library/Fonts/Hiragino Sans GB.ttc"),
    Path("/System/Library/Fonts/STHeiti Medium.ttc"),
    Path("/Library/Fonts/Arial Unicode.ttf"),
]


def load_font(size: int) -> ImageFont.FreeTypeFont:
    last = None
    for path in FONT_CANDIDATES:
        if not path.exists():
            continue
        try:
            return ImageFont.truetype(str(path), size=size, index=0)
        except OSError as exc:
            last = exc
    raise SystemExit(f"no CJK font: {last}")


def main() -> None:
    canvas = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(canvas)

    # Soft coral wash behind the bunny so the left side is not a flat slab.
    wash = Image.new("RGB", (W, H), CREAM)
    wash_draw = ImageDraw.Draw(wash)
    wash_draw.ellipse((-80, -120, 560, 620), fill=(255, 228, 214))
    canvas = Image.blend(canvas, wash, 0.55)
    draw = ImageDraw.Draw(canvas)

    bunny = Image.open(BUNNY).convert("RGBA")
    bunny_h = 430
    ratio = bunny_h / bunny.height
    bunny = bunny.resize((round(bunny.width * ratio), bunny_h), Image.Resampling.LANCZOS)
    # Source art is a circle on a square pad; mask the pad so it sits on cream.
    mask = Image.new("L", bunny.size, 0)
    ImageDraw.Draw(mask).ellipse((8, 8, bunny.width - 9, bunny.height - 9), fill=255)
    bunny.putalpha(mask)
    bx, by = 28, (H - bunny_h) // 2
    canvas.paste(bunny, (bx, by), bunny)

    title_font = load_font(64)
    en_font = load_font(34)
    tag_font = load_font(24)

    tx = 500
    title = "小兔头节拍器"
    english = "Bunny Metronome"
    tag = "打开就能练 · 核心永久免费"

    # Vertically center the text block in the right safe zone.
    title_box = draw.textbbox((0, 0), title, font=title_font)
    en_box = draw.textbbox((0, 0), english, font=en_font)
    tag_box = draw.textbbox((0, 0), tag, font=tag_font)
    title_h = title_box[3] - title_box[1]
    en_h = en_box[3] - en_box[1]
    tag_h = tag_box[3] - tag_box[1]
    gap1, gap2 = 14, 28
    block_h = title_h + gap1 + en_h + gap2 + tag_h
    y = (H - block_h) // 2 - 4

    draw.text((tx, y), title, font=title_font, fill=INK)
    y += title_h + gap1
    draw.text((tx, y), english, font=en_font, fill=CORAL)
    y += en_h + gap2
    draw.text((tx, y), tag, font=tag_font, fill=MUTED)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, format="PNG")
    assert canvas.mode == "RGB"
    assert canvas.size == (W, H)
    print(f"wrote {OUT.relative_to(ROOT)} {canvas.size} {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
