"""Measured geometry and mode-specific walking controls for the named park."""

import math

import pytest
from shapely import get_coordinates
from shapely.geometry import box, shape

from scripts.marzahn_garden_terrain_v330 import (
  ground_at,
  load_terrain,
  native_domain,
  terrain_height,
)


@pytest.fixture(scope="module")
def terrain():
  return load_terrain()


def test_cardinal_land_preserves_the_source_boundary_and_water_exclusion(terrain):
  scope, land, water, native, native_water = [
    shape(terrain[key])
    for key in ("scope", "land", "water", "nativeLand", "nativeWater")
  ]
  assert scope.symmetric_difference(land.union(water)).area < 1e-6
  assert land.intersection(water).area == 0
  assert native.difference(land).area == native_water.difference(water).area == 0
  assert native.intersection(native_water).area == 0
  assert all(
    x == math.floor(x) and z == math.floor(z)
    for x, z in get_coordinates(native.union(native_water))
  )
  assert terrain["sources"]["retained"]["areaM2"] == 0
  assert all(not row["overlaps"] for row in terrain["sources"]["retained"]["packets"])
  assert len(terrain["tileIds"]) == 13
  for native_mode in (False, True):
    assert ground_at(terrain, 14400, -915, native_mode) is None  # Wuhleteich
    assert (
      ground_at(terrain, 14975, -975, native_mode) is None
    )  # Outside the named park


def test_cardinal_union_keeps_every_complete_cell_at_a_partial_shared_edge(terrain):
  source = box(0, 0, 3, 1).union(box(0, 1, 2, 2)).union(box(1, 2, 2, 3))
  result = native_domain(source)
  assert result.is_valid
  assert result.equals(source)

  land, native = (shape(terrain[key]) for key in ("land", "nativeLand"))
  for z in range(-1460, -1452):
    cell = box(14278, z, 14279, z + 1)
    assert land.covers(cell)
    assert native.covers(cell)


def test_drawn_diagonal_and_native_midpoint_heights(terrain):
  grid = terrain["grid"]
  x, z = 14276, -1460
  column, row = (x - grid["origin"][0]) // 4, (z - grid["origin"][1]) // 4
  cols = grid["cols"]
  index = row * cols + column
  values = grid["heightsCm"]
  nw, ne, sw, se = (
    values[i] / 100 for i in (index, index + 1, index + cols, index + cols + 1)
  )
  assert terrain_height(terrain, x + 3, z + 1) == pytest.approx((nw + 2 * ne + se) / 4)
  assert terrain_height(terrain, x + 1, z + 3) == pytest.approx((nw + 2 * sw + se) / 4)
  assert terrain_height(terrain, x + 2, z + 2) == pytest.approx((nw + se) / 2)
  level = grid["nativeHeightsCm"][row * (cols - 1) + column] / 100
  assert terrain_height(terrain, x + 3, z + 1, True) == level
  assert terrain_height(terrain, x + 1, z + 3, True) == level
  assert ground_at(terrain, 13400, -1613) == pytest.approx(22.7975)
  assert ground_at(terrain, 14856, -975) == pytest.approx(25.6475)
  assert ground_at(terrain, 14278, -1457) == pytest.approx(71.9875)
  assert ground_at(terrain, 14278, -1457, True) == 72


def test_korean_pond_native_edge_is_visible_without_admitting_a_new_floor(terrain):
  """The boundary cell is rendered even though it is excluded from walking."""
  import base64

  import numpy as np
  from shapely.geometry import Point, Polygon

  from scripts.marzahn_garden_terrain_v330 import PUBLIC, read_json

  x, z = 14185.3, -1961.6
  point = Point(x, z)
  assert shape(terrain["scope"]).covers(box(14185, -1962, 14186, -1961))
  assert ground_at(terrain, x, z, native=True) is None

  visible = False
  for path in PUBLIC.glob("gardens330-27_-4*.minecraft.json.gz"):
    packet = read_json(path)
    ox, _, oz = packet["origin"]
    for row in packet["nav"]["ground"]:
      assert not Polygon(row["ring"], row["holes"]).covers(Point(x - ox, z - oz))
    for mesh in packet["meshes"]:
      if mesh["kind"] != "gardens-ground-v330":
        continue
      vertices = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(
        -1, 3
      )
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      faces = vertices[indices][:, :, [0, 2]] / 100 + [ox, oz]
      candidates = (
        (faces[:, :, 0].min(axis=1) <= x)
        & (faces[:, :, 0].max(axis=1) >= x)
        & (faces[:, :, 1].min(axis=1) <= z)
        & (faces[:, :, 1].max(axis=1) >= z)
      )
      visible |= any(Polygon(face).covers(point) for face in faces[candidates])
  assert visible
