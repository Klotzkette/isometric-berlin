"""Source-backed OSM shrub masses for the drawn Tiergarten."""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
from shapely.geometry import Point

from isometric_berlin.generation.build_minecraft_voxels import (
  ORIGIN_EASTING,
  ORIGIN_NORTHING,
)
from isometric_berlin.generation.build_surface_polygons import (
  GROSSER_TIERGARTEN_RELATION_ID,
  SCHEMA_VERSION,
  SCRUB_SPACING_M,
)

SURFACES = Path("src/app/public/mesh/regierungsviertel/surface-polygons.json")
OSM = Path("geo_data/regierungsviertel/osm.gpkg")


def test_mapped_scrub_inventory_and_samples_are_complete() -> None:
  payload = json.loads(SURFACES.read_text(encoding="utf-8"))
  assert payload["schema_version"] == SCHEMA_VERSION
  inventory = payload["scrub_inventory"]
  points = payload["scrub_points"]

  # The road/water exclusion removes twelve source polygons completely. Keep
  # the contract below the current 298 so a harmless boundary touch does not
  # make an otherwise identical source refresh fail.
  assert inventory["feature_count"] >= 295
  assert inventory["mapped_area_m2"] >= 200_000
  assert inventory["sampling_spacing_m"] == SCRUB_SPACING_M
  assert inventory["point_count"] == len(points)
  assert len(points) >= 1_400
  assert {point[4] for point in points} == {0, 1, 2}
  assert all(13 <= point[2] <= 23 for point in points)
  assert all(9 <= point[3] <= 20 for point in points)


def test_legacy_scrub_points_are_removed_only_inside_grosser_tiergarten() -> None:
  payload = json.loads(SURFACES.read_text(encoding="utf-8"))
  points = payload["scrub_points"]
  inventory = payload["scrub_inventory"]
  parks = gpd.read_file(OSM, layer="parks").to_crs(epsg=25833)
  tiergarten_rows = parks[
    (parks["element"] == "relation")
    & (parks["id"].astype(str) == GROSSER_TIERGARTEN_RELATION_ID)
  ]
  assert len(tiergarten_rows) == 1
  tiergarten = tiergarten_rows.geometry.iloc[0]

  official_points = [
    Point(
      ORIGIN_EASTING + point[0] / 10,
      ORIGIN_NORTHING - point[1] / 10,
    )
    for point in points
  ]
  assert not any(tiergarten.covers(point) for point in official_points)
  assert inventory["excluded_grosser_tiergarten_point_count"] == 732
  assert inventory["pre_tiergarten_filter_point_count"] == len(points) + 732
  # Stable sentinels on opposite sides of the expanded scope prove that the
  # old coarse layer remains unchanged outside relation/7643526.
  assert [2597, -34979, 15, 17, 0] in points
  assert [22760, 29040, 15, 20, 0] in points
