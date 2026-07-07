"""InkSpred brand assets: blackletter IS monogram icon + wordmark splash.

CI curls scripts/PirataOne-Regular.ttf (OFL) and pip-installs pillow first, then
runs this to draw assets/icon-only.png, assets/splash.png, assets/splash-dark.png
which @capacitor/assets expands into every iOS size."""
import math, os
from PIL import Image, ImageDraw, ImageFont

INK = (13, 13, 16, 255)
BONE = (245, 242, 236, 255)
GOLD = (201, 163, 95, 255)

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, "PirataOne-Regular.ttf")
OUT = os.path.join(os.path.dirname(HERE), "assets")
os.makedirs(OUT, exist_ok=True)
SS = 4


def drip(draw, x, y_top, length, w0):
    """One continuous drip: stem narrows slightly then swells into a bulb."""
    rb = w0 * 0.62
    neck_y = y_top + length - rb
    left, right = [], []
    steps = 30
    for i in range(steps + 1):
        t = i / steps
        yy = y_top + (neck_y - y_top) * t
        ww = w0 * 0.5 * (1 - 0.35 * t)
        left.append((x - ww, yy))
        right.append((x + ww, yy))
    cx, cy = x, neck_y + rb * 0.55
    for a in range(180, 361, 6):
        rad = math.radians(a)
        left.append((cx + rb * math.cos(rad), cy - rb * math.sin(rad) + rb))
    draw.polygon(left + right[::-1], fill=BONE)


def find_bottom(img, x_frac, s):
    px = img.load()
    x = int(x_frac * s)
    for y in range(s - 1, 0, -1):
        if px[x, y][:3] != INK[:3]:
            return y
    return None


def monogram(s):
    """IS blackletter monogram with drips, on transparent-ink canvas s x s."""
    img = Image.new("RGBA", (s, s), INK)
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, int(s * 0.5))
    bbox = d.textbbox((0, 0), "IS", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (s - tw) / 2 - bbox[0]
    ty = (s - th) / 2 - bbox[1] - s * 0.055
    d.text((tx, ty), "IS", font=font, fill=BONE)
    for x_frac, length, w in ((0.588, 0.115, 0.042), (0.520, 0.068, 0.034)):
        bottom = find_bottom(img, x_frac, s)
        if bottom:
            drip(d, x_frac * s, bottom - s * 0.03, length * s, w * s)
    return img


def make_icon():
    s = 1024 * SS
    img = monogram(s)
    img = img.resize((1024, 1024), Image.LANCZOS).convert("RGB")
    img.save(os.path.join(OUT, "icon-only.png"), optimize=True)


def make_splash():
    s = 2732
    ss = s * 2
    img = Image.new("RGBA", (ss, ss), INK)
    glyph = monogram(int(ss * 0.30))
    # monogram() returns an opaque tile; centre it as-is (same ink background)
    gx = int(ss * 0.5 - ss * 0.15)
    gy = int(ss * 0.5 - ss * 0.19)
    img.paste(glyph, (gx, gy))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, int(ss * 0.055))
    text = "InkSpred"
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    tx = (ss - tw) / 2 - bbox[0]
    ty = ss * 0.60
    d.text((tx, ty), text, font=font, fill=BONE)
    # gold full stop
    dot_r = ss * 0.006
    d.ellipse([tx + tw + dot_r, ty + (bbox[3] - bbox[1]) * 0.82,
               tx + tw + dot_r * 3, ty + (bbox[3] - bbox[1]) * 0.82 + dot_r * 2], fill=GOLD)
    img = img.resize((s, s), Image.LANCZOS).convert("RGB")
    img.save(os.path.join(OUT, "splash.png"), optimize=True)
    img.save(os.path.join(OUT, "splash-dark.png"), optimize=True)


make_icon()
make_splash()
for f in ("icon-only.png", "splash.png", "splash-dark.png"):
    print(f, os.path.getsize(os.path.join(OUT, f)), "bytes")
