"""Model the seated bronze from the front and profile elevations of the original cast."""

import base64
import gzip
import json
import math
from pathlib import Path

import numpy as np
import shapely as sh
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import Polygon, box

from scripts.build_kreuzberg_plaetze_v380 import Mesh

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/kollwitzplatz-v381.json.gz"
OUT = ROOT / "src/app/src/data/kollwitzDenkmalV381.json"
STEP = 0.085
BRONZE = (119, 123, 112)


class Figure:
  def __init__(self, source):
    self.x, self.z = source["anchor"]
    self.forward = np.asarray(source["front"])
    self.right = np.array([self.forward[1], -self.forward[0]])
    self.base = 3.22 + source["plinthHeight"]
    self.origin = (round(self.x), 0, round(self.z))
    self.smooth = Mesh(self.origin)
    self.native = Mesh(self.origin)
    self.cells = {}
    self.tone = np.frombuffer(base64.b64decode(source["frontTone"]), "u1").reshape(
      70, 48
    )

  def point(self, u, y, v):
    x, z = np.array([self.x, self.z]) + self.right * u + self.forward * v
    return np.array([x, self.base + y, z])

  def face(self, pts, col):
    points = np.array([self.point(*p) for p in pts])
    t = points[:3]
    n = np.cross(t[1] - t[0], t[2] - t[0])
    norm = np.linalg.norm(n)
    shade = 0.88 + 0.12 * abs(n[1] / norm) if norm > 0.000001 else 0.9
    u, y, _ = np.mean(pts, axis=0)
    if 0 < y <= 2.10 and norm > 1e-6:
      facing = max(0, float(n[[0, 2]] @ self.forward / norm))
      j = round((u + 0.78) * 47 / 1.56)
      i = round(y * 69 / 2.1)
      if facing > 0.12 and 0 <= j < 48 and self.tone[i, j]:
        gain = np.clip(0.75 + (float(self.tone[i, j]) - 65) * 0.0055, 0.74, 1.34)
        shade *= 1 + facing * (gain - 1)
    self.smooth.face(points, np.array(col) * shade)

  def loft(self, rings, col):
    for (y, r), (h, s) in zip(rings, rings[1:]):
      for i in range(len(r)):
        j = (i + 1) % len(r)
        self.face(
          [
            (r[i][0], y, r[i][1]),
            (s[i][0], h, s[i][1]),
            (s[j][0], h, s[j][1]),
            (r[j][0], y, r[j][1]),
          ],
          col,
        )
      if h - y < 0.005:
        continue
      for iy in range(
        math.floor((self.base + y) / STEP), math.ceil((self.base + h) / STEP)
      ):
        t = np.clip(((iy + 0.5) * STEP - self.base - y) / (h - y), 0, 1)
        ring = np.array(r) * (1 - t) + np.array(s) * t
        poly = Polygon([self.point(u, 0, v)[[0, 2]] for u, v in ring])
        x0, z0, x1, z1 = poly.bounds
        for ix in range(math.floor(x0 / STEP), math.ceil(x1 / STEP)):
          for iz in range(math.floor(z0 / STEP), math.ceil(z1 / STEP)):
            if sh.intersects_xy(poly, (ix + 0.5) * STEP, (iz + 0.5) * STEP):
              self.cells[ix, iy, iz] = col
    for y, r in [rings[0], rings[-1]]:
      self.face([(u, y, v) for u, v in r], col)

  def rings(self, rows, color, shape=2.0, folds=False):
    rings = []
    sections = [rows[0]]
    for start, end in zip(rows, rows[1:]):
      count = max(1, math.ceil((end[0] - start[0]) / 0.065))
      sections.extend(np.linspace(start, end, count + 1)[1:])
    for y, u, w, v, d in sections:
      ring = []
      for i in range(28):
        a = 2 * math.pi * i / 28

        def coord(k):
          return math.copysign(abs(k) ** (2 / shape), k)

        side = coord(math.cos(a))
        front = coord(math.sin(a))
        x = u + w / 2 * side
        z = v + d / 2 * front
        if folds and front > 0:
          # The front of the dress falls in a deep V between the knees.
          z -= (
            front
            * (
              0.15 * math.exp(-(((x - 0.02) / (0.14 + 0.08 * y)) ** 2))
              + 0.025 * math.cos(x * 24)
            )
            * (0.8 + 0.2 * y)
          )
        ring.append((x, z))
      rings.append((y, ring))
    self.loft(rings, color)

  def cuboid(self, x0, x1, y0, y1, z0, z1, color):
    rect = [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]
    self.loft([(y0, rect), (y1, rect)], color)

  def ellipsoid(self, center, radii, color):
    x, y, z = center
    w, h, d = radii
    self.rings(
      [
        (
          y + h * math.sin(phi),
          x,
          max(0.002, 2 * w * math.cos(phi)),
          z,
          max(0.002, 2 * d * math.cos(phi)),
        )
        for phi in np.linspace(-1.56, 1.56, 8)
      ],
      color,
    )

  def native_faces(self):
    # Greedy coplanar rectangles join visible cube faces without internal surfaces.
    from collections import defaultdict

    for axis, sign, u, v in [
      (0, 1, 1, 2),
      (0, -1, 2, 1),
      (1, 1, 2, 0),
      (1, -1, 0, 2),
      (2, 1, 0, 1),
      (2, -1, 1, 0),
    ]:
      planes = defaultdict(set)
      for p, color in self.cells.items():
        q = list(p)
        q[axis] += sign
        if tuple(q) not in self.cells:
          planes[p[axis] + int(sign > 0), color].add((p[u], p[v]))
      for (level, color), cells in planes.items():
        for a, b in sorted(cells.copy()):
          if (a, b) not in cells:
            continue
          w = 1
          while (a + w, b) in cells:
            w += 1
          h = 1
          while all((a + i, b + h) in cells for i in range(w)):
            h += 1
          for i in range(w):
            for j in range(h):
              cells.remove((a + i, b + j))
          points = []
          for x, y in [(a, b), (a + w, b), (a + w, b + h), (a, b + h)]:
            p = [0.0, 0.0, 0.0]
            p[axis] = level * STEP
            p[u] = x * STEP
            p[v] = y * STEP
            points.append(p)
          self.native.face(points, np.array(color) * ([0.9, 1.04, 0.83][axis]))


def make(source):
  f = Figure(source)
  w = source["plinthWidth"] / 2
  d = source["plinthDepth"] / 2
  f.cuboid(-w + 0.09, w - 0.09, -0.94, -0.83, -d + 0.09, d - 0.09, (155, 149, 126))
  f.cuboid(-w, w, -0.83, -0.095, -d, d, (190, 186, 161))
  f.cuboid(-w - 0.01, w + 0.01, -0.095, 0, -d - 0.01, d + 0.01, (207, 201, 175))
  for x in (-0.81, 0.22, 0.92):
    f.face(
      [
        (x, -0.825, d + 0.004),
        (x + 0.012, -0.825, d + 0.004),
        (x + 0.012, -0.095, d + 0.004),
        (x, -0.095, d + 0.004),
      ],
      (155, 151, 132),
    )
  # The right hand lies across the lap. The left hand closes the upright portfolio.
  f.cuboid(-0.40, 0.38, 0, 0.78, -0.59, -0.21, (70, 75, 65))
  f.rings(
    [
      (0, -0.025, 1.02, 0.015, 1.32),
      (0.06, -0.035, 1.08, 0.018, 1.35),
      (0.31, -0.034, 1.03, 0.00, 1.24),
      (0.65, -0.025, 0.98, -0.015, 1.10),
      (0.84, -0.01, 0.98, -0.045, 1.04),
      (0.94, -0.02, 0.94, -0.072, 0.99),
      (1.00, -0.025, 0.86, -0.12, 0.84),
      (1.055, -0.03, 0.73, -0.16, 0.63),
    ],
    (124, 124, 111),
    2.55,
    True,
  )

  # Long folds fall diagonally between the knees. The polished ridges sit on
  # the changing skirt profile measured in the side view.
  def folds(x, y):
    levels = [
      (0, -0.025, 1.02, 0.015, 1.32),
      (0.06, -0.035, 1.08, 0.018, 1.35),
      (0.31, -0.034, 1.03, 0, 1.24),
      (0.65, -0.025, 0.98, -0.015, 1.10),
      (0.84, -0.01, 0.98, -0.045, 1.04),
      (0.94, -0.02, 0.94, -0.072, 0.99),
    ]
    for a, b in zip(levels, levels[1:]):
      if a[0] <= y <= b[0]:
        break
    _, u, w, v, d = np.array(a) + (np.array(b) - a) * ((y - a[0]) / (b[0] - a[0]))
    front = max(0, 1 - abs((x - u) / (w / 2)) ** 2.55) ** (1 / 2.55)
    return (
      v
      + d / 2 * front
      - front
      * (
        0.15 * math.exp(-(((x - 0.02) / (0.14 + 0.08 * y)) ** 2))
        + 0.025 * math.cos(x * 24)
      )
      * (0.8 + 0.2 * y)
    )

  for side in (-1, 1):
    prev = None
    for t in np.linspace(0, 1, 13):
      y = 0.39 + 0.43 * t
      u = side * (0.025 + 0.34 * t)
      half = 0.018 + 0.028 * math.sin(math.pi * t)
      row = [
        (u - half, y, folds(u - half, y) + 0.009),
        (u, y, folds(u, y) + 0.049),
        (u + half, y, folds(u + half, y) + 0.008),
      ]
      if prev:
        for j, c in enumerate([(151, 148, 127), (116, 120, 104)]):
          f.face([prev[j], row[j], row[j + 1], prev[j + 1]], c)
      prev = row
  f.rings(
    [
      (0.81, -0.034, 0.77, -0.27, 0.63),
      (1.04, -0.028, 0.81, -0.29, 0.65),
      (1.30, -0.03, 0.78, -0.285, 0.64),
      (1.50, -0.025, 0.73, -0.25, 0.61),
      (1.66, -0.025, 0.65, -0.20, 0.55),
      (1.72, -0.03, 0.55, -0.155, 0.51),
      (1.80, -0.045, 0.35, -0.13, 0.36),
    ],
    BRONZE,
  )
  f.rings(
    [
      (1.68, -0.052, 0.3, -0.13, 0.32),
      (1.77, -0.06, 0.31, -0.095, 0.34),
      (1.84, -0.08, 0.265, -0.05, 0.32),
    ],
    (78, 80, 68),
  )
  # Elliptical sections follow the eye, ear, jaw and crown heights read in profile.
  f.rings(
    [
      (1.746, -0.063, 0.14, 0.064, 0.18),
      (1.78, -0.062, 0.245, 0.042, 0.27),
      (1.85, -0.063, 0.291, 0.015, 0.32),
      (1.93, -0.057, 0.307, -0.014, 0.36),
      (2.007, -0.067, 0.31, -0.036, 0.35),
      (2.055, -0.071, 0.271, -0.046, 0.29),
      (2.092, -0.072, 0.161, -0.062, 0.175),
      (2.10, -0.073, 0.068, -0.066, 0.073),
    ],
    (140, 139, 125),
  )
  f.ellipsoid((-0.07, 1.945, -0.205), (0.126, 0.118, 0.084), (73, 78, 66))
  f.ellipsoid((-0.09, 1.907, 0.148), (0.049, 0.054, 0.068), (148, 141, 122))
  for u in (-0.15, -0.012):
    f.ellipsoid((u, 1.966, 0.13), (0.063, 0.015, 0.032), (85, 84, 70))
    f.ellipsoid((u, 1.939, 0.142), (0.031, 0.010, 0.014), (59, 62, 55))
  f.ellipsoid((-0.071, 1.84, 0.166), (0.053, 0.009, 0.014), (73, 70, 59))
  # Sleeves fold forward over each knee instead of forming detached cylinders.
  f.rings(
    [
      (0.95, -0.20, 0.17, 0.265, 0.27),
      (1.00, -0.274, 0.19, 0.14, 0.45),
      (1.075, -0.36, 0.20, -0.05, 0.43),
      (1.17, -0.374, 0.21, -0.14, 0.33),
      (1.35, -0.36, 0.218, -0.206, 0.31),
      (1.53, -0.31, 0.20, -0.215, 0.30),
      (1.66, -0.245, 0.18, -0.192, 0.25),
    ],
    (112, 115, 103),
  )
  f.rings(
    [
      (0.81, 0.445, 0.11, 0.12, 0.16),
      (0.91, 0.432, 0.16, 0.095, 0.19),
      (1.06, 0.395, 0.16, -0.015, 0.20),
      (1.20, 0.37, 0.21, -0.108, 0.25),
      (1.45, 0.32, 0.21, -0.185, 0.28),
      (1.64, 0.25, 0.16, -0.175, 0.22),
    ],
    (110, 113, 101),
  )
  f.ellipsoid((-0.116, 0.973, 0.288), (0.123, 0.073, 0.107), (157, 144, 113))
  f.ellipsoid((0.445, 0.816, 0.132), (0.071, 0.091, 0.067), (120, 116, 92))
  for j in range(3):
    f.ellipsoid((0.411 + 0.026 * j, 0.785, 0.18), (0.012, 0.047, 0.012), (126, 120, 97))
  f.cuboid(0.422, 0.505, 0.01, 0.78, -0.54, 0.19, (79, 83, 72))
  f.cuboid(0.48, 0.506, 0.754, 0.78, -0.48, 0.17, (149, 136, 104))
  f.ellipsoid((-0.04, 0.972, 0.349), (0.113, 0.012, 0.015), (117, 113, 93))
  # The plinth bears raised serif capitals. The small rear plate uses its observed patina.
  font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", 32)
  text = "KÄTHE KOLLWITZ"
  bounds = font.getbbox(text)
  im = Image.new("L", (bounds[2] - bounds[0] + 2, bounds[3] - bounds[1] + 2))
  ImageDraw.Draw(im).text((1 - bounds[0], 1 - bounds[1]), text, font=font, fill=255)
  raw = np.asarray(im) > 110
  rectangles = []
  for y, row in enumerate(raw):
    edges = np.flatnonzero(np.diff(np.r_[False, row, False]))
    rectangles.extend(box(a, y, b, y + 1) for a, b in edges.reshape(-1, 2))
  letters = sh.union_all(rectangles).simplify(0.72)
  h, w0 = raw.shape

  def inscription(u, y):
    return f.point((u / w0 - 0.5) * 2.29, -0.28 - y / h * 0.22, d + 0.024)

  for model in [f.smooth, f.native]:
    model.polygon(letters, (121, 118, 96), inscription)
  f.cuboid(-0.18, 0.18, -0.52, -0.33, -d - 0.016, -d, (112, 127, 106))
  f.native_faces()
  return f


def main():
  survey = json.loads(gzip.decompress(SOURCE.read_bytes()))
  model = make(survey["statue"])
  old = next(
    s
    for s in json.loads((ROOT / "src/app/src/data/centralNamedV230.json").read_bytes())[
      "sites"
    ]
    if s["key"] == "kollwitzplatz"
  )
  packet = dict(
    drawn=model.smooth.finish(),
    native=model.native.finish(),
    old={"boxes": old["boxes"][167:], "nativeRows": old["nativeRows"][923:]},
  )
  OUT.write_text(json.dumps(packet, separators=(",", ":")) + "\n")


if __name__ == "__main__":
  main()
