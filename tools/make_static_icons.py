#!/usr/bin/env python3
"""Génère les icônes statiques (tuile blanche + logotype « info » officiel étiré).

Usage : python3 tools/make_static_icons.py <dossier_sortie> <préfixe_fichier>
Exemples :
  python3 tools/make_static_icons.py icons "icon-"      -> icons/icon-16.png … (kStock-ticker)
  python3 tools/make_static_icons.py icons "icon"       -> icons/icon16.png …  (infomaniak-ticker)
"""

import math
import os
import re
import struct
import zlib

SVG_PATH = "/Users/juliensilvestrini/kDrive2/logo-infomaniak.svg"
N_GLYPH_SUBPATHS = 5
SS = 4
SIZES = [16, 32, 48, 128]

BLUE = (0x00, 0x98, 0xFF, 255)  # tuile
LETTER = (255, 255, 255, 255)  # lettres blanches sur la tuile bleue
TRANSPARENT = (0, 0, 0, 0)

BASE = 128.0
R_RECT = 24.0

LOGO_X, LOGO_Y, LOGO_W, LOGO_H = 2.0, -8.0, 124.0, 100.0

NUM = re.compile(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")
CMD = re.compile(r"[mhvlcsz]", re.IGNORECASE)


def tokenize_path(d):
    tokens = []
    for m in CMD.finditer(d):
        start = m.end()
        nxt = CMD.search(d, start)
        nums = NUM.findall(d[start : nxt.start() if nxt else len(d)])
        tokens.append((m.group(0).lower(), [float(x) for x in nums]))
    return tokens


def flatten(tokens):
    subpaths = []
    cur = []
    x = y = 0.0
    sx = sy = 0.0
    for cmd, args in tokens:
        if cmd == "m":
            if cur:
                subpaths.append(cur)
            x, y = (args[0], args[1]) if not subpaths else (x + args[0], y + args[1])
            sx, sy = x, y
            cur = [(x, y)]
        elif cmd in ("h", "v"):
            for a in args:
                if cmd == "h":
                    x += a
                else:
                    y += a
                cur.append((x, y))
        elif cmd == "l":
            it = iter(args)
            for a, b in zip(it, it):
                x, y = x + a, y + b
                cur.append((x, y))
        elif cmd == "c":
            it = iter(args)
            for x1, y1, x2, y2, x3, y3 in zip(it, it, it, it, it, it):
                p0 = (x, y)
                p1 = (x + x1, y + y1)
                p2 = (x + x2, y + y2)
                p3 = (x + x3, y + y3)
                for i in range(1, 13):
                    t = i / 12
                    mt = 1 - t
                    cur.append(
                        (
                            mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0],
                            mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1],
                        )
                    )
                x, y = p3
        elif cmd == "s":
            it = iter(args)
            for x2, y2, x3, y3 in zip(it, it, it, it):
                p0 = (x, y)
                p2 = (x + x2, y + y2)
                p3 = (x + x3, y + y3)
                p1 = (2 * x - p0[0], 2 * y - p0[1])
                for i in range(1, 13):
                    t = i / 12
                    mt = 1 - t
                    cur.append(
                        (
                            mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0],
                            mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1],
                        )
                    )
                x, y = p3
        elif cmd == "z":
            if cur:
                cur.append((sx, sy))
                subpaths.append(cur)
                cur = []
            x, y = sx, sy
    if cur:
        subpaths.append(cur)
    return subpaths


def load_logo_subpaths():
    with open(SVG_PATH, "r", encoding="utf-8") as fh:
        svg = fh.read()
    d = re.search(r'\bd="([^"]+)"', svg).group(1)
    subpaths = flatten(tokenize_path(d))[:N_GLYPH_SUBPATHS]
    xs = [p[0] for poly in subpaths for p in poly]
    ys = [p[1] for poly in subpaths for p in poly]
    return subpaths, min(xs), min(ys), max(xs), max(ys)


def in_rounded_rect(u, v, x0, y0, x1, y1, r):
    if u < x0 or u > x1 or v < y0 or v > y1:
        return False
    cx = min(max(u, x0 + r), x1 - r)
    cy = min(max(v, y0 + r), y1 - r)
    return (u - cx) ** 2 + (v - cy) ** 2 <= r * r


def sample(u, v, subpaths, lx0, ly0, lw, lh):
    if not in_rounded_rect(u, v, 0.0, 0.0, BASE, BASE, R_RECT):
        return TRANSPARENT
    px = lx0 + (u - LOGO_X) * lw / LOGO_W
    py = ly0 + (v - LOGO_Y) * lh / LOGO_H
    inside = False
    for poly in subpaths:
        n = len(poly)
        for i in range(n - 1):
            (xa, ya), (xb, yb) = poly[i], poly[i + 1]
            if (ya <= py < yb) or (yb <= py < ya):
                xin = xa + (py - ya) * (xb - xa) / (yb - ya)
                if px < xin:
                    inside = not inside
    return LETTER if inside else BLUE


def render(size, subpaths, lx0, ly0, lw, lh):
    pixels = [[0] * (size * 4) for _ in range(size)]
    for py in range(size):
        for px in range(size):
            pr = pg = pb = pa = 0
            for dy in (-0.25, 0.25):
                for dx in (-0.25, 0.25):
                    uu = min(BASE - 0.001, max(0.0, (px + 0.5 + dx) * BASE / size))
                    vv = min(BASE - 0.001, max(0.0, (py + 0.5 + dy) * BASE / size))
                    r, g, b, a = sample(uu, vv, subpaths, lx0, ly0, lw, lh)
                    pr += r
                    pg += g
                    pb += b
                    pa += a
            n = 4
            base_index = px * 4
            pixels[py][base_index] = pr // n
            pixels[py][base_index + 1] = pg // n
            pixels[py][base_index + 2] = pb // n
            pixels[py][base_index + 3] = pa // n
    return pixels


def write_png(path, size, pixels):
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        raw.extend(row)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as fh:
        fh.write(png)


def main():
    import sys

    out_dir = sys.argv[1] if len(sys.argv) > 1 else "icons"
    prefix = sys.argv[2] if len(sys.argv) > 2 else "icon-"
    subpaths, lx0, ly0, lx1, ly1 = load_logo_subpaths()
    lw, lh = lx1 - lx0, ly1 - ly0
    os.makedirs(out_dir, exist_ok=True)
    for size in SIZES:
        path = os.path.join(out_dir, f"{prefix}{size}.png")
        write_png(path, size, render(size, subpaths, lx0, ly0, lw, lh))
        print(f"Créé {os.path.normpath(path)} ({size}x{size})")


if __name__ == "__main__":
    main()
