#!/usr/bin/env python3
"""Bake isometric_m_stencil_a_sleek.html at the attached view: tilt 8°, depth 35."""

from math import tan, pi, ceil
from pathlib import Path
import json

S, GAP, AXS = 1.5, 22, 1.3
ANG, D = 8.0, 35.0
PRESS = 16.0
W, PAD = 680.0, 36.0

M = [
    [0, 140],
    [0, 0],
    [40, 0],
    [115, 78],
    [190, 0],
    [230, 0],
    [230, 140],
    [190, 140],
    [190, 52],
    [115, 130],
    [40, 52],
    [40, 140],
]
A_RAW = [
    [[0, 140], [38, 0], [62, 0], [24, 140]],
    [[70, 0], [100, 140], [76, 140], [56, 58]],
    [[40, 104], [62, 104], [66, 120], [36, 120]],
]
AX = 230 + GAP
SOLIDS = [M] + [[[AX + p[0] * AXS, p[1]] for p in ring] for ring in A_RAW]

T = tan(ANG * pi / 180)


def shear(p):
    return [p[0] * S, p[1] * S + p[0] * S * T]


xs, ys = [], []
for ring in SOLIDS:
    for p in ring:
        q = shear(p)
        xs += [q[0]]
        ys += [q[1], q[1] + D]
minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
H = ceil(maxy - miny + PAD * 2)
OX = (W - (maxx - minx)) / 2 - minx
OY = PAD - miny


def pt(p, dy=0):
    q = shear(p)
    return (round(q[0] + OX, 1), round(q[1] + OY + dy, 1))


def fmt(p):
    return f"{p[0]:.1f} {p[1]:.1f}"


def poly(points):
    return "".join(("M" if n == 0 else "L") + fmt(p) for n, p in enumerate(points)) + "Z"


faces, sides_n, sides_p, stroke_n, stroke_p = [], [], [], [], []
for ring in SOLIDS:
    front_n = [pt(p) for p in ring]
    front_p = [pt(p, PRESS) for p in ring]
    faces.append(poly(front_n))
    stroke_n.append(poly(front_n))
    stroke_p.append(poly(front_p))

    area = 0.0
    n = len(ring)
    for k in range(n):
        a, b = pt(ring[k]), pt(ring[(k + 1) % n])
        area += a[0] * b[1] - b[0] * a[1]
    sgn = 1 if area > 0 else -1
    for k in range(n):
        a, b = pt(ring[k]), pt(ring[(k + 1) % n])
        ny = -(b[0] - a[0]) * sgn
        if ny <= 0.01:
            continue
        a2, b2 = (a[0], a[1] + D), (b[0], b[1] + D)
        ap, bp = (a[0], a[1] + PRESS), (b[0], b[1] + PRESS)
        sides_n.append(poly([a, b, b2, a2]))
        sides_p.append(poly([ap, bp, b2, a2]))
        stroke_n.append(poly([a, b, b2, a2]))
        stroke_p.append(poly([ap, bp, b2, a2]))

print(f"viewBox 0 0 {W:.0f} {H}")
print(f"faces {len(faces)} sides {len(sides_n)}")


def ts_list(vals):
    return "[\n" + ",\n".join(f"  '{v}'" for v in vals) + "\n]"


def ts_pairs(pairs):
    chunks = [f"  [\n    '{a}',\n    '{b}'\n  ]" for a, b in pairs]
    return "[\n" + ",\n".join(chunks) + "\n]"


tsx = (
    f"const VIEW_W = {W:.0f};\n"
    f"const VIEW_H = {H};\n\n"
    f"const FACE_FILLS = {ts_list(faces)};\n\n"
    f"const SIDES: Array<[string, string]> = {ts_pairs(list(zip(sides_n, sides_p)))};\n\n"
    f"const STROKE_NORMAL =\n  '{''.join(stroke_n)}';\n\n"
    f"const STROKE_PRESSED =\n  '{''.join(stroke_p)}';\n"
)
Path("/tmp/ma-consts.ts").write_text(tsx)
Path("/tmp/ma-paths.json").write_text(
    json.dumps({"view": [W, H], "faces": faces, "sides": len(sides_n)}, indent=2)
)
print("wrote /tmp/ma-consts.ts")
