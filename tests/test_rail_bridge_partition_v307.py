"""Exact plane partition for source paint on top faces and vertical kerbs."""

from __future__ import annotations

import base64
import gzip
import json
import sys
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Polygon, box

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from partition_rail_bridge_contact_v307 import triangle_complement


@pytest.mark.parametrize("vertical", [False, True])
def test_bridge_partition_keeps_the_exact_source_plane_and_reversed_orientation(
  vertical: bool,
) -> None:
  points = np.array([[0, 5, 0], [8, 7, 0], [8, 9, 8]], dtype=float)
  if vertical:
    points = np.array([[0, 3, 2], [8, 3, 2], [8, 7, 2]], dtype=float)
  weights, removed, area = triangle_complement(points, box(3, -10, 7, 10))
  assert 0 < removed < area
  normal = np.cross(points[1] - points[0], points[2] - points[0])
  surfaces = []
  axes = [0, 1] if vertical else [0, 2]
  for bary in weights:
    np.testing.assert_allclose(bary.sum(axis=1), 1, atol=1e-12)
    vertices = bary @ points
    assert (
      np.dot(np.cross(vertices[1] - vertices[0], vertices[2] - vertices[0]), normal) > 0
    )
    assert np.allclose((vertices - points[0]) @ normal, 0, atol=1e-10)
    surfaces.append(Polygon(vertices[:, axes]))
  assert sum(q.area for q in surfaces) == pytest.approx(area - removed)


def test_foreign_domain_retains_the_original_triangle_index_weights() -> None:
  points = np.array([[0, 5, 0], [8, 7, 0], [8, 9, 8]], dtype=float)
  weights, removed, area = triangle_complement(points, box(30, 30, 40, 40))
  assert removed == 0 and area == 32
  np.testing.assert_array_equal(weights[0], np.eye(3))


def test_complete_actual_underdeck_keeps_measured_floor_and_proved_rail_paint() -> None:
  root = Path(__file__).resolve().parents[1]
  floor = json.loads(
    (root / "src/app/src/data/railBridgeUnderdeckV307.json").read_text()
  )
  proof = json.loads(
    gzip.decompress(
      (
        root / "geo_data/regierungsviertel/rail-bridge-contact-v307-evidence.json.gz"
      ).read_bytes()
    )
  )
  assert len(floor["models"]) == 4
  assert proof["selectedOriginalTriangles"] == 823
  assert len(proof["requiresSeparateSourceTransfer"]) == 154
  assert floor["paletteSources"] == proof["paletteSources"]
  assert all(q["distanceToDeckM"] == 0 for q in floor["paletteSources"])
  assert {(q["mode"], q["triangle"]) for q in floor["paletteSources"]} == {
    ("drawn", 17112),
    ("minecraft", 36644),
  }
  native_faces = 0
  for model in floor["models"]:
    positions = np.frombuffer(base64.b64decode(model["positions"]), "<u2").reshape(
      -1, 3
    )
    colours = np.frombuffer(base64.b64decode(model["colors"]), "<u2").reshape(-1, 3)
    indices = np.frombuffer(base64.b64decode(model["indices"]), "<u4").reshape(-1, 3)
    assert np.all(colours == [10537, 8224, 6168])
    if model["native"]:
      assert np.all(np.any(np.ptp(positions[indices], axis=1) == 0, axis=1))
      native_faces += len(indices)
  assert native_faces == 1887
