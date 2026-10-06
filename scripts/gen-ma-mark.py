#!/usr/bin/env python3
"""
Upright laid-down M only. Stems along screen-vertical (i+j),
V arms on the iso layout axes. Shifted up so it sits inside the box.
"""

from pathlib import Path
import json

UX, UY = 55.425, 32.0
OX, OY = 0.5, 256.58
KT, KB = 9.45, 8.45

A = 2.05
STEM = 3.25
W = 1.52
IV, JV = 5.55, 0.42


DX, DY = -236.0, -43.0


def iso(i, j, k):
    return (
        round(OX + UX * (i - j) + DX, 2),
        round(OY + UY * (i + j - k) + DY, 2),
    )


S = STEM
pts = [
    (IV - A - W, JV),
    (IV - A, JV),
    (IV, JV),
    (IV, JV - A),
    (IV, JV - A - W),
    (IV + S, JV - A - W + S),
    (IV + S, JV - A + S),
    (IV + W, JV - A + W),
    (IV + W, JV + W),
    (IV - A + W, JV + W),
    (IV - A + S, JV + S),
    (IV - A - W + S, JV + S),
]


def fmt(p):
    return f"{p[0]:.2f} {p[1]:.2f}"


def poly(points, close=True):
    s = "".join(("M" if n == 0 else "L") + fmt(p) for n, p in enumerate(points))
    return s + ("Z" if close else "")


def ring(k):
    return [iso(i, j, k) for i, j in pts]


def sides_at(kt):
    quads = []
    n = len(pts)
    for a in range(n):
        b = (a + 1) % n
        ia, ja = pts[a]
        ib, jb = pts[b]
        quads.append(
            [
                iso(ia, ja, kt),
                iso(ib, jb, kt),
                iso(ib, jb, KB),
                iso(ia, ja, KB),
            ]
        )
    return quads


# Bottom edges the front-facing rule skips but that are visible:
# 2-3 right V underside, 3-4 right peak underside, 10-11 left foot.
EXTRA_BOTTOMS = {(2, 3), (3, 4), (8, 9), (10, 11)}


def strokes_at(kt):
    top, bot = ring(kt), ring(KB)
    segs = [poly(top, close=False) + f"L{fmt(top[0])}"]
    n = len(pts)
    for a in range(n):
        segs.append(f"M{fmt(top[a])}L{fmt(bot[a])}")
        ia, ja = pts[a]
        ib, jb = pts[(a + 1) % n]
        nxt = (a + 1) % n
        if (ib - ia) + (jb - ja) > 0.02 or (a, nxt) in EXTRA_BOTTOMS:
            segs.append(f"M{fmt(bot[a])}L{fmt(bot[nxt])}")
    return "".join(segs)


def extend_line(p0, p1, span=1800):
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    length = (dx * dx + dy * dy) ** 0.5 or 1
    ux, uy = dx / length, dy / length
    a = (p0[0] - ux * span, p0[1] - uy * span)
    b = (p0[0] + ux * span, p0[1] + uy * span)
    return f"M{a[0]:.2f} {a[1]:.2f}L{b[0]:.2f} {b[1]:.2f}"


xs, ys = [], []
for k in (KT, KB):
    for i, j in pts:
        x, y = iso(i, j, k)
        xs.append(x)
        ys.append(y)
print(f"bounds x[{min(xs):.1f},{max(xs):.1f}] y[{min(ys):.1f},{max(ys):.1f}]")

top = ring(KT)
guides = [
    extend_line(top[0], top[2]),
    extend_line(top[2], top[4]),
    extend_line(top[8], top[7]),
]

faces = [poly(top)]
sides_n = sides_at(KT)
sides_p = sides_at(KT - 0.5)
stroke_n = strokes_at(KT)
stroke_p = strokes_at(KT - 0.5)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 556 354" width="1112" height="708">
  <rect width="556" height="354" fill="#09090b"/>
  <rect x="0.5" y="0.5" width="555" height="353" fill="none" stroke="#333"/>
  <g stroke="#444" stroke-width="1" stroke-dasharray="4 2" fill="none">
    {"".join(f'<path d="{g}"/>' for g in guides)}
  </g>
  <path fill="#0c0c0c" d="{''.join(poly(s) for s in sides_n)}"/>
  <path fill="#161616" d="{faces[0]}"/>
  <path fill="none" stroke="#d0d0d0" stroke-width="1.15" d="{stroke_n}"/>
</svg>'''
Path("/tmp/m-only.svg").write_text(svg)
Path("/tmp/m-paths.json").write_text(
    json.dumps(
        {
            "faces": faces,
            "sides_normal": [poly(s) for s in sides_n],
            "sides_pressed": [poly(s) for s in sides_p],
            "stroke_normal": stroke_n,
            "stroke_pressed": stroke_p,
            "guides": guides,
        },
        indent=2,
    )
)
print("ok")
