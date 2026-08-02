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
import math
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
SCHEMA_VERSION = 3

# Roads a filling station can front. Service ways and footpaths run behind
# and beside forecourts, so matching those would rotate the canopy at random.
FUEL_FRONTAGE_HIGHWAYS = {
  "living_street",
  "primary",
  "residential",
  "secondary",
  "tertiary",
  "unclassified",
}
# The forecourt of a German filling station that OSM records as a single
# node. Both numbers are extrapolated and the payload says so.
FUEL_DEFAULT_WIDTH_DM = 170
FUEL_DEFAULT_DEPTH_DM = 140

# OSM `historic` kinds that become drawn monuments in the viewer.
MONUMENT_KINDS = {"cannon", "memorial", "monument", "tank"}
# Landmarks the recognition layer already models completely.
MONUMENT_SKIP_NAMES = {"Brandenburger Tor"}


def monument_kind(row: Any) -> str | None:
  """The drawn class of an OSM POI, or ``None`` if it is not a monument.

  Most of the Tiergarten's statuary is not tagged ``historic`` at all but
  ``tourism=artwork`` — the Wagner memorial, the hunting groups, the
  Luiseninsel figures. Leaving those out emptied whole lawns that in
  reality are full of marble, so a named artwork counts too.
  """
  kind = row.get("historic")
  if isinstance(kind, str) and kind in MONUMENT_KINDS:
    return kind
  if row.get("tourism") == "artwork":
    return "artwork"
  return None


def rectangle_axis(polygon: Any) -> tuple[tuple[float, float], float, float]:
  """The long axis and side lengths of a footprint's tightest rectangle.

  Returned in viewer world orientation: northing grows the opposite way to
  ``world_z``, so the northing component of the easting/northing edge flips.
  """
  ring = polygon.minimum_rotated_rectangle.exterior.coords
  edges = [
    (ring[index + 1][0] - ring[index][0], ring[index + 1][1] - ring[index][1])
    for index in range(4)
  ]
  lengths = [math.hypot(dx, dy) for dx, dy in edges]
  long_index = max(range(4), key=lambda index: lengths[index])
  dx, dy = edges[long_index]
  length = lengths[long_index]
  return (dx / length, -dy / length), length, lengths[(long_index + 1) % 4]


def frontage_axis(point: Any, roads: gpd.GeoDataFrame) -> tuple[float, float]:
  """The forecourt axis of a node-only filling station.

  A canopy stands across the street it serves, not along it: the mapped
  Esso roof on Lessingstraße runs exactly perpendicular to the street. So
  take the bearing of the nearest frontage road and turn it a quarter turn.
  """
  distances = roads.distance(point)
  road = roads.loc[distances.idxmin()].geometry
  offset = road.project(point)
  before = road.interpolate(max(0.0, offset - 8.0))
  after = road.interpolate(min(road.length, offset + 8.0))
  dx = after.x - before.x
  dy = -(after.y - before.y)
  length = math.hypot(dx, dy)
  if length == 0:
    return (1.0, 0.0)
  # Quarter turn: (x, z) -> (-z, x).
  return (-dy / length, dx / length)


def build_fuel_stations(
  pois: gpd.GeoDataFrame, roads: gpd.GeoDataFrame, bounds: Any
) -> list[dict[str, Any]]:
  """Filling stations with the axis their canopy and pump islands follow.

  OSM maps the position, the brand and the fuel grades; only one of the
  three sites in the bounds carries a footprint. The canopy, the islands
  and the price totem are therefore drawn to a standard forecourt and
  flagged, so the viewer can mark them as extrapolated.
  """
  frontage = roads[
    roads["highway"].isin(FUEL_FRONTAGE_HIGHWAYS)
    & roads.geometry.geom_type.isin(["LineString", "MultiLineString"])
  ]
  stations: list[dict[str, Any]] = []
  for _, row in pois[pois["amenity"] == "fuel"].iterrows():
    geometry = row.geometry
    if geometry is None or geometry.is_empty:
      continue
    centroid = geometry.centroid
    if not bounds.contains(centroid):
      continue
    if geometry.geom_type in ("Polygon", "MultiPolygon"):
      axis, along_m, across_m = rectangle_axis(geometry)
      surveyed = True
      width_dm = round(along_m * 10)
      depth_dm = round(across_m * 10)
    else:
      axis = frontage_axis(centroid, frontage)
      surveyed = False
      width_dm = FUEL_DEFAULT_WIDTH_DM
      depth_dm = FUEL_DEFAULT_DEPTH_DM
    name = row.get("name")
    stations.append(
      {
        "axis": [round(axis[0], 4), round(axis[1], 4)],
        "d_dm": depth_dm,
        "name": name if isinstance(name, str) else "",
        "surveyed_outline": surveyed,
        "w_dm": width_dm,
        "x_dm": round((centroid.x - ORIGIN_EASTING) * 10),
        "z_dm": round((ORIGIN_NORTHING - centroid.y) * 10),
      }
    )
  stations.sort(key=lambda entry: (entry["x_dm"], entry["z_dm"]))
  return stations


def build_payload(
  bounds_path: Path, osm_path: Path, scene_path: Path
) -> dict[str, Any]:
  verify_scene_origin(scene_path)
  bounds = project_geometry(load_bounds_polygon(bounds_path))
  roads = gpd.read_file(osm_path, layer="roads")
  roads = roads.to_crs(epsg=25833)
  signals = roads[
    (roads["highway"] == "traffic_signals") & (roads.geometry.geom_type == "Point")
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

  # Monuments and memorials ("alle Denkmäler im Tiergarten"): points and
  # polygon footprints from the OSM POI layer. Polygons keep their bbox
  # size so footprint-aware renderers (the Stelenfeld) know their field.
  pois = gpd.read_file(osm_path, layer="pois").to_crs(epsg=25833)
  monuments: list[dict[str, Any]] = []
  for _, row in pois.iterrows():
    kind = monument_kind(row)
    if kind is None:
      continue
    name = row.get("name")
    name = name if isinstance(name, str) else ""
    if name in MONUMENT_SKIP_NAMES:
      continue
    # An unnamed sculpture is a dot on a map with nothing to recognise.
    if kind == "artwork" and not name:
      continue
    geometry = row.geometry
    if geometry is None or geometry.is_empty:
      continue
    centroid = geometry.centroid
    if not bounds.contains(centroid):
      continue
    min_x, min_y, max_x, max_y = geometry.bounds
    monuments.append(
      {
        "kind": kind,
        "name": name,
        "w_dm": round((max_x - min_x) * 10),
        "d_dm": round((max_y - min_y) * 10),
        "x_dm": round((centroid.x - ORIGIN_EASTING) * 10),
        "z_dm": round((ORIGIN_NORTHING - centroid.y) * 10),
      }
    )
  monuments.sort(key=lambda entry: (entry["x_dm"], entry["z_dm"]))

  return {
    "fuel_stations": build_fuel_stations(pois, roads, bounds),
    "monuments": monuments,
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
    f"Wrote {args.out} with {len(payload['traffic_signals_dm'])} traffic "
    f"signals and {len(payload['monuments'])} monuments"
  )


if __name__ == "__main__":
  main()
