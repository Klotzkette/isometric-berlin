"""Build the surveyed Charlottenburger Tor, lamp standards, parapets and pavements.

Drawn profiles use the cadastral plan and the projection in the documented
photographs. Native occupancy is sampled from horizontal sections, unioned and
greedily meshed offline. The client draws each complete family in one batch.
"""

from __future__ import annotations

import base64
import gzip
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import shapely as sh
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/src/data"
SOURCE = json.loads(
  gzip.decompress((GEO / "charlottenburger-tor-v379-survey.json.gz").read_bytes())
)
OBJECTS = {oid: pts for oid, _, pts in SOURCE["osm"]}
ORIGIN = [-2760, 0, 570]
STEP = 0.32
TAU = 2 * math.pi
# Berliner Tuffstein, Granitsockel and the different bronze patina readings
STONE, LIGHT, LIP, DARK, GRANITE, SEAM = (
  0xC0AB8C,
  0xD1BEA0,
  0xD9CBB2,
  0x9C8A70,
  0x958579,
  0x978975,
)
BRONZE, PATINA, FOLD, HILITE, IRON, GLASS = (
  0x507266,
  0x6A897B,
  0x385649,
  0x80A192,
  0x434C49,
  0xE7DFC4,
)
PAVEMENT = {
  "01": 0xB7A790,
  "02": 0xA39E93,
  "03": 0xA59F90,
  "04": 0xB7AEA0,
  "06": 0xB6AD9E,
  "07": 0xB1AA9C,
  "08": 0xC3BCAC,
  "15": 0xB1A99B,
  "17": 0xAAA297,
}
GROUND = 5.2
DECK = 5.43


def parts(g, kind):
  if g.is_empty:
    return
  if g.geom_type == kind:
    yield g
  elif hasattr(g, "geoms"):
    for item in g.geoms:
      yield from parts(item, kind)


class Packet:
  """Deduplicate centimetre vertices, with separate palette tones at edges."""

  def __init__(self):
    self.points = {}
    self.indices = []
    self.palette = {}

  def face(self, corners, color):
    col = self.palette.setdefault(color, len(self.palette))
    ids = []
    for v in corners:
      key = tuple(round((v[i] - ORIGIN[i]) * 100) for i in range(3)) + (col,)
      ids.append(self.points.setdefault(key, len(self.points)))
    for i in range(1, len(ids) - 1):
      if len({ids[0], ids[i], ids[i + 1]}) == 3:
        self.indices.extend([ids[0], ids[i], ids[i + 1]])

  def store(self, path):
    def pack(raw):
      return base64.b64encode(gzip.compress(raw, compresslevel=9, mtime=0)).decode()

    def word_planes(values):
      values = np.asarray(values, dtype="<u2").ravel()
      return np.concatenate(
        [(values & 255).astype("u1"), (values >> 8).astype("u1")]
      ).tobytes()

    keys = list(self.points)
    assert all(-32768 < n < 32768 for p in keys for n in p[:3])
    assert len(keys) < 65536 and len(self.palette) < 256
    # Delta centimetres are independent per axis. Separate low/high bytes of
    # both the positions and triangle references before lossless compression.
    xyz = np.asarray([p[:3] for p in keys], dtype="<i2")
    delta = np.diff(xyz, axis=0, prepend=np.zeros((1, 3), dtype="<i2"))
    ids = np.asarray(self.indices, dtype="<u2")
    diff = np.diff(ids, prepend=np.zeros(1, dtype="<u2"))
    data = {
      "n": len(keys),
      "faces": len(ids) // 3,
      "p": pack(word_planes(delta.T)),
      "c": pack(bytes(p[3] for p in keys)),
      "i": pack(word_planes(diff)),
      "palette": list(self.palette),
      "origin": ORIGIN,
    }
    path.write_text(json.dumps(data, separators=(",", ":")) + "\n")


class Model:
  def __init__(self):
    self.drawn = Packet()
    self.native = Packet()
    self.cells = {}
    self.nav = []

  def solid(self, rings, color):
    """Horizontally sliced closed solid, coloured by its external surface."""
    pts = [[(x, h, z) for x, z in ring] for h, ring in rings]
    self.drawn.face(pts[0], color)
    self.drawn.face(pts[-1][::-1], color)
    for a, b in zip(pts, pts[1:]):
      for i in range(len(a)):
        j = (i + 1) % len(a)
        self.drawn.face([a[i], b[i], b[j], a[j]], color)
    for (h0, r0), (h1, r1) in zip(rings, rings[1:]):
      if h1 - h0 < 0.01:
        continue
      y0, y1 = math.floor(h0 / STEP), math.ceil(h1 / STEP)
      if h1 - h0 < STEP * 0.8:
        y0 = y1 - 1
      r0, r1 = np.asarray(r0), np.asarray(r1)
      for iy in range(y0, y1):
        t = np.clip(((iy + 0.5) * STEP - h0) / (h1 - h0), 0, 1)
        ring = r0 + (r1 - r0) * t
        g = Polygon(ring)
        if not g.is_valid or g.area < 0.001:
          continue
        minx, minz, maxx, maxz = g.bounds
        ix = np.arange(math.floor(minx / STEP), math.ceil(maxx / STEP))
        iz = np.arange(math.floor(minz / STEP), math.ceil(maxz / STEP))
        if not len(ix) or not len(iz):
          continue
        x, z = np.meshgrid(ix, iz)
        keep = sh.intersects_xy(g, (x + 0.5) * STEP, (z + 0.5) * STEP)
        if not np.any(keep) and g.area > 0.025:
          c = g.centroid
          self.cells[math.floor(c.x / STEP), iy, math.floor(c.y / STEP)] = color
        else:
          self.cells.update(
            {(int(i), iy, int(j)): color for i, j in zip(x[keep], z[keep])}
          )

  def native_faces(self):
    directions = [
      (0, 1, 1, 2),
      (0, -1, 2, 1),
      (1, 1, 2, 0),
      (1, -1, 0, 2),
      (2, 1, 0, 1),
      (2, -1, 1, 0),
    ]
    for axis, sign, u, v in directions:
      planes = defaultdict(set)
      for point, color in self.cells.items():
        near = list(point)
        near[axis] += sign
        if tuple(near) not in self.cells:
          planes[(point[axis] + int(sign > 0), color)].add((point[u], point[v]))
      for (plane, color), cells in planes.items():
        for a, b in sorted(cells.copy()):
          if (a, b) not in cells:
            continue
          w = 1
          while (a + w, b) in cells:
            w += 1
          h = 1
          while all((a + col, b + h) in cells for col in range(w)):
            h += 1
          for i in range(w):
            for j in range(h):
              cells.remove((a + i, b + j))
          vertices = []
          for x, y in [(a, b), (a + w, b), (a + w, b + h), (a, b + h)]:
            p = [0, 0, 0]
            p[axis] = plane * STEP
            p[u] = x * STEP
            p[v] = y * STEP
            vertices.append(p)
          self.native.face(vertices, color)


def rectangle(x, z, w, d):
  return [
    (x - w / 2, z - d / 2),
    (x + w / 2, z - d / 2),
    (x + w / 2, z + d / 2),
    (x - w / 2, z + d / 2),
  ]


def oval(x, z, w, d, n, phase=0):
  return [
    (
      x + math.cos(TAU * i / n + phase) * w / 2,
      z + math.sin(TAU * i / n + phase) * d / 2,
    )
    for i in range(n)
  ]


class Frame:
  def __init__(self, model, point, y=DECK):
    self.model, self.point, self.y = model, point, y

  def layers(self, rings, color):
    world = []
    for h, ring in rings:
      row = [self.point(u, v) for u, v in ring]
      # XZ rings are clockwise when viewed from +Y.
      if not Polygon(row).exterior.is_ccw:
        row.reverse()
      world.append((self.y + h, row))
    self.model.solid(world, color)

  def box(self, u, v, w, d, bottom, top, color, collision=False):
    r = rectangle(u, v, w, d)
    self.layers([(bottom, r), (top, r)], color)
    if collision:
      self.model.nav.append(
        [
          round(self.y + bottom, 2),
          round(self.y + top, 2),
          [[round(x, 2), round(z, 2)] for x, z in map(lambda p: self.point(*p), r)],
        ]
      )

  def profile(self, u, v, shape, color, n=16, collision=False):
    rings = [(h, oval(u + du, v + dv, w, d, n)) for h, du, dv, w, d in shape]
    self.layers(rings, color)
    if collision:
      idx = max(range(len(shape)), key=lambda i: shape[i][3] * shape[i][4])
      self.model.nav.append(
        [
          round(self.y + shape[0][0], 2),
          round(self.y + shape[-1][0], 2),
          [
            [round(x, 2), round(z, 2)]
            for x, z in (self.point(*p) for p in rings[idx][1])
          ],
        ]
      )

  def turned(self, u, v, shape, col, n=16, collision=False):
    self.profile(u, v, [(h, 0, 0, 2 * r, 2 * r) for h, r in shape], col, n, collision)

  def arch_strip(self, profile, bottom, d, v, color):
    # Tempered baroque volutes sit above an individual rectangular support.
    for (u, a), (t, b) in zip(profile, profile[1:]):
      self.box((u + t) / 2, v, t - u, d, bottom, (a + b) / 2, color)


def royal_figure(f, center, queen):
  """Projected east-facing bronze: a dressed figure with an arm on a separate plinth."""
  u, v = center

  def body(r, col, n=12):
    f.profile(u, v, r, col, n)

  for hand in (-1, 1):
    f.profile(
      u + hand * 0.34,
      v + 0.12,
      [
        (2.10, 0, 0, 0.47, 0.77),
        (2.27, 0, 0.09, 0.52, 0.78),
        (3.35, hand * 0.06, -0.02, 0.42, 0.44),
        (4.05, 0, 0, 0.46, 0.43),
      ],
      FOLD,
      10,
    )
  if queen:
    body(
      [
        (2.1, 0.05, 0, 1.40, 0.78),
        (2.45, 0.12, 0.1, 1.78, 0.98),
        (3.08, 0.10, 0.06, 1.49, 0.83),
        (4.36, 0, -0.04, 0.86, 0.59),
        (4.75, 0, 0.02, 0.97, 0.70),
      ],
      BRONZE,
    )
  body(
    [
      (3.65, 0.02, 0, 0.96, 0.50),
      (4.17, 0, 0, 0.84, 0.57),
      (4.82, 0, 0.01, 1.19, 0.69),
      (5.14, 0, 0, 1.43, 0.63),
      (5.30, 0, 0, 0.62, 0.42),
    ],
    BRONZE,
  )
  # One heavy trailing mantle, oblique pleats and a low, asymmetric train.
  body(
    [
      (1.62, 1.02, 0.26, 0.72, 0.44),
      (2.08, 0.80, 0.27, 1.37, 0.74),
      (2.65, 0.77, -0.05, 1.58, 1.0),
      (3.70, 0.72, -0.19, 1.32, 0.87),
      (4.65, 0.54, -0.15, 1.08, 0.74),
      (5.19, 0.43, 0, 0.73, 0.62),
    ],
    PATINA,
  )
  for j in range(4):
    offset = j * 0.23
    body(
      [
        (2.17, 0.34 + offset, 0.57 - 0.09 * j, 0.14, 0.13),
        (2.84, 0.46 + offset, 0.37 - 0.1 * j, 0.14, 0.12),
        (3.67, 0.44 + offset * 0.75, 0.19 - 0.08 * j, 0.13, 0.13),
        (4.50, 0.38 + offset * 0.5, 0.15 - 0.09 * j, 0.10, 0.12),
      ],
      FOLD,
      7,
    )
  body(
    [
      (5.10, 0, 0, 0.37, 0.36),
      (5.43, -0.02, 0.02, 0.35, 0.34),
      (5.48, -0.02, 0.08, 0.45, 0.39),
      (5.76, -0.03, 0.10, 0.50, 0.46),
      (5.93, -0.03, 0.03, 0.46, 0.44),
      (6.04, -0.03, 0.01, 0.30, 0.29),
    ],
    PATINA,
  )
  body(
    [
      (5.89, 0, -0.07, 0.55, 0.46),
      (6.03, -0.03, -0.08, 0.50, 0.42),
      (6.28, -0.02, -0.1, 0.34, 0.29),
      (6.37, -0.01, -0.11, 0.12, 0.13),
    ],
    FOLD,
    10,
  )
  body(
    [
      (4.58, -1.11, 0.15, 0.23, 0.27),
      (4.71, -1.02, 0.14, 0.43, 0.39),
      (4.87, -0.67, 0.06, 0.62, 0.45),
      (5.14, -0.56, 0.01, 0.50, 0.49),
    ],
    BRONZE,
  )
  body(
    [
      (4.08, 0.77, 0.27, 0.22, 0.18),
      (4.40, 0.82, 0.14, 0.35, 0.39),
      (5.10, 0.61, 0.01, 0.55, 0.5),
    ],
    PATINA,
  )
  f.box(u - 1.13, v, 0.75, 0.76, 1.96, 2.22, LIP)
  f.box(u - 1.13, v, 0.56, 0.63, 2.22, 3.58, STONE)
  f.box(u - 1.13, v, 0.78, 0.81, 3.58, 3.76, LIGHT)
  if queen:
    f.box(u - 1.14, v, 0.84, 0.51, 3.76, 4.12, BRONZE)
    for off in [-0.34, -0.19, -0.04, 0.11, 0.26]:
      f.box(u - 1.14 + off, v + 0.269, 0.045, 0.04, 3.82, 4.05, FOLD)
    f.box(u - 1.14, v, 0.54, 0.45, 4.12, 4.21, PATINA)
    f.turned(u - 1.14, v, [(4.2, 0.12), (4.35, 0.13), (4.53, 0.06)], PATINA, 8)
  else:
    body(
      [
        (3.78, -1.20, 0.35, 0.08, 0.08),
        (4.58, -1.10, 0.18, 0.08, 0.08),
        (4.92, -1.04, 0.11, 0.075, 0.075),
      ],
      HILITE,
      7,
    )
    f.turned(u - 1.04, v + 0.1, [(4.87, 0.055), (4.96, 0.10), (5.06, 0.035)], HILITE, 8)


def wing(model, oid, sign, statue_id):
  ring = Polygon(OBJECTS[oid])
  statue = OBJECTS[statue_id][0]
  uz = 546.9 if sign < 0 else 588.5

  def mid(z):
    section = ring.intersection(LineString([(-2750, z), (-2700, z)]))
    return (section.bounds[0] + section.bounds[2]) / 2

  # The historic colonnade curves; retain actual cross-sections on the central unobstructed strip.
  q = [(u, mid(uz + sign * u)) for u in [3.3, 5, 7, 9, 12, 15, 17.0]]

  def center(u):
    i = next((j for j in range(1, len(q)) if q[j][0] >= u), len(q) - 1)
    (a, x), (b, y) = q[i - 1 : i + 1]
    return x + (u - a) * (y - x) / (b - a), (y - x) / (b - a)

  def world(u, v):
    x, slope = center(u)
    ds = math.hypot(1, slope)
    return (x + v / ds, uz + sign * u - v * sign * slope / ds)

  base = Frame(model, world, GROUND + 0.10)
  for u, w, d in [(0, 6.25, 4.18), (19.45, 2.34, 3.47)]:
    base.box(u, 0, w + 0.33, d + 0.46, 0, 0.67, GRANITE, True)
    base.box(u, 0, w + 0.17, d + 0.26, 0.67, 2.03, STONE, True)
    base.box(u, 0, w + 0.39, d + 0.52, 2.03, 2.22, LIP)
    base.box(u, 0, w, d, 2.22, 12.0, STONE, True)
    for v in [-1, 1]:
      for du in [-1, 1]:
        base.box(
          u + du * (w / 2 - 0.17), v * (d / 2 + 0.02), 0.22, 0.17, 2.34, 11.51, LIGHT
        )
      # Recessed panels with a lip. The large eastern panel backs the royal bronze.
      base.box(u, v * (d / 2 + 0.015), w * 0.53, 0.065, 2.72, 10.08, DARK)
      base.box(u, v * (d / 2 + 0.055), w * 0.49, 0.065, 2.85, 9.92, STONE)
      base.box(u, v * (d / 2 + 0.085), w * 0.55, 0.10, 9.94, 10.12, LIGHT)
  # Two engaged and two free pairs along the colonnade, and the pair against the roadward return.
  for u in [-2.86, 3.13, 8.28, 13.45, 18.38]:
    for v in [-1.2, 1.2]:
      base.box(u, v, 1.99, 1.97, 0.02, 0.65, GRANITE, True)
      base.box(u, v, 1.80, 1.80, 0.65, 2.06, STONE, True)
      base.turned(
        u, v, [(2.06, 1.00), (2.19, 0.98), (2.27, 0.9), (2.4, 0.90), (2.52, 0.77)], LIP
      )
      base.turned(
        u, v, [(2.48, 0.76), (4.9, 0.75), (8.7, 0.70), (11.12, 0.62)], STONE, 18, True
      )
      base.turned(
        u, v, [(11.07, 0.64), (11.24, 0.70), (11.35, 0.75), (11.49, 0.70)], LIGHT
      )
      base.box(u, v, 1.65, 1.63, 11.45, 11.76, STONE)
      for du in [-0.64, 0.64]:
        base.turned(
          u + du,
          v + (0.53 if v > 0 else -0.53),
          [(11.34, 0.18), (11.53, 0.24), (11.65, 0.18)],
          DARK,
          9,
        )
  # Segmented extrusion follows the slight change of direction captured in the footprint.
  for low, high, depth, col in [
    (11.72, 12.02, 4.18, LIP),
    (12.02, 12.34, 4.24, STONE),
    (12.34, 13.05, 4.30, STONE),
    (13.05, 13.22, 4.55, DARK),
    (13.22, 13.43, 4.79, LIGHT),
    (13.43, 14.30, 4.09, STONE),
    (14.30, 14.48, 4.35, LIGHT),
    (14.48, 14.70, 4.53, LIP),
  ]:
    steps = [-3.43, 0, 3.3, 6, 9, 12, 15, 17, 20.88]
    for a, b in zip(steps, steps[1:]):
      base.box((a + b) / 2, 0, b - a, depth, low, high, col, collision=low == 11.72)
  for j in range(31):
    u = -2.93 + j * 0.78
    for v in [-2.20, 2.20]:
      base.box(u, v, 0.29, 0.33, 12.78, 13.08, LIGHT)
  # Surviving stepped stone cartouche with the four corner trophies.
  for ww, dd, y, h in [(6.65, 4.92, 14.6, 15.1), (5.95, 4.20, 15.05, 15.66)]:
    base.box(0, 0, ww, dd, y, h, LIGHT if h == 15.1 else STONE)
  # The current stone attic has a scrolled baroque crest and a shield. The
  # historic animal groups that once stood on it disappeared after the war.
  crown = [
    (15.55, 4.14, 2.82),
    (17.47, 4.14, 2.82),
    (17.62, 4.29, 2.92),
    (17.79, 4.10, 2.79),
    (18.00, 3.72, 2.62),
    (18.37, 3.53, 2.52),
    (18.73, 3.36, 2.46),
    (18.76, 3.50, 2.53),
    (18.90, 3.38, 2.48),
    (19.10, 2.94, 2.29),
    (19.38, 2.55, 2.08),
    (19.42, 2.67, 2.17),
    (19.62, 2.49, 2.02),
  ]
  base.layers([(y, rectangle(0, 0, ww, dd)) for y, ww, dd in crown], STONE)
  for side in [-1, 1]:
    base.profile(
      0,
      side * 1.45,
      [
        (16.10, 0, 0, 0.12, 0.11),
        (16.32, 0, 0, 0.62, 0.20),
        (16.68, 0, 0, 0.96, 0.24),
        (17.07, 0, 0, 1.04, 0.24),
        (17.36, 0, 0, 0.86, 0.18),
      ],
      LIGHT,
      12,
    )
    for du in [-0.53, 0.53]:
      base.profile(
        du,
        side * 1.49,
        [
          (16.40, du * 0.1, 0, 0.22, 0.17),
          (16.69, 0, 0.01, 0.28, 0.17),
          (17.04, -0.08 * du, 0, 0.20, 0.17),
          (17.18, 0, 0, 0.28, 0.17),
        ],
        LIGHT,
        8,
      )
    # Thick framed stone front consists of a horizontal cornice and a curved pediment.
    base.arch_strip(
      [
        (-1.72, 17.92),
        (-1.34, 18.16),
        (-0.72, 18.38),
        (0, 18.47),
        (0.72, 18.38),
        (1.34, 18.16),
        (1.72, 17.92),
      ],
      17.80,
      0.16,
      side * 1.32,
      LIGHT,
    )
  for u in [-2.07, 2.07]:
    for v in [-1.47, 1.47]:
      base.turned(u, v, [(15.10, 0.48), (15.37, 0.59), (15.61, 0.40)], STONE, 9)
      base.profile(
        u,
        v,
        [
          (15.55, 0, 0, 0.54, 0.56),
          (15.85, 0, 0, 0.88, 0.70),
          (16.18, 0.05, 0, 0.97, 0.65),
          (16.38, 0.07, 0, 0.53, 0.49),
          (16.52, 0.09, 0, 0.33, 0.36),
        ],
        LIGHT,
        10,
      )
      base.profile(
        u,
        v,
        [
          (16.39, 0, 0, 0.56, 0.53),
          (16.53, 0, 0, 0.70, 0.63),
          (16.76, 0.09, 0, 0.51, 0.49),
          (16.94, 0.17, 0, 0.40, 0.42),
          (17.07, 0.24, 0, 0.12, 0.21),
        ],
        STONE,
        9,
      )
  base.turned(
    19.47,
    0,
    [
      (14.68, 0.71),
      (14.9, 0.82),
      (15.15, 0.54),
      (15.69, 0.66),
      (16.12, 0.46),
      (16.42, 0.27),
      (16.79, 0.09),
    ],
    LIGHT,
    12,
  )
  # Flat obelisk and the prow on the canal side.
  base.layers(
    [
      (2.10, rectangle(0, -2.07, 2.46, 1.0)),
      (3.35, rectangle(0, -2.96, 2.67, 1.86)),
      (3.74, rectangle(0, -2.88, 2.74, 1.9)),
    ],
    STONE,
  )
  base.layers(
    [
      (3.72, rectangle(0, -2.31, 1.7, 0.60)),
      (9.0, rectangle(0, -2.25, 0.79, 0.42)),
      (10.19, rectangle(0, -2.24, 0.10, 0.11)),
    ],
    LIGHT,
  )
  target_u = (statue[1] - uz) * sign
  base_x, _ = center(target_u)
  east = statue[0] - base_x
  # Figure niche, granite pedestal, and separate model palace / sceptre.
  base.profile(
    target_u,
    east - 0.10,
    [
      (0, 0, 0, 3.96, 2.00),
      (0.61, 0, 0, 4.04, 2.03),
      (1.95, 0, 0, 3.75, 1.83),
      (2.11, 0, 0, 3.86, 1.93),
    ],
    STONE,
    18,
    True,
  )
  royal_figure(base, (target_u, east + 0.17), sign < 0)


def lamp_standard(model, oid):
  poly = Polygon(OBJECTS[oid])
  x, z = poly.centroid.coords[0]
  dx, dz = 0.99677, -0.0803
  f = Frame(model, lambda u, v: (x + u * dx - v * dz, z + u * dz + v * dx))
  # The north and south footprints were mapped separately.
  w, d = (4.08, 3.20) if oid == "w114399857" else (5.62, 4.79)
  for b, t, fw, fd, tone in [
    (0, 0.37, 1, 1, GRANITE),
    (0.37, 0.65, 0.96, 0.95, LIGHT),
    (0.65, 2.23, 0.86, 0.84, STONE),
    (2.23, 2.47, 0.9, 0.91, LIGHT),
    (2.47, 2.79, 0.80, 0.79, STONE),
  ]:
    f.box(0, 0, w * fw, d * fd, b, t, tone, True)
  for side in [-1, 1]:
    f.box(0, side * d * 0.426, w * 0.57, 0.057, 0.83, 1.98, DARK)
    f.box(0, side * d * 0.438, w * 0.52, 0.06, 0.90, 1.91, STONE)
  f.turned(
    0,
    0,
    [
      (2.76, 1.80),
      (3.02, 1.82),
      (3.28, 1.58),
      (4.1, 1.50),
      (4.50, 1.63),
      (4.92, 1.40),
      (5.28, 1.13),
    ],
    LIGHT,
    18,
    True,
  )
  f.turned(
    0,
    0,
    [
      (5.22, 1.16),
      (5.50, 1.19),
      (5.67, 1.05),
      (8.8, 1.03),
      (14.6, 0.90),
      (16.23, 0.85),
      (16.37, 0.99),
    ],
    STONE,
    24,
    True,
  )
  for angle in [0, math.pi / 2, math.pi, math.pi * 1.5]:
    u, v = math.cos(angle), math.sin(angle)
    f.profile(
      0,
      0,
      [
        (3.54, u * 1.30, v * 1.30, 0.65, 0.65),
        (3.93, u * 1.83, v * 1.83, 0.67, 0.63),
        (4.09, u * 1.97, v * 1.97, 0.39, 0.36),
        (4.20, u * 1.66, v * 1.66, 0.44, 0.43),
      ],
      LIGHT,
      8,
    )
  f.turned(0, 0, [(16.37, 1.04), (16.61, 1.20), (16.82, 1.36), (16.99, 1.19)], DARK, 20)
  f.turned(
    0,
    0,
    [
      (16.98, 1.17),
      (17.35, 1.05),
      (17.62, 1.16),
      (17.85, 1.09),
      (18.08, 0.96),
      (18.74, 0.90),
      (18.87, 0.95),
      (19.18, 0.72),
    ],
    LIGHT,
    18,
  )
  # Eight reconstructed bronze drop-lamps per standard; the district records the count.
  for j in range(8):
    a = j * TAU / 8
    u, v = math.cos(a), math.sin(a)
    f.profile(
      0,
      0,
      [
        (16.86, u * 0.98, v * 0.98, 0.24, 0.24),
        (17.48, u * 1.14, v * 1.14, 0.28, 0.28),
        (17.93, u * 1.68, v * 1.68, 0.20, 0.20),
        (18.08, u * 1.98, v * 1.98, 0.20, 0.20),
      ],
      IRON,
      8,
    )
    f.profile(
      0,
      0,
      [
        (17.27, u * 2.32, v * 2.32, 0.15, 0.15),
        (17.77, u * 2.30, v * 2.30, 0.18, 0.18),
        (18.02, u * 2.15, v * 2.15, 0.18, 0.18),
        (18.08, u * 1.98, v * 1.98, 0.20, 0.20),
      ],
      IRON,
      8,
    )
    f.turned(u * 2.32, v * 2.32, [(17.21, 0.07), (17.30, 0.12), (17.36, 0.05)], IRON, 8)
    f.turned(
      u * 2.32,
      v * 2.32,
      [(16.69, 0.11), (16.79, 0.18), (17.06, 0.21), (17.22, 0.12)],
      GLASS,
      10,
    )
    f.turned(
      u * 2.32, v * 2.32, [(16.57, 0.055), (16.68, 0.13), (16.74, 0.14)], IRON, 8
    )
  f.turned(
    0,
    0,
    [
      (19.15, 0.73),
      (19.45, 0.74),
      (19.81, 0.50),
      (20.10, 0.54),
      (20.43, 0.46),
      (20.83, 0.32),
      (21.29, 0.23),
      (21.77, 0.17),
      (22, 0.05),
    ],
    STONE,
    14,
  )


def parapets(model):
  # The orthophoto's north-up 1088 x 736 pixel grid corresponds to 3.2 px/m.
  # Traced outer coping edges; the south-east viewing platform curves around the gate.
  def trace(p):
    return [(-2890 + x / 3.2, 460 + y / 3.2) for x, y in p]

  south = trace(
    [
      (339, 475),
      (420, 468),
      (474, 464),
      (492, 463),
      (501, 466),
      (504, 477),
      (508, 485),
      (513, 490),
      (520, 494),
      (528, 496),
      (535, 495),
      (542, 493),
      (548, 489),
      (553, 484),
      (557, 476),
    ]
  )
  north = trace(
    [
      (275, 223),
      (277, 230),
      (281, 234),
      (287, 237),
      (295, 238),
      (310, 237),
      (410, 230),
      (442, 228),
      (453, 226),
      (459, 222),
      (465, 216),
      (468, 209),
      (469, 201),
    ]
  )
  # The foot of the stone wall follows the waterline around the rounded landing;
  # the clear navigable opening between the two abutments belongs to the v378 bridge deck.
  for path in [north, south]:
    line = LineString(path)
    for low, high, width, color in [
      (0.02, 0.18, 1.04, GRANITE),
      (0.18, 0.89, 0.75, STONE),
      (0.89, 1.06, 0.88, LIGHT),
      (1.06, 1.18, 1.04, LIP),
    ]:
      boundary = list(
        line.buffer(width / 2, cap_style=2, join_style=2).exterior.coords
      )[:-1]
      model.solid([(DECK + low, boundary), (DECK + high, boundary)], color)
    for h in np.arange(0, line.length + 0.05, 3.75):
      t = line.interpolate(h)
      f = Frame(
        model,
        lambda u, v: (t.x + u * 0.9968 + v * 0.0803, t.y - u * 0.0803 + v * 0.9968),
      )
      f.box(0, 0, 0.34, 0.84, 0.18, 0.93, LIGHT)
    for x, z in [path[0], path[-1]]:
      f = Frame(
        model, lambda u, v: (x + u * 0.9968 + v * 0.0803, z - u * 0.0803 + v * 0.9968)
      )
      f.box(0, 0, 1.42, 1.24, 0, 1.44, STONE, True)
      f.box(0, 0, 1.52, 1.34, 1.43, 1.56, LIGHT)
      f.turned(
        0,
        0,
        [
          (1.55, 0.42),
          (1.69, 0.45),
          (1.83, 0.3),
          (1.98, 0.34),
          (2.15, 0.23),
          (2.30, 0.06),
        ],
        LIGHT,
        10,
      )
    model.nav.extend(
      [
        [
          DECK,
          DECK + 1.15,
          [list(p) for p in Polygon(seg.buffer(0.4, cap_style=2)).exterior.coords[:-1]],
        ]
        for seg in [LineString([a, b]) for a, b in zip(path, path[1:])]
      ]
    )
  for edge, sign in [(south, 1), (north, -1)]:
    rim = edge[4:] if sign == 1 else edge[-6:]
    side = [(x, z - sign * 2.5) for x, z in rim[::-1]]
    polygon = sh.make_valid(Polygon(rim + side))
    for g in parts(polygon, "Polygon"):
      for tri in sh.constrained_delaunay_triangles(g).geoms:
        corners = list(tri.exterior.coords)[:3]
        pts = [(x, DECK + 0.04, z) for x, z in corners]
        model.drawn.face(pts, STONE)
        model.native.face(pts, STONE)


def streets(model):
  data = SOURCE["walk"]
  exclusion = unary_union(
    [
      Polygon(r[0], r[1:])
      for _, layer, _, _, r in data
      if layer in ("bn_baumscheibe", "ce_gruenflaeche")
    ]
  )
  road = unary_union(
    [Polygon(r[0], r[1:]) for _, layer, _, _, r in data if layer == "cm_fahrbahn"]
  )
  # Preserve all official polygons, survey holes and street crossings. Each material has its own shade.
  class_areas = Counter()
  ground_source = json.loads((OUT / "boulevardTransportGroundV210.json").read_bytes())
  bridge = Polygon(OBJECTS["w294331765"])

  def floor(x, z):
    if bridge.covers(Point(x, z)):
      return DECK + 0.127
    ix = math.floor((x - ground_source["origin"][0]) / ground_source["step"])
    iz = math.floor((z - ground_source["origin"][1]) / ground_source["step"])
    return ground_source["heightsDm"][iz * ground_source["cols"] + ix] / 10 + 0.143

  mapped = []
  for fid, layer, material, usage, r in data:
    if layer != "cl_gehweg":
      continue
    g = Polygon(r[0], r[1:]).difference(exclusion).difference(road)
    if g.area < 0.2:
      continue
    base = PAVEMENT.get(material, 0xB2AB9C)
    for p in parts(sh.make_valid(g), "Polygon"):
      mapped.append(p)
      class_areas[material] += p.area
      for tri in sh.constrained_delaunay_triangles(p).geoms:
        corners = list(tri.exterior.coords)[:3]
        vertices = [(x, floor(x, z), z) for x, z in corners]
        model.drawn.face(vertices, base)
      # Use only complete one-metre cells; test them individually so two
      # partial cells at the ends never discard a full interior stripe.
      a, b, c, d = p.bounds
      xs = np.arange(math.floor(a), math.ceil(c))
      for iz in range(math.floor(b), math.ceil(d)):
        good = xs[sh.covers(p, sh.box(xs, iz, xs + 1, iz + 1))]
        for run in np.split(good, np.flatnonzero(np.diff(good) > 1) + 1):
          if not len(run):
            continue
          left, right = int(run[0]), int(run[-1]) + 1
          corners = [(left, iz), (left, iz + 1), (right, iz + 1), (right, iz)]
          model.native.face([(x, floor(x, z), z) for x, z in corners], base)
  # Only the frontage of the documented pedestrian paving that touches a roadway.
  # Draw the two kerb faces; these strips also prevent flicker against old road edges.
  edges = unary_union(mapped).boundary.intersection(road.boundary.buffer(0.12))
  for seg in parts(edges, "LineString"):
    if seg.length < 0.7:
      continue
    for a, b in zip(seg.coords, list(seg.coords)[1:]):
      if math.dist(a, b) < 0.08:
        continue
      (x, z), (xx, zz) = a, b
      y, y1 = floor(x, z), floor(xx, zz)
      dx, dz = xx - x, zz - z
      length = math.hypot(dx, dz)
      nx, nz = dz * 0.095 / length, -dx * 0.095 / length
      row = [
        (x - nx, y + 0.028, z - nz),
        (xx - nx, y1 + 0.028, zz - nz),
        (xx + nx, y1 + 0.028, zz + nz),
        (x + nx, y + 0.028, z + nz),
      ]
      model.drawn.face(row, LIGHT)
  # Recessed stone-panel joints on just the exposed bridge forecourts, clipped to the actual surveyed polygons.
  for poly in mapped:
    area = poly.intersection(bridge)
    if area.area < 5:
      continue
    a, b, c, d = area.bounds
    for iy in range(math.floor(b / 1.4), math.ceil(d / 1.4)):
      z = iy * 1.4
      line = LineString([(a - 1, z + 0.081 * (-1)), (c + 1, z - 0.081 * (c - a + 1))])
      for seg in parts(area.intersection(line), "LineString"):
        if seg.length < 0.9:
          continue
        start, end = seg.coords[0], seg.coords[-1]
        x0, z0 = start
        x1, z1 = end
        model.drawn.face(
          [
            (x0, DECK + 0.138, z0 - 0.022),
            (x1, DECK + 0.138, z1 - 0.022),
            (x1, DECK + 0.138, z1 + 0.022),
            (x0, DECK + 0.138, z0 + 0.022),
          ],
          0xA89F91,
        )
  return class_areas, edges.length


def main():
  m = Model()
  wing(m, "w106957368", -1, "n1229890071")
  wing(m, "w106959645", 1, "n1229888412")
  for oid in ["w114399857", "w106961073"]:
    lamp_standard(m, oid)
  parapets(m)
  areas, kerbs = streets(m)
  m.native_faces()
  for mode, packet in [("Drawn", m.drawn), ("Native", m.native)]:
    path = OUT / ("charlottenburgerTorV379" + mode + ".json")
    packet.store(path)
    print(
      mode,
      len(packet.points),
      len(packet.indices) // 3,
      "triangles",
      len(gzip.compress(path.read_bytes(), mtime=0)),
      "bytes gzip",
    )
  (OUT / "charlottenburgerTorV379Solids.json").write_text(
    json.dumps(m.nav, separators=(",", ":")) + "\n"
  )
  print(
    "Detail parcels",
    len(SOURCE["walk"]),
    "walk areas",
    dict(areas),
    "kerbs",
    round(kerbs, 2),
    "solids",
    len(m.nav),
  )


if __name__ == "__main__":
  main()
