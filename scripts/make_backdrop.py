#!/usr/bin/env python3
"""Build the cinematic backdrop shown behind the profile photo on the homepage.

Source photo (not stored in the repo):
  "1 radcliffe camera night 2012.jpg" by chensiyuan, CC BY-SA 4.0
  https://commons.wikimedia.org/wiki/File:1_radcliffe_camera_night_2012.jpg
  Download the original and pass its path:  python3 scripts/make_backdrop.py /path/to/original.jpg

What it does: extends the night sky upward so the dome sits below the profile photo, cuts a
1:3 column strip centred on the Camera (shown as a rounded photo panel behind the portrait), applies a restrained cinematic grade (lifted blacks,
cool shadows, warm highlights, vignette, fine grain against banding) and writes:
  assets/images/backdrop/<name>-320.webp   1x column width
  assets/images/backdrop/<name>-640.webp   2x column width
  assets/images/backdrop/<name>-640.jpg    fallback for browsers without WebP
  _data/about_backdrop.yml                 srcset, sizes, inline placeholder and credit for _includes/about.html
`enabled` and `side` in _data/about_backdrop.yml are preserved across runs. Requires Pillow and PyYAML.
"""
import base64
import io
import sys
from pathlib import Path

import yaml
from PIL import Image, ImageChops, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets/images/backdrop"
DATA = ROOT / "_data/about_backdrop.yml"

NAME = "radcliffe-camera"
RATIO = 3.0            # strip height / width
CENTER_X = 0.50        # horizontal centre of the Camera in the source (fraction of width)
EXTEND_TOP = 0.22      # sky added above the frame, as a fraction of source height
WIDTHS = (320, 640)    # 1x and 2x of the widest column (293px at >=1200px viewports)
WEBP_QUALITY = 74
CAPTION = "Radcliffe Camera"   # two-line caption in the panel; the licence credit is in the footer
SUBCAPTION = "Oxford"
SIZES = "(min-width: 1200px) 293px, (min-width: 992px) 243px, 250px"
CREDIT = (
    'Backdrop: <a href="https://commons.wikimedia.org/wiki/File:1_radcliffe_camera_night_2012.jpg" '
    'rel="noopener" target="_blank">Radcliffe Camera at night</a> by chensiyuan, '
    '<a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="license noopener" target="_blank">CC BY-SA 4.0</a>; '
    'cropped, sky extended and colour-graded, shared under the same licence.'
)


def extend_sky(im: Image.Image, frac: float) -> Image.Image:
    """Add `frac` of the height above the frame, continuing the sky as a smooth, slightly darker gradient."""
    w, h = im.size
    ext = int(h * frac)
    top = im.crop((0, 0, w, max(8, int(h * 0.03)))).resize((w, ext), Image.LANCZOS)
    top = top.filter(ImageFilter.GaussianBlur(w * 0.012))
    # the zenith is darker than the horizon: darken toward the top of the extension
    shade = Image.linear_gradient("L").resize((w, ext)).point(lambda v: int(185 + 70 * v / 255))
    top = Image.composite(top, Image.new("RGB", (w, ext), (0, 0, 0)), shade)
    canvas = Image.new("RGB", (w, h + ext))
    canvas.paste(top, (0, 0))
    canvas.paste(im, (0, ext))
    # feather the seam
    seam = int(h * 0.05)
    band = canvas.crop((0, ext - seam, w, ext + seam)).filter(ImageFilter.GaussianBlur(w * 0.006))
    feather = Image.linear_gradient("L").resize((w, 2 * seam)).point(lambda v: int(255 * (1 - abs(v - 127.5) / 127.5)))
    canvas.paste(band, (0, ext - seam), feather)
    return canvas


def grade(im: Image.Image) -> Image.Image:
    im = ImageEnhance.Color(im).enhance(0.9)
    im = ImageEnhance.Contrast(im).enhance(1.06)
    im = ImageEnhance.Brightness(im).enhance(0.96)
    # matte blacks
    im = im.point(lambda v: int(v * 0.975 + 5))
    lum = im.convert("L")
    shadows = lum.point(lambda v: int(((255 - v) / 255) ** 2 * 255 * 0.26))
    highlights = lum.point(lambda v: int((v / 255) ** 2 * 255 * 0.22))
    cool = ImageChops.add(im, Image.new("RGB", im.size, (0, 3, 12)))
    warm = ImageChops.add(im, Image.new("RGB", im.size, (7, 3, 0)))
    im = Image.composite(cool, im, shadows)
    im = Image.composite(warm, im, highlights)
    return im


def vignette(im: Image.Image, strength: float = 0.28) -> Image.Image:
    w, h = im.size
    mask = Image.radial_gradient("L").resize((w, h))          # 0 centre -> 255 edges (circle); stretched to the strip
    mask = mask.point(lambda v: int(min(255, (v / 255) ** 1.6 * 255 * strength)))
    dark = ImageEnhance.Brightness(im).enhance(0.55)
    return Image.composite(dark, im, mask)


def grain(im: Image.Image, sigma: float = 2.2) -> Image.Image:
    noise = Image.effect_noise(im.size, sigma).convert("RGB")
    return ImageChops.add(im, noise, 1.0, -128)


def main(src: Path):
    im = Image.open(src).convert("RGB")
    im = extend_sky(im, EXTEND_TOP)
    w, h = im.size
    strip_w = int(h / RATIO)
    x0 = max(0, min(w - strip_w, int(w * CENTER_X) - strip_w // 2))
    strip = vignette(grade(im.crop((x0, 0, x0 + strip_w, h))))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    srcset, sizes_kb = [], {}
    for width in WIDTHS:
        out = grain(strip.resize((width, int(width * RATIO)), Image.LANCZOS))
        p = OUT_DIR / f"{NAME}-{width}.webp"
        out.save(p, "WEBP", quality=WEBP_QUALITY, method=6)
        srcset.append(f"/assets/images/backdrop/{p.name} {width}w")
        sizes_kb[p.name] = p.stat().st_size // 1024
        if width == max(WIDTHS):
            jpg = OUT_DIR / f"{NAME}-{width}.jpg"
            out.save(jpg, "JPEG", quality=72, optimize=True, progressive=True)
            sizes_kb[jpg.name] = jpg.stat().st_size // 1024
            fallback, full_w, full_h = f"/assets/images/backdrop/{jpg.name}", out.width, out.height

    # tiny blurred placeholder, inlined so the column has colour before the image arrives
    tiny = strip.resize((12, int(12 * RATIO)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1))
    buf = io.BytesIO()
    tiny.save(buf, "WEBP", quality=40, method=6)
    lqip = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()

    previous = yaml.safe_load(DATA.read_text()) if DATA.exists() else {}
    data = {
        "enabled": previous.get("enabled", True),
        "side": previous.get("side", "left"),
        "srcset": ", ".join(srcset),
        "sizes": SIZES,
        "fallback": fallback,
        "width": full_w,
        "height": full_h,
        "lqip": lqip,
        "caption": CAPTION,
        "subcaption": SUBCAPTION,
        "credit": CREDIT,
    }
    header = (
        "# Generated by scripts/make_backdrop.py; re-run it to regenerate the image assets.\n"
        "# You may edit `enabled` (true/false) and `side` (left/right) by hand; they survive re-runs.\n"
        "# Paths are site-root relative (the site uses an empty baseurl).\n"
    )
    DATA.write_text(header + yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=1000))
    print("strip:", strip.size, "| assets (KB):", sizes_kb, "| lqip bytes:", len(lqip))
    print("wrote", DATA.relative_to(ROOT))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
