"""Build physical Friedrichsfelde houses and open aviaries on proven city mesh owners.

The retained local survey is sufficient for rebuilding. Roof samples are in the
official height datum and the existing park surface is at scene Y=3 metres.
"""

from __future__ import annotations

import base64
import gzip
import json
import math
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

import numpy as np
from shapely import constrained_delaunay_triangles
from shapely.affinity import rotate
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import nearest_points

from scripts.build_surveyed_shell_retirements_v377 import select_tile
from scripts.build_windowless_buildings_v377 import bodies, entity

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
OUT = DATA / "tierparkEastV379Tiles"
SOURCE = GEO / "tierpark-east-v379-source.json.gz"
GROUND = 3.0
STEEL, EDGE, WOOD, OAK, GLASS = (
  (80, 91, 92),
  (134, 145, 143),
  (131, 104, 77),
  (103, 82, 64),
  (135, 164, 166),
)


def write(path, data):
  path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")


def encoded(a, dtype):
  return base64.b64encode(np.asarray(a, dtype=dtype).tobytes()).decode()


@lru_cache(maxsize=None)
def linear(color):
  return tuple(
    np.rint(((np.asarray(color) / 255 + 0.055) / 1.055) ** 2.4 * 255)
    .clip(0, 255)
    .astype(int)
  )


class Mesh:
  def __init__(self, tile):
    x, z = map(int, tile.rsplit("-", 1)[1].split("_"))
    self.origin = np.array([x * 512, -10, z * 512])
    self.table = {}
    self.positions = []
    self.colors = []
    self.indices = []

  def tri(self, a, b, c, color):
    pts = [
      tuple(np.rint((np.asarray(v) - self.origin) * 100).astype(int)) for v in (a, b, c)
    ]
    if len(set(pts)) < 3:
      return
    if any(v < 0 or v >= 65536 for p in pts for v in p):
      raise ValueError(("triangle outside tile", self.origin, pts))
    for p in pts:
      key = (p, tuple(color))
      if key not in self.table:
        self.table[key] = len(self.positions)
        self.positions.append(p)
        self.colors.append(linear(tuple(color)))
      self.indices.append(self.table[key])

  def quad(self, a, b, c, d, color):
    self.tri(a, b, c, color)
    self.tri(a, c, d, color)

  def box(self, x, y, z, w, h, d, color):
    p = [
      (x + i * w / 2, y + j * h / 2, z + k * d / 2)
      for j in (-1, 1)
      for k in (-1, 1)
      for i in (-1, 1)
    ]
    for q in [
      (0, 1, 5, 4),
      (1, 3, 7, 5),
      (3, 2, 6, 7),
      (2, 0, 4, 6),
      (4, 5, 7, 6),
      (0, 2, 3, 1),
    ]:
      self.quad(*(p[i] for i in q), color)

  def beam(self, a, b, width, color, thickness=None, native=False):
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    v = b - a
    length = np.linalg.norm(v)
    if length < 0.01:
      return
    thick = thickness or width
    if native:
      # Short orthogonal blocks represent the slant without a smooth double.
      n = max(1, math.ceil(max(abs(v[0]), abs(v[2])) / 1.3))
      for i in range(n):
        mid = a + v * (i + 0.5) / n
        self.box(
          *mid,
          max(width, abs(v[0]) / n),
          max(thick, abs(v[1]) / n),
          max(width, abs(v[2]) / n),
          color,
        )
      return
    tangent = v / length
    side = (
      np.cross(tangent, [0, 1, 0])
      if abs(tangent[1]) < 0.99
      else np.cross(tangent, [0, 0, 1])
    )
    side = side / np.linalg.norm(side)
    up = np.cross(side, tangent)
    p = [
      pt + s * side * width / 2 + h * up * thick / 2
      for pt in (a, b)
      for s, h in [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    ]
    for j in range(4):
      self.quad(p[j], p[(j + 1) % 4], p[(j + 1) % 4 + 4], p[j + 4], color)

  def payload(self, kind):
    return dict(
      kind=kind,
      positionType="u16cm",
      positions=encoded(self.positions, "<u2"),
      colors=encoded(self.colors, "u1"),
      indices=encoded(self.indices, "<u4"),
    )


def triangles(poly):
  if poly.is_empty:
    return []
  parts = (
    [poly]
    if isinstance(poly, Polygon)
    else [g for g in getattr(poly, "geoms", ()) if isinstance(g, Polygon)]
  )
  return [
    list(t.exterior.coords)[:3]
    for p in parts
    for t in constrained_delaunay_triangles(p).geoms
    if t.area > 0.004
  ]


def grids(poly, step):
  a, b, c, d = poly.bounds
  for x in range(step * math.floor(a / step), math.ceil(c), step):
    for z in range(step * math.floor(b / step), math.ceil(d), step):
      if poly.intersects(box(x, z, x + step, z + step)):
        yield x, z


def make_roof(mesh, feature, outline, native):
  samples = np.array(feature["roofSurvey"])
  source = shape(feature["geometry"])
  floor = feature["terrainNHN"]
  heights = samples[:, 2] - floor + GROUND
  inside = np.array(
    [source.buffer(-1.2).covers(Point(x, z)) for x, z in samples[:, :2]]
  )
  # Reject vegetation, courtyard ground and points falling on the eave's vertical return.
  rgb = samples[:, 3:].astype(int)
  clean = (
    inside
    & (heights > GROUND + 1.3)
    & (heights < GROUND + (24 if feature["id"] == "way/11269493" else 9))
    & (np.max(rgb, axis=1) - np.min(rgb, axis=1) < 80)
  )
  good = samples[clean]
  good[:, 2] = heights[clean]
  if len(good) < 70:
    raise ValueError("Too few surface measurements on " + feature["id"])
  obs = json.loads((GEO / "tierpark-east-v379-roof-observations.json").read_text())[
    "houses"
  ][feature["id"]]
  x0, z0, x1, z1 = obs["bboxScene"]
  pw, ph = obs["pixels"]
  zones = [
    (
      kind,
      angle,
      period,
      Polygon(
        [(x0 + x * (x1 - x0) / pw, z0 + z * (z1 - z0) / ph) for x, z in corners]
      ).intersection(outline),
    )
    for kind, angle, period, corners in obs["fields"]
  ]

  def base_color(kind, band):
    if kind in {"membrane", "barrel"}:
      return [(166, 184, 193), (191, 205, 212), (216, 225, 228), (226, 232, 232)][band]
    if kind == "dark-glass":
      return (68, 86, 102)
    if kind == "skylight":
      return [(131, 150, 158), (153, 165, 170)][band % 2]
    if kind == "light":
      return (185, 190, 187)
    return (175, 177, 167) if feature["id"] == "way/11269493" else (116, 122, 119)

  @lru_cache(maxsize=20000)
  def height(x, z):
    d2 = (good[:, 0] - x) ** 2 + (good[:, 1] - z) ** 2
    ix = np.argpartition(d2, 8)[:8]
    h = np.median(good[ix, 2])
    return round(h * 2) / 2 if native else round(h, 2)

  def top(x, z):
    return (x, height(round(x, 2), round(z, 2)), z)

  def color_at(x, z):
    for kind, angle, per, region in zones:
      if region.covers(Point(x, z)):
        u = -x * math.sin(angle) + z * math.cos(angle)
        return base_color(kind, int((u / per % 1) * 4) % 4)
    return base_color("", 0)

  walls = (191, 180, 155) if feature["id"] == "way/11269493" else (180, 168, 149)
  if not native:
    for a, b in zip(outline.exterior.coords, list(outline.exterior.coords)[1:]):
      length = math.dist(a, b)
      n = max(1, math.ceil(length / 2.5))
      for j in range(n):
        p, q = [np.array(a) + (np.array(b) - a) * k / n for k in (j, j + 1)]
        ta, tb = top(*p), top(*q)
        mesh.quad((p[0], GROUND, p[1]), (q[0], GROUND, q[1]), tb, ta, walls)
        mesh.beam(ta, tb, 0.13, EDGE)
    # Doors use two real OSM entrance nodes per house, snapped to each
    # retained wall. Width and jamb depths are display estimates.
    for _, dx, dz in obs["entrances"]:
      hit = nearest_points(outline.boundary, Point(dx, dz))[0]
      if hit.distance(Point(dx, dz)) > 2.1:
        continue
      edges = list(zip(outline.exterior.coords, list(outline.exterior.coords)[1:]))
      from shapely.geometry import LineString

      a, b = min(edges, key=lambda e: LineString(e).distance(hit))
      t = np.asarray(b) - a
      t = t / np.linalg.norm(t)
      normal = np.array([-t[1], t[0]])
      center = np.array(hit.coords[0])
      if outline.covers(Point(*(center + normal * 0.16))):
        normal = -normal
      center = center + normal * 0.13
      p, q = center - 1.04 * t, center + 1.04 * t
      mesh.quad(
        (p[0], GROUND, p[1]),
        (q[0], GROUND, q[1]),
        (q[0], GROUND + 2.48, q[1]),
        (p[0], GROUND + 2.48, p[1]),
        (84, 99, 99),
      )
      for v in (p, q):
        mesh.beam((v[0], GROUND, v[1]), (v[0], GROUND + 2.52, v[1]), 0.14, EDGE)
    start = len(mesh.indices)
    remaining = outline

    def panel(poly, col):
      for tri in triangles(poly):
        mesh.tri(*(top(*v) for v in tri), col)

    for kind, angle, period, zone in zones:
      zone = zone.intersection(remaining)
      if zone.is_empty:
        continue
      remaining = remaining.difference(zone)
      if kind not in ("membrane", "barrel", "skylight"):
        panel(zone, base_color(kind, 0))
        continue
      flat = rotate(zone, -angle, origin=(0, 0), use_radians=True)
      xmin, zmin, xmax, zmax = flat.bounds
      width = period / 4
      for k in range(math.floor(zmin / width), math.ceil(zmax / width)):
        for col in range(math.floor(xmin / 9), math.ceil(xmax / 9)):
          patch = flat.intersection(
            box(col * 9, k * width, (col + 1) * 9, (k + 1) * width)
          )
          if patch.area > 0.004:
            panel(
              rotate(patch, angle, origin=(0, 0), use_radians=True),
              base_color(kind, k % 4),
            )
    for x, z in grids(remaining, 4):
      panel(remaining.intersection(box(x, z, x + 4, z + 4)), base_color("", 0))
    return start
  tops = {
    (x, z): (height(x + 1, z + 1), color_at(x + 1, z + 1))
    for x, z in grids(outline, 2)
    if outline.covers(Point(x + 1, z + 1))
  }
  for (x, z), (h, _) in tops.items():
    for (dx, dz), a, b in [
      ((-2, 0), (x, z), (x, z + 2)),
      ((2, 0), (x + 2, z + 2), (x + 2, z)),
      ((0, -2), (x + 2, z), (x, z)),
      ((0, 2), (x, z + 2), (x + 2, z + 2)),
    ]:
      low = tops.get((x + dx, z + dz), (GROUND, None))[0]
      if h > low:
        mesh.quad(
          (a[0], low, a[1]),
          (b[0], low, b[1]),
          (b[0], h, b[1]),
          (a[0], h, a[1]),
          walls if low == GROUND else EDGE,
        )
  for _, dx, dz in obs["entrances"]:
    hit = nearest_points(outline.boundary, Point(dx, dz))[0]
    if hit.distance(Point(dx, dz)) > 2.9:
      continue
    edge = min(
      zip(outline.exterior.coords, list(outline.exterior.coords)[1:]),
      key=lambda e: Point(*((np.array(e[0]) + e[1]) / 2)).distance(hit),
    )
    tangent = np.asarray(edge[1]) - edge[0]
    along_x = abs(tangent[0]) > abs(tangent[1])
    normal = np.array([0, 1]) if along_x else np.array([1, 0])
    c = np.array(hit.coords[0])
    if outline.covers(Point(*(c + normal * 0.22))):
      normal = -normal
    c += normal * 0.18
    mesh.box(
      c[0],
      GROUND + 1.24,
      c[1],
      2.08 if along_x else 0.20,
      2.48,
      0.20 if along_x else 2.08,
      (84, 99, 99),
    )
  start = len(mesh.indices)
  for (x, z), (h, col) in tops.items():
    mesh.quad((x, h, z), (x + 2, h, z), (x + 2, h, z + 2), (x, h, z + 2), col)
  return start


def aviary(mesh, feature, poly, high, native):
  rim = poly.exterior
  n = max(6, math.ceil(rim.length / 3.4))
  pts = [
    np.asarray(rim.interpolate(i / n, normalized=True).coords[0]) for i in range(n)
  ]
  center = np.asarray(poly.representative_point().coords[0])
  lower = GROUND + (high - GROUND) * 0.58

  def pos(p, y):
    return (p[0], y, p[1])

  def rod(p, q, w, col):
    mesh.beam(p, q, w, col, native=native)

  for i, p in enumerate(pts):
    q = pts[(i + 1) % n]
    rod(pos(p, GROUND), pos(p, lower), 0.14 if i % 2 == 0 else 0.07, STEEL)
    for y in [GROUND + 0.55, lower]:
      rod(pos(p, y), pos(q, y), 0.075, STEEL)
    # Open mesh and curved roof-tension lines for mapped wire domes.
    shoulder = p * 0.58 + center * 0.42
    shoulder2 = q * 0.58 + center * 0.42
    y = lower + (high - lower) * 0.76
    rod(pos(p, lower), pos(shoulder, y), 0.08, EDGE)
    rod(pos(shoulder, y), pos(center, high), 0.075, EDGE)
    rod(pos(shoulder, y), pos(shoulder2, y), 0.07, STEEL)
  start = len(mesh.indices)
  mesh.box(*pos(center, high), 0.32, 0.13, 0.32, EDGE)
  return start


def pavilion(mesh, feature, poly, native):
  sid = feature["id"]
  if sid in {"way/121769085", "way/123268854"}:
    # Both mapped footprints are quadrilaterals with a tagged hipped roof.
    # The pelican keeper house has enclosing walls; the stage has an open front.
    ring = np.asarray(poly.minimum_rotated_rectangle.exterior.coords)[:4]
    if np.linalg.norm(ring[1] - ring[0]) < np.linalg.norm(ring[2] - ring[1]):
      ring = np.roll(ring, 1, axis=0)
    middle = (ring[0] + ring[3]) / 2
    far = (ring[1] + ring[2]) / 2
    axis = (far - middle) / np.linalg.norm(far - middle)
    inset = min(
      np.linalg.norm(ring[0] - ring[3]) * 0.45, np.linalg.norm(far - middle) * 0.36
    )
    eave = GROUND + (2.65 if sid == "way/121769085" else 3.1)
    rise = inset * 0.52
    ridge = [middle + axis * inset, far - axis * inset]

    def v(p, h):
      return (p[0], h, p[1])

    if sid == "way/121769085":
      for i, p in enumerate(ring):
        q = ring[(i + 1) % 4]
        mesh.quad(v(p, GROUND), v(q, GROUND), v(q, eave), v(p, eave), (153, 141, 118))
    else:
      for p in ring:
        mesh.beam(v(p, GROUND), v(p, eave), 0.25, WOOD, native=native)
    start = len(mesh.indices)
    col = (109, 112, 99)
    if native:
      for x, z in grids(poly, 1):
        q = Point(x + 0.5, z + 0.5)
        if not poly.covers(q):
          continue
        h = eave + round(min(inset, poly.boundary.distance(q)) * 0.52 * 2) / 2
        mesh.box(x + 0.5, h - 0.18, z + 0.5, 1, 0.36, 1, col)
    else:
      lo = [v(q, eave) for q in ring]
      a, b = [v(q, eave + rise) for q in ridge]
      mesh.quad(lo[0], lo[1], b, a, col)
      mesh.quad(lo[2], lo[3], a, b, col)
      mesh.tri(lo[0], a, lo[3], (102, 105, 94))
      mesh.tri(lo[1], lo[2], b, (102, 105, 94))
    return start
  if sid == "way/1178311018":
    # The mapped neck between the two documented shingled viewing roofs is
    # at z≈1993 m in scene coordinates. Reuse both surveyed lobe outlines.
    starts = []
    for region in [box(10960, 1980, 10980, 1993.4), box(10960, 1993.4, 10980, 2005)]:
      piece = poly.intersection(region)
      if isinstance(piece, Polygon) and piece.area > 8:
        starts.append(pavilion(mesh, {**feature, "id": "platform-lobe"}, piece, native))
    return min(starts)
  ring = poly.exterior
  center = np.asarray(poly.centroid.coords[0])
  high = 11.1 if sid == "platform-lobe" else 8.8
  base = 7.04 if sid == "platform-lobe" else GROUND
  lower = base + (2.05 if sid == "platform-lobe" else 1.65)
  coords = [
    np.array(ring.interpolate(i / 24, normalized=True).coords[0]) for i in range(24)
  ]

  def pt(v, h):
    return (v[0], h, v[1])

  for i, a in enumerate(coords):
    b = coords[(i + 1) % len(coords)]
    if sid == "way/192487133":
      mesh.quad(pt(a, base), pt(b, base), pt(b, lower), pt(a, lower), (169, 162, 143))
    if i % 3 == 0:
      mesh.beam(
        pt(a, base),
        pt(a, lower),
        0.19,
        WOOD if sid != "way/192487133" else STEEL,
        native=native,
      )
  start = len(mesh.indices)
  if native:
    src = poly.exterior
    for x, z in grids(poly, 1):
      v = Point(x + 0.5, z + 0.5)
      if not poly.covers(v):
        continue
      hr = lower + (high - lower) * min(
        1, v.distance(src) / max(0.5, poly.centroid.distance(src))
      )
      hr = round(hr * 2) / 2
      col = GLASS if sid == "way/192487133" else WOOD
      mesh.box(x + 0.5, hr - 0.17, z + 0.5, 1, 0.34, 1, col)
  else:
    for i, a in enumerate(coords):
      b = coords[(i + 1) % len(coords)]
      color = GLASS if sid == "way/192487133" else WOOD
      for j in range(4):
        s = j / 4
        t = (j + 1) / 4
        c = a * (1 - s) + center * s
        d = b * (1 - s) + center * s
        e = b * (1 - t) + center * t
        f = a * (1 - t) + center * t

        def hh(v):
          return lower + (high - lower) * (
            math.sin(v * math.pi / 2) if sid == "way/192487133" else v
          )

        mesh.quad(
          pt(c, hh(s)),
          pt(d, hh(s)),
          pt(e, hh(t)),
          pt(f, hh(t)),
          tuple(k + (i % 3) * 3 for k in color),
        )
        if i % 2 == 0:
          mesh.beam(pt(c, hh(s) + 0.04), pt(f, hh(t) + 0.04), 0.08, STEEL)
  return start


def tile_of(x, z):
  return f"outer187-{math.floor(x / 512)}_{math.floor(z / 512)}"


def generate():
  source = json.load(gzip.open(SOURCE))
  output = {}
  report = {}
  claimed = defaultdict(set)
  shell_counts = defaultdict(int)
  features = sorted(
    source["features"],
    key=lambda r: (
      "roofSurvey" not in r,
      r["id"] not in {"way/1178311018", "way/192487133"},
      -shape(r["geometry"]).area,
      r["id"],
    ),
  )
  for feature in features:
    geom = shape(feature["geometry"])
    if geom.geom_type != "MultiPolygon":
      continue
    poly = geom.geoms[0]
    owner = feature.get("owner", feature["id"].replace("way/", "OSM-way-"))
    tiles = {tile_of(x, z) for x, z in poly.exterior.coords}
    if len(tiles) != 1:
      continue
    tile = tiles.pop()
    # The base and earlier companions share the sixteen-part decoder budget.
    if shell_counts[tile] >= 10:
      continue
    plans = {}
    for family in ["drawn", "minecraft"]:
      try:
        receipt, stats = select_tile(tile, owner, family)
        shapes = [p for b, p, _, _ in bodies(tile, family)[0] if entity(b) == owner]
        if len(shapes) != 1:
          break
        mesh = Mesh(tile)
        outline = shapes[0]
        if not isinstance(outline, Polygon):
          break
        if "roofSurvey" in feature:
          start = make_roof(mesh, feature, outline, family == "minecraft")
        elif feature["tags"].get("roof:material") == "wire_fence":
          top = next(
            hi for b, _, _, hi in bodies(tile, family)[0] if entity(b) == owner
          )
          start = aviary(mesh, feature, poly, top, family == "minecraft")
        elif feature["id"] in (
          "way/192487133",
          "way/1178311018",
          "way/121769085",
          "way/123268854",
        ):
          start = pavilion(mesh, feature, poly, family == "minecraft")
        else:
          break
        packed = mesh.payload("surveyed-building-shells-v377")
        plans[family] = (
          receipt,
          dict(id=owner, parentId=owner, roofIndexStart=start, mesh=packed),
          dict(stats),
        )
      except (ValueError, KeyError) as e:
        print("Retained source", owner, family, str(e)[:170], flush=True)
        break
    if len(plans) != 2:
      continue
    for family, (receipt, shell, stats) in plans.items():
      key = (tile, family)
      dest = output.setdefault(
        key,
        {
          "shells": {"tiles": {tile: []}},
          "retirements": {
            "packets": {
              tile: {
                **receipt,
                "owners": [],
                "records": [],
                "segments": [],
                "lineFingerprint": None,
              }
            }
          },
        },
      )
      r = dest["retirements"]["packets"][tile]
      for cut in receipt["records"]:
        used = claimed[key, cut["mesh"]]
        if used.intersection(cut["triangles"]):
          raise ValueError("Two cages own the same mesh face")
        used.update(cut["triangles"])
        prev = next((p for p in r["records"] if p["mesh"] == cut["mesh"]), None)
        if prev:
          assert prev["fingerprint"] == cut["fingerprint"]
          prev["triangles"] = sorted(prev["triangles"] + cut["triangles"])
        else:
          r["records"].append(cut.copy())
      if receipt["segments"]:
        assert not set(r["segments"]).intersection(receipt["segments"])
        assert r["lineFingerprint"] in (None, receipt["lineFingerprint"])
        r["lineFingerprint"] = receipt["lineFingerprint"]
        r["segments"] = sorted(r["segments"] + receipt["segments"])
      r["owners"].append(owner)
      dest["shells"]["tiles"][tile].append(shell)
      report.setdefault(
        owner, {"name": feature["name"], "osm": feature["id"], "tile": tile}
      )[family] = stats
    shell_counts[tile] += 1
  OUT.mkdir(parents=True, exist_ok=True)
  for (tile, family), value in output.items():
    write(OUT / f"{family}_{tile}.json", value)
  write(DATA / "tierparkEastV379ShellIndex.json", sorted(shell_counts))
  write(GEO / "tierpark-east-v379-owners.json", report)
  print(
    "Fully matched houses and aviaries", len(report), dict(shell_counts), flush=True
  )


if __name__ == "__main__":
  generate()
