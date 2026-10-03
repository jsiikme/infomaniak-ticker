#!/usr/bin/env python3
"""Génère les icônes PNG de l'extension (k bleu Infomaniak + INFO sur tuile blanche).

Sans dépendance externe : rendu vectoriel avec sur-échantillonnage + encodeur PNG stdlib.
Usage : python3 tools/generate_icons.py
"""

import math
import os
import struct
import zlib

BLUE = (0x00, 0x98, 0xFF, 255)
NAVY = (0x11, 0x29, 0x62, 255)
BORDER = (0xE4, 0xE7, 0xEC, 255)
WHITE = (255, 255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)

BASE = 128
SS = 4

R_RECT = 24.0
INSET = 0.5
BORDER_W = 1.5

K_STROKE = 11.0
K_X = 22.0
K_Y0, K_Y1 = 45.0, 83.0
K_MID = 64.0
K_ARM = (42.0, 42.0)
K_LEG = (45.0, 79.0)

INFO_H = 21.0
INFO_STROKE = 5.5
GAP_K = 12.0
GAP = 3.5


def build_k_segments(shift):
    x = K_X + shift
    return [
        (x, K_Y0, x, K_Y1),
        (x, K_MID, K_ARM[0] + shift, K_ARM[1]),
        (x, K_MID, K_LEG[0] + shift, K_LEG[1]),
    ]


def build_info(shift):
    y0 = K_MID - INFO_H / 2
    y1 = K_MID + INFO_H / 2
    w_i = INFO_STROKE
    w_n = 0.72 * INFO_H
    w_f = 0.62 * INFO_H
    w_o = INFO_H
    segs = []
    x = K_X + K_STROKE / 2 + GAP_K + shift

    segs.append((x, y0, x, y1))
    x += w_i + GAP

    segs.extend([(x, y1, x, y0), (x, y0, x + w_n, y1), (x + w_n, y1, x + w_n, y0)])
    x += w_n + GAP

    segs.extend([(x, y1, x, y0), (x, y0, x + w_f, y0), (x, (y0 + y1) / 2, x + w_f * 0.72, (y0 + y1) / 2)])
    x += w_f + GAP

    ring = (x + w_o / 2, (y0 + y1) / 2, w_o / 2 - INFO_STROKE / 2)
    return segs, ring, x + w_o


def layout():
    k_left = K_X - K_STROKE / 2
    k_right = K_LEG[0] + K_STROKE / 2
    info_width = INFO_STROKE + GAP + 0.72 * INFO_H + GAP + 0.62 * INFO_H + GAP + INFO_H
    total = (k_right - k_left) + GAP_K + info_width
    shift = (BASE - total) / 2 - k_left
    k_segs = build_k_segments(shift)
    info_segs, ring, o_end = build_info(shift)
    return k_segs, info_segs, ring


K_SEGS, INFO_SEGS, INFO_RING = layout()


def in_rounded_rect(u, v, x0, y0, x1, y1, r):
    if u < x0 or u > x1 or v < y0 or v > y1:
        return False
    cx = min(max(u, x0 + r), x1 - r)
    cy = min(max(v, y0 + r), y1 - r)
    return (u - cx) ** 2 + (v - cy) ** 2 <= r * r


def dist_to_segment(px, py, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    length_sq = dx * dx + dy * dy
    if length_sq == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / length_sq))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def sample(u, v):
    outer = (INSET, INSET, BASE - INSET, BASE - INSET)
    if not in_rounded_rect(u, v, *outer, R_RECT):
        return TRANSPARENT
    inner = (
        INSET + BORDER_W,
        INSET + BORDER_W,
        BASE - INSET - BORDER_W,
        BASE - INSET - BORDER_W,
    )
    if not in_rounded_rect(u, v, *inner, R_RECT - BORDER_W):
        return BORDER
    for x1, y1, x2, y2 in K_SEGS:
        if dist_to_segment(u, v, x1, y1, x2, y2) <= K_STROKE / 2:
            return BLUE
    for x1, y1, x2, y2 in INFO_SEGS:
        if dist_to_segment(u, v, x1, y1, x2, y2) <= INFO_STROKE / 2:
            return NAVY
    cx, cy, r = INFO_RING
    if abs(math.hypot(u - cx, v - cy) - r) <= INFO_STROKE / 2:
        return NAVY
    return WHITE


def render(size):
    big = size * SS
    grid = [[None] * big for _ in range(big)]
    for y in range(big):
        v = (y + 0.5) / SS
        row = grid[y]
        for x in range(big):
            row[x] = sample((x + 0.5) / SS, v)

    pixels = [[0] * (size * 4) for _ in range(size)]
    for py in range(size):
        for px in range(size):
            r = g = b = a = 0
            for sy in range(SS):
                row = grid[py * SS + sy]
                for sx in range(SS):
                    pr, pg, pb, pa = row[px * SS + sx]
                    r += pr
                    g += pg
                    b += pb
                    a += pa
            n = SS * SS
            base_index = px * 4
            pixels[py][base_index] = r // n
            pixels[py][base_index + 1] = g // n
            pixels[py][base_index + 2] = b // n
            pixels[py][base_index + 3] = a // n
    return pixels


def write_png(path, size, pixels):
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        raw.extend(row)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as fh:
        fh.write(png)


def main():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "icons")
    os.makedirs(out_dir, exist_ok=True)
    for size in [16, 32, 48, 128]:
        path = os.path.join(out_dir, f"icon-{size}.png")
        write_png(path, size, render(size))
        print(f"Créé {os.path.normpath(path)} ({size}x{size})")


if __name__ == "__main__":
    main()
