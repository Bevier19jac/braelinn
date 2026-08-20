#!/usr/bin/env python3
"""
Generates every icon + the social share card for Braelinn Poker League.

Run:  python3 make-assets.py

Everything is drawn from the same palette as styles.css so the icons, the
share card and the app itself read as one product. Re-run it any time the
brand changes; it overwrites in place.

WHY A SEPARATE MASKABLE ICON: Android crops maskable icons to a circle or
squircle and only guarantees the middle ~80% is visible. An icon that fills
its frame gets its edges shaved off. So the maskable variant draws the same
mark at ~55% scale on a full-bleed background, and the regular variant fills
more of the frame for platforms that don't crop.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math

FELT_DARK = (6, 18, 13)
FELT_MID  = (15, 42, 30)
FELT_HI   = (29, 91, 63)
BRASS     = (217, 171, 82)
BRASS_HI  = (240, 201, 121)
CREAM     = (242, 246, 243)
MUTE      = (168, 189, 178)

SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SANS  = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


# ---------------------------------------------------------------- shapes ---
def spade(d, cx, cy, s, fill):
    """
    Spade centred on (cx, cy); total height about 2*s.
    Built as: two lobes + a triangle that overlaps them (so there is no seam)
    + a flared stem that starts INSIDE the lobes rather than below them.
    """
    lobe_r = s * 0.50
    lobe_cy = cy + s * 0.18
    # lobes
    d.ellipse([cx - s * 0.98, lobe_cy - lobe_r, cx + s * 0.02, lobe_cy + lobe_r], fill=fill)
    d.ellipse([cx - s * 0.02, lobe_cy - lobe_r, cx + s * 0.98, lobe_cy + lobe_r], fill=fill)
    # blade — apex above, base overlapping the lobe centres so it fuses cleanly
    d.polygon([(cx, cy - s * 0.98),
               (cx - s * 0.96, lobe_cy + s * 0.06),
               (cx + s * 0.96, lobe_cy + s * 0.06)], fill=fill)
    # stem — starts inside the lobes, flares out at the foot
    d.polygon([(cx - s * 0.11, lobe_cy),
               (cx + s * 0.11, lobe_cy),
               (cx + s * 0.34, cy + s * 0.98),
               (cx - s * 0.34, cy + s * 0.98)], fill=fill)


def heart(d, cx, cy, s, fill):
    r = s * 0.55
    d.ellipse([cx - r * 1.85, cy - r * 1.15, cx + r * 0.05, cy + r * 0.5], fill=fill)
    d.ellipse([cx - r * 0.05, cy - r * 1.15, cx + r * 1.85, cy + r * 0.5], fill=fill)
    d.polygon([(cx - s * 0.98, cy - s * 0.05), (cx + s * 0.98, cy - s * 0.05),
               (cx, cy + s * 1.0)], fill=fill)


def diamond(d, cx, cy, s, fill):
    d.polygon([(cx, cy - s), (cx + s * 0.72, cy), (cx, cy + s), (cx - s * 0.72, cy)], fill=fill)


def club(d, cx, cy, s, fill):
    r = s * 0.46
    d.ellipse([cx - r, cy - s * 0.95, cx + r, cy - s * 0.95 + 2 * r], fill=fill)
    d.ellipse([cx - s * 0.95, cy - r * 0.35, cx - s * 0.95 + 2 * r, cy + r * 1.65], fill=fill)
    d.ellipse([cx + s * 0.95 - 2 * r, cy - r * 0.35, cx + s * 0.95, cy + r * 1.65], fill=fill)
    d.polygon([(cx - s * 0.30, cy + s * 1.02), (cx + s * 0.30, cy + s * 1.02),
               (cx + s * 0.10, cy + s * 0.25), (cx - s * 0.10, cy + s * 0.25)], fill=fill)


def felt(size, cx_frac=0.5, cy_frac=0.28):
    """Radial felt background with a subtle woven texture."""
    w, h = size
    img = Image.new("RGB", (w, h), FELT_DARK)
    d = ImageDraw.Draw(img)
    cx, cy = w * cx_frac, h * cy_frac
    maxr = math.hypot(max(cx, w - cx), max(cy, h - cy))
    steps = 90
    for i in range(steps, 0, -1):
        t = i / steps
        r = maxr * t
        col = tuple(int(FELT_DARK[j] + (FELT_HI[j] - FELT_DARK[j]) * (1 - t) ** 1.7) for j in range(3))
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    # weave
    tex = Image.new("L", (w, h), 0)
    td = ImageDraw.Draw(tex)
    step = max(3, w // 260)
    for x in range(-h, w, step * 2):
        td.line([(x, 0), (x + h, h)], fill=14, width=1)
        td.line([(x, h), (x + h, 0)], fill=8, width=1)
    img = Image.composite(Image.new("RGB", (w, h), (255, 255, 255)), img, tex.point(lambda v: v // 3))
    return img


def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m


# ----------------------------------------------------------------- icons ---
def make_icon(px, mark_scale, rounded, ring=True):
    """mark_scale = spade height as a fraction of the canvas."""
    S = px * 4                      # supersample for clean edges
    img = felt((S, S), 0.5, 0.36)
    d = ImageDraw.Draw(img)

    if ring:
        pad = S * 0.085
        d.ellipse([pad, pad, S - pad, S - pad], outline=BRASS, width=max(2, int(S * 0.016)))
        pad2 = S * 0.115
        d.ellipse([pad2, pad2, S - pad2, S - pad2], outline=BRASS, width=max(1, int(S * 0.005)))

    spade(d, S / 2, S * 0.50, S * mark_scale, BRASS_HI)

    img = img.resize((px, px), Image.LANCZOS)
    if rounded:
        img = img.convert("RGBA")
        img.putalpha(rounded_mask((px, px), int(px * 0.22)))
    return img


def make_favicon(px):
    """Tiny sizes need a bolder, simpler mark — no rings, bigger spade."""
    S = px * 8
    img = felt((S, S), 0.5, 0.4)
    d = ImageDraw.Draw(img)
    spade(d, S / 2, S * 0.52, S * 0.34, BRASS_HI)
    return img.resize((px, px), Image.LANCZOS)


# ------------------------------------------------------------ social card ---
def make_social(path):
    W, H = 1200, 630
    img = felt((W, H), 0.5, 0.18)
    d = ImageDraw.Draw(img)

    # vignette
    v = Image.new("L", (W, H), 0)
    vd = ImageDraw.Draw(v)
    for i in range(70):
        t = i / 70
        vd.rectangle([int(W * t * 0.06), int(H * t * 0.06),
                      W - int(W * t * 0.06), H - int(H * t * 0.06)],
                     outline=int(3 + 3 * (1 - t)))
    img = Image.composite(Image.new("RGB", (W, H), FELT_DARK), img, v)
    d = ImageDraw.Draw(img)

    # brass frame
    d.rounded_rectangle([26, 26, W - 27, H - 27], radius=18, outline=BRASS, width=3)
    d.rounded_rectangle([36, 36, W - 37, H - 37], radius=13, outline=(*BRASS, ), width=1)

    # suit row, top
    y = 138
    gap = 78
    xs = [W / 2 - gap * 1.5, W / 2 - gap * 0.5, W / 2 + gap * 0.5, W / 2 + gap * 1.5]
    spade(d,   xs[0], y, 26, BRASS)
    heart(d,   xs[1], y, 26, (200, 92, 92))
    diamond(d, xs[2], y, 28, (200, 92, 92))
    club(d,    xs[3], y, 26, BRASS)

    # wordmark
    f_big = ImageFont.truetype(SERIF, 108)
    f_sub = ImageFont.truetype(SANS, 30)
    f_tag = ImageFont.truetype(SANS, 25)

    def centre(txt, font, cy, fill, spacing=0):
        if spacing:
            widths = [d.textlength(c, font=font) for c in txt]
            total = sum(widths) + spacing * (len(txt) - 1)
            x = (W - total) / 2
            for c, cw in zip(txt, widths):
                d.text((x, cy), c, font=font, fill=fill)
                x += cw + spacing
        else:
            w = d.textlength(txt, font=font)
            d.text(((W - w) / 2, cy), txt, font=font, fill=fill)

    centre("BRAELINN", f_big, 208, CREAM)
    centre("P O K E R   L E A G U E", f_sub, 340, BRASS_HI, spacing=2)

    # divider
    d.line([(W / 2 - 190, 400), (W / 2 + 190, 400)], fill=BRASS, width=2)
    d.ellipse([W / 2 - 5, 395, W / 2 + 5, 405], fill=BRASS_HI)

    centre("Season 7  ·  Peachtree City, GA", f_tag, 432, MUTE)
    centre("Standings · RSVP · Seat Draw · Game Night", f_tag, 476, MUTE)

    # corner pips
    for (cx, cy) in [(78, 78), (W - 78, 78), (78, H - 78), (W - 78, H - 78)]:
        spade(d, cx, cy, 17, (*BRASS,))

    img.save(path, "PNG", optimize=True)
    return img.size


# -------------------------------------------------------------------- run ---
if __name__ == "__main__":
    made = []

    # Regular icons — mark fills more of the frame.
    for px in (192, 512):
        p = f"icon-{px}.png"
        make_icon(px, 0.26, rounded=False).save(p, "PNG", optimize=True)
        made.append(p)

    # Maskable — smaller mark, full bleed, safe inside Android's crop.
    for px in (192, 512):
        p = f"icon-maskable-{px}.png"
        make_icon(px, 0.26, rounded=False, ring=False).save(p, "PNG", optimize=True)
        made.append(p)

    # Apple touch icon — iOS applies its own rounding, so ship a square.
    make_icon(180, 0.26, rounded=False).save("apple-touch-icon.png", "PNG", optimize=True)
    made.append("apple-touch-icon.png")

    # Favicons
    make_favicon(32).save("favicon-32.png", "PNG", optimize=True)
    make_favicon(16).save("favicon-16.png", "PNG", optimize=True)
    made += ["favicon-32.png", "favicon-16.png"]
    ico = make_favicon(64)
    ico.save("favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    made.append("favicon.ico")

    print("social-card.png", make_social("social-card.png"))
    made.append("social-card.png")

    import os
    for m in made:
        print(f"  {m:26} {os.path.getsize(m):>7,} bytes")
