"""Build the fitted Invalidenpark planting and paving from local source records."""

import base64
import json
import math
import struct
from pathlib import Path

from shapely import constrained_delaunay_triangles, get_parts, union_all
from shapely.geometry import Point, Polygon, box

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/invalidenpark-v371-survey.json"
WATER = ROOT / "src/app/public/mesh/regierungsviertel/surface-polygons.json"
OUTPUT = ROOT / "src/app/src/data/invalidenParkGroundV371.json"
ORIGIN = (230, -1310)
DRAPE_CELL = 12


def footprint(record):
  return Polygon([(x / 10, z / 10) for x, z in record["ring"]])


def garden():
  survey = json.loads(SOURCE.read_bytes())
  water = json.loads(WATER.read_bytes())
  wall = next(row for row in water["sunken_walls"] if row["name"] == "Sinkende Mauer")
  basins = [
    footprint(row)
    for row in water["water"]
    if row["kind"] == "basin" and footprint(row).covers(Point(363, -1155))
  ]
  assert len(basins) == 1
  basin = basins[0].union(footprint(wall))
  assert basin.geom_type == "Polygon" and basin.area < 2500
  boundary = Polygon(survey["boundary"])
  available = boundary.difference(basin)
  bands = union_all([Polygon(band) for band in survey["graniteBands"]])
  # The stone bands stop at the inside edge of the continuous perimeter walks.
  treatments = [
    (
      "gravel",
      union_all([Polygon(survey[k]) for k in ("westWalk", "eastWalk", "southWalk")]),
    ),
    (
      "coping",
      union_all([Polygon(survey[k]) for k in ("basinSurround", "wallApproach")]),
    ),
    ("granite", bands.union(Polygon(survey["southernApron"]))),
    ("underplanting", Polygon(survey["woodedBed"])),
  ]
  pieces = {}
  for material, shape in treatments:
    pieces[material] = available.intersection(shape)
    available = available.difference(shape)
  pieces["lawn"] = available
  return boundary, basin, pieces


def packed_shorts(values, signed=False):
  raw = struct.pack(f"<{len(values)}{'h' if signed else 'H'}", *values)
  return base64.b64encode(raw).decode("ascii")


def compile_ground():
  boundary, _, pieces = garden()
  low_x, low_z, high_x, high_z = boundary.bounds
  vertices = {}
  coords = []
  indices = []
  groups = []
  for material, shape in pieces.items():
    start = len(indices)
    for x in range(
      math.floor(low_x / DRAPE_CELL) * DRAPE_CELL, math.ceil(high_x), DRAPE_CELL
    ):
      for z in range(
        math.floor(low_z / DRAPE_CELL) * DRAPE_CELL, math.ceil(high_z), DRAPE_CELL
      ):
        patch = shape.intersection(box(x, z, x + DRAPE_CELL, z + DRAPE_CELL))
        for tri in get_parts(constrained_delaunay_triangles(patch)):
          a, b, c = [
            (round((px - ORIGIN[0]) * 100), round((pz - ORIGIN[1]) * 100))
            for px, pz in list(tri.exterior.coords)[:3]
          ]
          cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
          if cross == 0:
            continue
          for point in (a, b, c) if cross < 0 else (a, c, b):
            key = (material, point)
            if key not in vertices:
              vertices[key] = len(vertices)
              coords.extend(point)
            indices.append(vertices[key])
    groups.append(
      {"material": material, "endIndex": len(indices), "endVertex": len(vertices)}
    )
    assert len(indices) > start
  return {
    "origin": ORIGIN,
    "groups": groups,
    "xzCm": packed_shorts(coords, signed=True),
    "indices": packed_shorts(indices),
  }


if __name__ == "__main__":
  OUTPUT.write_text(json.dumps(compile_ground(), separators=(",", ":")) + "\n")
