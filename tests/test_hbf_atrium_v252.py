"""The old north cuts stay byte-identical; only the authored atrium owns ground."""

import base64
import hashlib
import json
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"


def arrays(data):
  return [
    np.frombuffer(base64.b64decode(data[key]), dtype=dtype).reshape(-1, width)
    for key, dtype, width in [
      ("cells_u32", "<u4", 6),
      ("triangles_f32", "<f4", 2),
      ("edges_f32", "<f4", 2),
    ]
  ]


def test_retains_every_original_north_cut_record_and_source_payload():
  old_bytes = (DATA / "hbfNorthRailTerrainBoundary.json").read_bytes()
  old = json.loads(old_bytes)
  new = json.loads((DATA / "hbfDrawnTerrainBoundaryV252.json").read_bytes())
  receipt_bytes = (
    ROOT / "geo_data/regierungsviertel/hbf-atrium-v252-receipt.json"
  ).read_bytes()
  receipt = json.loads(receipt_bytes)
  assert new["source_sha256"] == hashlib.sha256(receipt_bytes).hexdigest()
  assert new["original_north_sha256"] == hashlib.sha256(old_bytes).hexdigest()
  assert (
    receipt["originalGroundSha256"]
    == hashlib.sha256(
      (ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json").read_bytes()
    ).hexdigest()
  )
  for before, after in zip(arrays(old), arrays(new)):
    assert np.array_equal(before, after[: len(before)])
  assert new["atrium_affected_cells"] == 201
  assert new["atrium_removed_area_m2"] == pytest.approx(2022.08)


def test_every_atrium_boundary_fragment_keeps_its_exact_outside_complement():
  old = json.loads((DATA / "hbfNorthRailTerrainBoundary.json").read_bytes())
  new = json.loads((DATA / "hbfDrawnTerrainBoundaryV252.json").read_bytes())
  receipt = json.loads(
    (ROOT / "geo_data/regierungsviertel/hbf-atrium-v252-receipt.json").read_bytes()
  )
  footprint = shape(receipt["footprint"])
  cells, triangles, _ = arrays(new)
  grid = new["grid"]
  area = 0
  for col, row, start, count, _, _ in cells[old["affected_cells"] :]:
    x, z = (grid["min_x_idx"] + int(col)) * 4, (grid["min_z_idx"] + int(row)) * 4
    expected = box(x, z, x + 4, z + 4).difference(footprint)
    actual = unary_union(
      [Polygon(t) for t in triangles[start : start + count].reshape(-1, 3, 2)]
    )
    # Only Float32 roundoff, no discarded perimeter slivers or source decimation.
    assert actual.symmetric_difference(expected).area < 0.0005
    area += actual.area
  assert area == pytest.approx(new["atrium_preserved_area_m2"], abs=0.01)
  assert area + new["atrium_removed_area_m2"] == pytest.approx(201 * 16, abs=0.01)
