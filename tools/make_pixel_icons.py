#!/usr/bin/env python3
"""Génère les icônes statiques « info » en pixel art bleu, fond transparent.

Sans badge à éviter, le mot est centré verticalement ; la grille de 16 px est
agrandie d'un facteur entier pour chaque taille.

Usage : python3 tools/make_pixel_icons.py
"""

import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = [os.path.join(ROOT, "chrome", "icons"), os.path.join(ROOT, "firefox", "icons")]
SIZES = [16, 32, 48, 128]
BLUE = (0x00, 0x98, 0xFF, 255)
GRID = 16

# « info » sur 16 × 7 : i (2) · n (4) · f (3) · o (4), espaces de 1 px.
INFO_PIXELS = [
    "##.......##.....",
    "........##......",
    "##.###..###..##.",
    "##.##.#.##..#..#",
    "##.##.#.##..#..#",
    "##.##.#.##..#..#",
    "##.##.#.##...##.",
]


def read_grid():
    return INFO_PIXELS


def render(rows, size):
    k = size // GRID
    top = (GRID - len(rows)) // 2
    pixels = [[(0, 0, 0, 0)] * size for _ in range(size)]
    for gy, row in enumerate(rows):
        for gx, ch in enumerate(row):
            if ch != "#":
                continue
            for y in range((top + gy) * k, (top + gy + 1) * k):
                for x in range(gx * k, (gx + 1) * k):
                    pixels[y][x] = BLUE
    return pixels


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
    rows = read_grid()
    for folder in TARGETS:
        for size in SIZES:
            path = os.path.join(folder, f"icon-{size}.png")
            write_png(path, render(rows, size))
            print(os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main()
