#!/usr/bin/env python3
"""Génère les icônes statiques : logotype « info » officiel, bleu, fond transparent.

Le tracé (INFO_PATH) est lu dans chrome/background.js pour rester identique à
l'icône dynamique. Sans badge à éviter, le mot est centré dans le carré.
Rendu sans dépendance : remplissage pair-impair par lignes de balayage,
sur-échantillonné 8 × 8 par pixel.

Usage : python3 tools/make_logo_icons.py
"""

import bisect
import os
import re
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "chrome", "background.js")
TARGETS = [os.path.join(ROOT, "chrome", "icons"), os.path.join(ROOT, "firefox", "icons")]
SIZES = [16, 32, 48, 128]
BLUE = (0x00, 0x98, 0xFF)
SS = 8
BEZIER_STEPS = 16

NUM = re.compile(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")
CMD = re.compile(r"[MmHhVvLlCcSsZz]")


def read_path():
    src = open(SOURCE, encoding="utf-8").read()
    m = re.search(r"const INFO_PATH =\s*'([^']+)'", src)
    if not m:
        raise SystemExit(f"INFO_PATH introuvable dans {SOURCE}")
    return m.group(1)


def flatten(d):
    """Convertit le tracé SVG en polygones fermés (m, h, v, l, c, s, z)."""
    polys, cur = [], []
    x = y = sx = sy = 0.0
    last_ctrl = None
    for m in CMD.finditer(d):
        cmd = m.group(0)
        nxt = CMD.search(d, m.end())
        args = [float(v) for v in NUM.findall(d[m.end() : nxt.start() if nxt else len(d)])]
        rel = cmd.islower()
        c = cmd.lower()
        if c == "m":
            if cur:
                polys.append(cur)
            for i in range(0, len(args), 2):
                dx, dy = args[i], args[i + 1]
                # Un « m » initial est absolu, même en minuscule.
                x, y = (x + dx, y + dy) if rel and (polys or cur or i) else (dx, dy)
                if i == 0:
                    sx, sy, cur = x, y, [(x, y)]
                else:
                    cur.append((x, y))
            last_ctrl = None
        elif c in "hv":
            for a in args:
                if c == "h":
                    x = x + a if rel else a
                else:
                    y = y + a if rel else a
                cur.append((x, y))
            last_ctrl = None
        elif c == "l":
            for i in range(0, len(args), 2):
                x, y = (x + args[i], y + args[i + 1]) if rel else (args[i], args[i + 1])
                cur.append((x, y))
            last_ctrl = None
        elif c in "cs":
            n = 6 if c == "c" else 4
            for i in range(0, len(args), n):
                a = args[i : i + n]
                ox, oy = (x, y) if rel else (0.0, 0.0)
                if c == "c":
                    p1 = (ox + a[0], oy + a[1])
                    p2, p3 = (ox + a[2], oy + a[3]), (ox + a[4], oy + a[5])
                else:
                    p1 = (2 * x - last_ctrl[0], 2 * y - last_ctrl[1]) if last_ctrl else (x, y)
                    p2, p3 = (ox + a[0], oy + a[1]), (ox + a[2], oy + a[3])
                p0 = (x, y)
                for k in range(1, BEZIER_STEPS + 1):
                    t = k / BEZIER_STEPS
                    u = 1 - t
                    cur.append(
                        (
                            u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                            u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
                        )
                    )
                last_ctrl = p2
                x, y = p3
        elif c == "z":
            if cur:
                polys.append(cur)
                cur = []
            x, y = sx, sy
            last_ctrl = None
    if cur:
        polys.append(cur)
    return polys


def render(polys, size):
    xs = [p[0] for poly in polys for p in poly]
    ys = [p[1] for poly in polys for p in poly]
    bx, by, bw, bh = min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)
    margin = size / 32
    scale = (size - 2 * margin) / bw
    ox = (size - bw * scale) / 2 - bx * scale
    oy = (size - bh * scale) / 2 - by * scale
    edges = [
        (ox + a[0] * scale, oy + a[1] * scale, ox + b[0] * scale, oy + b[1] * scale)
        for poly in polys
        for a, b in zip(poly, poly[1:] + poly[:1])
    ]

    cover = [[0] * size for _ in range(size)]
    n = size * SS
    for sy in range(n):
        yy = (sy + 0.5) / SS
        crossings = sorted(
            x0 + (yy - y0) * (x1 - x0) / (y1 - y0)
            for x0, y0, x1, y1 in edges
            if (y0 <= yy < y1) or (y1 <= yy < y0)
        )
        row = cover[sy // SS]
        for sx in range(n):
            if bisect.bisect_right(crossings, (sx + 0.5) / SS) % 2:
                row[sx // SS] += 1
    full = SS * SS
    return [[(*BLUE, round(255 * c / full)) for c in row] for row in cover]


def write_png(path, pixels):
    size = len(pixels)
    raw = b"".join(b"\x00" + b"".join(bytes(p) for p in row) for row in pixels)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def main():
    polys = flatten(read_path())
    for folder in TARGETS:
        for size in SIZES:
            path = os.path.join(folder, f"icon-{size}.png")
            write_png(path, render(polys, size))
            print(os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main()
