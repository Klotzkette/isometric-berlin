"""Step 10: small additive street and facade details on five retained south sites."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import build_surrounding_outlines as outlines
import geopandas as gpd
from shapely.geometry import LineString, Point, mapping, shape
from shapely.ops import nearest_points, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
SOURCE = DATA / "south-kiez-v185-source.json"
DEST = ROOT / "src/app/src/data/southKiezV185.json"
STREETS = ("Richardplatz", "Schudomastraße", "Wiener Straße", "Forster Straße")


def extract() -> dict[str, Any]:
  """Clip retained OSM and already delivered owner footprints, never rebuild them."""
  candidate = DATA / "raw/outer-v159/candidate.gpkg"
  named = gpd.read_file(
    candidate, layer="lines", where="name IN " + str(STREETS)
  ).to_crs(25833)
  areas = gpd.read_file(
    candidate, layer="multipolygons", where="osm_way_id='15740772'"
  ).to_crs(25833)
  park = outlines.world(areas.geometry.iloc[0])
  named_world = [outlines.world(g) for g in named.geometry]
  roads = unary_union(named_world)
  scope = roads.buffer(36).union(park)
  all_lines = gpd.read_file(
    candidate, layer="lines", bbox=tuple(named.to_crs(4326).total_bounds)
  ).to_crs(25833)
  selected = []
  for _, row in all_lines.iterrows():
    tags = outlines.tags_for(row)
    highway = tags.get("highway")
    if highway not in outlines.ROAD_WIDTHS_M or tags.get("tunnel", "no") != "no":
      continue
    if float(tags.get("layer", 0)) < 0:
      continue
    geometry = outlines.world(row.geometry)
    if not geometry.intersects(scope.buffer(20)):
      continue
    width = outlines.road_width_m(tags)
    if width is None:
      continue
    selected.append(
      {
        "osmId": "way/" + str(row.osm_id),
        "name": tags.get("name", ""),
        "highway": highway,
        "surface": tags.get("surface"),
        "width": width,
        "widthSource": outlines.road_width_source(tags),
        "geometry": mapping(geometry),
      }
    )
  records = []
  caches = []
  for directory in ["outer-v159", "ring-v182", "city-v183"]:
    cache = DATA / f"raw/{directory}/resolved-outlines.gpkg"
    frame = gpd.read_file(cache, layer="buildings", bbox=scope.buffer(10).bounds)
    for _, row in frame.iterrows():
      if not row.geometry.intersects(scope.buffer(10)):
        continue
      records.append(
        {
          "sourceId": row.sourceId,
          "geometry": mapping(row.geometry),
          "height": float(row.height),
          "minHeight": float(row.minHeight),
          "heightSource": row.heightSource,
          "sourceCache": directory,
        }
      )
    caches.append(
      {
        "path": str(cache.relative_to(ROOT)),
        "sha256": hashlib.sha256(cache.read_bytes()).hexdigest(),
      }
    )
  nodes = gpd.read_file(
    DATA / "raw/outer-v159/berlin-260929.osm.pbf",
    layer="points",
    bbox=tuple(areas.to_crs(4326).total_bounds),
    where="other_tags LIKE '%bench%'",
  ).to_crs(25833)
  benches = []
  for _, row in nodes.iterrows():
    tags = outlines.tags_for(row)
    point = outlines.world(row.geometry)
    # Retain only explicitly oriented wooden park benches. No invented locations
    # or directions, and no second street-furniture pass beyond the named park.
    if (
      tags.get("amenity") != "bench"
      or tags.get("material") != "wood"
      or not park.covers(point)
    ):
      continue
    try:
      direction = float(tags["direction"])
    except (KeyError, ValueError):
      continue
    benches.append(
      {
        "osmId": "node/" + row.osm_id,
        "xz": [point.x, point.y],
        "direction": direction,
        "backrest": tags.get("backrest") == "yes",
        "seats": tags.get("seats"),
      }
    )
  return {
    "schemaVersion": 1,
    "frame": "x=EPSG25833 easting-389500; z=5820000-northing; groundY=3",
    "sourceDate": "2026-09-29",
    "osmSource": outlines.SOURCE_URL,
    "osmLicence": "ODbL-1.0",
    "officialLicence": "dl-de/zero-2-0",
    "cacheEvidence": caches,
    "scope": mapping(scope),
    "park": {"osmId": "way/15740772", "geometry": mapping(park)},
    "roads": selected,
    "buildings": records,
    "benches": benches,
  }


def build(source: dict[str, Any]) -> dict[str, Any]:
  """Produce sparse contours/profiles; every solid source owner remains untouched."""
  scope, park = shape(source["scope"]), shape(source["park"]["geometry"])
  records = source["buildings"]
  occupied = unary_union([shape(b["geometry"]) for b in records])
  roads = source["roads"]
  named = [r for r in roads if r["name"] in STREETS]
  target = unary_union([shape(r["geometry"]) for r in named])
  target_surface = unary_union(
    [shape(r["geometry"]).buffer(r["width"] / 2, quad_segs=3) for r in named]
  )
  vehicular = unary_union(
    [
      shape(r["geometry"]).buffer(r["width"] / 2, quad_segs=3)
      for r in roads
      if r["highway"] in outlines.VEHICULAR_HIGHWAYS
    ]
  )
  paths = unary_union(
    [
      shape(r["geometry"]).buffer(r["width"] / 2, quad_segs=3)
      for r in roads
      if r["highway"] in {"footway", "path", "pedestrian", "steps"}
    ]
  )
  # Union first, so a crossing/junction never receives a transverse kerb.
  kerbs = (
    vehicular.boundary.intersection(target_surface.buffer(0.03))
    .difference(paths.buffer(0.2))
    .difference(occupied.buffer(0.2))
    .intersection(scope)
  )
  park_edges = (
    paths.boundary.intersection(park)
    .difference(vehicular.buffer(0.2))
    .difference(occupied.buffer(0.2))
  )
  boxes: list[list[float]] = []
  native: list[list[float]] = []
  evidence = []

  def strip(
    a: tuple[float, float],
    b: tuple[float, float],
    y: float,
    height: float,
    depth: float,
    color: int,
    *,
    native_step: float = 2.5,
    native_y: float | None = None,
    native_offset: tuple[float, float] = (0, 0),
  ) -> None:
    dx, dz = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dz)
    if length < 0.12:
      return
    boxes.append(
      [
        *[
          round(v, 3)
          for v in [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, length, height, depth]
        ],
        round(-math.atan2(dz, dx), 6),
        color,
      ]
    )
    count = max(1, math.ceil(length / native_step))
    # Independent axis-aligned shallow blocks follow the same source course.
    for i in range(count):
      t = (i + 0.5) / count
      native.append(
        [
          round(a[0] + dx * t + native_offset[0], 3),
          round(y if native_y is None else native_y, 3),
          round(a[1] + dz * t + native_offset[1], 3),
          round(max(depth, abs(dx) / count), 3),
          round(height, 3),
          round(max(depth, abs(dz) / count), 3),
          color,
        ]
      )

  for role, contours, y, h, width, color in [
    ("street-kerb", kerbs, 3.21, 0.16, 0.24, 0xCFCBBB),
    ("park-path-edging", park_edges, 3.18, 0.10, 0.18, 0xBFB499),
  ]:
    start, native_start = len(boxes), len(native)
    for line in outlines.line_parts(contours):
      for a, b in zip(line.coords, list(line.coords)[1:]):
        strip(a, b, y, h, width, color)
    evidence.append(
      {
        "role": role,
        "geometry": mapping(contours),
        "firstBox": start,
        "boxCount": len(boxes) - start,
        "firstNative": native_start,
        "nativeCount": len(native) - native_start,
      }
    )
  used = set()
  for building in sorted(records, key=lambda b: b["sourceId"]):
    owner, geom = building["sourceId"], shape(building["geometry"])
    height = building["height"]
    if owner in used or height < 8 or building["minHeight"] > 0.1:
      continue
    if geom.distance(target) > 27:
      continue
    candidates = []
    for polygon in outlines.polygons_from_geometry(geom):
      for a, b in zip(polygon.exterior.coords, list(polygon.exterior.coords)[1:]):
        dx, dz = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dz)
        if length < 9:
          continue
        middle = Point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        near = nearest_points(middle, target)[1]
        distance = middle.distance(near)
        if distance > 27 or distance < 1:
          continue
        nx, nz = dz / length, -dx / length
        if (near.x - middle.x) * nx + (near.y - middle.y) * nz < 0:
          nx, nz = -nx, -nz
        if ((near.x - middle.x) * nx + (near.y - middle.y) * nz) / distance < 0.80:
          continue
        if any(
          occupied.covers(Point(middle.x + nx * d, middle.y + nz * d))
          for d in [0.6, 2, 4]
        ):
          continue
        line = LineString([a, b])
        if not scope.covers(line):
          continue
        candidates.append((length, a, b, nx, nz))
    if not candidates:
      continue
    length, a, b, nx, nz = max(candidates)
    start, native_start = len(boxes), len(native)
    # These are intentionally modest profile readings, not invented openings.
    for y, h, depth, color in [
      (3.55, 0.65, 0.20, 0xABA99B),
      (3.91, 0.09, 0.30, 0xD8CFBA),
      (3 + height - 0.65, 0.16, 0.28, 0xDBD3C0),
    ]:
      strip(
        (a[0] + nx * 0.19, a[1] + nz * 0.19),
        (b[0] + nx * 0.19, b[1] + nz * 0.19),
        y,
        h,
        depth,
        color,
        native_step=3.5,
        native_offset=(nx * 1.11, nz * 1.11),
        native_y=3 + max(2, round(height / 2) * 2) - 0.65 if y > 5 else y,
      )
    used.add(owner)
    evidence.append(
      {
        "role": "source-frontage-profile",
        "sourceId": owner,
        "sourceCache": building["sourceCache"],
        "sourceHeight": height,
        "heightSource": building["heightSource"],
        "wall": [a, b],
        "normal": [nx, nz],
        "firstBox": start,
        "boxCount": len(boxes) - start,
        "firstNative": native_start,
        "nativeCount": len(native) - native_start,
      }
    )
  for bench in source["benches"]:
    x, z = bench["xz"]
    angle = math.radians(bench["direction"])
    nx, nz = math.sin(angle), -math.cos(angle)
    dx, dz = -nz, nx
    first, first_native = len(boxes), len(native)
    # Section sizes and a modest 1.8 m length are display estimates; OSM alone
    # supplies the point, facing, wood material and presence of a backrest.
    a, b = (x - dx * 0.9, z - dz * 0.9), (x + dx * 0.9, z + dz * 0.9)
    strip(a, b, 3.46, 0.12, 0.47, 0x94734F, native_step=0.6)
    if bench["backrest"]:
      strip(
        (a[0] - nx * 0.21, a[1] - nz * 0.21),
        (b[0] - nx * 0.21, b[1] - nz * 0.21),
        3.79,
        0.38,
        0.09,
        0x9C7A54,
        native_step=0.6,
      )
    for t in [-0.65, 0.65]:
      px, pz = x + dx * t, z + dz * t
      strip(
        (px - nx * 0.16, pz - nz * 0.16),
        (px + nx * 0.16, pz + nz * 0.16),
        3.22,
        0.44,
        0.08,
        0x555F59,
        native_step=0.6,
      )
    evidence.append(
      {
        "role": "mapped-park-bench",
        **bench,
        "firstBox": first,
        "boxCount": len(boxes) - first,
        "firstNative": first_native,
        "nativeCount": len(native) - first_native,
      }
    )
  return {"boxes": boxes, "nativeRows": native, "evidence": evidence}


def main() -> None:
  """Publish only the bounded derived overlay and source receipts."""
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  if args.extract:
    SOURCE.write_text(
      json.dumps(extract(), ensure_ascii=False, separators=(",", ":")) + "\n"
    )
  result = build(json.loads(SOURCE.read_text()))
  evidence = result.pop("evidence")
  native = result.pop("nativeRows")
  result["sourceSha256"] = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
  DEST.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  DEST.with_name("southKiezV185Native.json").write_text(
    json.dumps({"nativeRows": native}, separators=(",", ":")) + "\n"
  )
  (DATA / "south-kiez-v185-evidence.json").write_text(
    json.dumps(
      {"sourceSha256": result["sourceSha256"], "features": evidence},
      separators=(",", ":"),
    )
    + "\n"
  )
  print(
    {
      "boxes": len(result["boxes"]),
      "nativeBlocks": len(native),
      "frontages": sum(e["role"] == "source-frontage-profile" for e in evidence),
    }
  )


if __name__ == "__main__":
  main()
