"""Exact land complements preserve all non-water area without raster teeth."""

import base64
import hashlib
import json
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

from scripts.build_drawn_water_boundary import build_payload, clip_cell

ROOT = Path(__file__).resolve().parents[1]


def test_clip_preserves_exact_land_area_and_inner_holes():
  cell = box(0, 0, 4, 4)
  water = box(1, 1, 3, 3)
  triangles, edges, removed = clip_cell(cell, water)
  polygons = [Polygon(points) for points in np.asarray(triangles).reshape(-1, 3, 2)]
  result = unary_union(polygons)
  assert result.symmetric_difference(cell.difference(water)).area < 1e-10
  assert removed == 4
  assert result.area == 12
  assert len(edges) == 32  # Both outer and inner perimeter survive.


def test_clip_keeps_disconnected_and_tiny_valid_land_remnants():
  cell = box(0, 0, 4, 4)
  water = box(0.000001, -1, 3, 5)
  triangles, _, removed = clip_cell(cell, water)
  result = unary_union([Polygon(p) for p in np.asarray(triangles).reshape(-1, 3, 2)])
  assert len(result.geoms) == 2
  assert result.symmetric_difference(cell.difference(water)).area < 1e-10
  assert result.area + removed == pytest.approx(16)


def test_generator_records_full_and_partial_cells_but_keeps_bridge_and_water_classes():
  ground = {
    "cell_m": 4,
    "grid": {"min_x_idx": 0, "min_z_idx": 0, "cols": 5, "rows": 1},
    "classes": ["grass", "bridge", "water"],
    "ground_rows": [[[0, 3, 0], [3, 1, 1], [4, 1, 2]]],
  }
  source = {
    "source_sha256": "fixture",
    "water": [
      {"kind": "river", "ring": [[6, 0], [20, 0], [20, 4], [6, 4]], "holes": []}
    ],
  }
  output = build_payload(ground, source, "ground")
  cells = np.frombuffer(base64.b64decode(output["cells_u32"]), dtype="<u4").reshape(
    -1, 6
  )
  assert cells[:, 0].tolist() == [1, 2]
  assert output["fully_water_cells"] == 1
  assert output["removed_raster_intrusion_m2"] == 24
  assert output["preserved_land_m2"] == 8


def test_committed_boundary_matches_sources_and_conserves_every_encoded_cell():
  source = ROOT / "src/app/public/mesh/regierungsviertel/surface-polygons.json"
  ground = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
  output = json.loads((ROOT / "src/app/src/data/drawnWaterBoundary.json").read_text())
  assert output["source_sha256"] == hashlib.sha256(source.read_bytes()).hexdigest()
  assert output["ground_sha256"] == hashlib.sha256(ground.read_bytes()).hexdigest()
  cells = np.frombuffer(base64.b64decode(output["cells_u32"]), dtype="<u4").reshape(
    -1, 6
  )
  triangles = (
    np.frombuffer(base64.b64decode(output["triangles_f32"]), dtype="<f4")
    .reshape(-1, 2)
    .astype(float)
  )
  all_triangles = triangles.reshape(-1, 3, 2)
  cross = (all_triangles[:, 1, 0] - all_triangles[:, 0, 0]) * (
    all_triangles[:, 2, 1] - all_triangles[:, 0, 1]
  ) - (all_triangles[:, 2, 0] - all_triangles[:, 0, 0]) * (
    all_triangles[:, 1, 1] - all_triangles[:, 0, 1]
  )
  assert len(cells) == output["affected_cells"] == 11_366
  assert len(set(map(tuple, cells[:, :2]))) == len(cells)
  assert np.all(cross >= -1e-6)
  assert sum(abs(cross)) / 2 == pytest.approx(output["preserved_land_m2"], abs=0.1)
  assert (
    output["preserved_land_m2"] + output["removed_raster_intrusion_m2"]
    == len(cells) * 16
  )
  for x, z, start, count, _, _ in cells:
    points = triangles[start : start + count]
    if not count:
      continue
    world_x, world_z = (
      (int(x) + output["grid"]["min_x_idx"]) * 4,
      (int(z) + output["grid"]["min_z_idx"]) * 4,
    )
    assert np.min(points[:, 0]) >= world_x and np.max(points[:, 0]) <= world_x + 4
    assert np.min(points[:, 1]) >= world_z and np.max(points[:, 1]) <= world_z + 4
