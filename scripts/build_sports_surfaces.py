"""Refine mapped playing surfaces on retained flat Berlin terrain packets."""

from __future__ import annotations

import argparse
import gzip
import json
import math
from pathlib import Path

import geopandas as gpd
import shapely
from shapely.affinity import rotate
from shapely.geometry import LineString, Point, box, mapping
from shapely.ops import unary_union

from scripts.build_public_green_v329 import native_pixels, nav_exclusions, rgba_floor
from scripts.build_spree_details_v337 import PUBLIC, ROOT, json_bytes, sha
from scripts.build_surrounding_outlines import PackedMesh, tags_for, world

CACHE = ROOT / "geo_data/regierungsviertel/raw/outskirts-v187/candidate.gpkg"
SOURCE = ROOT / "geo_data/regierungsviertel/sports-surfaces-source.json.gz"
RECEIPT = ROOT / "geo_data/regierungsviertel/sports-surfaces-receipt.json"
PAINT = (232, 230, 213)
SURFACES = {
  "grass": (112, 144, 77),
  "artificial_turf": (90, 133, 81),
  "clay": (174, 103, 78),
  "sand": (189, 155, 108),
  "tartan": (151, 83, 71),
  "rubber": (151, 83, 71),
  "asphalt": (113, 117, 114),
  "concrete": (154, 151, 137),
}


def extract() -> dict:
  frame = gpd.read_file(
    CACHE, layer="multipolygons", where="leisure IN ('pitch','track')"
  ).to_crs(25833)
  manifest = json.loads((PUBLIC / "manifest.json").read_bytes())
  coverage = shapely.STRtree([box(*entry["bounds"]) for entry in manifest["chunks"]])
  rows = []
  for _, record in frame.iterrows():
    tags = tags_for(record)
    sport = tags.get("sport")
    surface = tags.get("surface")
    if surface not in SURFACES or sport not in {
      "tennis",
      "soccer",
      "athletics",
      "running",
      "horse_racing",
    }:
      continue
    geometry = world(shapely.make_valid(record.geometry))
    if geometry.is_empty or not len(coverage.query(geometry, predicate="intersects")):
      continue
    if tags["leisure"] == "track":
      # Keep surveyed loop footprints. A centreline or single outer boundary
      # would not establish the width or the infield.
      if geometry.area < 900 or not any(
        p.interiors for p in shapely.get_parts(geometry) if p.geom_type == "Polygon"
      ):
        continue
    elif not (
      (sport == "tennis" and geometry.area >= 285)
      or (sport == "soccer" and geometry.area >= 3500)
    ):
      continue
    rows.append(
      {
        "id": str(tags.get("osm_way_id") or tags.get("osm_id")),
        "sport": sport,
        "surface": surface,
        "kind": tags["leisure"],
        "geometry": mapping(geometry),
      }
    )
  return {
    "source": "Geofabrik Berlin 2026-09-29 / OpenStreetMap (ODbL-1.0)",
    "rows": rows,
  }


def markings(geometry, sport: str, native: bool):
  """Build measured sport proportions inside near-rectangular court owners."""
  rect = geometry.minimum_rotated_rectangle
  if rect.geom_type != "Polygon" or geometry.area / rect.area < 0.91:
    return None
  a, b, c, _ = list(rect.exterior.coords)[:4]
  start, end = (a, b) if math.dist(a, b) > math.dist(b, c) else (b, c)
  angle = math.degrees(math.atan2(end[1] - start[1], end[0] - start[0]))
  origin = (rect.centroid.x, rect.centroid.y)
  x0, z0, x1, z1 = rotate(rect, -angle, origin=origin).bounds
  width, length = z1 - z0, x1 - x0
  if sport == "tennis" and 23.9 < length < 42 and 11.05 < width < 25:
    x, z = origin
    x0, x1, z0, z1 = x - 11.885, x + 11.885, z - 5.485, z + 5.485
    lines = [box(x0, z0, x1, z1).boundary, box(x0, z - 4.115, x1, z + 4.115).boundary]
    lines.extend(
      LineString([(x + offset, z - 4.115), (x + offset, z + 4.115)])
      for offset in (-6.4, 6.4)
    )
    lines.append(LineString([(x - 6.4, z), (x + 6.4, z)]))
  elif sport == "soccer" and 86 < length < 122 and 47 < width < 91:
    x0, x1, z0, z1 = x0 + 1.0, x1 - 1.0, z0 + 1.0, z1 - 1.0
    x, z = origin
    lines = [
      box(x0, z0, x1, z1).boundary,
      LineString([(x, z0), (x, z1)]),
      Point(x, z).buffer(9.15, quad_segs=12).boundary,
    ]
    for edge, direction in [(x0, 1), (x1, -1)]:
      for depth, half_width in [(16.5, 20.16), (5.5, 9.16)]:
        inner = edge + depth * direction
        lines.append(
          LineString(
            [
              (edge, z - half_width),
              (inner, z - half_width),
              (inner, z + half_width),
              (edge, z + half_width),
            ]
          )
        )
  else:
    return None
  line_width = 0.26 if native else 0.075 if sport == "tennis" else 0.11
  return rotate(
    unary_union(lines).buffer(line_width, cap_style=2, join_style=2),
    angle,
    origin=origin,
  ).intersection(geometry)


def plan(source: dict, manifest: dict) -> tuple[dict, dict]:
  rows = source["rows"]
  footprints = [shapely.geometry.shape(row["geometry"]) for row in rows]
  index = shapely.STRtree(footprints)
  results, report = {}, {}
  for chunk in manifest["chunks"]:
    if chunk.get("detailCompanionOf") or chunk["id"].startswith(
      ("ubahnApproach", "gardens330")
    ):
      continue
    bounds = box(*chunk["bounds"])
    near = sorted(index.query(bounds, predicate="intersects"))
    if not near:
      continue
    for family in ("drawn", "minecraft"):
      asset = chunk[family]
      path = PUBLIC / asset["url"]
      wire = path.read_bytes()
      assert sha(wire) == asset["sha256"]
      packet = json.loads(gzip.decompress(wire))
      if len(packet["meshes"]) >= 16:
        continue
      native = family == "minecraft"
      shapes = {i: footprints[i].intersection(bounds) for i in near}
      desired = unary_union(list(shapes.values()))
      floors = rgba_floor(packet, desired)
      if not floors:
        continue
      blocked = nav_exclusions(packet, desired)
      mesh = PackedMesh(packet["origin"][0], packet["origin"][2])
      owners = []
      for i in near:
        row = rows[i]
        surface = shapes[i].difference(blocked)
        lines = (
          markings(footprints[i], row["sport"], native)
          if row["kind"] == "pitch"
          else None
        )
        used = 0
        for y, base in floors.items():
          support = surface.intersection(base)
          if support.area < 9:
            continue
          # Both families keep the surface within the source polygon after
          # centimetre quantization. Native keeps whole cardinal cells.
          clip = native_pixels(support, 0.5) if native else support.buffer(-0.015)
          if clip.area < 9:
            continue
          mesh.surface(clip, y + 0.04, SURFACES[row["surface"]])
          used += clip.area
          if lines is not None:
            paint = lines.intersection(clip)
            if native:
              paint = native_pixels(paint, 0.25)
            mesh.surface(paint, y + 0.05, PAINT)
        if used:
          owners.append([row["id"], round(used, 2)])
      part = mesh.payload("mapped-sports-surfaces")
      if not part:
        continue
      packet["meshes"].append(part)
      raw = json_bytes(packet)
      if len(raw) > 12 * 1024 * 1024:
        continue
      new_wire = gzip.compress(raw, compresslevel=9, mtime=0)
      report[f"{family}:{chunk['id']}"] = {
        "owners": owners,
        "before": asset.copy(),
        "after": dict(
          asset, sha256=sha(new_wire), bytes=len(new_wire), decodedBytes=len(raw)
        ),
      }
      results[path] = new_wire
  return results, report


def write(path: Path, value: bytes) -> None:
  temp = path.with_suffix(".sports-tmp")
  temp.write_bytes(value)
  temp.replace(path)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--refresh-source", action="store_true")
  parser.add_argument("--apply", action="store_true")
  args = parser.parse_args()
  if args.refresh_source:
    write(SOURCE, gzip.compress(json_bytes(extract()), mtime=0))
  path = PUBLIC / "manifest.json"
  manifest = json.loads(path.read_bytes())
  if RECEIPT.exists():
    raise SystemExit("Sports surfaces are already applied to this checkout")
  wire, report = plan(json.loads(gzip.decompress(SOURCE.read_bytes())), manifest)
  if args.apply:
    assert all(
      sha((PUBLIC / row["before"]["url"]).read_bytes()) == row["before"]["sha256"]
      for row in report.values()
    )
    for chunk in manifest["chunks"]:
      for family in ("drawn", "minecraft"):
        row = report.get(f"{family}:{chunk['id']}")
        if row:
          chunk[family] = row["after"]
    for target, data in wire.items():
      write(target, data)
    write(path, json_bytes(manifest))
    write(RECEIPT, json_bytes(report))
  print(
    {
      "packets": len(report),
      "owners": len({p[0] for r in report.values() for p in r["owners"]}),
      "netBytes": sum(
        r["after"]["bytes"] - r["before"]["bytes"] for r in report.values()
      ),
    }
  )
