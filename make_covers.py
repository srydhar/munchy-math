#!/usr/bin/env python3
"""Generate CrazyGames cover images for Munchy Math (16:9, 1:1, 2:3)."""
import math, os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.dirname(os.path.abspath(__file__))
F_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def gradient(w, h, c1=(123, 92, 255), c2=(54, 209, 220)):
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(0, w, 4):
            t = (x / w + y / h) / 2
            c = lerp(c1, c2, t)
            for dx in range(min(4, w - x)):
                px[x + dx, y] = c
    return img

def monster(d, cx, cy, r, color=(167, 139, 250)):
    dark = (35, 32, 77)
    # shadow
    d.ellipse([cx - r, cy + r * 0.82, cx + r, cy + r * 1.05], fill=(0, 0, 0, 60))
    # horns
    d.polygon([(cx - r * 0.55, cy - r * 0.55), (cx - r * 0.85, cy - r * 1.15), (cx - r * 0.25, cy - r * 0.75)], fill=color)
    d.polygon([(cx + r * 0.55, cy - r * 0.55), (cx + r * 0.85, cy - r * 1.15), (cx + r * 0.25, cy - r * 0.75)], fill=color)
    # body
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    hl = lerp(color, (255, 255, 255), 0.45)
    d.ellipse([cx - r * 0.75, cy - r * 0.8, cx + r * 0.2, cy - r * 0.05], fill=hl)
    d.ellipse([cx - r * 0.92, cy - r * 0.92, cx + r * 0.92, cy + r * 0.92], outline=None, fill=None)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=dark, width=max(3, int(r * 0.04)))
    # eyes
    for ex in (-0.34, 0.34):
        d.ellipse([cx + r * ex - r * 0.22, cy - r * 0.38, cx + r * ex + r * 0.22, cy + r * 0.06], fill=(255, 255, 255))
        d.ellipse([cx + r * ex - r * 0.10, cy - r * 0.24, cx + r * ex + r * 0.10, cy - r * 0.04], fill=dark)
        d.ellipse([cx + r * ex - 0.02 * r, cy - r * 0.22, cx + r * ex + 0.08 * r, cy - r * 0.12], fill=(255, 255, 255))
    # cheeks
    for ex in (-0.62, 0.62):
        d.ellipse([cx + r * ex - r * 0.14, cy + r * 0.12, cx + r * ex + r * 0.14, cy + r * 0.3], fill=(255, 158, 196))
    # open happy mouth
    d.ellipse([cx - r * 0.34, cy + r * 0.18, cx + r * 0.34, cy + r * 0.68], fill=dark)
    d.ellipse([cx - r * 0.2, cy + r * 0.44, cx + r * 0.2, cy + r * 0.68], fill=(255, 126, 179))

def food(d, cx, cy, r, color, num, font):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color, outline=(255, 255, 255), width=max(3, r // 12))
    tw = d.textbbox((0, 0), num, font=font)
    d.text((cx - (tw[2] - tw[0]) / 2, cy - (tw[3] - tw[1]) / 2 - tw[1]), num, font=font, fill=(255, 255, 255))

def title(d, W, cx, cy, size, text="Munchy Math", sub="Feed the monster. Master the math!"):
    f = ImageFont.truetype(F_BOLD, size)
    bb = d.textbbox((0, 0), text, font=f)
    x = cx - (bb[2] - bb[0]) / 2
    y = cy
    for ox, oy in [(-4, 4), (4, 4), (0, 6)]:
        d.text((x + ox, y + oy), text, font=f, fill=(35, 32, 77))
    d.text((x, y), text, font=f, fill=(255, 210, 63))
    fs = ImageFont.truetype(F_BOLD, int(size * 0.30))
    bb2 = d.textbbox((0, 0), sub, font=fs)
    d.text((cx - (bb2[2] - bb2[0]) / 2, y + (bb[3] - bb[1]) * 1.35), sub, font=fs, fill=(255, 255, 255))

FOODS = [(255, 107, 107), (78, 205, 196), (255, 210, 63), (67, 233, 123), (255, 140, 66)]

def cover_169():
    W, H = 1920, 1080
    img = gradient(W, H); d = ImageDraw.Draw(img, "RGBA")
    fnum = ImageFont.truetype(F_BOLD, 64)
    monster(d, 540, 560, 300)
    positions = [(1180, 330, 92, "12"), (1420, 560, 105, "7"), (1230, 800, 88, "25"),
                 (1650, 320, 72, "9"), (1680, 780, 78, "36")]
    for i, (x, y, r, n) in enumerate(positions):
        food(d, x, y, r, FOODS[i % len(FOODS)], n, fnum)
    # equation bubble
    fe = ImageFont.truetype(F_BOLD, 96)
    d.rounded_rectangle([320, 120, 800, 280], 60, fill=(255, 255, 255))
    d.polygon([(520, 280), (585, 280), (540, 340)], fill=(255, 255, 255))
    bb = d.textbbox((0, 0), "3 × 4 = ?", font=fe)
    d.text((560 - (bb[2] - bb[0]) / 2, 200 - (bb[3] - bb[1]) / 2 - bb[1]), "3 × 4 = ?", font=fe, fill=(35, 32, 77))
    title(d, W, 1350, 850, 118)
    img.save(os.path.join(OUT, "cover-1920x1080.png"))

def cover_sq():
    W = H = 800
    img = gradient(W, H); d = ImageDraw.Draw(img, "RGBA")
    fnum = ImageFont.truetype(F_BOLD, 40)
    monster(d, 400, 360, 210)
    for i, (x, y, r, n) in enumerate([(120, 160, 58, "7"), (680, 180, 62, "12"), (660, 560, 55, "9"), (130, 560, 50, "25")]):
        food(d, x, y, r, FOODS[i % len(FOODS)], n, fnum)
    title(d, W, 400, 615, 70)
    img.save(os.path.join(OUT, "cover-800x800.png"))

def cover_23():
    W, H = 600, 900
    img = gradient(W, H); d = ImageDraw.Draw(img, "RGBA")
    fnum = ImageFont.truetype(F_BOLD, 38)
    monster(d, 300, 380, 185)
    for i, (x, y, r, n) in enumerate([(95, 170, 52, "7"), (505, 200, 56, "12"), (500, 600, 50, "9"), (100, 590, 46, "25")]):
        food(d, x, y, r, FOODS[i % len(FOODS)], n, fnum)
    title(d, W, 300, 640, 62)
    img.save(os.path.join(OUT, "cover-600x900.png"))

cover_169(); cover_sq(); cover_23()
print("covers done")
