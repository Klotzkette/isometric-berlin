"""Bounded open Museum Island colonnades; immutable source polygons stay auditable."""

from __future__ import annotations

import copy
import hashlib
import json
import math
from pathlib import Path

from build_breitscheid_towers_v161 import triangles_for
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/colonnades-v231-source.json"
DATA = ROOT / "src/app/src/data"
STONE = 0xB6AA94
PALE = 0xC8BEAB
RECESS = 0x958B79
FLOOR = 5.22
# Endpoints are midpoint fits between the retained opposing source edges.
# Spacing and member sections are display estimates, never survey claims.
PATHS = [
  ("bodestrasse", [[1803.429, -48.867], [1922.808, -127.839]], 2.0),
  ("spree", [[1921.057, -130.986], [1854.443, -217.139]], 2.0),
  ("neues-museum", [[1835.695, -74.178], [1772.361, -156.900]], 1.8),
  (
    "museum-return",
    [[1738.45, -131.77], [1755.8, -145.0], [1761.0, -151.9], [1788.496, -172.188]],
    1.45,
  ),
  ("north-link", [[1851.96, -218.8], [1838.121, -213.783]], 1.7),
  (
    "north-curve",
    [
      [1838.121, -213.783],
      [1827.0, -229.088],
      [1823.964, -232.224],
      [1820.674, -234.997],
      [1817.194, -237.348],
      [1813.492, -239.205],
      [1809.634, -240.624],
      [1805.657, -241.58],
      [1801.6, -242.1],
      [1797.52, -242.1],
    ],
    1.75,
  ),
]


def write(path: Path, data: dict) -> None:
  """Compact deterministic runtime/source record."""
  path.write_text(json.dumps(data, separators=(",", ":")) + "\n")


def rounded(value: object) -> object:
  """Bound derived member precision; original source vertices are already mm."""
  if isinstance(value, float):
    return round(value, 5)
  if isinstance(value, (list, tuple)):
    return [rounded(v) for v in value]
  if isinstance(value, dict):
    return {k: rounded(v) for k, v in value.items()}
  return value


def polygon_parts(shape: object) -> list:
  """Iterate a finite difference, retaining holes and disconnected pieces."""
  if shape.is_empty:
    return []
  return [shape] if shape.geom_type == "Polygon" else list(shape.geoms)


def planar(shape: Polygon, y: float) -> list:
  """Triangulate the entire original horizontal polygon without edge reduction."""
  rings = [list(shape.exterior.coords)[:-1]] + [
    list(r.coords)[:-1] for r in shape.interiors
  ]
  return triangles_for([[[x, y, z] for x, z in r] for r in rings])


def clip_high(ring: list, floor: float) -> list:
  """Retain the exact upper wall plane above the open gallery soffit."""
  out = []
  for a, b in zip(ring, ring[1:] + ring[:1]):
    ia, ib = a[1] >= floor, b[1] >= floor
    if ia:
      out.append(a)
    if ia != ib:
      t = (floor - a[1]) / (b[1] - a[1])
      out.append([a[i] + (b[i] - a[i]) * t for i in range(3)])
  return out


def build() -> tuple[dict, dict]:
  """Replay source-bound roofs, open shafts, coffer members and native blocks."""
  source = json.loads(SOURCE.read_text())
  parents = copy.deepcopy(source["parents"])
  # A single rigid translation preserves relative source heights at the seam.
  shift = 5.2 - parents[0]["ground_y_m"]
  for p in parents:
    for surface in p["surfaces"]:
      for ring in surface["rings"]:
        for point in ring:
          point[1] += shift
  shapes = [Polygon(p["ring"], p["holes"]) for p in parents]
  original = unary_union(shapes)
  osm = unary_union([Polygon(w["ring"]) for w in source["osm"]["ways"]])
  footprint = unary_union([original, osm]).buffer(0)
  roofs, floors, boxes, columns, native, domes = [], [], [], [], [], []
  nav_roofs, nav_columns = [], []
  top_main = parents[0]["top_y_m"] + shift
  top_north = parents[1]["top_y_m"] + shift

  def addbox(c: list, size: list, yaw: float, color: int) -> None:
    boxes.append([*c, *size, yaw, color])
    # Independent axis-aligned short members, never rotated voxel boxes.
    length, height, depth = size
    n = max(1, math.ceil(length / 0.8))
    tx, tz = math.cos(yaw), -math.sin(yaw)
    w = abs(tx) * length / n + abs(tz) * depth
    d = abs(tz) * length / n + abs(tx) * depth
    for i in range(n):
      u = length * ((i + 0.5) / n - 0.5)
      native.append([c[0] + tx * u, c[1], c[2] + tz * u, w, height, d, color])

  def band(a: tuple, b: tuple, y: float, height: float, width: float, color: int):
    length = math.dist(a, b)
    if length < 0.015:
      return
    yaw = -math.atan2(b[1] - a[1], b[0] - a[0])
    addbox(
      [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2], [length, height, width], yaw, color
    )

  def raster(shape: Polygon, top: float, thickness: float, color: int):
    # Exactly bounded row runs, surface-only. No hidden whole-height solid fill.
    step = 0.8
    x0, z0, x1, z1 = shape.bounds
    for iz in range(math.floor(z0 / step), math.ceil(z1 / step)):
      active = []
      for ix in range(math.floor(x0 / step), math.ceil(x1 / step)):
        if shape.covers(Point((ix + 0.5) * step, (iz + 0.5) * step)):
          active.append(ix)
      if not active:
        continue
      start = last = active[0]
      for ix in active[1:] + [active[-1] + 2]:
        if ix != last + 1:
          native.append(
            [
              (start + last + 1) * step / 2,
              top - thickness / 2,
              (iz + 0.5) * step,
              (last - start + 1) * step,
              thickness,
              step,
              color,
            ]
          )
          start = ix
        last = ix

  for i, p in enumerate(parents):
    top = top_main if i == 0 else top_north
    for s in p["surfaces"]:
      if s["kind"] == "RoofSurface":
        triangles = triangles_for(s["rings"])
        roofs.append(
          {
            "color": 0x8B8A81,
            "triangles": triangles,
            "sourceOwner": p["id"],
            "role": "complete-source-roof",
          }
        )
        nav_roofs.extend(triangles)
      else:
        rings = [clip_high(r, top - 0.66) for r in s["rings"]]
        rings = [r for r in rings if len(r) >= 3]
        if rings:
          roofs.append(
            {
              "color": STONE,
              "triangles": triangles_for(rings),
              "sourceOwner": p["id"],
              "role": "retained-upper-source-wall",
            }
          )
    raster(shapes[i], top, 0.66, STONE)
  # OSM maps the additional west connection and small source-outline differences.
  # Keep the complete old footprint as a roof, without rebuilding its false walls.
  complements = polygon_parts(osm.difference(original))
  for p in complements:
    ts = planar(p, top_main)
    roofs.append(
      {
        "color": 0x8B8A81,
        "triangles": ts,
        "sourceOwner": "osm-complement",
        "role": "retained-osm-roof-complement",
      }
    )
    nav_roofs.extend(ts)
    raster(p, top_main, 0.66, STONE)
  for p in polygon_parts(footprint):
    floors.extend(planar(p, FLOOR))
    raster(p, FLOOR, 0.20, 0xBFB6A4)
  # Three documented domed pavilion positions: both ends and midpoint of Spree arm.
  pavilion_centres = [[1922.0, -127.6], [1887.3, -174.7], [1851.7, -218.9]]
  seen = []
  samples = []
  for key, points, halfwidth in PATHS:
    path = LineString(points)
    top = top_north if key == "north-curve" else top_main
    bays = max(1, round(path.length / 3.65))
    route_samples = []
    for j in range(bays + 1):
      distance = min(path.length - 0.4, max(0.4, j * path.length / bays))
      pos = path.interpolate(distance)
      pa = path.interpolate(max(0, distance - 0.1))
      pb = path.interpolate(min(path.length, distance + 0.1))
      tx, tz = pb.x - pa.x, pb.y - pa.y
      length = math.hypot(tx, tz)
      tx, tz = tx / length, tz / length
      route_samples.append([pos.x, FLOOR, pos.y])
      yaw = -math.atan2(tz, tx)
      for sign in [-1, 1]:
        x, z = pos.x - tz * halfwidth * sign, pos.y + tx * halfwidth * sign
        if not footprint.covers(Point(x, z)):
          continue
        if any(math.hypot(x - xx, z - zz) < 1.25 for xx, zz in seen):
          continue
        seen.append((x, z))
        tone = [STONE, 0xBCAE95, 0xADA38F, 0xC5BAA4][len(seen) % 4]
        # Plinth, round mouldings, tapered fluted shaft, cushion and square abacus.
        columns.append([x, z, FLOOR, top - 1.05, yaw, tone])
        nav_columns.append([x, z, FLOOR, top - 0.66, 0.53])
        addbox([x, FLOOR + 0.09, z], [1.02, 0.18, 1.02], yaw, tone)
        addbox([x, top - 0.79, z], [1.08, 0.22, 1.08], yaw, PALE)
        for lo, hi, width in [
          (FLOOR + 0.18, FLOOR + 0.48, 0.9),
          (FLOOR + 0.48, top - 1.35, 0.72),
          (top - 1.35, top - 1.05, 0.85),
          (top - 1.05, top - 0.9, 0.98),
        ]:
          native.append([x, (lo + hi) / 2, z, width, hi - lo, width, tone])
      # Two slim longitudinal beams and double coffer divisions leave clear space.
      if j < bays:
        mid = path.interpolate((j + 0.5) * path.length / bays)
        # One coffer per bay: recess plate at the soffit and four shallow borders.
        addbox(
          [mid.x, top - 0.72, mid.y],
          [path.length / bays - 0.22, 0.10, 2 * halfwidth - 0.46],
          yaw,
          RECESS,
        )
        addbox(
          [pos.x, top - 0.83, pos.y], [0.18, 0.18, 2 * halfwidth + 0.15], yaw, PALE
        )
    for a, b in zip(points, points[1:]):
      dx, dz = b[0] - a[0], b[1] - a[1]
      length = math.hypot(dx, dz)
      nx, nz = -dz / length, dx / length
      for side in [-1, 1]:
        aa = (a[0] + nx * halfwidth * side, a[1] + nz * halfwidth * side)
        bb = (b[0] + nx * halfwidth * side, b[1] + nz * halfwidth * side)
        band(aa, bb, top - 0.97, 0.18, 0.23, PALE)
    samples.append({"key": key, "points": route_samples, "path": points})
  # Low rounded caps distinguish the three small pavilions from the museum itself.
  # Their locations follow the retained Spree arm, rise/section remain estimates.
  for x, z in pavilion_centres:
    # Only a roof feature: keep every original roof triangle below it.
    domes.append([x, top_main, z, 2.25, 1.85])
    for j in range(5):
      lo, hi = j * 1.85 / 5, (j + 1) * 1.85 / 5
      radius = 2.25 * math.sqrt(max(0.03, 1 - ((lo + hi) / 3.7) ** 2))
      native.append(
        [
          x,
          top_main + (lo + hi) / 2,
          z,
          radius * 1.72,
          hi - lo,
          radius * 1.72,
          0x797D76,
        ]
      )
  # The north head stays open, with its 2024 through route intact.
  head = [1797.4, -244.0]
  for dx, dz in [(-2.4, -2), (2.4, -2), (-2.4, 2), (2.4, 2)]:
    x, z = head[0] + dx, head[1] + dz
    if footprint.covers(Point(x, z)) and not any(
      math.hypot(x - xx, z - zz) < 1.25 for xx, zz in seen
    ):
      columns.append([x, z, FLOOR, top_north - 1.05, 0, PALE])
      nav_columns.append([x, z, FLOOR, top_north - 0.66, 0.53])
      native.append(
        [x, (FLOOR + top_north - 0.66) / 2, z, 0.9, top_north - 0.66 - FLOOR, 0.9, PALE]
      )
  site = dict(
    key="kolonnadenhof",
    name="Museumsinsel historic open colonnades",
    roofs=roofs,
    floorTriangles=floors,
    boxes=boxes,
    columns=columns,
    domes=domes,
    nativeRows=native,
    bounds=list(footprint.bounds),
  )
  nav = dict(
    bounds=list(footprint.bounds),
    floor=FLOOR,
    rings=[
      dict(
        ring=list(p.exterior.coords)[:-1],
        holes=[list(r.coords)[:-1] for r in p.interiors],
      )
      for p in polygon_parts(footprint)
    ],
    roofTriangles=nav_roofs,
    columns=nav_columns,
    passageSamples=samples,
    canopyThickness=0.66,
    domes=domes,
  )
  evidence = dict(
    sourceSha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    originalSourceSurfaceCount=sum(len(p["surfaces"]) for p in parents),
    originalSourceRoofCount=2,
    sourceToDisplayYOffset=shift,
    unchangedSourceRoofTop=[top_main, top_north],
    exactRetiredCoreOwners=["33885752", "33887411"],
    unaffectedAdjacentCoreOwner="42698898",
    columns=len(columns),
    counts={
      k: len(site[k])
      for k in ["roofs", "floorTriangles", "boxes", "columns", "domes", "nativeRows"]
    },
    estimates="Post spacing, fluting, capital proportions, coffer depth, uniform display floor, dome rise and tones are non-surveyed display fits.",
  )
  return {
    "schema": "colonnades-v231/1",
    "sites": [rounded(site)],
    "evidence": evidence,
  }, rounded(nav)


def main() -> None:
  """Write reproducible bounded render/navigation records only."""
  data, nav = build()
  write(DATA / "colonnadesV231.json", data)
  write(DATA / "colonnadesV231Navigation.json", nav)
  write(
    ROOT / "geo_data/regierungsviertel/colonnades-v231-evidence.json", data["evidence"]
  )
  print(data["evidence"])


if __name__ == "__main__":
  main()
