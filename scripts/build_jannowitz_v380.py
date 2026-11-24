"""Compile the Jannowitz ensemble against the retained v183, v242 and v268 owners."""

from __future__ import annotations

import argparse
import base64
import gzip
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import linemerge, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SRC = ROOT / "src/app/src/data"
PUB = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SURVEY = json.loads((GEO / "jannowitz-v380-survey.json").read_bytes())
MANIFEST = {
  a["id"]: a for a in json.loads((PUB / "manifest.json").read_bytes())["chunks"]
}
ORIGIN = np.array([3000, -2, 500])


def rows(packet, kind):
  for m in packet["meshes"]:
    if m["kind"] == kind:
      v = (
        np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3) * 0.01
        + packet["origin"]
      )
      idx = np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3)
      yield v[idx]


class Batch:
  def __init__(self, name, origin=ORIGIN):
    self.name = name
    self.origin = origin
    self.xyz = []
    self.rgb = []
    self.ids = []
    self.vertices = {}

  def tri(self, a, b, c, color):
    pts = np.array([a, b, c])
    normal = np.cross(pts[1] - pts[0], pts[2] - pts[0])
    length = np.linalg.norm(normal)
    if length < 0.00008:
      return
    # Bake one consistent diffuse value per plane. Opposite winding has the same reading.
    normal /= length
    shade = 0.82 + 0.18 * abs(float(normal @ [0.31, 0.85, 0.43]))
    rgb = tuple(
      round(255 * ((int(color[k : k + 2], 16) / 255 + 0.055) / 1.055) ** 2.4 * shade)
      for k in (0, 2, 4)
    )
    for p in pts:
      q = tuple(np.rint((p - self.origin) * 100).astype(int))
      assert min(q) >= 0 and max(q) < 65536, q
      key = (q, rgb)
      if key not in self.vertices:
        self.vertices[key] = len(self.xyz)
        self.xyz.append(q)
        self.rgb.append(rgb)
      self.ids.append(self.vertices[key])

  def quad(self, a, b, c, d, color):
    self.tri(a, b, c, color)
    self.tri(a, c, d, color)

  def box(self, x, z, y, w, d, h, color, angle=0):
    dx, dz = math.cos(angle), math.sin(angle)

    def p(u, v, Y):
      return (x + dx * u - dz * v, Y, z + dz * u + dx * v)

    ring = [p(u * w / 2, v * d / 2, y) for u, v in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    self.prism(ring, y + h, color)

  def prism(self, ring, top, color):
    cap = [(x, top, z) for x, _, z in ring]
    for j in range(1, len(cap) - 1):
      self.tri(cap[0], cap[j], cap[j + 1], color)
    for j, p in enumerate(ring):
      k = (j + 1) % len(ring)
      self.quad(p, ring[k], cap[k], cap[j], color)

  def packet(self):
    assert len(self.xyz) < 65536
    # Component planes and modulo-16-bit deltas keep repeated steelwork and
    # neighbouring indices compact. Coordinates remain exact centimetres.
    pos = np.asarray(self.xyz, dtype="<u2").T
    idx = np.asarray(self.ids, dtype="<u2")
    dp = np.diff(pos, axis=1, prepend=np.zeros((3, 1), dtype="<u2")).flatten()
    di = np.diff(idx, prepend=np.uint16(0))

    def planes(words):
      return (words & 255).astype("u1").tobytes() + (words >> 8).astype("u1").tobytes()

    raw = planes(dp) + np.asarray(self.rgb, "u1").tobytes() + planes(di)
    payload = base64.b64encode(gzip.compress(raw, compresslevel=9, mtime=0)).decode(
      "ascii"
    )
    return dict(name=self.name, n=len(self.xyz), i=len(self.ids), data=payload)


def navsolid(ring, low, high, host):
  ox, oz = (int(s) * 512 for s in host.split("_"))
  return dict(
    ring=[[round(x - ox, 2), round(z - oz, 2)] for x, z in ring],
    holes=[],
    low=round(low, 2),
    high=round(high, 2),
  )


def station(native):
  b = Batch("Bahnhof Jannowitzbrücke · verglaste Stadtbahnbögen an der Spree")
  profile = next(
    q
    for q in json.loads((SRC / "alexanderStationsV183Navigation.json").read_bytes())[
      "profiles"
    ]
    if q["key"] == "jannowitz"
  )
  f = profile["frame"]
  half = f["width"] / 2 - 0.12
  offsets = SURVEY["viaductEdge"]["offsets"]

  def p(u, y, v):
    if v > half + 0.11:
      # The main line runs between the platform hall and the river. The
      # photographed arches belong to its curved outer viaduct wall.
      o = np.interp(u, [p[0] for p in offsets], [p[1] for p in offsets])
      v = o + (v - (half + 1.20)) + (2.04 if native else 0.74)
    return [f["x"] + f["dx"] * u - f["dz"] * v, y, f["z"] + f["dz"] * u + f["dx"] * v]

  def rect(left, right, low, high, depth, tone):
    b.quad(
      p(left, low, depth),
      p(right, low, depth),
      p(right, high, depth),
      p(left, high, depth),
      tone,
    )

  # Source photo: glazed brick arches on the river elevation only. End track portals
  # and the transverse accesses on the street side retain their original clearance.
  length = f["length"] - 1.5
  v = half + 1.20
  count = 9
  span = length / count
  solids = []
  for j in range(count):
    mid = -length / 2 + span * (j + 0.5)
    left, right = mid - span / 2, mid + span / 2
    spring = 4.27
    radius = span / 2 - 0.77
    rise = 4.03
    steps = 12 if native else 20
    rect(left, right, -1.15, 1.38, v, "989482")
    rect(left, right, 1.38, 9.69, v - 0.53, "344446")
    rect(left, mid - radius, 1.35, spring, v, "aa7a62")
    rect(mid + radius, right, 1.35, spring, v, "a9745d")
    for i in range(steps):
      u0 = -radius + 2 * radius * i / steps
      u1 = -radius + 2 * radius * (i + 1) / steps

      def arc(u):
        return spring + rise * math.sqrt(max(0, 1 - (u / radius) ** 2))

      a, c = arc(u0), arc(u1)
      if native:
        a = c = round(arc((u0 + u1) / 2) * 4) / 4
      x0, x1 = mid + u0, mid + u1
      b.quad(
        p(x0, a + 0.29, v), p(x1, c + 0.29, v), p(x1, 9.69, v), p(x0, 9.69, v), "ad806b"
      )
      band = ["bb8a6c", "ba8970", "af7a60", "bc8a72"][i % 4]
      b.quad(
        p(x0, a, v + 0.05),
        p(x1, c, v + 0.05),
        p(x1, c + 0.29, v + 0.05),
        p(x0, a + 0.29, v + 0.05),
        band,
      )
      b.quad(
        p(x0, a, v + 0.05),
        p(x1, c, v + 0.05),
        p(x1, c, v - 0.53),
        p(x0, a, v - 0.53),
        "725a50",
      )
    for k in range(-3, 4):
      u = k * radius / 4
      rect(mid + u - 0.055, mid + u + 0.055, 1.48, arc(u) - 0.04, v - 0.43, "819193")
    for y in [2.75, 4.36, 6.1]:
      w = radius * math.sqrt(max(0, 1 - (max(0, y - spring) / rise) ** 2))
      rect(mid - w, mid + w, y, y + 0.10, v - 0.42, "819193")
    rect(left, right, 9.39, 9.7, v + 0.10, "b7ad9e")
    # Viaduct glass/masonry is an occupied outer skin, not a transverse obstruction.
    ring = [
      p(u, 0, s)
      for u, s in [(left, v - 0.54), (right, v - 0.54), (right, v), (left, v)]
    ]
    solids.append(navsolid([(x, z) for x, _, z in ring], -1.15, 9.69, "6_1"))
    # The island hall and the uncovered mainline share a real structural
    # deck. The existing rails run at 10.65 m and stay clear of its cap.
    lip = [(left, half - 0.06), (right, half - 0.06), (right, v), (left, v)]
    cap = [p(u, 10.35, vv) for u, vv in lip]
    b.quad(*cap, "817e75")
    b.quad(p(left, 9.69, v), p(right, 9.69, v), cap[2], cap[3], "a69f91")
    b.quad(*[p(u, 9.69, vv) for u, vv in lip], "77746b")
    solids.append(navsolid([(x, z) for x, _, z in cap], 9.69, 10.35, "6_1"))
  # Tight steel mullions read through the existing v183 glass between its structural posts.
  for i in range(1, 69):
    u = -length / 2 + i * length / 69
    if i % 3:
      for side in (-1, 1):
        rect(u - 0.045, u + 0.045, 12.02, 18.54, side * (half + 0.10), "95a4a0")
  return b, solids


def lamps(native):
  b = Batch("Jannowitzbrücke · acht zweiflammige Bogenleuchten")
  solids = []
  n = 4 if native else 8
  road = Polygon(SURVEY["bridgeRing"])

  def taper(x, z, y, r, h, r2, color):
    bottom = [
      (x + math.cos(j * 2 * math.pi / n) * r, y, z + math.sin(j * 2 * math.pi / n) * r)
      for j in range(n)
    ]
    top = [
      (
        x + math.cos(j * 2 * math.pi / n) * r2,
        y + h,
        z + math.sin(j * 2 * math.pi / n) * r2,
      )
      for j in range(n)
    ]
    for j in range(n):
      k = (j + 1) % n
      b.quad(bottom[j], bottom[k], top[k], top[j], color)
    for j in range(1, n - 1):
      b.tri(top[0], top[j], top[j + 1], color)

  for _, x, z in SURVEY["lampPoints"]:
    assert road.contains(Point(x, z))
    for y, r, h, r2 in [
      (3.24, 0.23, 0.35, 0.21),
      (3.59, 0.19, 1.02, 0.14),
      (4.61, 0.13, 4.69, 0.095),
      (9.30, 0.14, 0.31, 0.08),
    ]:
      taper(x, z, y, r, h, r2, "45504e")
    for sign in (-1, 1):
      # Opposed pendant lanterns at the head of the central straight mast.
      dx, dz = 0.987 * sign, 0.16 * sign
      b.box(x + dx * 0.40, z + dz * 0.40, 9.30, 0.86, 0.105, 0.12, "46504e", 0.16)
      xx, zz = x + dx * 0.77, z + dz * 0.77
      taper(xx, zz, 8.59, 0.115, 0.46, 0.215, "d9d0ac")
      taper(xx, zz, 9.05, 0.25, 0.15, 0.14, "424947")
      taper(xx, zz, 9.20, 0.08, 0.16, 0.08, "424947")
    solids.append(
      navsolid(
        [
          (x - 0.13, z - 0.13),
          (x + 0.13, z - 0.13),
          (x + 0.13, z + 0.13),
          (x - 0.13, z + 0.13),
        ],
        3.24,
        9.43,
        "6_1",
      )
    )
  return b, solids


def roof(native, triangles):
  b = Batch(
    "Kraftwerk Berlin · Lichtaufsätze und Lüfter auf den gestaffelten Hallendächern"
  )
  if native:
    source = json.loads((SRC / "kraftwerkBerlinV268.json").read_bytes())["packets"][
      "minecraft:6_1"
    ]
    packet = {"origin": source["origin"], "meshes": [source["replacement"]]}
    triangles = next(rows(packet, "kraftwerk-berlin-v268"))
  upper = triangles[(triangles[:, :, 1].min(1) > 18) & (triangles[:, :, 1].max(1) < 48)]
  polygons = [Polygon(t[:, [0, 2]]) for t in upper]
  angle = math.atan2(*SURVEY["roofDirection"][::-1])
  solids = []
  for kind, x, z in SURVEY["roofObjects"]:
    heights = [
      float(y[:, 1].max())
      for poly, y in zip(polygons, upper)
      if poly.area > 0.01 and poly.covers(Point(x, z))
    ]
    assert heights, (kind, x, z, native)
    base = max(heights) - 0.015
    w, d = (5.1, 2.1) if kind == "raised rooflight" else (2.1, 1.22)
    h = 1.12 if kind == "raised rooflight" else 0.88
    if native:
      # These small upstands sit inside the original cardinal top cells.
      angle0 = 0
    else:
      angle0 = angle
    b.box(
      x,
      z,
      base,
      w,
      d,
      h * 0.65,
      "a2a3a1" if kind == "raised rooflight" else "747b7a",
      angle0,
    )
    b.box(
      x,
      z,
      base + h * 0.65,
      w + 0.10,
      d + 0.10,
      h * 0.35,
      "d0cfbd" if kind == "raised rooflight" else "99a2a0",
      angle0,
    )
    tone = "e2dfca" if kind == "raised rooflight" else "475154"
    for k in [-0.28, 0, 0.28]:
      b.box(
        x + w * k * math.cos(angle0),
        z + w * k * math.sin(angle0),
        base + h,
        w * 0.235,
        d * 0.76,
        0.055,
        tone,
        angle0,
      )
    ring = []
    for u, v in [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]:
      ring.append(
        (
          x + u * math.cos(angle0) - v * math.sin(angle0),
          z + u * math.sin(angle0) + v * math.cos(angle0),
        )
      )
    solids.append(navsolid(ring, base, base + h + 0.055, "6_1"))
  return b, solids


def native_edges(path, triangles, level, side=1):
  """Recover the rendered stair-step perimeter from real vertical packet faces."""
  target = path.buffer(3.15)
  out = []
  groups = defaultdict(list)
  for t in triangles:
    if t[:, 1].min() >= level or t[:, 1].max() <= level:
      continue
    pairs = []
    for a, b in zip(t, np.roll(t, -1, axis=0)):
      if (a[1] - level) * (b[1] - level) < 0:
        q = a + (b - a) * (level - a[1]) / (b[1] - a[1])
        pairs.append(q[[0, 2]])
    if len(pairs) != 2:
      continue
    a, b = pairs
    line = LineString(pairs)
    if line.length < 0.02 or not line.intersects(target):
      continue
    axis = 0 if abs(a[0] - b[0]) < 0.0001 else 1 if abs(a[1] - b[1]) < 0.0001 else -1
    if axis < 0:
      continue
    groups[(axis, round(a[axis], 2))].append(line)
  for (axis, _), lines in groups.items():
    merged = unary_union(lines)
    if merged.geom_type == "MultiLineString":
      merged = linemerge(merged)
    for line in getattr(merged, "geoms", [merged]):
      if line.geom_type != "LineString":
        continue
      # Evaluate each metre so the street corner can end independently of adjacent owners.
      for j in range(math.ceil(line.length)):
        a = np.array(line.interpolate(j).coords[0])
        b = np.array(line.interpolate(min(j + 1, line.length)).coords[0])
        c = (a + b) / 2
        p = Point(c)
        if path.distance(p) > 3.15:
          continue
        u0, u1 = path.project(Point(a)), path.project(Point(b))
        if abs(u1 - u0) < 0.08:
          continue
        # Positive facade U follows the street toward and around the corner.
        if u0 > u1:
          u0, u1, a, b = u1, u0, b, a
        t = (b - a) / np.linalg.norm(b - a)
        n = side * np.array([-t[1], t[0]])
        out.append((u0, u1, a, b, n))
  # At a native grid corner both rear and exposed faces can project into
  # the same interval. Select only the streetmost one at each exact break.
  breaks = sorted({u for left, right, *_ in out for u in (left, right)})
  visible = []
  for left, right in zip(breaks, breaks[1:]):
    if right - left < 0.004:
      continue
    u = (left + right) / 2
    q = np.array(path.interpolate(u).coords[0])
    tangent = np.array(
      path.interpolate(min(u + 0.04, path.length)).coords[0]
    ) - np.array(path.interpolate(max(0, u - 0.04)).coords[0])
    n = side * np.array([-tangent[1], tangent[0]]) / np.linalg.norm(tangent)
    candidates = [edge for edge in out if edge[0] <= u <= edge[1]]
    if not candidates:
      continue

    def point(edge, d):
      lo, hi, a, b, _ = edge
      return a + (b - a) * (d - lo) / (hi - lo)

    e = max(candidates, key=lambda e: (point(e, u) - q) @ n)
    a, b = point(e, left), point(e, right)
    if (
      visible
      and abs(visible[-1][1] - left) < 0.005
      and np.linalg.norm(visible[-1][3] - a) < 0.015
      and np.linalg.norm(visible[-1][4] - e[4]) < 0.01
    ):
      lo, _, prev, _, normal = visible[-1]
      visible[-1] = (lo, right, prev, b, normal)
    else:
      visible.append((left, right, a, b, e[4]))
  return visible


def club(native, host, triangles):
  b = Batch("KitKatClub · gerundetes Eckhaus und niedriger Straßenflügel")
  rows = json.loads(
    gzip.decompress((GEO / "alt-mitte-v169/source-392_5819-00.json.gz").read_bytes())
  )["buildings"]
  bodies = {r["id"]: r["parts"][0] for r in rows}
  for main in [True, False]:
    owner = "DEBE01YYK00005jK" if main else "DEBE01YYK0000CXv"
    part = bodies[owner]
    pts = part["footprintPolygons"][0]["ring"]
    path = (
      LineString(pts[7::-1] + pts[:17:-1]) if main else LineString([pts[0], pts[-1]])
    )
    length = path.length
    top = 13.0 if main and native else 9.0 if native else part["topY"]
    art = []

    def patch(points, tone, depth):
      art.append((Polygon(points), tone, depth))

    def plate(u, w, y, h, tone, depth):
      patch([(u, y), (u + w, y), (u + w, y + h), (u, y + h)], tone, depth)

    plate(0, length, 3.06, top - 3.06, "373439" if main else "a49c86", 0.17)
    plate(0, length, 3.09, 0.32, "625e5b", 0.21)
    if main:
      plate(0, length, 7.53, 0.31, "514950", 0.25)
      plate(0, length, top - 0.28, 0.18, "5c5353", 0.25)
      # Dark graphite corner with pale divided sash, the interrupted sign
      # field and fragments of the coloured street mural from the 2025 view.
      for u in [1.0, 3.7, 6.45, 9.2, 12.05, 15.0, 17.9, 20.65, 29.1, 31.3, 33.5, 35.7]:
        if u + 1.24 > length:
          continue
        plate(u, 1.23, 8.56, 2.19, "a6a399", 0.245)
        plate(u + 0.095, 1.04, 8.68, 1.97, "414b51", 0.28)
        plate(u + 0.55, 0.09, 8.65, 2.0, "b8b5a7", 0.30)
        plate(u + 0.10, 1.02, 9.64, 0.10, "c0bbae", 0.30)
      for u, w, y, h, c in [
        (1.0, 3.6, 4.05, 2.4, "6c9ba7"),
        (5.2, 3.1, 4.15, 2.45, "929a9a"),
        (11.5, 3.3, 3.45, 3.65, "a19b84"),
        (18.1, 3.15, 3.64, 2.55, "d9c8b0"),
        (30.5, 4.1, 5.45, 1.15, "b79157"),
      ]:
        plate(u, w, y, h, c, 0.24)
        plate(
          u + 0.20, w - 0.40, y + 0.13, h - 0.30, "43545b" if u < 10 else "504951", 0.28
        )
      # Abstract painted discs, starbursts and broad sign strokes preserve
      # the colour blocks and silhouettes without shipping a photograph.
      for u, y, r, c in [
        (16.9, 5.93, 0.83, "9a686d"),
        (21.7, 5.23, 1.13, "c3c1aa"),
        (26.4, 5.2, 1.13, "72a9ad"),
        (24.3, 10.28, 0.84, "c88679"),
        (13.2, 11.02, 0.86, "d7ba80"),
        (31.4, 10.89, 0.70, "cc8979"),
      ]:
        patch(
          [
            (
              u + math.cos(i * math.pi / 8) * r * (0.5 if i % 2 and u == 13.2 else 1),
              y + math.sin(i * math.pi / 8) * r * (0.5 if i % 2 and u == 13.2 else 1),
            )
            for i in range(16)
          ],
          c,
          0.33,
        )
      # The painted ground-level figures have outlined eyes, arcs and
      # white linework. Retain these broad shapes on the corresponding
      # dark bays without sampling any source photograph into a texture.
      for u, y, r, tone in [
        (16.9, 5.93, 0.83, "bdadb0"),
        (21.7, 5.23, 1.13, "ded9c8"),
        (26.4, 5.2, 1.13, "bdd2ce"),
        (24.3, 10.28, 0.84, "e4d6bd"),
      ]:
        for du in [-0.27, 0.27]:
          patch(
            [
              (
                u + (du + math.cos(i * math.pi / 5) * 0.155) * r,
                y + (0.16 + math.sin(i * math.pi / 5) * 0.115) * r,
              )
              for i in range(10)
            ],
            tone,
            0.36,
          )
          patch(
            [
              (
                u + (du + math.cos(i * math.pi / 5) * 0.073) * r,
                y + (0.16 + math.sin(i * math.pi / 5) * 0.072) * r,
              )
              for i in range(10)
            ],
            "424851",
            0.39,
          )
        for k in range(7):
          a = math.pi * (1.10 + k * 0.105)
          c = a + math.pi * 0.105
          patch(
            [
              (u + math.cos(angle) * rr * r, y + math.sin(angle) * rr * r)
              for angle, rr in [(a, 0.49), (c, 0.49), (c, 0.43), (a, 0.43)]
            ],
            tone,
            0.37,
          )
      for k in range(4):
        plate(1.2 + k * 0.84, 0.07, 4.23, 1.98, "b2b9b7", 0.33)
      for k in range(6):
        plate(11.85, 2.63, 3.80 + k * 0.40, 0.052, "958e87", 0.33)
      # Lettering painted across the upper corner in the dated city photo.
      letters = {
        "P": ["110", "101", "110", "100", "100"],
        "R": ["110", "101", "110", "101", "101"],
        "E": ["111", "100", "110", "100", "111"],
        "L": ["100", "100", "100", "100", "111"],
        "O": ["010", "101", "101", "101", "010"],
        "V": ["101", "101", "101", "101", "010"],
      }
      for start, width in [(13.6, 8.3), (28.0, min(8.6, length - 28.2))]:
        pitch = width / 27
        for k, ch in enumerate("PRELOVE"):
          for iy, row in enumerate(letters[ch]):
            for ix, val in enumerate(row):
              if val == "1":
                plate(
                  start + (k * 4 + ix) * pitch,
                  pitch + 0.008,
                  11.07 + (4 - iy) * 0.25,
                  0.26,
                  "d6c6b2" if ch != "O" else "c38580",
                  0.35,
                )
    else:
      plate(0, length, 7.52, 1.10, "c0b8a1", 0.22)
      plate(0, length, 7.22, 0.27, "5d5a51", 0.25)
      for u, w, c in [
        (1.0, 3.1, "5f7278"),
        (5.0, 3.7, "695c57"),
        (9.3, 4.4, "82686a"),
        (14.2, 3.4, "706a5f"),
        (18.7, 3.05, "606a69"),
      ]:
        plate(u, w, 3.34, 3.68, "575852", 0.25)
        plate(u + 0.16, w - 0.32, 3.49, 3.19, c, 0.29)
        plate(u + 0.12, w - 0.24, 6.36, 0.23, "a59980", 0.32)
    if native:
      edges = native_edges(path, triangles, 7.17 if main else 5.37)
    else:
      edges = []
      for a, bb in zip(path.coords, list(path.coords)[1:]):
        a, bb = np.array(a), np.array(bb)
        t = (bb - a) / np.linalg.norm(bb - a)
        edges.append(
          (
            path.project(Point(a)),
            path.project(Point(bb)),
            a,
            bb,
            np.array([-t[1], t[0]]),
          )
        )
    for lo, hi, a, bb, n in edges:
      if hi - lo < 0.015:
        continue
      # Only the actual front is dressed. No new stand-in body/paint on the courtyard.
      for shape, tone, depth in art:
        if shape.bounds[2] <= lo or shape.bounds[0] >= hi:
          continue
        cut = shape.intersection(box(lo, 3, hi, top))
        for poly in getattr(cut, "geoms", [cut]):
          if poly.geom_type != "Polygon" or poly.area < 0.001:
            continue

          def world(q):
            u, y = q
            xx, zz = a + (bb - a) * (u - lo) / (hi - lo) + n * depth
            return (xx, y, zz)

          # Clip precisely at the 512 m tile boundary. Adjacent tiles
          # receive only their own portion of the painted front.
          vs = [world(q) for q in list(poly.exterior.coords)[:-1]]
          clipped = []
          for x1, x2 in zip(vs, vs[1:] + vs[:1]):

            def inside(v):
              return v[0] < 3072 if host == "5_1" else v[0] >= 3072

            if inside(x1):
              clipped.append(x1)
            if inside(x1) != inside(x2):
              t = (3072 - x1[0]) / (x2[0] - x1[0])
              clipped.append(tuple(a0 + t * (a1 - a0) for a0, a1 in zip(x1, x2)))
          for j in range(1, len(clipped) - 1):
            b.tri(clipped[0], clipped[j], clipped[j + 1], tone)
  return b


def dutch(native, triangles):
  b = Batch(
    "Niederländische Botschaft · gläserner Kubus und silbriger Hoftrakt",
    np.array([2650, -2, 400]),
  )
  for record in SURVEY["embassy"]["facades"]:
    path = LineString([record["a"], record["b"]])
    length = path.length
    a, bb = np.array(record["a"]), np.array(record["b"])
    tangent = (bb - a) / length
    sign = record["normalSign"]
    normal = sign * np.array([-tangent[1], tangent[0]])
    kind = record["kind"]
    low, high = record["low"], record["high"]
    if native:
      edges = native_edges(path, triangles, (low + high) / 2, sign)
      high = (
        math.floor(high / 2) * 2 + 1 if high % 2 >= 1 else math.floor(high / 2) * 2 - 1
      )
    else:
      edges = [(0, length, a, bb, normal)]
    fields = []

    def field(pts, tone, depth):
      fields.append((Polygon(pts), tone, depth))

    def rect(u0, u1, y0, y1, tone, depth):
      if u1 > u0 and y1 > y0:
        field(((u0, y0), (u1, y0), (u1, y1), (u0, y1)), tone, depth)

    def ribbon(y, w, h, tone):
      field(((0, y), (length, y + w), (length, y + w + h), (0, y + h)), tone, 0.31)

    rect(
      0,
      length,
      low,
      high,
      "939b9b" if kind == "silver court screen" else "606f70",
      0.19,
    )
    if kind == "silver court screen":
      for x in np.arange(0.3, length, 1.14):
        rect(x, x + 0.06, low, high, "b1b8b6", 0.255)
      for y in np.arange(9.7, high, 0.65):
        rect(0, length, y, y + 0.04, "797f80", 0.26)
    elif kind == "projected street bay":
      # The street photograph shows a dark lower glass strip, broad
      # satin-metal cladding and the continuous green-glass overhang.
      rect(0, length, 3.0, 5.35, "526164", 0.24)
      rect(0, length, 5.35, 10.50, "a0a3a4", 0.24)
      ribbon(10.05, 1.68, 3.05, "516568")
      for x in np.arange(0.4, length, 2.28):
        rect(x, x + 0.08, 5.35, 10.5, "aeb0ae", 0.27)
        y = 10.05 + 1.68 * x / length
        rect(x, x + 0.095, y, y + 3.05, "b6bcba", 0.35)
      ribbon(13.08, 1.68, 0.16, "b4b8b7")
    else:
      is_river = kind.startswith("river glass")
      pitch = 1.65 if is_river else 1.48
      for k, x0 in enumerate(np.arange(0, length, pitch)):
        rect(
          x0,
          min(length, x0 + pitch),
          low,
          high,
          (
            ["788e8c", "81918f", "788886", "7c8d89"]
            if is_river
            else ["69787b", "657578", "718084", "627276"]
          )[k % 4],
          0.24,
        )
      for y in [6.37, 9.88, 13.40, 16.9, 20.43, 23.96, 27.50]:
        rect(0, length, y, y + 0.23, "a1aaaa", 0.28)
      if kind == "river glass east":
        ribbon(25.35, -4.70, 1.44, "475b5b")
        ribbon(24.99, -4.70, 0.31, "a9b7af")
        ribbon(20.15, -2.75, 0.64, "5c706c")
      elif kind == "river glass west":
        ribbon(20.65, -0.22, 1.44, "475b5b")
        ribbon(20.29, -0.22, 0.31, "abb4ae")
      elif kind == "upper street glass":
        # The broad horizontal break and its slight kink are visible
        # against much taller continuous silver uprights.
        ribbon(21.25, 1.70, 0.85, "b0b9b7")
        rect(0, length, high - 0.48, high, "bfc3c1", 0.29)
      elif kind == "court connector face":
        rect(0, length, 17.3, 19.65, "b0b5ae", 0.29)
      for x in np.arange(0.08, length, pitch):
        rect(
          x,
          x + (0.18 if kind == "upper street glass" else 0.10),
          low,
          high,
          "b2bbb9",
          0.37,
        )
      rect(0, length, high - 0.20, high, "b9c1c0", 0.38)
    for u0, u1, a, bb, n in edges:
      if u1 - u0 < 0.018:
        continue
      domain = box(u0, low, u1, high)
      for shape, tone, depth in fields:
        cut = shape.intersection(domain)
        if cut.geom_type != "Polygon" or cut.area < 0.003:
          continue

        def point(pt):
          u, y = pt
          xx, zz = a + (bb - a) * (u - u0) / (u1 - u0) + depth * n
          return (xx, y, zz)

        ring = [point(q) for q in list(cut.exterior.coords)[:-1]]
        for j in range(1, len(ring) - 1):
          b.tri(ring[0], ring[j], ring[j + 1], tone)
  return b


def build(check=False):
  for native in [False, True]:
    family = "minecraft" if native else "drawn"
    packets = {
      host: json.loads(
        gzip.decompress((PUB / MANIFEST[host][family]["url"]).read_bytes())
      )
      for host in ["5_0", "5_1", "6_1"]
    }
    all_faces = np.concatenate(
      [a for packet in packets.values() for a in rows(packet, "alt-mitte-v169")]
    )
    lo, hi = all_faces.min(axis=1), all_faces.max(axis=1)
    club_faces = all_faces[
      (hi[:, 0] > 3044) & (lo[:, 0] < 3087) & (hi[:, 2] > 912) & (lo[:, 2] < 958)
    ]
    roof_faces = all_faces[
      (hi[:, 0] > 3195) & (lo[:, 0] < 3322) & (hi[:, 2] > 909) & (lo[:, 2] < 1018)
    ]
    dutch_faces = all_faces[
      (hi[:, 0] > 2698) & (lo[:, 0] < 2759) & (hi[:, 2] > 426) & (lo[:, 2] < 481)
    ]
    for host in packets:
      parts = (
        [dutch(native, dutch_faces)]
        if host == "5_0"
        else [club(native, host, club_faces)]
      )
      solids = []
      if host == "6_1":
        for mesh, nav in (station(native), lamps(native), roof(native, roof_faces)):
          parts.append(mesh)
          solids.extend(nav)
      assert all(p.xyz for p in parts)
      filename = ("native_" if native else "drawn_") + host + ".json"
      floors = [
        dict(ring=s["ring"], holes=[], y=s["high"]) for s in solids if s["low"] >= 9.69
      ]
      data = {"parts": [b.packet() for b in parts], "solids": solids, "floors": floors}
      path = SRC / "jannowitzV380" / filename
      text = json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n"
      if check:
        if path.read_text() != text:
          raise SystemExit(f"Stale Jannowitz packet: {filename}")
      else:
        path.write_text(text)
      print(
        filename,
        len(path.read_bytes()),
        [(b.name[:12], len(b.ids) // 3) for b in parts],
      )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--check",
    action="store_true",
    help="Check all committed packets without modifying them",
  )
  build(parser.parse_args().check)
