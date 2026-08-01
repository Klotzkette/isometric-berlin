"""Build smooth water and parkland polygons for the drawn isometric city.

The voxel payload rasterises everything onto a 4 m grid, which is right
for the Minecraft world but makes the Spree banks and the Tiergarten
lawns read as staircases in the drawn city ("alles zu zackig, völlig
bescheuerte Ufer"). This module exports the TRUE OSM polygon rings so
the viewer can draw water bodies and parkland as smooth surfaces with a
continuous shoreline.

Water keeps a much tighter tolerance than parkland: at 0.6 m the Spree
loses two thirds of its vertices, and every dropped vertex turns a bend
into a 25 m chord that the viewer then has to draw as a straight facet.
The bank line is the one edge the eye follows, so it is worth the bytes.

Rings are stored as decimetre integers in viewer world coordinates:
``world_x = easting − 389500``, ``world_z = 5820000 − northing``.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import geopandas as gpd
from shapely.geometry import (
  LineString,
  MultiLineString,
  MultiPolygon,
  Polygon,
)
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from isometric_berlin.data.common import load_bounds_polygon, project_geometry
from isometric_berlin.generation.build_minecraft_voxels import (
  ATTRIBUTION,
  DEFAULT_BOUNDS,
  DEFAULT_SCENE,
  MESH_PUBLIC_DIR,
  ORIGIN_EASTING,
  ORIGIN_NORTHING,
  REPO_ROOT,
  verify_scene_origin,
)

DEFAULT_OSM = REPO_ROOT / "geo_data/regierungsviertel/osm.gpkg"
DEFAULT_OUT = MESH_PUBLIC_DIR / "surface-polygons.json"
SCHEMA_VERSION = 2
WATER_SIMPLIFY_M = 0.15
PARK_SIMPLIFY_M = 1.2
MIN_WATER_AREA_M2 = 40.0
MIN_PARK_AREA_M2 = 250.0

# --- Carriageways and park paths -------------------------------------
#
# OSM gives streets and paths as CENTRELINES, which is why the drawn city
# had no road surfaces at all outside the 4 m voxel raster: the Straße des
# 17. Juni and the Großer Stern roundabout arrived as pale green park with
# a hairline through it ("die Straße ist … noch nicht grau", "die Wege im
# Tiergarten sind noch nicht alle grau oder gelb eingezeichnet"). Buffering
# each centreline by half its real carriageway width turns them into true
# polygons the viewer can draw exactly like the water and park plates.
#
# Widths are the ordinary German cross-sections for each class, not
# per-street survey: they are presentation geometry derived from an OSM
# classification, and the manifest labels them as such.
ROAD_WIDTHS_M: dict[str, float] = {
  # Berlin's classified roads are mapped as ONE centreline even where the
  # street carries two carriageways and a central reservation — the Straße
  # des 17. Juni is a single OSM way across a 50 m boulevard. A textbook
  # 12 m lane width therefore drew it as a hairline through the park. These
  # widths are the full paved cross-section for the class as it occurs in
  # this district, so the axis reads as the avenue it is.
  "trunk": 20.0,
  "primary": 17.0,
  "secondary": 12.0,
  "tertiary": 9.5,
  "residential": 8.0,
  "unclassified": 7.5,
  "living_street": 7.0,
  "service": 5.0,
  "pedestrian": 9.0,
  "cycleway": 2.6,
  "footway": 2.4,
  "path": 2.2,
  "track": 3.0,
  "steps": 2.0,
}
# Which drawn surface each class reads as. Park paths are the sandy
# Tiergarten gravel; everything carrying traffic is asphalt; squares and
# pedestrian zones are paving.
ROAD_KINDS: dict[str, str] = {
  "trunk": "asphalt",
  "primary": "asphalt",
  "secondary": "asphalt",
  "tertiary": "asphalt",
  "residential": "asphalt",
  "unclassified": "asphalt",
  "living_street": "asphalt",
  "service": "asphalt",
  "pedestrian": "paving",
  "cycleway": "paving",
  "footway": "paving",
  "path": "sand",
  "track": "sand",
  "steps": "paving",
}
# Classes whose centreline earns a painted lane marking.
MARKED_CLASSES = frozenset({"trunk", "primary", "secondary"})
ROAD_SIMPLIFY_M = 0.75
MIN_ROAD_AREA_M2 = 25.0
# A footway or cycleway that runs inside parkland is a park path and reads
# sandy, wherever OSM classified it. This is what makes the Tiergarten look
# like the Tiergarten instead of a grey street grid dropped on a lawn.
PARK_PATH_KIND = "sand"


def ring_to_dm(coords: Any) -> list[list[int]]:
  return [
    [round((x - ORIGIN_EASTING) * 10), round((ORIGIN_NORTHING - y) * 10)]
    for x, y in coords
  ]


def polygon_parts(geometry: BaseGeometry) -> list[Polygon]:
  if isinstance(geometry, Polygon):
    return [geometry]
  if isinstance(geometry, MultiPolygon):
    return list(geometry.geoms)
  return []


def collect(
  osm_path: Path,
  layer: str,
  bounds: BaseGeometry,
  min_area: float,
  simplify_m: float,
) -> list[dict[str, Any]]:
  frame = gpd.read_file(osm_path, layer=layer).to_crs(epsg=25833)
  surfaces: list[dict[str, Any]] = []
  for _, row in frame.iterrows():
    geometry = row.geometry
    if geometry is None or geometry.is_empty:
      continue
    clipped = geometry.intersection(bounds)
    if clipped.is_empty:
      continue
    for part in polygon_parts(clipped):
      simplified = part.simplify(simplify_m, preserve_topology=True)
      if simplified.is_empty or simplified.area < min_area:
        continue
      ring = ring_to_dm(simplified.exterior.coords)
      if len(ring) < 4:
        continue
      holes = [
        ring_to_dm(interior.coords)
        for interior in simplified.interiors
        if len(interior.coords) >= 4
      ]
      name = row.get("name")
      surfaces.append(
        {
          "area_m2": round(simplified.area),
          "holes": holes,
          "name": name if isinstance(name, str) else "",
          "ring": ring,
        }
      )
  surfaces.sort(key=lambda entry: -entry["area_m2"])
  return surfaces


def line_parts(geometry: BaseGeometry) -> list[LineString]:
  if isinstance(geometry, LineString):
    return [geometry]
  if isinstance(geometry, MultiLineString):
    return list(geometry.geoms)
  return []


def line_to_dm(coords: Any) -> list[list[int]]:
  return [
    [round((x - ORIGIN_EASTING) * 10), round((ORIGIN_NORTHING - y) * 10)]
    for x, y in coords
  ]


def collect_roads(
  osm_path: Path, bounds: BaseGeometry, parkland: BaseGeometry | None
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
  """Buffer OSM highway centrelines into drawn carriageway polygons.

  Returns the surface polygons and, separately, the centrelines of the
  classes that carry a painted lane marking, so the viewer can stroke them
  as dashes instead of inventing markings from the polygon.
  """
  frame = gpd.read_file(osm_path, layer="roads").to_crs(epsg=25833)
  by_kind: dict[str, list[Polygon]] = {}
  markings: list[dict[str, Any]] = []
  for _, row in frame.iterrows():
    highway = row.get("highway")
    if not isinstance(highway, str):
      continue
    width = ROAD_WIDTHS_M.get(highway)
    if width is None:
      continue
    geometry = row.geometry
    if geometry is None or geometry.is_empty:
      continue
    clipped = geometry.intersection(bounds)
    if clipped.is_empty:
      continue
    kind = ROAD_KINDS[highway]
    for line in line_parts(clipped):
      if line.length < 2.0:
        continue
      resolved = kind
      if (
        kind in {"paving", "sand"}
        and parkland is not None
        and parkland.intersects(line)
        and line.intersection(parkland).length > line.length * 0.5
      ):
        resolved = PARK_PATH_KIND
      # flat caps: a buffered centreline must not bulge into a lollipop at
      # every junction, which is what round caps do on a 4 000-segment net.
      band = line.buffer(width / 2, cap_style=2, join_style=1)
      if band.is_empty:
        continue
      by_kind.setdefault(resolved, []).append(band)
      if highway in MARKED_CLASSES and line.length >= 25.0:
        simplified = line.simplify(ROAD_SIMPLIFY_M, preserve_topology=True)
        points = line_to_dm(simplified.coords)
        if len(points) >= 2:
          markings.append(
            {
              "name": row.get("name") if isinstance(row.get("name"), str) else "",
              "points": points,
              "width_m": round(width, 2),
            }
          )

  surfaces: list[dict[str, Any]] = []
  for kind, bands in by_kind.items():
    merged = unary_union(bands)
    for part in polygon_parts(merged):
      simplified = part.simplify(ROAD_SIMPLIFY_M, preserve_topology=True)
      if simplified.is_empty or simplified.area < MIN_ROAD_AREA_M2:
        continue
      ring = ring_to_dm(simplified.exterior.coords)
      if len(ring) < 4:
        continue
      # Sliver holes are what a buffered road network produces wherever
      # two carriageways graze each other, and a hole with no real area
      # makes the viewer's ear-clipping triangulator throw. Keep only
      # holes that enclose at least a square metre.
      holes = [
        ring_to_dm(interior.coords)
        for interior in simplified.interiors
        if len(interior.coords) >= 4 and Polygon(interior).area >= 1.0
      ]
      surfaces.append(
        {
          "area_m2": round(simplified.area),
          "holes": holes,
          "kind": kind,
          "name": "",
          "ring": ring,
        }
      )
  surfaces.sort(key=lambda entry: -entry["area_m2"])
  markings.sort(key=lambda entry: -len(entry["points"]))
  return surfaces, markings


def build_payload(
  bounds_path: Path, osm_path: Path, scene_path: Path
) -> dict[str, Any]:
  verify_scene_origin(scene_path)
  bounds = project_geometry(load_bounds_polygon(bounds_path))
  parks = gpd.read_file(osm_path, layer="parks").to_crs(epsg=25833)
  parkland = unary_union(
    [g for g in parks.geometry if g is not None and not g.is_empty]
  )
  roads, markings = collect_roads(osm_path, bounds, parkland)
  return {
    "lane_markings": markings,
    "park_simplify_m": PARK_SIMPLIFY_M,
    "parks": collect(
      osm_path, "parks", bounds, MIN_PARK_AREA_M2, PARK_SIMPLIFY_M
    ),
    "road_simplify_m": ROAD_SIMPLIFY_M,
    "road_widths_m": ROAD_WIDTHS_M,
    "roads": roads,
    "schema_version": SCHEMA_VERSION,
    "simplify_m": WATER_SIMPLIFY_M,
    "source": ATTRIBUTION,
    "water": collect(
      osm_path, "water", bounds, MIN_WATER_AREA_M2, WATER_SIMPLIFY_M
    ),
  }


def main(argv: list[str] | None = None) -> None:
  parser = argparse.ArgumentParser(
    description="Export smooth OSM water/parkland polygons for the viewer."
  )
  parser.add_argument("--bounds", type=Path, default=DEFAULT_BOUNDS)
  parser.add_argument("--osm", type=Path, default=DEFAULT_OSM)
  parser.add_argument("--scene", type=Path, default=DEFAULT_SCENE)
  parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
  args = parser.parse_args(argv)

  payload = build_payload(args.bounds, args.osm, args.scene)
  args.out.write_text(
    json.dumps(payload, separators=(",", ":"), sort_keys=True) + "\n",
    encoding="utf-8",
  )
  size = args.out.stat().st_size
  from collections import Counter

  kinds = Counter(entry["kind"] for entry in payload["roads"])
  print(
    f"Wrote {args.out} ({size / 1024:.0f} KiB) with "
    f"{len(payload['water'])} water, {len(payload['parks'])} park, "
    f"{len(payload['roads'])} road polygons ({dict(kinds)}) and "
    f"{len(payload['lane_markings'])} lane markings"
  )


if __name__ == "__main__":
  main()
