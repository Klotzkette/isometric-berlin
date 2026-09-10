"""Protect the source edges and open crossings of the bounded avenue repair."""

from __future__ import annotations

import hashlib
from itertools import combinations
from pathlib import Path

import geopandas as gpd
import pytest
from shapely.geometry import Point
from shapely.ops import unary_union

from scripts.brandenburg_approach import (
  ALKIS,
  AVENUE_DISPLAY_WIDTH_M,
  MEDIAN_GRASS_IDS,
  OSM,
  PARCEL_IDS,
  _authored_gardens,
  build_brandenburg_approach,
)


@pytest.fixture(scope="module")
def source_frames() -> tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
  return (
    gpd.read_file(OSM, layer="roads").to_crs(epsg=25833),
    gpd.read_file(OSM, layer="parks").to_crs(epsg=25833),
  )


@pytest.fixture(scope="module")
def approach(source_frames: tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]) -> dict:
  return build_brandenburg_approach(*source_frames)


def at_world(x: float, z: float) -> Point:
  return Point(389500 + x, 5820000 - z)


def test_source_scope_joins_exact_parcels_to_friedrichstrasse(approach: dict) -> None:
  parcels = gpd.read_file(ALKIS, layer="flurstuecke").to_crs(epsg=25833)
  west = unary_union(parcels[parcels["uuid"].isin(PARCEL_IDS)].geometry.tolist())
  assert west.difference(approach["scope"]).area < 1e-6
  plaza = parcels[parcels["uuid"] == PARCEL_IDS[0]].geometry.iloc[0]
  assert approach["plaza_scope"].equals(plaza)
  assert approach["scope"].geom_type == "Polygon"
  for x, z in ((500, 294), (580, 287), (700, 280), (900, 260), (1175, 236)):
    assert approach["scope"].covers(at_world(x, z))
  # The narrow source corridor cannot swallow embassy courtyards or continue
  # indefinitely east of the selected Friedrichstraße junction.
  for x, z in ((500, 200), (700, 220), (900, 320), (1220, 230)):
    assert not approach["scope"].covers(at_world(x, z))


def test_all_surface_classes_partition_scope_without_hiding_gardens(
  approach: dict,
  source_frames: tuple[gpd.GeoDataFrame, gpd.GeoDataFrame],
) -> None:
  roads, parks = source_frames
  classes = [approach[key] for key in ("asphalt", "paving", "gravel", "grass")]
  assert all(geometry.is_valid for geometry in classes)
  assert unary_union(classes).symmetric_difference(approach["scope"]).area < 1e-6
  for left, right in combinations(classes, 2):
    assert left.intersection(right).area < 1e-6
  original_gravel = roads[roads["id"] == "915958593"].geometry.iloc[0]
  assert approach["gravel"].symmetric_difference(original_gravel).area < 1e-6
  for geometry in parks[parks["id"].isin(MEDIAN_GRASS_IDS)].geometry:
    assert geometry.difference(approach["grass"]).area < 1e-6
  assert _authored_gardens().difference(approach["grass"]).area < 1e-6
  assert _authored_gardens().intersection(approach["paving"]).area < 1e-6
  # Both source pedestrian polygons retain their paving identity.
  for source_id in ("24240315", "915958607"):
    geometry = roads[roads["id"] == source_id].geometry.iloc[0]
    safe_paving = geometry.difference(approach["grass"].union(approach["gravel"]))
    assert safe_paving.difference(approach["paving"]).area < 1e-6
    assert geometry.intersection(approach["asphalt"]).area < 1e-6
  assert 0 < approach["source"]["mapped_surface_overlap_m2"] < 1


def test_avenue_widths_keep_evidence_without_lane_split_steps(approach: dict) -> None:
  widths = approach["source"]["road_widths"]
  avenue = [row for row in widths if row["name"] == "Unter den Linden"]
  inferred = [row for row in avenue if row["display_width_inference"]]
  assert len(inferred) >= 12
  assert {row["source_width_m"] for row in inferred} == {6.5, 9.75}
  assert {row["display_width_m"] for row in inferred} == {AVENUE_DISPLAY_WIDTH_M}
  west = {row["id"]: row for row in avenue if row["source_width_evidence"] == "width"}
  for source_id in ("24240245", "30805074", "1476805843"):
    assert west[source_id]["source_width_m"] == 11
    assert west[source_id]["display_width_m"] == 11
    assert not west[source_id]["display_width_inference"]


def test_curbs_leave_plaza_junctions_and_scope_cuts_open(approach: dict) -> None:
  curb = approach["curbs"]
  assert curb.is_valid and curb.length > 1500
  assert curb.difference(approach["scope"]).length < 1e-6
  assert curb.intersection(approach["scope"].boundary.buffer(0.29)).length < 1e-6
  # Broad central plaza circulation and the four crossing traffic axes remain
  # free of transverse kerbs; the existing garden edging is authored elsewhere.
  for x, z in (
    (497, 294),
    (541.77, 304.65),
    (624.57, 267.23),
    (632.25, 297.83),
    (842.52, 248.32),
    (845.1, 279.61),
    (966.31, 237.92),
    (969.82, 269.32),
    (1173.09, 220.77),
  ):
    assert curb.intersection(at_world(x, z).buffer(2)).length < 1e-6


def test_provenance_records_both_sources_and_geometry_inferences(
  approach: dict,
) -> None:
  source = approach["source"]
  for key, path in (("osm_sha256", OSM), ("alkis_sha256", ALKIS)):
    assert source[key] == hashlib.sha256(Path(path).read_bytes()).hexdigest()
  assert source["alkis_parcel_uuids"] == list(PARCEL_IDS)
  assert "display inference" in source["width_conflict"]
  assert "not a cadastral extension or paving survey" in source["scope_policy"]
  assert "915958607" in {row["id"] for row in source["osm_polygon_surfaces"]}
  assert approach["markings_exclusion"].equals(approach["scope"])
