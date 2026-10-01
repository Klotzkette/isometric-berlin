"""Bounded outer outlines must retain streets, courtyards and source ownership."""

from __future__ import annotations

import base64
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import pytest
from shapely.geometry import LineString, Polygon, box

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build_surrounding_outlines import (  # noqa: E402
  COLORS,
  PackedMesh,
  chunk_payload,
  collect_sources,
  earcut_fallback,
  linear_rgb_bytes,
  native_polygon,
)


def decoded_positions(payload: dict) -> np.ndarray:
  """Decode the actual public typed-array format for independent area checks."""
  return (
    np.frombuffer(base64.b64decode(payload["positions"]), dtype="<u2").reshape(-1, 3)
    / 100
  )


def test_roof_triangulation_keeps_mapped_courtyard_and_upward_winding() -> None:
  courtyard = Polygon(
    [(5, 5), (25, 5), (25, 25), (5, 25)],
    holes=[[(10, 10), (20, 10), (20, 20), (10, 20)]],
  )
  mesh = PackedMesh(0, 0)
  mesh.surface(courtyard, 20, COLORS["roof"])
  payload = mesh.payload("building")
  positions = decoded_positions(payload)
  indices = np.frombuffer(base64.b64decode(payload["indices"]), dtype="<u4")
  triangles = positions[indices.reshape(-1, 3)]
  normals = np.cross(
    triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
  )
  assert (normals[:, 1] > 0).all()
  assert normals[:, 1].sum() / 2 == pytest.approx(courtyard.area)
  for triangle in triangles:
    polygon = Polygon(triangle[:, [0, 2]])
    assert polygon.intersection(box(10, 10, 20, 20)).area < 1e-9


def test_native_geometry_has_block_edges_and_preserves_large_open_court() -> None:
  source = Polygon(
    [(0.3, 0.3), (40.3, 7.3), (34.3, 40.3), (0.3, 40.3)],
    holes=[[(12, 12), (24, 12), (24, 24), (12, 24)]],
  )
  native = native_polygon(source)
  assert native.intersection(box(12, 12, 24, 24)).area == 0
  for ring in [native.exterior, *native.interiors]:
    for a, b in zip(ring.coords, list(ring.coords)[1:]):
      assert a[0] == b[0] or a[1] == b[1]
      assert all(value % 2 == 0 for value in a)


def test_authoritative_footprint_wins_without_dropping_uncovered_osm_house() -> None:
  areas = gpd.GeoDataFrame(
    [
      {
        "osm_way_id": "11",
        "building": "yes",
        "other_tags": '"height"=>"99"',
        "geometry": box(10, 10, 30, 30),
      },
      {
        "osm_way_id": "12",
        "building": "yes",
        "other_tags": '"height"=>"17"',
        "geometry": box(50, 50, 60, 60),
      },
    ],
    crs=25833,
  )
  official = [{"sourceId": "DEBE-test", "height": 23, "geometry": box(9, 9, 31, 31)}]
  lines = gpd.GeoDataFrame(geometry=[], crs=25833)
  buildings, _, inventory = collect_sources(lines, areas, box(0, 0, 100, 100), official)
  assert {record["sourceId"] for record in buildings} == {"DEBE-test", "OSM-way-12"}
  assert buildings[0]["height"] == 23
  assert buildings[1]["height"] == 17
  assert sum(inventory["heightEvidence"].values()) == 1


def test_actual_named_road_course_and_explicit_width_are_retained() -> None:
  course = LineString([(5, 10), (35, 10), (35, 45)])
  lines = gpd.GeoDataFrame(
    [
      {
        "osm_id": "123",
        "name": "Knaackstraße",
        "highway": "residential",
        "other_tags": '"width"=>"10"',
        "geometry": course,
      }
    ],
    crs=25833,
  )
  areas = gpd.GeoDataFrame(geometry=[], crs=25833)
  _, surfaces, inventory = collect_sources(lines, areas, box(0, 0, 100, 100), [])
  road = surfaces["road"][0]
  assert road.covers(course)
  assert road.intersection(LineString([(20, 0), (20, 20)])).length == pytest.approx(10)
  assert inventory["namedStreets"] == {"Knaackstraße": ["123"]}
  assert inventory["roadSources"][0]["widthSource"] == "width"


def test_chunk_geometry_and_navigation_leave_core_cutout_empty() -> None:
  tile = box(0, 0, 512, 512)
  ground = tile.difference(box(0, 0, 100, 512))
  source = {
    "sourceId": "fixture",
    "geometry": box(120, 20, 140, 40),
    "height": 13,
    "minHeight": 0,
    "heightSource": "fixture height",
  }
  payload = chunk_payload("0_0", tile, ground, [source], {}, minecraft=False)
  positions = decoded_positions(payload["meshes"][0])
  assert positions[:, 0].min() >= 100
  assert payload["origin"] == [0, -10, 0]
  assert payload["nav"]["groundY"] == 3
  assert len(payload["nav"]["buildings"]) == 1
  assert payload["nav"]["buildings"][0]["height"] == 13
  for polygon in payload["nav"]["ground"]:
    assert (
      Polygon(polygon["ring"], polygon["holes"]).intersection(box(0, 0, 100, 512)).area
      == 0
    )


def test_uint16_envelope_rejects_cross_chunk_overflow() -> None:
  mesh = PackedMesh(0, 0)
  with pytest.raises(ValueError, match="UInt16"):
    mesh.vertex((700, 0, 0), COLORS["ground"])


def test_independent_triangulation_fallback_keeps_concave_courtyard() -> None:
  source = Polygon(
    [(0, 0), (30, 0), (30, 10), (20, 10), (20, 30), (0, 30)],
    holes=[[(5, 5), (15, 5), (15, 15), (5, 15)]],
  )
  triangles = earcut_fallback(source)
  assert sum(triangle.area for triangle in triangles) == pytest.approx(source.area)
  assert all(triangle.difference(source).area < 1e-9 for triangle in triangles)


def test_display_palette_encodes_linear_vertex_rgb() -> None:
  assert linear_rgb_bytes(np.array([[0, 128, 255]])).tolist() == [[0, 55, 255]]
