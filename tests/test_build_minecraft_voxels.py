"""Checks for the committed Minecraft-mode voxel payload."""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import pytest

from isometric_berlin.generation.build_minecraft_voxels import (
  CLASSES,
  encode_ground_rows,
  inset_cells,
  snap_up,
  to_world,
)

PAYLOAD = Path("src/app/public/mesh/regierungsviertel/minecraft-voxels.json")
SCENE = Path("src/app/public/mesh/regierungsviertel/scene.json")
BOUNDS = Path("geo_data/regierungsviertel/bounds.geojson")
CELL_AREA_M2 = 4.0 * 4.0
CELL_M = 4.0

# Reichstag LoD2 footprint in world/scene coordinates (verified against the
# scene.json landmark at world [315.0, 8.0, 39.8]): x 266.5..367.5, z -29.5..110.3.
REICHSTAG_X_IDX = range(66, 92)
REICHSTAG_Z_IDX = range(-8, 28)


@pytest.fixture(scope="module")
def payload() -> dict:
  raw = PAYLOAD.read_text(encoding="utf-8")
  assert "NaN" not in raw
  return json.loads(raw)


def test_payload_is_small_and_versioned(payload: dict) -> None:
  assert PAYLOAD.exists()
  assert PAYLOAD.stat().st_size < 5 * 1024 * 1024
  assert payload["schema_version"] == 1
  assert payload["cell_m"] == 4.0
  assert payload["classes"] == CLASSES
  assert payload["classes"] == [
    "grass",
    "asphalt",
    "water",
    "concrete",
    "glass",
    "plazaBrick",
    "bridge",
  ]
  assert payload["origin"]["easting_offset"] == 389500.0
  assert payload["origin"]["northing_offset"] == 5820000.0
  assert payload["water_top_y_m"] == 1.31
  assert "OpenStreetMap" in payload["source"]["attribution"]
  assert "Geoportal Berlin" in payload["source"]["attribution"]


def test_building_columns_are_plausible(payload: dict) -> None:
  grid = payload["grid"]
  columns = payload["buildings"]
  assert len(columns) > 1_000
  x_lo, x_hi = grid["min_x_idx"], grid["min_x_idx"] + grid["cols"]
  z_lo, z_hi = grid["min_z_idx"], grid["min_z_idx"] + grid["rows"]
  class_count = len(payload["classes"])
  for x_idx, z_idx, y0_dm, y1_dm, class_id in columns:
    assert x_lo <= x_idx < x_hi
    assert z_lo <= z_idx < z_hi
    assert y1_dm > y0_dm
    assert (y1_dm - y0_dm) % 40 == 0, "column heights must be 4 m block multiples"
    assert 0 <= class_id < class_count
  # Palette split: mostly concrete with a real glass share (offices, station hall).
  concrete = sum(1 for column in columns if column[4] == 3)
  glass = sum(1 for column in columns if column[4] == 4)
  assert concrete > glass > 100


def test_ground_rows_cover_most_of_the_bounds_polygon(payload: dict) -> None:
  grid = payload["grid"]
  ground_rows = payload["ground_rows"]
  assert len(ground_rows) == grid["rows"]
  covered = 0
  for runs in ground_rows:
    previous_end = -1
    for x_start, run_length, class_id in runs:
      assert 0 <= class_id < len(payload["classes"])
      assert run_length > 0
      assert x_start > previous_end, "runs must be ordered and non-overlapping"
      previous_end = x_start + run_length - 1
      assert previous_end < grid["cols"]
      covered += run_length
  polygon = to_world(gpd.read_file(BOUNDS).to_crs(epsg=25833).geometry.union_all())
  expected_cells = polygon.area / CELL_AREA_M2
  assert covered > 0.5 * expected_cells
  assert covered <= grid["cols"] * grid["rows"]


def test_reichstag_area_has_tall_columns(payload: dict) -> None:
  reichstag = [
    column
    for column in payload["buildings"]
    if column[0] in REICHSTAG_X_IDX and column[1] in REICHSTAG_Z_IDX
  ]
  assert len(reichstag) > 100
  tall = [column for column in reichstag if column[3] - column[2] >= 200]
  assert len(tall) > 100, "Reichstag block must produce 20 m+ voxel columns"
  assert any(column[3] - column[2] >= 240 for column in reichstag), (
    "Reichstag (28.055 m LoD2 height) must snap up to 24 m+ columns"
  )


def test_tree_blocks_are_plausible(payload: dict) -> None:
  grid = payload["grid"]
  trees = payload["trees"]
  assert len(trees) > 1_000
  x_lo, x_hi = grid["min_x_idx"], grid["min_x_idx"] + grid["cols"]
  z_lo, z_hi = grid["min_z_idx"], grid["min_z_idx"] + grid["rows"]
  occupied = set()
  for x_idx, z_idx, y0_dm, height_dm in trees:
    assert x_lo <= x_idx < x_hi
    assert z_lo <= z_idx < z_hi
    assert -10 <= y0_dm <= 80, "tree ground must stay in the sampled terrain band"
    assert height_dm >= 80, "trees are at least 8 m (trunk + crown blocks)"
    assert height_dm % 40 == 0
    occupied.add((x_idx, z_idx))
  assert len(occupied) == len(trees), "one voxel tree per cell"


def test_ground_height_grid_matches_terrain_band(payload: dict) -> None:
  grid = payload["grid"]
  ground_height = payload["ground_height"]
  stride = ground_height["stride_cells"]
  assert ground_height["cols"] * stride >= grid["cols"]
  assert ground_height["rows"] * stride >= grid["rows"]
  values = ground_height["y_dm"]
  assert len(values) == ground_height["cols"] * ground_height["rows"]
  assert all(-10 <= value <= 80 for value in values)


def _landmark_world(name: str) -> tuple[float, float]:
  scene = json.loads(SCENE.read_text(encoding="utf-8"))
  for landmark in scene["landmarks"]:
    if landmark["name"] == name:
      return landmark["world"][0], landmark["world"][2]
  raise KeyError(name)


def _bridge_cell_centres(payload: dict) -> list[tuple[float, float]]:
  grid = payload["grid"]
  bridge_id = payload["classes"].index("bridge")
  centres: list[tuple[float, float]] = []
  for row_index, runs in enumerate(payload["ground_rows"]):
    centre_z = (grid["min_z_idx"] + row_index + 0.5) * CELL_M
    for x_start, run_length, class_id in runs:
      if class_id != bridge_id:
        continue
      for offset in range(run_length):
        centre_x = (grid["min_x_idx"] + x_start + offset + 0.5) * CELL_M
        centres.append((centre_x, centre_z))
  return centres


def test_bridge_class_reclaims_spree_crossings(payload: dict) -> None:
  assert "bridge" in payload["classes"]
  bridge_cells = _bridge_cell_centres(payload)
  assert len(bridge_cells) > 100, "Spree/Humboldthafen crossings must keep decks"
  # Each landmark sits at the bank end of its OSM bridge line, so the deck
  # cells over water lie within a 30 m box around the landmark position.
  for name in ("Moltkebrücke", "Gustav-Heinemann-Brücke"):
    landmark_x, landmark_z = _landmark_world(name)
    nearby = [
      (x, z)
      for x, z in bridge_cells
      if abs(x - landmark_x) <= 30.0 and abs(z - landmark_z) <= 30.0
    ]
    assert nearby, f"no bridge deck cells within 30 m of the {name} landmark"


def test_snap_up_quantises_to_blocks() -> None:
  assert snap_up(0.024) == 4
  assert snap_up(4.0) == 4
  assert snap_up(4.001) == 8
  assert snap_up(28.055) == 32
  assert snap_up(3.0, minimum_m=8.0) == 8


def test_encode_ground_rows_run_length() -> None:
  import numpy as np

  grid = np.array([[-1, 0, 0, 1, 1, 1, -1], [2, 2, -1, -1, 5, 0, 0]], dtype=np.int8)
  assert encode_ground_rows(grid) == [
    [[1, 2, 0], [3, 3, 1]],
    [[0, 2, 2], [4, 1, 5], [5, 2, 0]],
  ]


def test_inset_cells_requires_all_four_neighbours() -> None:
  block = {(x, z) for x in range(3) for z in range(3)}
  assert inset_cells(block) == {(1, 1)}
  assert inset_cells({(0, 0), (1, 0)}) == set()
