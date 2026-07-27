"""Build smooth water and parkland polygons for the drawn isometric city.

The voxel payload rasterises everything onto a 4 m grid, which is right
for the Minecraft world but makes the Spree banks and the Tiergarten
lawns read as staircases in the drawn city ("alles zu zackig, völlig
bescheuerte Ufer"). This module exports the TRUE OSM polygon rings so
the viewer can draw water bodies and parkland as smooth surfaces with a
continuous shoreline.

Rings are simplified to 0.6 m (well below a drawn line width) and stored
as decimetre integers in viewer world coordinates:
``world_x = easting − 389500``, ``world_z = 5820000 − northing``.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import geopandas as gpd
from shapely.geometry import MultiPolygon, Polygon
from shapely.geometry.base import BaseGeometry

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
SCHEMA_VERSION = 1
SIMPLIFY_M = 0.6
MIN_WATER_AREA_M2 = 40.0
MIN_PARK_AREA_M2 = 250.0


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
  osm_path: Path, layer: str, bounds: BaseGeometry, min_area: float
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
      simplified = part.simplify(SIMPLIFY_M, preserve_topology=True)
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


def build_payload(
  bounds_path: Path, osm_path: Path, scene_path: Path
) -> dict[str, Any]:
  verify_scene_origin(scene_path)
  bounds = project_geometry(load_bounds_polygon(bounds_path))
  return {
    "parks": collect(osm_path, "parks", bounds, MIN_PARK_AREA_M2),
    "schema_version": SCHEMA_VERSION,
    "simplify_m": SIMPLIFY_M,
    "source": ATTRIBUTION,
    "water": collect(osm_path, "water", bounds, MIN_WATER_AREA_M2),
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
  print(
    f"Wrote {args.out} ({size / 1024:.0f} KiB) with "
    f"{len(payload['water'])} water and {len(payload['parks'])} park polygons"
  )


if __name__ == "__main__":
  main()
