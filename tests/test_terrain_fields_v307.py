"""Complete source-union, paint and independent native terrain composition."""

from __future__ import annotations

import base64

import numpy as np
import pytest
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

from scripts.terrain_fields_v307 import TerrainFieldV307, compile_ground_v307


def _encoded(a: np.ndarray) -> str:
  return base64.b64encode(a.tobytes()).decode()


def _source() -> tuple[list[dict], list[float], np.ndarray, np.ndarray]:
  origin = [-10, 0, -10]
  xyz = np.array([[-4, 3, -4], [20, 3, -4], [20, 3, 12], [-4, 3, 12]])
  # Deliberately not an 8-bit value multiplied by257. The complete renderer's
  # earlier material/relief changes must survive without another quantization.
  rgb = np.array([[12345, 23456, 34567]] * 4, dtype="<u2")
  p = {
    "mesh": 0,
    "kind": "city",
    "positions": _encoded(np.rint((xyz - origin) * 100).astype("<u2")),
    "colors": _encoded(rgb),
    "indices": _encoded(np.array([0, 1, 2, 0, 2, 3], dtype="<u4")),
  }
  return [p], origin, xyz, rgb


def _field(key: str, start: float) -> TerrainFieldV307:
  domain = box(start, 0, start + 8, 8)

  def offset(x: float, z: float, native: bool = False) -> float:
    if native:
      x, z = (np.floor(x / 4) + 0.5) * 4, (np.floor(z / 4) + 0.5) * 4
    return max(0, 2 * min((x - start) / 4, (start + 8 - x) / 4, z / 4, (8 - z) / 4))

  return TerrainFieldV307(key, domain, domain.bounds, 4, offset, lambda *_: 3)


def _decode(p: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
  xyz = np.frombuffer(base64.b64decode(p["positions"]), "<u2").reshape(-1, 3)
  rgb = np.frombuffer(base64.b64decode(p["colors"]), "<u2").reshape(-1, 3)
  idx = np.frombuffer(base64.b64decode(p["indices"]), "<u4").reshape(-1, 3)
  return xyz.astype(float) / 100 + p["origin"], rgb, idx


def test_native_half_centimetre_source_rounding_cannot_introduce_slopes() -> None:
  parts, origin, _xyz, _rgb = _source()
  source = np.array([[0, 3.09, 0], [28, 3.09, 0], [28, 3.09, 28], [0, 3.09, 28]])
  parts[0]["positions"] = _encoded(np.rint((source - origin) * 100).astype("<u2"))
  domain = box(0, 0, 28, 28)
  field = TerrainFieldV307(
    "half-cm", domain, domain.bounds, 4, lambda *_: 0.125, lambda *_: 3
  )
  result = compile_ground_v307(
    parts, origin, [field], native=True, ground_predicate=lambda *_: True
  )
  points, _colors, indices = _decode(result["parts"][0]["fields"]["half-cm"])
  triangles = points[indices]
  assert np.all(np.ptp(triangles[:, :, 1], axis=1) == 0)
  assert len(np.unique(points[:, 1])) == 1


@pytest.mark.parametrize("native", [False, True])
def test_one_union_keeps_complete_outside_and_every_full_precision_colour(
  native: bool,
) -> None:
  parts, origin, xyz, rgb = _source()
  before = [dict(p) for p in parts]
  fields = [_field("park", 0), _field("station", 8)]
  result = compile_ground_v307(parts, origin, fields, native=native)
  assert parts == before
  record = result["parts"][0]
  assert record["retireTriangles"] == [0, 1]
  assert set(record["fields"]) == {"park", "station"}
  assert sum(r["sourceAreaM2"] for r in record["provenance"]) == 384
  assert sum(r["outsideAreaM2"] for r in record["provenance"]) == 256
  meshes = [record["outside"], *record["fields"].values()]
  footprints = []
  for mesh in meshes:
    p, c, ix = _decode(mesh)
    assert (c == rgb[0]).all()
    if mesh is record["outside"]:
      assert (p[:, 1] == 3).all()
      for point in xyz:
        assert np.any(np.all(p == point, axis=1))
    for t in p[ix]:
      normal = np.cross(t[1] - t[0], t[2] - t[0])
      if native:
        assert np.count_nonzero(np.abs(normal) > 1e-7) <= 1
      footprint = Polygon(t[:, [0, 2]])
      if footprint.area > 1e-8:
        footprints.append(footprint)
  assert unary_union(footprints).equals(box(-4, -4, 20, 12))
  assert abs(sum(p.area for p in footprints) - 384) < 1e-7


def test_actual_drawn_grid_peak_and_native_risers_have_the_same_floor_contract() -> (
  None
):
  parts, origin, _, _ = _source()
  field = _field("hill", 0)
  drawn = compile_ground_v307(parts, origin, [field])["parts"][0]["fields"]["hill"]
  p, _, _ = _decode(drawn)
  assert np.any(np.all(p == [4, 5, 4], axis=1))
  native = compile_ground_v307(parts, origin, [field], native=True)["parts"][0][
    "fields"
  ]["hill"]
  p, _, idx = _decode(native)
  assert set(p[:, 1]) == {3, 4}
  normals = np.cross(p[idx][:, 1] - p[idx][:, 0], p[idx][:, 2] - p[idx][:, 0])
  assert np.any(np.abs(normals[:, 0]) > 0) or np.any(np.abs(normals[:, 2]) > 0)


def test_overlapping_fields_are_rejected_instead_of_double_transferring_ground() -> (
  None
):
  parts, origin, _, _ = _source()
  with pytest.raises(ValueError, match="overlap"):
    compile_ground_v307(parts, origin, [_field("one", 0), _field("two", 4)])


def test_unrelated_bodies_and_already_retired_triangles_are_never_resurrected() -> None:
  parts, origin, _, _ = _source()
  parts[0]["kind"] = "private-building-model"
  assert compile_ground_v307(parts, origin, [_field("one", 0)])["parts"] == []
  parts[0]["kind"] = "city"
  parts[0]["indices"] = _encoded(np.array([0, 0, 0, 0, 2, 3], dtype="<u4"))
  result = compile_ground_v307(parts, origin, [_field("one", 0)])
  assert result["parts"][0]["retireTriangles"] == [1]


def test_existing_native_skirts_keep_source_paint_and_match_both_real_old_cells() -> (
  None
):
  origin = [0, 0, 0]
  xyz = np.array([[4, 3, 0], [4, 3, 8], [4, 4, 8], [4, 4, 0]], dtype=float)
  source = [
    {
      "mesh": 0,
      "kind": "city",
      "positions": _encoded((xyz * 100).astype("<u2")),
      "colors": _encoded(np.array([[12345, 23456, 34567]] * 4, dtype="<u2")),
      "indices": _encoded(np.array([0, 1, 2, 0, 2, 3], dtype="<u4")),
    }
  ]
  domain = box(0, 0, 8, 8)
  field = TerrainFieldV307(
    "slope",
    domain,
    domain.bounds,
    4,
    lambda x, z, native=False: 1 if x < 4 else 2,
    lambda x, z, native=False: 3 if x < 4 else 4,
  )
  result = compile_ground_v307(source, origin, [field], native=True)
  record = result["parts"][0]
  assert record["retireTriangles"] == [0, 1]
  p, c, idx = _decode(record["fields"]["slope"])
  assert p[:, 1].min() == 4 and p[:, 1].max() == 6
  assert (c == [12345, 23456, 34567]).all()
  normal = np.cross(p[idx][:, 1] - p[idx][:, 0], p[idx][:, 2] - p[idx][:, 0])
  assert (np.count_nonzero(np.abs(normal) > 1e-7, axis=1) <= 1).all()
  source[0]["kind"] = "unrelated-wall"
  assert compile_ground_v307(source, origin, [field], native=True)["parts"] == []
