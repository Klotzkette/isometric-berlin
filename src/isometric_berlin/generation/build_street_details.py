"""Build the street-details payload (task 07: animated traffic lights).

Exports every OSM ``highway=traffic_signals`` node inside the
Regierungsviertel bounds as viewer world coordinates. The viewer snaps
each signal to the surveyed ground grid it already loads and animates
the German phase sequence itself, so the payload stays a tiny list of
positions.

Scene mapping (verified against ``scene.json`` ``origin_epsg25833``):
``world_x = easting − 389500``, ``world_z = 5820000 − northing``.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import geopandas as gpd

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
DEFAULT_OUT = MESH_PUBLIC_DIR / "street-details.json"
SCHEMA_VERSION = 1


def build_payload(
  bounds_path: Path, osm_path: Path, scene_path: Path
) -> dict[str, Any]:
  verify_scene_origin(scene_path)
  bounds = project_geometry(load_bounds_polygon(bounds_path))
  roads = gpd.read_file(osm_path, layer="roads")
  roads = roads.to_crs(epsg=25833)
  signals = roads[
    (roads["highway"] == "traffic_signals")
    & (roads.geometry.geom_type == "Point")
  ]
  positions: list[list[int]] = []
  for point in signals.geometry:
    if not bounds.contains(point):
      continue
    # Decimetre integers, matching the other payloads.
    positions.append(
      [
        round((point.x - ORIGIN_EASTING) * 10),
        round((ORIGIN_NORTHING - point.y) * 10),
      ]
    )
  positions.sort()
  return {
    "schema_version": SCHEMA_VERSION,
    "source": ATTRIBUTION,
    "traffic_signals_dm": positions,
  }


def main(argv: list[str] | None = None) -> None:
  parser = argparse.ArgumentParser(
    description="Export OSM traffic signals as viewer street details."
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
  print(
    f"Wrote {args.out} with {len(payload['traffic_signals_dm'])} traffic signals"
  )


if __name__ == "__main__":
  main()
