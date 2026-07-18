"""Checks for the committed drawn-isometric LoD2 prism payload."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from shapely.geometry import LinearRing, Point, Polygon

from isometric_berlin.generation.build_isometric_prisms import (
  CLASSES,
  MIN_RING_POINTS,
  OVERVIEW_LANDMARK_HEIGHT_M,
  TONE_MAX_SAMPLES,
  TONE_MIN_SAMPLES,
  footprint_sample_points,
  overview_canvas_px,
  overview_projection,
  quantise_ring,
)

PAYLOAD = Path("src/app/public/mesh/regierungsviertel/lod2-prisms.json")
VOXELS = Path("src/app/public/mesh/regierungsviertel/minecraft-voxels.json")
BOUNDS = Path("geo_data/regierungsviertel/bounds.geojson")
LANDMARKS_GEOJSON = Path("geo_data/regierungsviertel/landmarks.geojson")
LANDMARKS_JSON = Path("src/app/public/dzi/regierungsviertel/landmarks.json")

# LoD2 building id of the Reichstag main body (verified: single prism carrying
# the courtyard holes, 28.1 m measured height).
REICHSTAG_ID = "K0002MCN"
# The Bundeskanzleramt Leadership Building cube: the one LoD2 prism containing
# this scene world (x, z) point (id MLwG4KW9, 39.9 m measured height).
KANZLERAMT_WORLD_XZ = (-153.9, -145.8)
KANZLERAMT_ID = "MLwG4KW9"

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


def entry_polygon(building: dict) -> Polygon:
  """Rebuild the world-metre footprint polygon from payload decimetres."""
  return Polygon(
    [(x_dm / 10.0, z_dm / 10.0) for x_dm, z_dm in building["ring"]],
    [[(x_dm / 10.0, z_dm / 10.0) for x_dm, z_dm in hole] for hole in building["holes"]],
  )


def tone_luma(tone: list[int]) -> float:
  return tone[0] * 0.2126 + tone[1] * 0.7152 + tone[2] * 0.0722


def test_overview_projection_matches_committed_landmarks() -> None:
  """The tone-sampling transform IS the transform of the committed overview.

  Re-project known landmark world positions with the module's projection and
  compare against the committed landmarks.json canvas pixels (which
  landmark_records wrote at 18 m elevation).
  """
  gpd = pytest.importorskip("geopandas")
  projection = overview_projection(BOUNDS)
  committed = {
    record["name"]: record
    for record in json.loads(LANDMARKS_JSON.read_text(encoding="utf-8"))["landmarks"]
  }
  landmarks = gpd.read_file(LANDMARKS_GEOJSON).to_crs("EPSG:25833")
  for name in ("Reichstagsgebäude", "Bundeskanzleramt", "Berlin Hauptbahnhof"):
    row = landmarks[landmarks["name"] == name].iloc[0]
    px, py = overview_canvas_px(
      row.geometry.x - 389500.0,
      5820000.0 - row.geometry.y,
      projection,
      height_m=OVERVIEW_LANDMARK_HEIGHT_M,
    )
    record = committed[name]
    assert abs(px - record["x"]) <= 3, f"{name} x: {px} vs {record['x']}"
    assert abs(py - record["y"]) <= 3, f"{name} y: {py} vs {record['y']}"


def test_most_prisms_carry_a_real_colour_tone(payload: dict) -> None:
  buildings = payload["buildings"]
  toned = [b for b in buildings if "tone" in b]
  assert len(toned) > 0.8 * len(buildings)
  for building in toned:
    tone = building["tone"]
    assert len(tone) == 3
    assert all(isinstance(channel, int) and 0 <= channel <= 255 for channel in tone)


def test_reichstag_tone_is_greyish(payload: dict) -> None:
  entries = [b for b in payload["buildings"] if b["id"] == REICHSTAG_ID]
  assert entries, "Reichstag main body must ship"
  tone = max(entries, key=lambda b: b["h_dm"])["tone"]
  assert max(tone) - min(tone) < 60, f"channel spread too wide for grey: {tone}"
  assert 60 < tone_luma(tone) < 190, f"luma outside grey band: {tone}"
  assert tone[0] - tone[2] < 40, f"tone reads warm yellow, not stone grey: {tone}"


def test_kanzleramt_tone_is_light(payload: dict) -> None:
  target = Point(*KANZLERAMT_WORLD_XZ)
  hits = [b for b in payload["buildings"] if entry_polygon(b).contains(target)]
  assert [b["id"] for b in hits] == [KANZLERAMT_ID]
  tone = hits[0]["tone"]
  assert tone_luma(tone) > 140, f"Kanzleramt must read light: {tone}"


def test_footprint_sample_points_refine_and_cap() -> None:
  tiny = Polygon([(0.0, 0.0), (2.0, 0.0), (2.0, 1.0), (0.0, 1.0)])  # 2 m² sliver
  tiny_points = footprint_sample_points(tiny)
  assert len(tiny_points) >= TONE_MIN_SAMPLES
  large = Polygon([(0.0, 0.0), (100.0, 0.0), (100.0, 100.0), (0.0, 100.0)])
  large_points = footprint_sample_points(large)
  assert len(large_points) <= TONE_MAX_SAMPLES
  # Deterministic: same polygon, same grid.
  assert (footprint_sample_points(large) == large_points).all()


def test_quantise_ring_drops_closing_vertex_and_duplicates() -> None:
  ring = LinearRing([(0.0, 0.0), (10.04, 0.0), (10.0, 0.0), (10.0, 10.0)])
  assert quantise_ring(ring) == [[0, 0], [100, 0], [100, 100]]


def test_quantise_ring_rejects_degenerate_rings() -> None:
  collapsed = LinearRing([(0.0, 0.0), (0.04, 0.0), (0.0, 0.04)])
  assert MIN_RING_POINTS == 3
  assert quantise_ring(collapsed) is None
