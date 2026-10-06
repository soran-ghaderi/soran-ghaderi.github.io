#!/usr/bin/env python3
"""Make crisp, downscaled thumbnails for publication card figures.

Browsers downscale huge figures badly (aliasing that shimmers while the page
scrolls), so serve a pre-sized copy instead of the full-resolution file.

Usage:
  python3 scripts/make_thumbs.py                    # every local image referenced in _data/publication.yml
  python3 scripts/make_thumbs.py assets/images/x.png  # specific source files

Writes assets/images/thumbs/<name>.png: at most 800px wide (never upscaled),
Lanczos resampling, transparency flattened onto white. Point the `image:` key
in _data/publication.yml at the generated file. Requires Pillow.
"""
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMG_DIR = ROOT / "assets/images"
OUT_DIR = IMG_DIR / "thumbs"
MAX_WIDTH = 800
SOURCE_EXTS = (".png", ".jpg", ".jpeg", ".webp")


def referenced_sources():
    """Local images referenced in publication.yml, mapped back to their originals."""
    text = (ROOT / "_data/publication.yml").read_text()
    for m in re.finditer(r"^\s*image:\s*(\S+)", text, re.M):
        ref = m.group(1)
        if not ref.startswith("/assets/images/"):
            continue
        stem = Path(ref).stem
        for ext in SOURCE_EXTS:
            cand = IMG_DIR / (stem + ext)
            if cand.exists():
                yield cand
                break


def make_thumb(src: Path) -> Path:
    im = Image.open(src)
    if im.mode != "RGB":
        im = im.convert("RGBA")
        white = Image.new("RGBA", im.size, (255, 255, 255, 255))
        im = Image.alpha_composite(white, im).convert("RGB")
    if im.width > MAX_WIDTH:
        im = im.resize((MAX_WIDTH, round(im.height * MAX_WIDTH / im.width)), Image.LANCZOS)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / (src.stem + ".png")
    im.save(out, optimize=True)
    return out


def main(argv):
    sources = [Path(a).resolve() for a in argv] or sorted(set(referenced_sources()))
    if not sources:
        print("No source images found.")
        return
    for src in sources:
        if not src.exists():
            print(f"skip (missing): {src}")
            continue
        out = make_thumb(src)
        w, h = Image.open(out).size
        print(f"{src.relative_to(ROOT)} -> /{out.relative_to(ROOT)}  {w}x{h}  {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1:])
