"""Extract central Berlin bank faces from the actual drawn and block-mode shorelines.

The bounded control points mark the visible changes described in
docs/berliner-ufer-zentrum-v370.md. They select a bank; they do not replace it.
"""

import json
import math
import subprocess
import tempfile
from pathlib import Path

from shapely import union_all
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import substring

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app"
OUTPUT = APP / "src/data/waterwayBanksV370Central.json"

# Source surface, endpoints (world X,Z metres), facial finish, local source key.
# Gaps retain bridge abutments, stair landings and the separately modelled north bank.
# fmt: off
REACHES = [
    ("humboldthafen-west-hafenhals", 12, (33,-535), (-11,-706), "steel", "humboldthafen", "hh-plan"),
    ("humboldthafen-ost-hafenhals", 12, (92,-538), (146,-715), "stone", "humboldthafen", "hh-ost"),
    ("kanal-golda-spundwand-sued", 10, (-118,-1525), (-147.29,-1577.92), "steel", "bsk", "kanal-stahl"),
    ("kanal-golda-vertical-wetlands", 10, (-147.29,-1577.92), (-169.36,-1610.98), "steel", "bsk", "igb"),
    ("kanal-golda-spundwand-nord", 10, (-169.36,-1610.98), (-186,-1635), "steel", "bsk", "kanal-stahl"),
    ("kanal-kornspeicher-boeschung", 10, (-270,-1772), (-294,-1810), "natural", "bsk", "korn"),
    ("kanal-kornspeicher-stein", 10, (-302,-1824), (-318,-1849), "stone", "bsk", "korn"),
    ("spree-helgolaender-ufer", 0, (-1538,-354), (-1427,-204), "stone", "spree", "helg"),
    ("landwehr-luetzowufer-west", 3, (-1578,1292), (-1411,1410), "stone", "landwehr", "lwk"),
    ("landwehr-luetzowufer-mitte", 4, (-1280,1446), (-1045,1360), "stone", "landwehr", "lwk"),
    ("landwehr-luetzowufer-ost", 4, (-967,1350), (-787,1428), "stone", "landwehr", "lwk"),
    ("landwehr-schoeneberger-ufer-west", 4, (-770,1437), (-662,1466), "stone", "landwehr", "lwk"),
    ("landwehr-schoeneberger-ufer-mitte", 4, (-623,1468), (-294,1434), "stone", "landwehr", "lwk"),
    ("landwehr-schoeneberger-ufer-marshall-west", 4, (-218,1447), (-48,1536), "stone", "landwehr", "lwk"),
    ("landwehr-schoeneberger-ufer-marshall-ost", 4, (18,1588), (141,1774), "stone", "landwehr", "lwk"),
]
# fmt: on


WATERS = {
  "bsk": "Berlin-Spandauer Schifffahrtskanal",
  "humboldthafen": "Humboldthafen",
  "landwehr": "Landwehrkanal",
  "spree": "Spree",
}


def shortest_arc(ring, start, end):
  """Take the shorter path around a closed ring; reversing preserves endpoints."""
  line = LineString(ring)
  a, b = (line.project(Point(p)) for p in (start, end))
  low, high = sorted((a, b))
  if high - low <= line.length / 2:
    return substring(line, a, b)
  after = list(substring(line, high, line.length).coords)
  before = list(substring(line, 0, low).coords)
  wrapped = after + before[1:]
  return LineString(wrapped if a == high else wrapped[::-1])


def water_side(line, polygon):
  """A positive sign denotes the [-dz,+dx] water-facing normal."""
  votes = []
  for a, b in zip(line.coords, list(line.coords)[1:]):
    dx, dz = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dz)
    if length < 0.02:
      continue
    mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    inside = polygon.covers(Point(mx - 0.06 * dz / length, mz + 0.06 * dx / length))
    votes.append(1 if inside else -1)
  if not votes or min(votes) != max(votes):
    raise ValueError("inconsistent water side")
  return votes[0]


def native_boundary(ground, line):
  """Window the restored water runs, then follow their real exposed cell faces."""
  cell = ground["cell_m"]
  min_x, min_z = (ground["grid"][k] for k in ("min_x_idx", "min_z_idx"))
  lowx, lowz, highx, highz = line.buffer(cell * 6).bounds
  row0, row1 = math.floor(lowz / cell) - min_z, math.ceil(highz / cell) - min_z
  col0, col1 = math.floor(lowx / cell) - min_x, math.ceil(highx / cell) - min_x
  water_id = ground["classes"].index("water")
  boxes = []
  for row in range(row0, row1):
    for x, count, cls in ground["ground_rows"][row]:
      left, right = max(col0, x), min(col1, x + count)
      if cls == water_id and left < right:
        boxes.append(
          box(
            (min_x + left) * cell,
            (min_z + row) * cell,
            (min_x + right) * cell,
            (min_z + row + 1) * cell,
          )
        )
  shore = union_all(boxes)
  polys = [shore] if shore.geom_type == "Polygon" else list(shore.geoms)
  start, end = line.coords[0], line.coords[-1]
  candidates = []
  for poly in polys:
    for ring in [poly.exterior, *poly.interiors]:
      if max(ring.distance(Point(p)) for p in (start, end)) > 6:
        continue
      arc = shortest_arc(ring, start, end)
      candidates.append((arc.hausdorff_distance(line), arc, poly))
  if not candidates:
    raise ValueError("no continuous native shoreline")
  err, arc, poly = min(candidates, key=lambda c: c[0])
  if err > 6:
    raise ValueError(f"native shore too far away ({err:.1f} m)")
  return arc, water_side(arc, poly)


def rounded(points):
  return [[round(x, 2), round(z, 2)] for x, z in points]


def grade_at(ground, x, z):
  grid, terrain = ground["grid"], ground["ground_height"]
  heights = terrain["y_dm"]
  cols = terrain["cols"]
  x = (x / ground["cell_m"] - grid["min_x_idx"]) / terrain["stride_cells"] - 0.5
  z = (z / ground["cell_m"] - grid["min_z_idx"]) / terrain["stride_cells"] - 0.5
  i, j = math.floor(x), math.floor(z)
  dx, dz = x - i, z - j
  return (
    (heights[j * cols + i] * (1 - dx) + heights[j * cols + i + 1] * dx) * (1 - dz)
    + (heights[(j + 1) * cols + i] * (1 - dx) + heights[(j + 1) * cols + i + 1] * dx)
    * dz
  ) / 10


def drawn_crown(ground, line, side):
  water = ground["water_top_y_m"]
  heights = []
  coords = list(line.coords)
  for i, (x, z) in enumerate(coords):
    a, b = coords[max(i - 1, 0)], coords[min(i + 1, len(coords) - 1)]
    dx, dz = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dz)
    grade = grade_at(ground, x + side * dz / length * 1.2, z - side * dx / length * 1.2)
    heights.append(round(max(water + 4.55, grade) + 0.12, 2))
  return heights


def native_crown(g, line, side):
  """Each land-side block's top is sampled at the unbroken run centre."""
  cell, grid, h = g["cell_m"], g["grid"], g["ground_height"]
  grades = []
  coords = list(line.coords)
  for a, b in zip(coords, coords[1:]):
    dx, dz = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dz)
    x, z = (
      (a[0] + b[0]) / 2 + side * dz / length * 0.3,
      (a[1] + b[1]) / 2 - side * dx / length * 0.3,
    )
    col, row = (
      math.floor(x / cell) - grid["min_x_idx"],
      math.floor(z / cell) - grid["min_z_idx"],
    )
    start, n, cls = next(
      (s, n, c) for s, n, c in g["ground_rows"][row] if s <= col < s + n
    )
    assert g["classes"][cls] != "water"
    j, i = row // h["stride_cells"], int((start + n / 2) // h["stride_cells"])
    grades.append(h["y_dm"][j * h["cols"] + i] / 10)
  return [
    grades[0],
    *[round(min(a, b), 2) for a, b in zip(grades, grades[1:])],
    grades[-1],
  ]


def build():
  with tempfile.TemporaryDirectory() as temp:
    work = Path(temp)
    subprocess.run(
      ["bun", "scripts/prepare-water-boundary-source.ts", str(work / "smooth.json")],
      cwd=APP,
      check=True,
    )
    expr = (
      'import {restoreHumboldthafenWaterV369 as restore} from "./src/HumboldthafenRailV369";'
      'const grid=await Bun.file("public/mesh/regierungsviertel/minecraft-voxels.json").json();'
      "await Bun.write(process.argv[1],JSON.stringify(restore(grid)));"
    )
    subprocess.run(["bun", "-e", expr, str(work / "ground.json")], cwd=APP, check=True)
    surfaces = json.loads((work / "smooth.json").read_text())["water"]
    g = json.loads((work / "ground.json").read_text())
  records = []
  for name, idx, start, end, material, water, source in REACHES:
    poly = Polygon(surfaces[idx]["ring"])
    if max(poly.boundary.distance(Point(p)) for p in (start, end)) > 4:
      raise ValueError(f"Bank endpoints no longer match surface {idx} for {name}")
    line = shortest_arc(poly.exterior, start, end)
    side = water_side(line, poly)
    native, nside = native_boundary(g, line)
    # Preserve smooth spline vertices and interpolate long straight faces for
    # bilinear grade changes. The block chain retains exactly orthogonal edges.
    line = line.simplify(0.015).segmentize(12)
    rec = dict(
      id=name,
      host="core",
      water=WATERS[water],
      material=material,
      source=source,
      points=rounded(line.coords),
      waterSide=side,
      waterY=g["water_top_y_m"],
      topY=drawn_crown(g, line, side),
      nativePoints=rounded(native.coords),
      nativeWaterSide=nside,
      nativeTopY=native_crown(g, native, nside),
    )
    if source in ("korn", "helg", "lwk") and material == "stone":
      rec.update(profile="paved-slope", width=0.85 if source == "helg" else 1.1)
    if source == "igb":
      rec["reed"] = True
    if material == "natural":
      rec["width"] = 3.2
    records.append(rec)
  return dict(records=records)


if __name__ == "__main__":
  OUTPUT.write_text(
    json.dumps(build(), ensure_ascii=False, separators=(",", ":")) + "\n"
  )
