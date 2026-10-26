"""Replay the finite Berlin Decks v277 contract from its retained offline inputs.

Run without arguments to check the committed contract; ``--output FILE`` writes
a rebuilt copy. No cache, original raster archive, live service or photographs
are needed. Every input field is retained unchanged, including the complete OSM
selection, original prisms, 67 WMS samples and the 1 m bDOM subset.

The Berlin bDOM records are official surface-height measurements acquired in
summer 2025, not measured LoD2 walls or roof polygons. The plane levels below
are interpreted representative heights: roof vegetation, equipment and edges
also occur in the raster. Building 1's internal steps are inferred, axis-aligned
boundaries. Building 2 uses two mapped OSM building:part rings; its two broad
remaining pieces inherit estimated levels by side of the building. Its two
narrow low roof strips instead use the median of the dominant 0.2 m height band
among their own raster points, excluding the outer 1 m to avoid facade-edge
mixing. That corrects their initially inherited 53.8 m NHN level to 45.4/45.3 m
NHN. These representative display planes are not a claim of millimetre accuracy.
Facade storey counts are display estimates too.
Original-only contour remnants keep their original 9 m cap, not a new survey.

Derived XZ intersections retain full floating-point precision. Rounding these
coordinates to millimetres produces self-intersections in three main-roof
pieces. No area cutoff, largest-polygon selection or implicit geometry repair
is permitted. The scope is exactly five prior owners: the historic/construction
owner 64895468 and the two external bridges remain evidence only, unchanged.
"""

from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import json
from collections import defaultdict
from pathlib import Path
from statistics import median

from shapely.geometry import Point, Polygon
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/berlin-decks-v277-source.json.gz"
OWNER_OSM = {
  "64895469": "1464895469",
  "64895471": "1464895471",
  "01745260": "1201745260",
  "01745259": "1201745259",
  "64895470": "1464895470",
}
UNCHANGED_OWNER = "64895468"
DISPLAY_GROUND = 5.2
GROUND_NHN = 36.0
WORLD_NHN_ORIGIN = 30.0
VERTICAL_OFFSET = DISPLAY_GROUND - (GROUND_NHN - WORLD_NHN_ORIGIN)
AXIS_ORIGIN = (-1347.75, -2183.656)
AXIS_U = (0.9499533462787421, -0.31239180510029446)
BUILDING_1_STEPS = (
  ("north-terrace", (16, -1, 42, 16.045), 53.8),
  ("middle-tower", (23.8, 31.045, 42, 66.32), 62.0),
  ("middle-low-deck", (-1, 44, 23.8, 55.3), 50.2),
  ("south-low-wing", (-1, 55.3, 23.8, 81.23), 53.8),
)


def load(path: Path = SOURCE) -> dict:
  return json.loads(gzip.decompress(path.read_bytes()))


def polygon_parts(geometry: BaseGeometry) -> list[Polygon]:
  """Keep every area component, including arbitrarily small residual slivers."""
  if geometry.is_empty:
    return []
  if geometry.geom_type == "Polygon":
    if not geometry.is_valid:
      raise ValueError("Invalid polygon; refusing to repair or discard source pieces")
    return [geometry]
  if geometry.geom_type in ("MultiPolygon", "GeometryCollection"):
    return [part for child in geometry.geoms for part in polygon_parts(child)]
  # A boundary-only intersection has no roof area. Never drop an area component.
  if geometry.geom_type in ("Point", "MultiPoint", "LineString", "MultiLineString"):
    return []
  raise ValueError(f"Unexpected geometry: {geometry.geom_type}")


def mapped_polygon(record: dict) -> Polygon:
  polygon = Polygon(record["ring"], record.get("holes", []))
  if polygon.is_empty or not polygon.is_valid:
    raise ValueError(f"Invalid mapped source: {record.get('id')}")
  return polygon


def original_polygon(record: dict) -> Polygon:
  polygon = Polygon(
    [(x / 10, z / 10) for x, z in record["ring"]],
    [[(x / 10, z / 10) for x, z in ring] for ring in record.get("holes", [])],
  )
  if polygon.is_empty or not polygon.is_valid:
    raise ValueError(f"Invalid original source: {record['id']}")
  # Preserve the original preparation's ring order, but forbid silent repair.
  normalized = polygon.buffer(0)
  if normalized.geom_type != "Polygon" or not normalized.equals(polygon):
    raise ValueError(f"Normalization changed source topology: {record['id']}")
  return normalized


def local_rectangle(bounds: tuple[float, float, float, float]) -> Polygon:
  x0, z0, x1, z1 = bounds
  a, u, v = AXIS_ORIGIN, AXIS_U, (-AXIS_U[1], AXIS_U[0])
  return Polygon(
    [
      (a[0] + u[0] * x + v[0] * z, a[1] + u[1] * x + v[1] * z)
      for x, z in [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]
    ]
  )


def low_roof_evidence(polygon: Polygon, rows: list[list[float]]) -> dict:
  """Estimate the dominant plane from retained 1 m measurements, not OSM levels."""
  interior = polygon.buffer(-1)
  x0, z0, x1, z1 = polygon.bounds
  values = [
    nhn
    for x, z, nhn in rows
    if x0 < x < x1 and z0 < z < z1 and interior.contains(Point(x, z))
  ]
  if len(values) < 20:
    raise ValueError("Insufficient interior bDOM support for a narrow low roof")
  bins = defaultdict(list)
  for height in values:
    bins[round(height * 5)].append(height)
  mode = min(bins, key=lambda key: (-len(bins[key]), key))
  return {
    "insetM": 1,
    "bandWidthM": 0.2,
    "interiorSamples": len(values),
    "interiorMedianNhn": median(values),
    "modeCentreNhn": mode / 5,
    "modeSamples": len(bins[mode]),
    "modeMedianNhn": median(bins[mode]),
    "roofNhn": round(median(bins[mode]), 1),
  }


def rebuild(source: dict) -> dict:
  """Derive parts afresh; all original source/evidence fields pass through intact."""
  originals = source["originalPrisms"]
  if [p["id"] for p in originals] != list(OWNER_OSM):
    raise ValueError("Berlin Decks replacement is limited to its five exact owners")
  if source["unchangedConstructionPrism"] != UNCHANGED_OWNER:
    raise ValueError("The neighbouring construction owner must stay unchanged")
  datum = source["datum"]
  if (
    datum["displayGround"],
    datum["sourceGroundNhn"],
    datum["offset"],
  ) != (DISPLAY_GROUND, GROUND_NHN, VERTICAL_OFFSET):
    raise ValueError("Changed vertical datum requires a separately audited contract")
  osm = source["osm"]
  parts = []

  def emit(
    identifier: str, geometry: BaseGeometry, nhn: float, owner: str, method: str
  ):
    for index, polygon in enumerate(polygon_parts(geometry)):
      parts.append(
        {
          "id": f"{identifier}-{index}",
          "sourceId": owner,
          "ring": [[float(x), float(z)] for x, z in polygon.exterior.coords[:-1]],
          "holes": [
            [[float(x), float(z)] for x, z in ring.coords[:-1]]
            for ring in polygon.interiors
          ],
          "ground_y_m": DISPLAY_GROUND,
          "top_y_m": round(nhn - WORLD_NHN_ORIGIN + VERTICAL_OFFSET, 3),
          "roofNhn": nhn,
          "groundNhn": GROUND_NHN,
          "verticalOffset": VERTICAL_OFFSET,
          "method": method,
          "facadeStoreys": max(1, round((nhn - GROUND_NHN) / 4.25)),
        }
      )

  parent = mapped_polygon(osm["1201745260"])
  covered = []
  for name, bounds, height in BUILDING_1_STEPS:
    polygon = parent.intersection(local_rectangle(bounds))
    covered.append(polygon)
    emit(
      f"building1-{name}",
      polygon,
      height,
      "01745260",
      "Roof plane supported by summer-2025 bDOM; internal step boundary estimated "
      "from 1m height grid and aligned to OSM facade axes.",
    )
  emit(
    "building1-main",
    parent.difference(unary_union(covered)),
    57.6,
    "01745260",
    "Full mapped footprint complement, bDOM-supported main roof plane; plant and "
    "green-roof outliers retained only in source evidence.",
  )

  parent = mapped_polygon(osm["1201745259"])
  covered = []
  for identifier, height in [("1564126265", 57.4), ("1564126266", 62.1)]:
    polygon = mapped_polygon(osm[identifier]).intersection(parent)
    covered.append(polygon)
    emit(
      f"building2-{identifier}",
      polygon,
      height,
      "01745259",
      "Explicit current OSM building:part footprint with bDOM-supported roof plane.",
    )
  for index, polygon in enumerate(
    polygon_parts(parent.difference(unary_union(covered)))
  ):
    height = 57.6 if polygon.centroid.x < -1275 else 53.8
    method = (
      "Mapped building footprint complement with bDOM-supported roof plane; "
      "unmeasured roof plant excluded."
    )
    if index in (2, 3):
      height = low_roof_evidence(polygon, source["bdomGrid"]["rows"])["roofNhn"]
      method = (
        "Complete mapped low-roof complement; representative NHN plane inferred "
        "from the median of its dominant 0.2m summer-2025 bDOM height band, "
        "using raster points 1m inside the footprint. Roof-step boundary and "
        "facade subdivisions remain estimates."
      )
    emit(
      f"building2-complement-{index}",
      polygon,
      height,
      "01745259",
      method,
    )

  for identifier, height in [
    ("1464895469", 66.4),
    ("1464895470", 53.9),
    ("1464895471", 45.2),
  ]:
    emit(
      f"building4-{identifier}",
      mapped_polygon(osm[identifier]),
      height,
      identifier[-8:],
      "Mapped footprint and bDOM-supported plane; low circulation wing is an "
      "explicitly bounded simplified deck estimate, not a staircase survey.",
    )

  for original in originals:
    owner = original["id"]
    old = original_polygon(original)
    cover = unary_union(
      [Polygon(p["ring"], p["holes"]) for p in parts if p["sourceId"] == owner]
    )
    emit(
      f"retained-original-edge-{owner}",
      old.difference(cover),
      original["y0_dm"] / 10
      + original["h_dm"] / 10
      + WORLD_NHN_ORIGIN
      - VERTICAL_OFFSET,
      owner,
      "Exact old-only footprint remainder retained at original cap height; "
      "no blanket erasure.",
    )
    final = unary_union(
      [Polygon(p["ring"], p["holes"]) for p in parts if p["sourceId"] == owner]
    )
    expected = old.union(mapped_polygon(osm[OWNER_OSM[owner]]))
    if final.symmetric_difference(expected).area > 1e-8:
      raise ValueError(f"Incomplete original/mapped footprint: {owner}")

  result = copy.deepcopy(source)
  result["parts"] = parts
  return result


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--source", type=Path, default=SOURCE)
  parser.add_argument("--output", type=Path, help="Write a rebuilt gzip copy")
  args = parser.parse_args()
  source = load(args.source)
  result = rebuild(source)
  raw = json.dumps(result, separators=(",", ":")).encode()
  if args.output:
    args.output.write_bytes(gzip.compress(raw, mtime=0))
  elif result != source:
    raise SystemExit("Stored derived parts differ from the offline replay")
  print(
    json.dumps(
      {
        "owners": len(OWNER_OSM),
        "parts": len(result["parts"]),
        "bdomRows": len(result["bdomGrid"]["rows"]),
        "jsonSha256": hashlib.sha256(raw).hexdigest(),
        "output": str(args.output) if args.output else "check only; no files changed",
      }
    )
  )


if __name__ == "__main__":
  main()
