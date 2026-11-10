"""Build the real named landmark source against the measured terrain in both modes."""

import json
from functools import partial
from pathlib import Path

import numpy as np
import pytest
import shapely
from shapely.geometry import Point, shape

from scripts.marzahn_garden_landmarks_v330 import build_garden_landmarks
from scripts.marzahn_garden_terrain_v330 import load_terrain, terrain_height

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/marzahn-garden-landmarks-v330.json"


@pytest.fixture(scope="module")
def source():
  return json.loads(SOURCE.read_text())


@pytest.fixture(scope="module", params=(False, True), ids=("drawn", "native"))
def mode_geometry(source, request):
  ground = partial(terrain_height, load_terrain(), native=request.param)
  triangles, solids = build_garden_landmarks(source, ground, request.param)
  return request.param, ground, triangles, solids


def test_four_measured_oriental_parts_and_exact_duplicate_owners(source):
  ids = set(source["ownedAreas"])
  assert "DEBE10YYS00005jf" in ids
  assert "DEBE10YYS0000Vlj" not in ids
  assert len(source["loD2Reception"]["parts"]) == 4
  assert len(ids) == 10
  for identity in (key for key in ids if key.startswith("way/")):
    assert source["ownedAreas"][identity] == source["osm"][identity]["geometry"]


def test_mode_geometry_and_solid_bounds(source, mode_geometry):
  native, _, triangles, solids = mode_geometry
  park = shape(source["park"])
  points = np.asarray([vertices for vertices, _ in triangles])
  bounds = shapely.points(points[:, :, (0, 2)].reshape(-1, 2))
  assert shapely.covers(park, bounds).all()
  assert np.isfinite(points).all()
  assert 20000 <= len(triangles) <= 55000
  assert 300 <= len(solids) <= 520
  assert len({identity for identity, *_ in solids}) == len(solids)
  assert all(
    park.covers(footprint) and height > 0 for _, footprint, _, height in solids
  )
  assert {identity.split(":")[0] for identity, *_ in solids} == {
    "oriental-v330",
    "japanese-v330",
    "korean-v330",
    "maze-v330",
  }
  cardinal = np.any(np.ptp(points, axis=1) < 1e-8, axis=1)
  assert cardinal.all() if native else not cardinal.all()


def test_hedges_keep_all_mapped_maze_routes_and_entrances_open(source, mode_geometry):
  _, _, _, solids = mode_geometry
  maze = source["maze"]
  walls = shapely.union_all(
    [p for identity, p, _, _ in solids if identity.startswith("maze-v330:yew:")]
  )
  axes = shapely.union_all(
    [shape(source["osm"][f"way/{i}"]["geometry"]) for i in maze["pathsOsm"]]
  )
  assert walls.area > 700
  assert walls.distance(axes) > 0.45
  assert all(walls.distance(Point(entry)) > 1.0 for entry in maze["entries"])


def test_paving_stays_above_the_actual_terrain_inside_triangles(mode_geometry):
  _, ground, triangles, _ = mode_geometry
  checked = 0
  floor_colors = {
    (213, 211, 194),  # Japanese dry gravel
    (177, 171, 150),  # Japanese approach
    (198, 181, 149),  # Korean courtyards
    (200, 183, 151),
    (202, 185, 153),
    (179, 172, 157),  # Hedge maze paths
    (204, 201, 192),  # Circular labyrinth
  }
  for triangle, color in triangles:
    if color not in floor_colors:
      continue
    x, y, z = np.mean(triangle, axis=0)
    assert y > ground(x, z) + 0.04
    checked += 1
  assert checked > 500
