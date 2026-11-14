"""Finite-site source, independent terrain, roof and emitted-packet guarantees."""

from __future__ import annotations

import base64
import gzip
import json
import os
from pathlib import Path

import numpy as np
import pytest
from shapely import make_valid
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

from scripts.britzer_garten_geometry_v342 import CAFE, measured_buildings
from scripts.marzahn_garden_landmarks_v330 import Garden
from scripts.marzahn_garden_terrain_v330 import load_terrain, terrain_height

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/britzer-garten-v342-source.json.gz"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
STAGE = Path(os.environ.get("BRITZER_V342_STAGE", str(PUBLIC)))


@pytest.fixture(scope="module")
def source():
  return load_terrain(SOURCE)


def test_finite_named_scope_preserves_old_owners(source):
  parks = source["sources"]["gris"]["parks"]
  assert {r["id"] for r in parks} == {"00008100:000a6b88", "00008100:0012db81"}
  actual = unary_union([shape(r["geometry"]) for r in parks])
  assert actual.symmetric_difference(shape(source["scope"])).area < 1e-6
  assert actual.area == pytest.approx(867572.1351414677)
  assert source["sources"]["retained"]["areaM2"] == 0
  assert all(not r["overlaps"] for r in source["sources"]["retained"]["packets"])
  assert len(source["tileIds"]) == 12


def test_water_and_island_voids_are_source_bound(source):
  names = {
    r["tags"].get("name"): r
    for r in source["osm"]["records"]
    if r["layer"] == "multipolygons"
  }
  for name in ("Hauptsee", "Südsee", "Ostsee", "Irissee", "Kopfweidenpfuhl"):
    p = shape(names[name]["geometry"]).intersection(shape(source["scope"]))
    assert p.area > 100
    assert p.difference(shape(source["water"])).area < 1e-6
  island = shape(names["Liebesinsel"]["geometry"])
  assert island.intersection(shape(source["land"])).area > island.area * 0.99
  assert shape(source["land"]).intersection(shape(source["water"])).area < 1e-6
  # Line-layer osm_id values are ways, not relations (GDAL source_identity caveat).
  assert all(
    r["id"].startswith("way/")
    for r in source["osm"]["records"]
    if r["layer"] == "lines"
  )


def test_independent_native_terrain_and_exact_drawn_planes(source):
  grid = source["grid"]
  cols, rows = grid["cols"], grid["rows"]
  assert len(grid["heightsCm"]) == cols * rows
  assert len(grid["nativeHeightsCm"]) == (cols - 1) * (rows - 1)
  assert min(grid["heightsCm"]) == 610
  assert max(grid["heightsCm"]) == 3308
  heights = np.array(grid["heightsCm"]).reshape(rows, cols) / 100
  native = np.array(grid["nativeHeightsCm"]).reshape(rows - 1, cols - 1) / 100
  assert np.any(np.abs(native - heights[:-1, :-1]) > 0.05)
  for i, j in [(90, 210), (160, 220), (200, 160), (300, 100)]:
    x, z = grid["origin"][0] + i * 4, grid["origin"][1] + j * 4
    assert terrain_height(source, x, z) == pytest.approx(heights[j, i])
    assert terrain_height(source, x + 1, z + 2, True) == pytest.approx(native[j, i])
    assert terrain_height(source, x + 3, z + 3.5, True) == pytest.approx(native[j, i])
  assert shape(source["nativeLand"]).difference(shape(source["land"])).area < 1e-5


def test_cafe_uses_complete_measured_shell_and_cardinal_roof_navigation(source):
  row = next(r for r in source["lod2"]["buildings"] if r["id"] == CAFE)
  narrow = {**source, "lod2": {"buildings": [row]}}
  native = Garden(
    {"park": source["scope"]}, lambda x, z: terrain_height(source, x, z, True), True
  )
  drawn = Garden(
    {"park": source["scope"]}, lambda x, z: terrain_height(source, x, z), False
  )
  _, account = measured_buildings(narrow, drawn)
  assert account == [{"id": CAFE, "status": "complete-LoD2-shell", "role": "cafe"}]
  # Every original surveyed sheet remains as a member of the drawing.
  from scripts.build_breitscheid_towers_v161 import triangles_for

  source_triangles = [
    t for surface in row["surfaces"] for t in triangles_for(surface["rings"])
  ]
  assert len(source_triangles) > 40
  assert [
    tri for tri, _ in drawn.triangles[: len(source_triangles)]
  ] == source_triangles
  measured_buildings(narrow, native)
  assert native.solids
  caps = native.roof_navigation[CAFE]["nativeRoofCaps"]
  assert len(caps) > 400
  assert len({round(c[4], 1) for c in caps}) > 4
  for _, poly, lo, height in native.solids:
    assert height > 0
    for ring in [poly.exterior, *poly.interiors]:
      for a, b in zip(ring.coords, list(ring.coords)[1:]):
        assert abs(a[0] - b[0]) < 1e-7 or abs(a[1] - b[1]) < 1e-7
    assert lo == row["ground_y_m"]
  assert len(native.triangles) != len(drawn.triangles)


def test_staged_packets_keep_limits_and_match_walk_heights(source):
  paths = sorted(STAGE.glob("britzer342-*.json.gz"))
  assert paths, f"Run scoped staging first or integrate generated park assets: {STAGE}"
  for path in paths:
    packed = path.read_bytes()
    raw = gzip.decompress(packed)
    data = json.loads(raw)
    assert len(packed) <= 650000
    assert len(raw) <= 2600000
    native = ".minecraft." in path.name
    for mesh in data["meshes"]:
      p = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(-1, 3)
      c = np.frombuffer(base64.b64decode(mesh["colors"]), dtype=np.uint8).reshape(-1, 3)
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4")
      assert len(p) == len(c)
      assert len(indices) % 3 == 0
      assert indices.max(initial=0) < len(p)
      assert len(p) <= 250000
    if "gardenTerrainV330" not in data:
      continue
    side = 128 if native else 129
    grid = (
      np.frombuffer(base64.b64decode(data["gardenTerrainV330"]), dtype="<i2").reshape(
        side, side
      )
      / 100
    )
    ox, _, oz = data["origin"]
    for row, col in [(25, 40), (70, 78), (90, 30)]:
      x, z = ox + col * 4, oz + row * 4
      height = terrain_height(source, x, z, native)
      if height is not None:
        assert grid[row, col] == pytest.approx(height)
    # The existing centimetre serializer can collapse tiny boundary returns.
    # Canonicalize their planar interpretation without changing packet points;
    # Independently rounded lake/ground/bridge edges can meet in a 1.5cm band.
    def canonical(records):
      result = []
      for row in records:
        original = Polygon(row["ring"], row["holes"])
        valid = make_valid(original)
        assert abs(valid.area - original.area) < 0.06
        result.append(valid)
      return unary_union(result)

    dry = canonical(data["nav"]["ground"])
    wet = canonical(data["nav"]["water"])
    bridges = unary_union(
      [Polygon(r["ring"], r["holes"]) for r in data["nav"].get("bridges", [])]
    )
    overlap = dry.intersection(wet).difference(bridges)
    assert overlap.area < 0.05
    edge_band = unary_union([wet.boundary, bridges.boundary]).buffer(0.015)
    assert overlap.difference(edge_band).area < 1e-8
