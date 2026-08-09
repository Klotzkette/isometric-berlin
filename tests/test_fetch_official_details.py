"""Tests for bounded official Berlin detail-data normalization."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import geopandas as gpd
from shapely.geometry import LineString, MultiPoint, Point

from isometric_berlin.data.fetch_official_details import (
  LIGHT_LAYER,
  normalized_lights,
  normalized_trees,
  wfs_params,
  write_layers,
)


def test_wfs_params_keep_metric_bbox_and_type_name() -> None:
  params = wfs_params(LIGHT_LAYER, (1.0, 2.0, 3.0, 4.0))
  assert params["TYPENAMES"] == "beleuchtung:beleuchtung"
  assert params["SRSNAME"] == "EPSG:25833"
  assert params["BBOX"] == "1.000,2.000,3.000,4.000,EPSG:25833"


def test_tree_catalogues_retain_measured_dimensions() -> None:
  frame = gpd.GeoDataFrame(
    [
      {
        "gisid": "tree-1",
        "art_dtsch": "Linde",
        "art_bot": "Tilia",
        "art_gruppe": "Laubbäume",
        "baumhoehe": 14.5,
        "kronedurch": 9.0,
        "stammumfg": 120,
        "pflanzjahr": "1975",
        "eigentuemer": "Land Berlin",
        "geometry": Point(389000, 5820000),
      }
    ],
    crs="EPSG:25833",
  )
  result = normalized_trees([frame, frame.iloc[0:0]])
  assert result.iloc[0]["tree_id"] == "tree-1"
  assert result.iloc[0]["height_m"] == 14.5
  assert result.iloc[0]["crown_diameter_m"] == 9.0
  assert result.iloc[0]["catalogue"] == "anlagenbaum"


def test_lighting_multipoints_are_exploded() -> None:
  frame = gpd.GeoDataFrame(
    [
      {
        "id": 42,
        "leuchtstelle": "00001-1",
        "status": "In Betrieb",
        "strasse": "Teststraße",
        "rotation": 15.0,
        "leuchtentyp": "Lichtmast mit Aufsatzleuchte",
        "symbolnr": 1,
        "geometry": MultiPoint([(389000, 5820000), (389001, 5820001)]),
      }
    ],
    crs="EPSG:25833",
  )
  result = normalized_lights(frame)
  assert len(result) == 2
  assert set(result["light_id"]) == {"42"}
  assert set(result.geom_type) == {"Point"}


def test_canonical_package_omits_optional_spatial_indexes(tmp_path: Path) -> None:
  trees = gpd.GeoDataFrame(
    [{"tree_id": "1", "geometry": Point(389000, 5820000)}],
    crs="EPSG:25833",
  )
  lights = gpd.GeoDataFrame(
    [{"light_id": "1", "geometry": Point(389001, 5820001)}],
    crs="EPSG:25833",
  )
  wall = gpd.GeoDataFrame(
    [
      {
        "wall_id": "1",
        "geometry": LineString([(389000, 5820000), (389010, 5820010)]),
      }
    ],
    crs="EPSG:25833",
  )
  output = tmp_path / "details.gpkg"

  write_layers(trees, lights, wall, output)

  with sqlite3.connect(output) as connection:
    spatial_indexes = connection.execute(
      "SELECT name FROM sqlite_schema WHERE name LIKE 'rtree_%'"
    ).fetchall()
  assert spatial_indexes == []
  assert len(gpd.read_file(output, layer="trees")) == 1
  assert len(gpd.read_file(output, layer="street_lights")) == 1
  assert len(gpd.read_file(output, layer="berlin_wall")) == 1
