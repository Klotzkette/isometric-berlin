"""Finite source topology, full floor support and independent exact Native grid."""

from __future__ import annotations

import gzip
import json
import math

import numpy as np
import pytest
from shapely.geometry import LineString, Point, box
from shapely.ops import unary_union

from scripts.build_network_fidelity_v326 import (
  DATA,
  SOURCE,
  PlanWriter,
  ReceiptWriter,
  at_grade,
  bounded_shape,
  cardinal_pixels,
  emit,
  packet_receipts,
  read,
)
from scripts.build_surrounding_outlines import PackedMesh


def test_complete_original_inventory_and_strict_topological_height_policy() -> None:
  source = read(SOURCE)
  assert len(source["records"]) == 37590
  assert len({r["key"] for r in source["records"]}) == 37590
  assert all(
    abs(r["originalLengthM"] - r["berlinLengthM"] - r["outsideLengthM"]) < 1e-5
    for r in source["records"]
  )
  assert sum(r["berlinLengthM"] > 0.01 for r in source["records"]) == 36935
  for tags in [
    {"bridge": "yes"},
    {"layer": "1"},
    {"layer": "-1"},
    {"tunnel": "yes"},
    {"layer": "not-a-height"},
    {"location": "elevated"},
  ]:
    assert not at_grade(tags)
  assert at_grade({"layer": "0", "bridge": "no"})
  # An explicit height never makes a contradictory bridge an ordinary floor.
  assert not at_grade({"bridge": "yes", "height": "8", "layer": "0"})


def test_sparse_cardinal_raster_is_exactly_the_full_original_cell_selection() -> None:
  desired = LineString([(-3.31, -2.65), (4.57, 5.23), (8.31, 2.19)]).buffer(0.17)
  support = box(-4, -3, 9, 6).difference(box(0.2, 0.3, 2.4, 1.8))
  actual = cardinal_pixels(desired.intersection(support), support)
  cells = []
  for ix in range(-16, 36):
    for iz in range(-12, 24):
      x, z = ix / 4, iz / 4
      if desired.covers(Point(x + 0.125, z + 0.125)) and support.covers(
        box(x, z, x + 0.25, z + 0.25)
      ):
        cells.append(box(x, z, x + 0.25, z + 0.25))
  assert actual.equals(unary_union(cells))
  assert support.covers(actual)
  assert not actual.intersects(box(0.21, 0.31, 2.39, 1.79))


def test_full_rounded_fitting_polygon_not_just_centre_must_have_real_support() -> None:
  support = box(-2, -2, 2, 2).difference(box(-0.3, -0.3, 0.3, 0.3))
  desired = LineString([(-1.5, 0), (1.5, 0)]).buffer(0.18)
  for native in [False, True]:
    result = bounded_shape(desired, support, native)
    assert support.covers(result)
    assert not result.intersects(box(-0.29, -0.29, 0.29, 0.29))
    for polygon in getattr(result, "geoms", [result]):
      for x, z in polygon.exterior.coords:
        assert abs(x * 100 - round(x * 100)) < 1e-7
        assert abs(z * 100 - round(z * 100)) < 1e-7
        if native:
          assert x * 4 == round(x * 4) and z * 4 == round(z * 4)


def test_source_buffer_cannot_escape_border_and_aligned_native_members_do_not_vanish() -> (
  None
):
  berlin = box(-1, -1, 1, 1)
  old_regional_floor = box(-5, -5, 5, 5)
  source = LineString([(-1.8, 0.9), (1.8, 0.9)]).buffer(0.25)
  for native in [False, True]:
    fitted = bounded_shape(source, old_regional_floor.intersection(berlin), native)
    assert not fitted.is_empty
    assert berlin.covers(fitted)
  # Exact boundary ties are included, while the whole cell still needs support.
  aligned = bounded_shape(LineString([(-1, 0), (1, 0)]).buffer(0.125), berlin, True)
  assert aligned.area > 0


def test_new_closed_volume_has_outward_top_bottom_and_vertical_winding() -> None:
  mesh = PackedMesh(0, 0)
  emit(mesh, box(1, 1, 3, 4), 3.18, 3.25, (150, 160, 150))
  vertices = np.asarray(list(mesh.vertices))[:, :3] / 100 + np.array([0, -10, 0])
  center = np.array([2, 3.215, 2.5])
  volume = 0.0
  for a, b, c in np.asarray(mesh.indices).reshape(-1, 3):
    triangle = vertices[[a, b, c]]
    normal = np.cross(triangle[1] - triangle[0], triangle[2] - triangle[0])
    assert np.dot(normal, triangle.mean(axis=0) - center) > 0
    volume += np.dot(triangle[0], np.cross(triangle[1], triangle[2])) / 6
  assert math.isclose(volume, 2 * 3 * 0.07, abs_tol=1e-12)


def test_finite_recipe_shards_keep_existing_candidate_and_owner_caps() -> None:
  index = read(DATA / "networkFidelityV326Index.json")
  assert index["kind"] == "network-fidelity-v326"
  allkeys = []
  for entry in index["sources"]:
    source = read(DATA / entry["file"])
    assert source["keys"] == entry["keys"]
    assert 0 < len(source["keys"]) <= 512
    assert set(source["packets"]) == set(source["keys"])
    for plan in source["packets"].values():
      assert 0 < len(plan["owners"]) <= 512
      assert not plan["retire"] and not plan["retireNav"] and not plan["retireLines"]
    allkeys.extend(entry["keys"])
  assert len(allkeys) == len(set(allkeys))


def test_streamed_proof_is_complete_and_truncated_proof_never_passes(tmp_path) -> None:
  path = tmp_path / "proof.json.gz"
  writer = ReceiptWriter(path)
  rows = [
    {"key": "drawn:test", "values": list(range(40000)), "credit": "Straße"},
    {"key": "minecraft:test", "values": [-0.0, 1.25]},
  ]
  for row in rows:
    writer.append(row)
  writer.finish({"complete": True})
  assert list(packet_receipts(path)) == rows
  assert json.loads(gzip.decompress(path.read_bytes()))["complete"] is True
  broken = tmp_path / "broken.gz"
  broken.write_bytes(gzip.compress(b'{"packets":[{"key":"incomplete"}'))
  with pytest.raises(ValueError, match="Truncated"):
    list(packet_receipts(broken))
  broken.write_bytes(gzip.compress(b'{"packets":[{"key":"prefix"}],'))
  with pytest.raises(ValueError, match="trailer"):
    list(packet_receipts(broken))
  broken.write_bytes(path.read_bytes()[:-8])
  with pytest.raises((ValueError, EOFError)):
    list(packet_receipts(broken))
  wrong = ReceiptWriter(broken)
  wrong.append({"key": "only-one"})
  wrong.finish({"plans": 2})
  with pytest.raises(ValueError, match="row count"):
    list(packet_receipts(broken))


def test_measured_transport_retains_exact_original_json_and_bounded_shards(
  tmp_path, monkeypatch
) -> None:
  import scripts.build_network_fidelity_v326 as compiler

  monkeypatch.setattr(compiler, "GEO", tmp_path)
  monkeypatch.setattr(compiler, "ROOT", tmp_path)
  writer = PlanWriter(True, "test-stage")
  for i in range(33):
    writer.add(
      "drawn:" + str(i), {"word": i, "negativeZero": -0.0, "unicode": "Straße"}
    )
  writer.flush()
  with pytest.raises(ValueError, match="Duplicate"):
    writer.add("drawn:0", {"foreign": True})
  assert len(writer.files) == 2
  for entry in writer.files:
    raw = gzip.decompress((tmp_path / entry["carrier"]).read_bytes())
    assert len(raw) == entry["rawBytes"] < 100 * 1024 * 1024
    source = json.loads(raw)
    assert source["keys"] == entry["keys"]
    assert all(
      math.copysign(1, p["negativeZero"]) == -1 for p in source["packets"].values()
    )
  assert len(writer.files[0]["keys"]) == 32
