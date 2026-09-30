"""James-Simon terrain ownership keeps every exterior and shoreline remnant."""

import base64
import hashlib
import json
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

from scripts.build_drawn_water_boundary import clip_cell, encoded
from scripts.build_james_simon_terrain import (
  EXCLUDED_CLASSES,
  OPEN_PART_IDS,
  build_payload,
  building_footprint,
  existing_land_cells,
  stair_footprint,
)

ROOT = Path(__file__).resolve().parents[1]


def decoded_cells(payload):
  cells = np.frombuffer(base64.b64decode(payload["cells_u32"]), dtype="<u4").reshape(
    -1, 6
  )
  points = np.frombuffer(
    base64.b64decode(payload["triangles_f32"]), dtype="<f4"
  ).reshape(-1, 2)
  return {
    (int(x), int(z)): unary_union(
      [Polygon(t) for t in points[start : start + count].reshape(-1, 3, 2)]
    )
    for x, z, start, count, _, _ in cells
  }


def test_existing_shoreline_complement_survives_and_water_classes_are_untouched():
  ground = {
    "cell_m": 4,
    "grid": {"min_x_idx": 0, "min_z_idx": 0, "cols": 6, "rows": 1},
    "classes": ["grass", "bridge", "water", "pond", "basin"],
    "ground_rows": [[[0, 2, 0], [2, 1, 1], [3, 1, 2], [4, 1, 3], [5, 1, 4]]],
  }
  triangles, edges, _ = clip_cell(box(0, 0, 4, 4), box(0, 0, 2, 4))
  shore = {
    "grid": ground["grid"],
    "cell_m": 4,
    "source_sha256": "water",
    "ground_sha256": "ground",
    "cells_u32": encoded([0, 0, 0, len(triangles) // 2, 0, len(edges) // 2], "<u4"),
    "triangles_f32": encoded(triangles, "<f4"),
    "edges_f32": encoded(edges, "<f4"),
  }
  source = {
    "parent_id": "fixture",
    "source_sha256": "lod2",
    "parts": [
      {"id": "closed", "ring": [[1, 1], [24, 1], [24, 3], [1, 3]], "holes": []}
    ],
  }
  result = build_payload(ground, source, shore, "source", "ground", "shore")
  land = decoded_cells(result)
  assert set(land) == {(0, 0), (1, 0)}
  assert result["affected_cells"] == 2
  assert result["existing_shoreline_cells"] == 1
  assert result["preserved_water_exclusion_m2"] == 8
  assert result["removed_building_intrusion_m2"] == 12
  assert result["preserved_land_m2"] == 12
  assert (
    land[(0, 0)].symmetric_difference(box(2, 0, 4, 4).difference(box(1, 1, 24, 3))).area
    == 0
  )
  assert (
    land[(1, 0)].symmetric_difference(box(4, 0, 8, 4).difference(box(1, 1, 24, 3))).area
    == 0
  )
  with pytest.raises(ValueError, match="retained ground"):
    build_payload(ground, source, shore, "source", "wrong-ground", "shore")


def test_committed_table_is_reproducible_and_preserves_all_outside_source_land():
  ground_bytes = (
    ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
  ).read_bytes()
  source_bytes = (ROOT / "src/app/src/jamesSimonSource.json").read_bytes()
  shore_bytes = (ROOT / "src/app/src/data/drawnWaterBoundary.json").read_bytes()
  ground, source, shore = map(json.loads, (ground_bytes, source_bytes, shore_bytes))
  result = json.loads(
    (ROOT / "src/app/src/data/jamesSimonTerrainBoundary.json").read_text()
  )
  assert result == build_payload(
    ground,
    source,
    shore,
    hashlib.sha256(source_bytes).hexdigest(),
    hashlib.sha256(ground_bytes).hexdigest(),
    hashlib.sha256(shore_bytes).hexdigest(),
  )
  native = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json").read_text()
  )
  assert result["grid"] == native["grid"] == ground["grid"]
  assert result["cell_m"] == native["cell_m"] == 4
  assert result["affected_cells"] == 184 <= 400
  assert result["existing_shoreline_cells"] == 18
  assert set(result["ownership"]["excluded_open_part_ids"]) == OPEN_PART_IDS
  assert len(result["ownership"]["closed_part_ids"]) == 4
  assert stair_footprint().area == pytest.approx(260)
  body = building_footprint(source)
  mask = body.union(stair_footprint())
  assert mask.area < box(*mask.bounds).area / 2
  shore_land, retained = existing_land_cells(shore), decoded_cells(result)
  min_x, min_z = ground["grid"]["min_x_idx"], ground["grid"]["min_z_idx"]
  expected_keys = set()
  expected_area = removed_area = 0.0
  for z_offset, row in enumerate(ground["ground_rows"]):
    z = (min_z + z_offset) * 4
    if z + 4 <= mask.bounds[1] or z >= mask.bounds[3]:
      continue
    for x_start, length, class_id in row:
      if ground["classes"][class_id] in EXCLUDED_CLASSES:
        continue
      for x_offset in range(x_start, x_start + length):
        x = (min_x + x_offset) * 4
        if x + 4 <= mask.bounds[0] or x >= mask.bounds[2]:
          continue
        tile = box(x, z, x + 4, z + 4)
        if tile.intersection(mask).area <= 0:
          continue
        key = (x_offset, z_offset)
        expected_keys.add(key)
        original_land = shore_land.get(key, tile)
        expected = original_land.difference(mask)
        # Float32 wire coordinates have ~0.12 mm precision at this world x.
        assert retained[key].symmetric_difference(expected).area < 0.003
        assert retained[key].intersection(mask).area < 0.003
        assert retained[key].difference(original_land).area < 0.003
        expected_area += expected.area
        removed_area += original_land.intersection(mask).area
  assert set(retained) == expected_keys
  assert result["preserved_land_m2"] == pytest.approx(expected_area)
  assert result["removed_building_intrusion_m2"] == pytest.approx(removed_area)
  assert sum(p.area for p in retained.values()) == pytest.approx(
    expected_area, abs=0.02
  )
  assert result["preserved_land_m2"] + result["removed_building_intrusion_m2"] + result[
    "preserved_water_exclusion_m2"
  ] == pytest.approx(184 * 16)
  for part in source["parts"]:
    if part["id"] in OPEN_PART_IDS:
      open_only = (
        Polygon(part["ring"], part["holes"])
        .difference(body)
        .difference(stair_footprint())
      )
      assert open_only.intersection(mask).area < 1e-9
