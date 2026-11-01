"""Exact shared hall/rail ownership retains all original source and outside land."""

from __future__ import annotations

import base64
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import unary_union

from scripts.build_hbf_interior_ground_v291 import build, canonical_bytes

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
BOUNDARY = DATA / "hbfInteriorTerrainBoundaryV291.json"
RECEIPT = ROOT / "geo_data/regierungsviertel/hbf-interior-ground-v291-receipt.json"
ORIGINAL_SHA256 = {
  "src/app/public/mesh/regierungsviertel/ground-context.json": "810798aacd7051ac8f3d8c910fdc086c097c013503df1b9038e62ebe34fe5f3b",
  "src/app/src/data/hbfNorthApproachSources.json": "d9ca83ea87ea41a43779fcd41db2a93696d26930abeb4f91d1cf491252793f97",
  "src/app/src/data/hbfNorthRailTerrainBoundary.json": "8e03c7ac2b17b231fdf4bff8c30a7cfa10cdf62542e7a4daa20a162cd8b1c476",
  "src/app/src/data/hbfDrawnTerrainBoundaryV252.json": "2f25f71e1c09b8efd66c115f0d7876d0a4481a4ceefc875e58bef4e023b3888c",
}


def decoded(data: dict, field: str, dtype: str, width: int) -> np.ndarray:
  return np.frombuffer(base64.b64decode(data[field]), dtype=dtype).reshape(-1, width)


@pytest.fixture(scope="module")
def payload() -> tuple[dict, dict, dict, np.ndarray, np.ndarray, np.ndarray]:
  boundary = json.loads(BOUNDARY.read_bytes())
  receipt = json.loads(RECEIPT.read_bytes())
  original = json.loads((DATA / "hbfNorthRailTerrainBoundary.json").read_bytes())
  return (
    boundary,
    receipt,
    original,
    decoded(boundary, "cells_u32", "<u4", 6),
    decoded(boundary, "triangles_f32", "<f4", 2),
    decoded(boundary, "edges_f32", "<f4", 2),
  )


def test_all_original_payloads_and_tables_remain_byte_identical(payload) -> None:
  boundary, receipt, _, _, _, _ = payload
  for path, expected in ORIGINAL_SHA256.items():
    raw = (ROOT / path).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == expected
    assert receipt["sourceFiles"][path] == {"bytes": len(raw), "sha256": expected}
  assert boundary["source_sha256"] == hashlib.sha256(RECEIPT.read_bytes()).hexdigest()
  assert (
    boundary["ground_sha256"]
    == ORIGINAL_SHA256["src/app/public/mesh/regierungsviertel/ground-context.json"]
  )


def test_cut_stays_within_the_exact_represented_hall_and_old_rail_union(
  payload,
) -> None:
  boundary, receipt, _, _, _, _ = payload
  assert receipt["localInteriorBoundsM"] == [-20, -92.2, 20, 92.2]
  interior = shape(receipt["interiorFootprint"])
  angle = math.radians(21.82)
  c, s = math.cos(angle), math.sin(angle)
  local = Polygon(
    [
      (c * (x + 119.936) - s * (z + 683.307), s * (x + 119.936) + c * (z + 683.307))
      for x, z in interior.exterior.coords
    ]
  )
  assert local.symmetric_difference(box(-20, -92.2, 20, 92.2)).area < 1e-9
  north_source = json.loads((DATA / "hbfNorthApproachSources.json").read_bytes())
  north = unary_union([Polygon(p["ring"], p["holes"]) for p in north_source["cut"]])
  assert (
    shape(receipt["combinedFootprint"])
    .symmetric_difference(unary_union([north, interior]))
    .area
    < 1e-9
  )
  assert receipt["northInteriorOverlapAreaM2"] == 0
  assert boundary["interior_area_m2"] == pytest.approx(40 * 184.4)


def test_old_north_numeric_records_survive_exactly_and_cells_are_unique(
  payload,
) -> None:
  boundary, _, original, cells, triangles, edges = payload
  for field, dtype, width, actual in [
    ("cells_u32", "<u4", 6, cells),
    ("triangles_f32", "<f4", 2, triangles),
    ("edges_f32", "<f4", 2, edges),
  ]:
    before = decoded(original, field, dtype, width)
    assert np.array_equal(actual[: len(before)], before)
  assert len(cells) == boundary["affected_cells"] == 1393
  assert len({tuple(cell[:2]) for cell in cells}) == len(cells)
  assert len(cells) - original["affected_cells"] == 539
  assert boundary["removed_cut_area_m2"] - original["removed_cut_area_m2"] == (
    pytest.approx(7376)
  )


def test_every_affected_cell_has_source_land_and_correct_bounded_array_ranges(
  payload,
) -> None:
  boundary, receipt, _, cells, triangles, edges = payload
  ground = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json").read_bytes()
  )
  assert ground["grid"] == boundary["grid"]
  assert ground["cell_m"] == boundary["cell_m"] == 4
  footprint = shape(receipt["combinedFootprint"])
  grid = ground["grid"]
  for col, row, tri_start, tri_count, edge_start, edge_count in cells:
    col, row = int(col), int(row)
    owners = [
      kind
      for start, span, kind in ground["ground_rows"][row]
      if start <= col < start + span
    ]
    assert len(owners) == 1
    assert ground["classes"][owners[0]] not in {"water", "pond", "basin", "bridge"}
    x, z = (grid["min_x_idx"] + col) * 4, (grid["min_z_idx"] + row) * 4
    assert box(x, z, x + 4, z + 4).intersection(footprint).area > 0
    assert tri_count % 3 == 0
    assert edge_count % 2 == 0
    assert tri_start + tri_count <= len(triangles)
    assert edge_start + edge_count <= len(edges)


def test_every_outside_fragment_and_perimeter_is_retained_without_height_or_paint_rewrite(
  payload,
) -> None:
  boundary, receipt, _, cells, triangles, edges = payload
  footprint = shape(receipt["combinedFootprint"])
  grid = boundary["grid"]
  area = 0.0
  for col, row, start, count, edge_start, edge_count in cells:
    x = (grid["min_x_idx"] + int(col)) * 4
    z = (grid["min_z_idx"] + int(row)) * 4
    expected = box(x, z, x + 4, z + 4).difference(footprint)
    actual = unary_union(
      [Polygon(t) for t in triangles[start : start + count].reshape(-1, 3, 2)]
    )
    # Each cell differs by less than 2 cm² solely through Float32 storage.
    assert actual.symmetric_difference(expected).area < 0.0002
    assert actual.intersection(footprint).area < 0.0002
    area += actual.area
    for a, b in edges[edge_start : edge_start + edge_count].reshape(-1, 2, 2):
      for endpoint in (a, b):
        assert expected.boundary.distance(Point(endpoint)) < 0.0001
  assert area == pytest.approx(boundary["preserved_land_area_m2"], abs=0.001)
  assert area + boundary["removed_cut_area_m2"] == pytest.approx(
    len(cells) * 16, abs=0.001
  )
  # Vertical positions and paint are deliberately inherited from live host runs,
  # not resampled or replaced by a new table-owned elevation or colour.
  assert not {"tops_f32", "colors_f32", "heights_f32", "materials"}.intersection(
    boundary
  )


def test_generator_reproduces_the_committed_receipt_and_table_exactly() -> None:
  receipt, boundary = build()
  assert canonical_bytes(receipt) == RECEIPT.read_bytes()
  assert canonical_bytes(boundary) == BOUNDARY.read_bytes()
