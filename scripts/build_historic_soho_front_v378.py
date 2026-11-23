"""Fit the photographed limestone piers, cornices and dark street-floor glazing of Kaufhaus Jonaß.

The two registered exterior photographs and twenty-six-edge official front are named
in historicArchitectureV378SpecialEvidence.json. Only matching previously measured
street windows are eligible. Native fittings must sit on a genuinely exposed face.
"""

import json
import math
from pathlib import Path

from shapely.geometry import LineString, Point

p = Path(__file__).resolve().parents[1] / "src/app/src/data"
d = json.load(open(p / "alexanderNorthV166Evidence.json"))
source = json.load(open(p / "alexanderNorthV166Source.json"))
rt = next(v for v in d["parts"] if v["id"] == "DEBE3DRi4wQ35v8J")["ring"]
faces = []
for j in range(15, 26):
  a, b = rt[j], rt[(j + 1) % len(rt)]
  length = math.dist(a, b)
  dx = (b[0] - a[0]) / length
  dz = (b[1] - a[1]) / length
  faces.append((LineString([a, b]), dx, dz, dz, -dx))
draw = []
nat = []
keys = set()
blocks = [v for v in source["nativeRuns"] if 2970 < v[0] < 3062 and -947 < v[2] < -867]


def cells(part, base, dx, dz, nx, nz, width, height, color):
  x, y, z = base
  yaw = math.atan2(-dz, dx)
  draw.append(
    [
      round(x + nx * 0.205, 3),
      round(y, 3),
      round(z + nz * 0.205, 3),
      round(width, 3),
      round(height, 3),
      0.16,
      round(yaw, 6),
      color,
    ]
  )
  # Preserve the step profile; never project a whole diagonal strip through blocks.
  span = max(1, math.ceil(width / 1.65))
  for k in range(span):
    u = width * ((k + 0.5) / span - 0.5)
    xx = x + u * dx
    zz = z + u * dz
    opts = []
    for bx, by, bz, w, h, dep, _ in blocks:
      if not by - h / 2 + 0.06 <= y <= by + h / 2 - 0.06:
        continue
      for axis, (n, along, at, trans, half, t0, t1) in enumerate(
        [
          (nx, zz, xx, bx, w / 2, bz - dep / 2, bz + dep / 2),
          (nz, xx, zz, bz, dep / 2, bx - w / 2, bx + w / 2),
        ]
      ):
        if abs(n) < 0.36 or not t0 - 0.01 <= along <= t1 + 0.01:
          continue
        face = trans + math.copysign(half, n)
        dr = (face - at) * math.copysign(1, n)
        if not -1.45 <= dr <= 2.1:
          continue
        # A physical outward face exists only if the adjacent half-space is free.
        xp = face + math.copysign(0.15, n) if not axis else xx
        zp = zz if not axis else face + math.copysign(0.15, n)
        if any(
          sx - sw / 2 + 0.001 < xp < sx + sw / 2 - 0.001
          and sz - sd / 2 + 0.001 < zp < sz + sd / 2 - 0.001
          and sy - sh / 2 < y < sy + sh / 2
          for sx, sy, sz, sw, sh, sd, _ in blocks
        ):
          continue
        start = max(t0 + 0.025, along - width / span / 2)
        end = min(t1 - 0.025, along + width / span / 2)
        if end - start < 0.09:
          continue
        coord = face + math.copysign(0.085, n)
        mid = (start + end) / 2
        bottom = max(by - h / 2, y - height / 2)
        top = min(by + h / 2, y + height / 2)
        if top - bottom < 0.08:
          continue
        row = (
          [coord, (top + bottom) / 2, mid, 0.15, top - bottom, end - start, color]
          if not axis
          else [mid, (top + bottom) / 2, coord, end - start, top - bottom, 0.15, color]
        )
        opts.append((abs(dr) + 0.4 * (1 - abs(n)), row))
    if opts:
      a = min(opts, key=lambda v: v[0])[1]
      t = tuple(round(v, 3) if isinstance(v, float) else v for v in a)
      if t not in keys:
        nat.append(t)
        keys.add(t)


for x, y, z, w, h, depth, yaw, col in source["facadeBoxes"]:
  if col != 0x50676C or x >= 3100 or z < -919 or z > -883 or x < 2984:
    continue
  f = min(faces, key=lambda v: v[0].distance(Point(x, z)))
  if f[0].distance(Point(x, z)) > 0.24:
    continue
  line, dx, dz, nx, nz = f
  if abs(dx * math.cos(yaw) + dz * (-math.sin(yaw))) < 0.96:
    continue
  # Frontages over the five recessed window storeys have continuous, broad,
  # pale upright ribs. The stone band runs below the last upper course.
  if 12 < y < 30:
    cells(
      "pier",
      (x + dx * (w / 2 + 0.25), y, z + dz * (w / 2 + 0.25)),
      dx,
      dz,
      nx,
      nz,
      0.44,
      3.8,
      0xE2D9C4,
    )
  if 27 < y < 30 or 8 < y < 10:
    cells("cornice", (x, y + h / 2 + 0.26, z), dx, dz, nx, nz, w / 0.65, 0.28, 0xC9BEAA)
  if y < 6:
    cells("shop", (x, y, z), dx, dz, nx, nz, w * 1.24, h * 1.22, 0x414C50)
    cells("shop-mullion", (x, y, z), dx, dz, nx, nz, 0.11, h * 1.22, 0x9C998E)
out = {"drawn": draw, "minecraft": nat}
(p / "historicArchitectureV378Soho.json").write_text(
  json.dumps(out, separators=(",", ":")) + "\n"
)
print(len(draw), len(nat))
