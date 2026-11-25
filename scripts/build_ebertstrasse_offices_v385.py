"""Fit the two Ebertstraße office facades to their LoD2 and original block envelopes."""

import argparse
import json
import math
from pathlib import Path

import numpy as np
import shapely as sh
from build_kreuzberg_plaetze_v380 import Mesh
from scipy.interpolate import PchipInterpolator
from shapely.geometry import LineString, Point, Polygon, box
from shapely.geometry.polygon import orient

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/ebertstrasse-offices-v385.json"
OUT = ROOT / "src/app/src/data/ebertstrasseOfficesV385"

STEEL = (123, 126, 126)
TAYLOR_MULLION = (145, 149, 148)
TAYLOR_GLAZING = ((151, 158, 157), (159, 172, 173), (166, 176, 176))
TAYLOR_BLIND = (174, 172, 162)
JAMB = (80, 84, 85)
GLASS = (95, 116, 119)
WHITE = (235, 233, 225)
DARK = (55, 64, 66)
ALUMINIUM = (195, 196, 189)
ROOF = (134, 132, 115)
GREEN = (120, 131, 100)

# Window head and sill contours in the rectified west facade, sampled from
# left/north to right/south. Image ordinate 210 is street level. The second
# elevation faces south. Readings of the two park sides are interpolated.
WEST = [
  (
    [201, 193, 180, 174, 173, 177, 185, 203, 209],
    [209, 209, 209, 209, 209, 209, 209, 209, 209],
  ),
  (
    [124, 123, 121, 119, 118, 119, 122, 127, 131],
    [131, 133, 135, 137, 138, 137, 130, 127, 131],
  ),
  ([81, 82, 83, 84, 85, 84, 82, 81, 79], [101, 101, 98, 95, 92, 96, 100, 103, 104]),
  ([44, 44, 45, 46, 48, 49, 50, 51, 51], [65, 66, 65, 63, 61, 58, 54, 52, 52]),
  ([6, 6, 9, 13, 19, 22, 22, 13, 8], [23, 24, 24, 23, 21, 22, 22, 23, 23]),
]
SOUTH = [
  (
    [209, 201, 192, 188, 186, 186, 187, 193, 209],
    [209, 209, 209, 209, 209, 209, 209, 209, 209],
  ),
  (
    [131, 130, 124, 118, 114, 114, 115, 116, 118],
    [131, 130, 124, 127, 128, 128, 128, 128, 126],
  ),
  ([79, 77, 76, 76, 76, 76, 76, 78, 80], [104, 98, 90, 83, 89, 90, 85, 83, 83]),
  ([51, 48, 45, 43, 41, 40, 40, 42, 45], [52, 51, 49, 47, 52, 52, 45, 46, 48]),
  ([8, 5, 3, 1, 1, 1, 1, 2, 3], [23, 21, 18, 13, 8, 4, 1, 3, 7]),
]
# The entrance canopy and the smaller glazing strip above it are distinct.
WEST.insert(
  1,
  (
    [165, 164, 162, 159, 157, 156, 158, 160, 162],
    [183, 177, 173, 170, 169, 171, 174, 177, 178],
  ),
)
SOUTH.insert(
  1,
  (
    [162, 160, 157, 151, 149, 149, 149, 150, 150],
    [178, 173, 167, 162, 160, 159, 157, 155, 154],
  ),
)


def boundaries(site, native):
  edges = np.asarray(site["exterior"])
  groups = [0, 1, 2, 3, 4] if len(edges) == 4 else [0, 14, 24, 36, len(edges)]
  ring = np.vstack((edges, edges[0]))
  sides = [LineString(ring[a : b + 1]) for a, b in zip(groups, groups[1:])]
  body = Polygon(edges)
  if native:
    body = sh.union_all(
      [box(x * 4, z * 4, x * 4 + 4, z * 4 + 4) for x, z, *_ in site["nativeColumns"]]
    )
  # Clearance includes the generic window pane on the original block face.
  skin = orient(body.buffer(0.36 if native else 0.29, join_style="mitre"), sign=-1)
  return list(skin.exterior.coords), sides


class Wall:
  def __init__(self, mesh, a, b):
    self.mesh = mesh
    self.a, self.b = np.asarray(a), np.asarray(b)
    self.length = np.linalg.norm(self.b - self.a)
    self.d = (self.b - self.a) / self.length
    self.n = np.array([-self.d[1], self.d[0]])
    self.shade = 0.91 + 0.055 * self.n[0] - 0.035 * self.n[1]

  def point(self, u, y, out=0):
    x, z = self.a + u * self.d + out * self.n
    return (x, y, z)

  def flat(self, u, v, lo, hi, color, out=0):
    if v - u < 0.006 or hi - lo < 0.006:
      return
    self.shape(u, v, lo, hi, lo, hi, color, out)

  def shape(self, u, v, lo1, hi1, lo2, hi2, color, out=0):
    self.mesh.face(
      [
        self.point(u, lo1, out),
        self.point(v, lo2, out),
        self.point(v, hi2, out),
        self.point(u, hi1, out),
      ],
      np.asarray(color) * self.shade,
    )


def shell(mesh, polygon, y0, y1, color, cap):
  ring = list(orient(Polygon(polygon), sign=-1).exterior.coords)
  for a, b in zip(ring, ring[1:]):
    wall = Wall(mesh, a, b)
    wall.flat(0, wall.length, y0, y1, color)
  mesh.ground(Polygon(polygon), y1, cap)


def reference_on_wall(wall, sides):
  middle = Point((wall.a + wall.b) / 2)
  index = min(range(4), key=lambda i: sides[i].distance(middle))
  side = sides[index]
  start = side.project(Point(wall.a)) / side.length
  end = side.project(Point(wall.b)) / side.length
  return index, start, end, side.length


def taylor_wall(wall, reg, base, roof):
  side, q0, q1, source_width = reg
  bays = (6, 7, 5, 7)[side]
  # Bosen's west view shows a tall glazed ground floor, three fully glazed
  # upper rows, and a fifth office floor recessed behind the terrace frame.
  levels = [base, base + 6.05, base + 10.08, base + 14.02, base + 17.65, roof]
  wall.flat(0, wall.length, levels[0], levels[-2], STEEL)
  edges = sorted(
    {0.0, wall.length}
    | {
      np.clip((t - q0) / (q1 - q0) * wall.length, 0, wall.length)
      for i in range(bays)
      for t in ((i + 0.092) / bays, (i + 0.908) / bays)
      if abs(q1 - q0) > 1e-6
    }
  )
  for u, v in zip(edges, edges[1:]):
    t = q0 + (q1 - q0) * (u + v) / (2 * wall.length)
    fraction = (t * bays) % 1
    if 0.09 <= fraction <= 0.91:
      for j in range(4):
        lo, hi = levels[j] + (0.18 if j == 0 else 0.21), levels[j + 1] - 0.27
        bay = min(bays - 1, max(0, math.floor(t * bays)))
        # The Ebertstraße photograph shows a charcoal grid around reflected
        # glazing and two lighter closed blinds on the middle office row.
        tone = (
          TAYLOR_BLIND
          if side == 0 and j == 2 and bay in (0, 4)
          else TAYLOR_GLAZING[(bay + j) % len(TAYLOR_GLAZING)]
        )
        wall.flat(u, v, lo, hi, tone, 0.045)
        if j == 0:
          wall.flat(u, v, lo + 2.83, lo + 2.94, TAYLOR_MULLION, 0.08)
        wall.flat(
          max(u, (u + v) / 2 - 0.035),
          min(v, (u + v) / 2 + 0.035),
          lo,
          hi,
          TAYLOR_MULLION,
          0.08,
        )
      wall.flat(u, v, levels[-2] + 0.12, levels[-2] + 0.91, (109, 119, 120), -0.015)
      wall.flat(u, v, levels[-2] + 1.00, levels[-2] + 1.09, TAYLOR_MULLION, 0.055)
    else:
      wall.flat(u, v, levels[-2], roof, STEEL)
  wall.flat(0, wall.length, roof - 0.54, roof, STEEL)
  wall.flat(0, wall.length, levels[-2] - 0.24, levels[-2] + 0.13, STEEL, 0.04)


def entrance(wall, reg, base, name, native):
  side, q0, q1, _ = reg
  if side or abs(q1 - q0) < 0.0001:
    return

  def interval(q, r):
    a, b = sorted(
      ((q - q0) * wall.length / (q1 - q0), (r - q0) * wall.length / (q1 - q0))
    )
    return max(0, a), min(wall.length, b)

  left, right = (0.38, 0.66) if name == "taylor" else (0.39, 0.61)
  u, v = interval(left, right)
  if v > u:
    doorstep = base + (0.48 if name == "taylor" else 0.09)
    for q in [left, (left + right) * 0.5, right]:
      a, b = interval(q - 0.004, q + 0.004)
      wall.flat(a, b, doorstep, doorstep + 2.55, (105, 111, 108), 0.095)
    wall.flat(u, v, doorstep + 2.49, doorstep + 2.59, JAMB, 0.105)
    for q in [left * 0.25 + right * 0.75, left * 0.75 + right * 0.25]:
      a, b = interval(q - 0.003, q + 0.003)
      wall.flat(a, b, doorstep + 0.83, doorstep + 1.31, ALUMINIUM, 0.14)
  if name == "taylor":
    u, v = interval(0.34, 0.71)
    if v <= u:
      return
    for i in range(3):
      y = base + 0.45 - i * 0.15
      front = 0.46 + i * 0.31
      wall.mesh.face(
        [
          wall.point(u, y, front),
          wall.point(v, y, front),
          wall.point(v, y, front + 0.31),
          wall.point(u, y, front + 0.31),
        ],
        (146, 145, 139),
      )
      wall.flat(u, v, y - 0.15, y, (106, 108, 103), front + 0.31)
  else:
    # A swept stainless canopy arches over the entrance and rests on the
    # pavement at its north end. Its tapered lip stays above the double doors.
    for a, b in zip(np.linspace(0.12, 0.73, 22)[:-1], np.linspace(0.12, 0.73, 22)[1:]):
      u, v = interval(a, b)
      if v <= u:
        continue

      def at(s):
        t = q0 + (q1 - q0) * s / wall.length
        return (
          base + 0.12 + 3.68 * math.sin(np.clip((t - 0.12) / 0.29, 0, 1) * math.pi / 2)
        )

      h, k = at(u), at(v)
      offset = 1.10 if native else 1.45
      wall.mesh.face(
        [
          wall.point(u, h),
          wall.point(v, k),
          wall.point(v, k + 0.12, offset),
          wall.point(u, h + 0.12, offset),
        ],
        ALUMINIUM,
      )
      wall.shape(u, v, h - 0.06, h + 0.12, k - 0.06, k + 0.12, ALUMINIUM, offset)


def opening_samples():
  xs = np.linspace(0, 1, 9)
  panes = []
  for side in range(4):
    entries = []
    for w, s in zip(WEST, SOUTH):
      if side < 2:
        head, sill = (w, s)[side]
      else:
        # Keep the two street elevations' corner openings continuous, with a
        # less elaborate park-side interpolation where there is less evidence.
        a = (s[0][-1], s[1][-1])
        b = (w[0][0], w[1][0])
        head, sill = [
          np.linspace(v, t, 17)[(side - 2) * 8 : (side - 1) * 8 + 1]
          for v, t in zip(a, b)
        ]
      entries.append((PchipInterpolator(xs, head), PchipInterpolator(xs, sill)))
    panes.append(entries)
  return panes


def magenta_wall(wall, reg, site, sections, native):
  side, q0, q1, width = reg
  ground, roof = site["datum"], site["ceiling"]

  def heights(y):
    return ground + (roof - ground) * (1 - y / 210)

  count = max(1, math.ceil(wall.length / (0.61 if native else 0.38)))
  params = np.linspace(q0, q1, count + 1)
  for i in range(count):
    u, v = wall.length * i / count, wall.length * (i + 1) / count
    t = params[i : i + 2]
    sample = np.full(2, np.mean(t)) if native else t
    openings = [
      (np.asarray(heights(sill(sample))), np.asarray(heights(head(sample))))
      for head, sill in sections[side]
    ]
    bottom = np.full(2, ground)
    for level, (lo, hi) in enumerate(openings):
      lo = np.maximum(bottom, lo)
      hi = np.maximum(lo, hi)
      wall.shape(u, v, bottom[0], lo[0], bottom[1], lo[1], WHITE)
      if level < 5:
        glass_color = (
          (70, 92, 97) if (math.floor(np.mean(t) * width / 1.35) % 5 == 0) else GLASS
        )
        wall.shape(u, v, lo[0], hi[0], lo[1], hi[1], glass_color, -0.045)
        if int(t[0] * width / 1.38) != int(t[-1] * width / 1.38):
          wall.flat(
            u, min(v, u + 0.048), float(lo.mean()), float(hi.mean()), DARK, 0.015
          )
      bottom = hi
    wall.shape(u, v, bottom[0], roof, bottom[1], roof, WHITE)
  # The lit Telekom mark is high on the western aluminium band.
  if side == 0 and abs(q1 - q0) > 0.0001:

    def mark(m, n, y0, y1):
      a, b = sorted(
        ((m - q0) * wall.length / (q1 - q0), (n - q0) * wall.length / (q1 - q0))
      )
      wall.flat(max(0, a), min(wall.length, b), y0, y1, (222, 0, 113), 0.055)

    mark(0.477, 0.557, 23.03, 23.36)
    mark(0.511, 0.526, 22.15, 23.20)
    mark(0.460, 0.472, 22.56, 22.78)
    mark(0.561, 0.573, 22.56, 22.78)


def roof_polygon(ring, native):
  p = Polygon(ring)
  if native:
    cells = [
      box(x, z, x + 1, z + 1)
      for x in range(math.floor(p.bounds[0]), math.ceil(p.bounds[2]))
      for z in range(math.floor(p.bounds[1]), math.ceil(p.bounds[3]))
      if p.covers(Point(x + 0.5, z + 0.5))
    ]
    p = sh.union_all(cells).simplify(0.01)
  return [[round(x, 3), round(z, 3)] for x, z in list(p.exterior.coords)[:-1]]


def inner_office(mesh, ring, low, high, native):
  shell(mesh, roof_polygon(ring, native), low, high, (90, 103, 104), ROOF)


def model(name, site, native):
  mesh = Mesh([376, 0, 870])
  ring, sides = boundaries(site, native)
  sections = opening_samples()
  base, roof, terrace = site["datum"], site["ceiling"], site["terraceY"]
  for a, b in zip(ring, ring[1:]):
    wall = Wall(mesh, a, b)
    registration = reference_on_wall(wall, sides)
    if name == "taylor":
      taylor_wall(wall, registration, base, roof)
    else:
      magenta_wall(wall, registration, site, sections, native)
    entrance(wall, registration, base, name, native)
  # Current TrueDOP distinguishes the open perimeter deck and rooftop rooms.
  # The western street facade and the southern continuation retain open sky
  # above their terrace rails.
  parapet = Polygon(ring)
  inside = Polygon(site["inner"])
  # On the orthophoto the outer rails are connected across open sky by short
  # roof-level ties. Keep all spaces between them free of top polygons.
  mesh.ground(
    parapet.difference(parapet.buffer(-0.23)),
    roof,
    STEEL if name == "taylor" else WHITE,
  )
  for side_index, side in enumerate(sides):
    count = (
      (6, 7, 5, 7)[side_index] if name == "taylor" else max(2, round(side.length / 2.8))
    )
    for i in range(1, count):
      p = side.interpolate(i / count, normalized=True)
      a = parapet.exterior.interpolate(parapet.exterior.project(p))
      b = inside.exterior.interpolate(inside.exterior.project(a))
      if a.distance(b) < 0.45:
        continue
      span = LineString([a, b]).buffer(
        0.095 if name == "taylor" else 0.13, cap_style="flat"
      )
      mesh.ground(span, roof - 0.09, STEEL if name == "taylor" else WHITE)
  if name == "taylor":
    inner_office(mesh, site["inner"], terrace, roof - 0.27, native)
    inner_office(mesh, site["plant"], roof - 0.27, roof + 0.11, native)
  else:
    inner_office(mesh, site["penthouse"], terrace, roof - 0.24, native)
    border = Polygon(ring).buffer(-1.15)
    for u in np.arange(0, border.length, 1.7):
      p = border.exterior.interpolate(u)
      q = border.exterior.interpolate((u + 0.98) % border.length)
      if p.distance(q) > 1.2:
        continue
      mesh.rod((p.x, terrace + 0.20, p.y), (q.x, terrace + 0.20, q.y), 0.17, GREEN)
  return mesh.finish()


def owner_values(source):
  # All published regular prisms are retained as the lower support of the
  # new terrace. The original roof heights are protected against data changes.
  out = {"prisms": [], "columns": [], "obstacles": {}}
  for name in ("taylor", "magenta"):
    site = source[name]
    objects = []
    for style in ("drawn", "native"):
      native = style == "native"
      sx = site["ceiling"]
      pieces = (
        [
          (site["inner"], site["terraceY"], sx - 0.27),
          (site["plant"], sx - 0.27, sx + 0.11),
        ]
        if name == "taylor"
        else [(site["penthouse"], site["terraceY"], sx - 0.24)]
      )
      for ring, bottom, top in pieces:
        objects.append(
          {
            "native": native,
            "bottom": round(bottom, 2),
            "top": round(top, 2),
            "ring": roof_polygon(ring, native),
          }
        )
      if native:
        body = sh.union_all(
          [
            box(x * 4, z * 4, (x + 1) * 4, (z + 1) * 4)
            for x, z, *_ in site["nativeColumns"]
          ]
        ).simplify(0.01)
        ring = list(body.exterior.coords)[:-1]
      else:
        ring = site["exterior"]
      objects.append(
        {
          "native": native,
          "bottom": site["datum"],
          "top": round(site["terraceY"] * 10) / 10,
          "ring": ring,
        }
      )
    out["obstacles"][site["innerPart"]] = objects
    for p in site["originalPrisms"]:
      out["prisms"].append(
        [p["id"], p["y0_dm"], p["h_dm"], round(site["terraceY"] * 10), p["ring"][0]]
      )
    for x, z, lo, hi, c in site["nativeColumns"]:
      out["columns"].append([x, z, lo, hi, c, round(site["terraceY"] * 10)])
  return out


def main():
  parser = argparse.ArgumentParser()
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  source = json.loads(SOURCE.read_bytes())
  OUT.mkdir(parents=True, exist_ok=True)
  packets = {"owners": owner_values(source)}
  for name in ("taylor", "magenta"):
    for native in (False, True):
      p = model(name, source[name], native)
      packets[name + ("_native" if native else "_drawn")] = p
      print(name, native, p["f"], "triangles")
  for name, p in packets.items():
    data = json.dumps(p, separators=(",", ":")) + "\n"
    target = OUT / (name + ".json")
    if args.check:
      if target.read_text() != data:
        raise ValueError(f"Stale office packet {target}")
    else:
      target.write_text(data)


if __name__ == "__main__":
  main()
