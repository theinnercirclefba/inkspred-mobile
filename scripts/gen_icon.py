"""Inkspred app icon + splash: minimal ink-drop glyph on ink-950.

Run in CI (pip3 install pillow) to draw assets/icon-only.png, assets/splash.png,
assets/splash-dark.png which @capacitor/assets then turns into all iOS sizes."""
import math, os
from PIL import Image, ImageDraw

INK = (13, 13, 16, 255)         # #0d0d10
OXBLOOD = (140, 47, 57, 255)    # #8c2f39
GOLD = (201, 163, 95, 255)      # #c9a35f

SS = 4
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")
os.makedirs(OUT, exist_ok=True)


def teardrop(draw, cx, cy, R, apex_y, fill):
    d = cy - apex_y
    alpha = math.asin(R / d)
    ang = math.pi / 2 - alpha
    tp_left = (cx - R * math.sin(ang), cy - R * math.cos(ang))
    tp_right = (cx + R * math.sin(ang), cy - R * math.cos(ang))
    pts = [(cx, apex_y), tp_right]
    start = math.degrees(math.atan2(tp_right[1] - cy, tp_right[0] - cx))
    end = math.degrees(math.atan2(tp_left[1] - cy, tp_left[0] - cx))
    if end < start:
        end += 360
    steps = 200
    for i in range(steps + 1):
        t = math.radians(start + (end - start) * i / steps)
        pts.append((cx + R * math.cos(t), cy + R * math.sin(t)))
    pts.append(tp_left)
    draw.polygon(pts, fill=fill)


def render_glyph(size_px):
    img = Image.new("RGBA", (size_px, size_px), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size_px
    cx, cy, R = s * 0.5, s * 0.615, s * 0.27
    apex_y = s * 0.115
    teardrop(d, cx, cy, R, apex_y, OXBLOOD)
    r = s * 0.052
    hx, hy = cx - R * 0.42, cy - R * 0.42
    d.ellipse([hx - r, hy - r, hx + r, hy + r], fill=GOLD)
    return img


def make_icon():
    s = 1024 * SS
    img = Image.new("RGBA", (s, s), INK)
    glyph = render_glyph(int(s * 0.72))
    img.alpha_composite(glyph, (int(s * 0.14), int(s * 0.15)))
    img = img.resize((1024, 1024), Image.LANCZOS).convert("RGB")
    img.save(os.path.join(OUT, "icon-only.png"), optimize=True)


def make_splash():
    s = 2732
    ss = s * 2
    img = Image.new("RGBA", (ss, ss), INK)
    glyph = render_glyph(int(ss * 0.28))
    img.alpha_composite(glyph, (int(ss * 0.5 - ss * 0.14), int(ss * 0.5 - ss * 0.155)))
    img = img.resize((s, s), Image.LANCZOS).convert("RGB")
    img.save(os.path.join(OUT, "splash.png"), optimize=True)
    img.save(os.path.join(OUT, "splash-dark.png"), optimize=True)


make_icon()
make_splash()
for f in ("icon-only.png", "splash.png", "splash-dark.png"):
    print(f, os.path.getsize(os.path.join(OUT, f)), "bytes")
