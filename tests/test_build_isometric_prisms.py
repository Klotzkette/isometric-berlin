"""Checks for the committed drawn-isometric LoD2 prism payload."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from shapely.geometry import LinearRing

from isometric_berlin.generation.build_isometric_prisms import (
  CLASSES,
  MIN_RING_POINTS,
  quantise_ring,
)

PAYLOAD = Path("src/app/public/mesh/regierungsviertel/lod2-prisms.json")
VOXELS = Path("src/app/public/mesh/regierungsviertel/minecraft-voxels.json")

# Reichstag LoD2 footprint in world/scene coordinates (verified against the
# scene.json landmark at world [315.0, 8.0, 39.8]): x 266.5..367.5,
# z -29.5..110.3 — here in payload decimetres.
REICHSTAG_X_DM = (2640, 3680)
REICHSTAG_Z_DM = (-300, 1110)


@pytest.fixture(scope="module")
def payload() -> dict:
  raw = PAYLOAD.read_text(encoding="utf-8")
  assert "NaN" not in raw
  return json.loads(raw)


@pytest.fixture(scope="module")
def grid_dm() -> dict[str, int]:
  """Scene grid bounds in decimetres from the committed voxel payload."""
  grid = json.loads(VOXELS.read_text(encoding="utf-8"))["grid"]
  cell_dm = 40  # voxel grid cells are 4 m; payload coordinates are dm
  return {
    "x_lo": grid["min_x_idx"] * cell_dm,
    "x_hi": (grid["min_x_idx"] + grid["cols"]) * cell_dm,
    "z_lo": grid["min_z_idx"] * cell_dm,
    "z_hi": (grid["min_z_idx"] + grid["rows"]) * cell_dm,
  }


def test_payload_is_small_and_versioned(payload: dict) -> None:
  assert PAYLOAD.exists()
  assert PAYLOAD.stat().st_size < 5 * 1024 * 1024
  assert payload["schema_version"] == 1
  assert payload["classes"] == CLASSES
  assert payload["origin"]["easting_offset"] == 389500.0
  assert payload["origin"]["northing_offset"] == 5820000.0
  assert payload["origin"]["height_unit"] == "decimetres"
  assert "OpenStreetMap" in payload["source"]["attribution"]
  assert "Geoportal Berlin" in payload["source"]["attribution"]
  assert "dl-de/zero-2-0" in payload["source"]["licenses"]["lod2_buildings"]


def test_carries_the_full_lod2_building_stock(payload: dict) -> None:
  assert len(payload["buildings"]) > 2_000


def test_rings_are_valid_and_inside_the_scene_grid(
  payload: dict, grid_dm: dict[str, int]
) -> None:
  class_count = len(payload["classes"])
  for building in payload["buildings"]:
    assert len(building["id"]) == 8
    assert 0 <= building["class"] < class_count
    assert building["h_dm"] > 0
    assert isinstance(building["y0_dm"], int)
    assert isinstance(building["roof"], int)
    for ring in [building["ring"], *building["holes"]]:
      assert len(ring) >= 3
      first, last = ring[0], ring[-1]
      assert first != last, "rings ship open — closing vertex is omitted"
      for x_dm, z_dm in ring:
        assert isinstance(x_dm, int) and isinstance(z_dm, int)
        assert grid_dm["x_lo"] <= x_dm <= grid_dm["x_hi"]
        assert grid_dm["z_lo"] <= z_dm <= grid_dm["z_hi"]


def test_reichstag_prism_with_courtyards(payload: dict) -> None:
  def in_box(building: dict) -> bool:
    return all(
      REICHSTAG_X_DM[0] <= x_dm <= REICHSTAG_X_DM[1]
      and REICHSTAG_Z_DM[0] <= z_dm <= REICHSTAG_Z_DM[1]
      for x_dm, z_dm in building["ring"]
    )

  box_entries = [b for b in payload["buildings"] if in_box(b)]
  assert box_entries, "Reichstag block must survive simplification"
  assert any(b["h_dm"] >= 240 for b in box_entries), (
    "Reichstag (28.055 m LoD2 height) must keep its true 28 m prism height"
  )
  assert any(len(b["holes"]) >= 1 for b in box_entries), (
    "Reichstag courtyards must ship as interior rings"
  )


def test_heights_are_true_not_snapped(payload: dict) -> None:
  # Snapped voxel heights are all 40 dm multiples; true LoD2 heights are not.
  assert any(b["h_dm"] % 40 != 0 for b in payload["buildings"])


def test_palette_split_matches_voxel_mode(payload: dict) -> None:
  concrete = sum(1 for b in payload["buildings"] if b["class"] == 0)
  glass = sum(1 for b in payload["buildings"] if b["class"] == 1)
  assert concrete > glass > 10


def test_quantise_ring_drops_closing_vertex_and_duplicates() -> None:
  ring = LinearRing([(0.0, 0.0), (10.04, 0.0), (10.0, 0.0), (10.0, 10.0)])
  assert quantise_ring(ring) == [[0, 0], [100, 0], [100, 100]]


def test_quantise_ring_rejects_degenerate_rings() -> None:
  collapsed = LinearRing([(0.0, 0.0), (0.04, 0.0), (0.0, 0.04)])
  assert MIN_RING_POINTS == 3
  assert quantise_ring(collapsed) is None
