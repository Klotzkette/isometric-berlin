"""Terrain placement must retain source faces, colours and ground coverage."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import itertools
import json
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest
import shapely
from shapely.geometry import MultiPoint, Polygon
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from build_weinberg_terrain_packets_v176 import (
  basin_shapes,
  drape_triangle,
  elevate_lines,
  elevate_mesh,
  sample_native_offset,
  triangle_key,
)
from weinberg_terrain_v176 import sample_offset

ROOT = Path(__file__).resolve().parents[1]
PACKETS = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
DATA = ROOT / "src/app/src/data"
AUDIT = ROOT / "geo_data/regierungsviertel/weinberg-v176/packet-audit.json"
BASE = "v1.0.75"


def _mesh(
  points: list | np.ndarray,
  indices: list | np.ndarray,
  origin: list,
  *,
  kind: str = "alt-mitte-v169",
  colors: list | np.ndarray | None = None,
) -> dict:
  positions = np.rint((np.asarray(points) - origin) * 100).astype(np.int64)
  assert np.min(positions) >= 0 and np.max(positions) <= 65535
  if colors is None:
    colors = np.tile([42, 118, 197], (len(positions), 1))
  return {
    "kind": kind,
    "positionType": "u16cm",
    "positions": base64.b64encode(positions.astype("<u2").tobytes()).decode(),
    "colors": base64.b64encode(np.asarray(colors, dtype="u1").tobytes()).decode(),
    "indices": base64.b64encode(np.asarray(indices, dtype="<u4").tobytes()).decode(),
    "retainedMetadata": {"source": "fixture"},
  }


def _decode(mesh: dict, origin: list) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
  positions = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(
    -1, 3
  )
  world_cm = positions.astype(np.int64) + np.rint(np.asarray(origin) * 100).astype(
    np.int64
  )
  colors = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(-1, 3)
  return world_cm, colors, indices


def _project(triangles: list | np.ndarray) -> list[Polygon]:
  return [Polygon(np.asarray(triangle)[:, [0, 2]]) for triangle in triangles]


def _no_owner(points: np.ndarray) -> None:
  return None


def _unexpected_fallback(points: np.ndarray) -> None:
  pytest.fail("Exact ownership or ground recognition must precede fallback")


def test_triangle_owner_key_ignores_winding_but_retains_all_coordinates() -> None:
  points = np.array(
    [[200001, 1301, -179998], [200499, 1799, -179500], [200201, 2302, -179888]]
  )
  expected = triangle_key(points)
  assert {
    triangle_key(permutation) for permutation in itertools.permutations(points)
  } == {expected}
  for axis in range(3):
    changed = points.copy()
    changed[0, axis] += 1
    assert triangle_key(changed) != expected


def test_owner_offsets_split_shared_vertices_without_losing_faces_or_colours() -> None:
  origin = [2000, -10, -1800]
  points = [
    [2000, 3, -1800],
    [2004, 3, -1800],
    [2004, 11, -1800],
    [2000, 7, -1800],
    [2000, 9, -1796],
  ]
  indices = [[0, 1, 2], [0, 2, 3], [0, 3, 4]]
  colors = [[17, 22, 99], [101, 7, 255], [0, 240, 16], [224, 224, 224], [13, 88, 103]]
  source = _mesh(points, indices, origin, colors=colors)
  frozen = copy.deepcopy(source)
  before, rgb, before_indices = _decode(source, origin)
  owners = {
    triangle_key(before[before_indices[0]]): 20.33,
    triangle_key(before[before_indices[1]]): -1.17,
  }
  calls = []

  def fallback(triangle: np.ndarray) -> None:
    calls.append(triangle.copy())
    return None

  result, counts = elevate_mesh(source, origin, owners, fallback)
  after, result_rgb, result_indices = _decode(result, origin)
  assert source == frozen
  assert result["retainedMetadata"] == source["retainedMetadata"]
  assert len(result_indices) == len(before_indices) == 3
  for i, offset_cm in enumerate((2033, -117, 0)):
    expected = before[before_indices[i]] + [0, offset_cm, 0]
    np.testing.assert_array_equal(after[result_indices[i]], expected)
    np.testing.assert_array_equal(result_rgb[result_indices[i]], rgb[before_indices[i]])
    np.testing.assert_array_equal(
      np.diff(after[result_indices[i]], axis=0),
      np.diff(before[before_indices[i]], axis=0),
    )
  assert len(calls) == 1
  np.testing.assert_array_equal(calls[0], before[before_indices[2]] / 100)
  assert counts["exactOwnerTriangles"] == 2
  assert counts["translatedSourceTriangles"] == 2
  assert counts["unownedTriangles"] == 1
  assert len(after) == 9


def test_same_owner_keeps_shared_vertices_and_exact_owner_precedes_ground() -> None:
  origin = [2000, -10, -1800]
  source = _mesh(
    [[2000, 3, -1800], [2040, 3, -1800], [2040, 3, -1760], [2000, 3, -1760]],
    [[0, 1, 2], [0, 2, 3]],
    origin,
    kind="city",
  )
  before, rgb, indices = _decode(source, origin)
  owners = {triangle_key(before[triangle]): 12.34 for triangle in indices}
  result, counts = elevate_mesh(source, origin, owners, _unexpected_fallback)
  after, result_rgb, result_indices = _decode(result, origin)
  assert len(after) == 4
  np.testing.assert_array_equal(result_indices, indices)
  np.testing.assert_array_equal(after, before + [0, 1234, 0])
  np.testing.assert_array_equal(result_rgb, rgb)
  assert counts["sourceTriangles"] == counts["resultTriangles"] == 2
  assert counts.get("drapedSourceTriangles", 0) == 0


def test_rigid_ink_retains_zero_length_source_segments_and_endpoint_colours() -> None:
  origin = [2000, -10, -1800]
  local = np.array(
    [[[0, 1300, 0], [0, 1300, 0]], [[100, 1300, 0], [100, 1400, 0]]], dtype="<u2"
  )
  colors = np.array(
    [[[12, 31, 47], [56, 77, 80]], [[19, 17, 240], [22, 44, 127]]], dtype="u1"
  )
  source = {
    "positionType": "u16cm",
    "positions": base64.b64encode(local.tobytes()).decode(),
    "colors": base64.b64encode(colors.tobytes()).decode(),
  }
  frozen = copy.deepcopy(source)
  world = local.astype(np.int64) + np.rint(np.asarray(origin) * 100).astype(np.int64)
  result, receipt = elevate_lines(
    source, origin, SimpleNamespace(lookup=_no_owner), {triangle_key(world[0]): 20.33}
  )
  positions, actual_colors = _decode_lines(result, origin)
  expected = world.copy()
  expected[0, :, 1] += 2033
  np.testing.assert_array_equal(positions, expected)
  np.testing.assert_array_equal(actual_colors, colors)
  assert source == frozen
  assert receipt["sourceSegments"] == receipt["resultSegments"] == 2


@pytest.mark.parametrize(("height", "offset"), [(640.0, 10.0), (-9.0, -2.0)])
def test_owner_translation_rejects_uint16_overflow_before_wrapping(
  height: float, offset: float
) -> None:
  origin = [2000, -10, -1800]
  source = _mesh(
    [[2000, height, -1800], [2001, height, -1800], [2000, height, -1799]],
    [[0, 1, 2]],
    origin,
  )
  frozen = copy.deepcopy(source)
  positions, _, indices = _decode(source, origin)
  with pytest.raises(ValueError, match="UInt16"):
    elevate_mesh(
      source,
      origin,
      {triangle_key(positions[indices[0]]): offset},
      _unexpected_fallback,
    )
  assert source == frozen


@pytest.mark.parametrize("minecraft", [False, True])
def test_outside_support_mesh_remains_byte_exact(minecraft: bool) -> None:
  origin = [0, -10, -512]
  source = _mesh(
    [[100, 3.12, -100], [400, 3.12, -100], [100, 3.12, -400], [500, 77, -20]],
    [[0, 1, 2]],
    origin,
    kind="city",
  )
  frozen = copy.deepcopy(source)
  result, counts = elevate_mesh(
    source, origin, {}, _unexpected_fallback, minecraft=minecraft
  )
  assert result == source == frozen
  assert counts["sourceTriangles"] == counts["resultTriangles"] == 1
  assert counts["untouchedGroundTriangles"] == 1
  points = np.array(
    [
      [100.0003, 3.1234, -100.002],
      [400.003, 3.1234, -100.005],
      [100.004, 3.1234, -400.006],
    ]
  )
  pieces = drape_triangle(points, minecraft=minecraft)
  assert len(pieces) == 1
  np.testing.assert_array_equal(pieces[0], points)


@pytest.mark.parametrize("minecraft", [False, True])
def test_ground_draping_preserves_hole_area_colours_and_original_coverage(
  minecraft: bool,
) -> None:
  outer = [(2000, -1800), (2040, -1800), (2040, -1760), (2000, -1760)]
  hole = [(2010, -1790), (2030, -1790), (2030, -1770), (2010, -1770)]
  footprint = Polygon(outer, [hole])
  source_triangles = list(shapely.constrained_delaunay_triangles(footprint).geoms)
  points = [
    [x, 3.12, z]
    for triangle in source_triangles
    for x, z in list(triangle.exterior.coords)[:3]
  ]
  origin = [2000, -10, -1800]
  source = _mesh(points, np.arange(len(points)).reshape(-1, 3), origin, kind="city")
  result, counts = elevate_mesh(
    source, origin, {}, _unexpected_fallback, minecraft=minecraft
  )
  after, colors, indices = _decode(result, origin)
  triangles = after[indices] / 100
  normals = np.cross(
    triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
  )
  assert np.all(np.linalg.norm(normals, axis=1) > 0)
  projected = _project(triangles[np.abs(normals[:, 1]) > 0])
  coverage = unary_union(projected)
  assert coverage.symmetric_difference(footprint).area < 1e-8
  assert coverage.intersection(Polygon(hole)).area < 1e-8
  assert sum(piece.area for piece in projected) == pytest.approx(
    footprint.area, abs=1e-8
  )
  assert all(piece.area > 0 for piece in projected)
  assert np.all(colors == [42, 118, 197])
  assert (
    counts["sourceTriangles"]
    == counts["drapedSourceTriangles"]
    == len(source_triangles)
  )
  assert counts["resultTriangles"] > counts["sourceTriangles"]
  if minecraft:
    assert np.all(np.count_nonzero(normals, axis=1) == 1)


def test_draped_triangles_follow_the_same_planes_as_navigation() -> None:
  original = np.array(
    [[2001.0, 3.09, -1797.0], [2041.0, 3.09, -1797.0], [2001.0, 3.09, -1757.0]]
  )
  pieces = drape_triangle(original)
  assert len(pieces) > 1
  original_normal = np.cross(original[1] - original[0], original[2] - original[0])[1]
  for piece in pieces:
    x, y, z = np.mean(piece, axis=0)
    assert y == pytest.approx(3.09 + sample_offset(x, z), abs=1e-9)
    normal = np.cross(piece[1] - piece[0], piece[2] - piece[0])[1]
    assert original_normal * normal > 0
  assert sum(p.area for p in _project(pieces)) == pytest.approx(
    Polygon(original[:, [0, 2]]).area, abs=1e-8
  )


def test_triangle_crossing_support_is_draped_even_with_all_vertices_outside() -> None:
  original = np.array(
    [[1820.0, 3.0, -2010.0], [1860.0, 3.0, -2050.0], [1880.0, 3.0, -2050.0]]
  )
  assert all(sample_offset(x, z) == 0 for x, _, z in original)
  pieces = drape_triangle(original)
  assert len(pieces) > 1
  assert any(np.max(piece[:, 1]) > 3 for piece in pieces)
  projected = _project(pieces)
  footprint = Polygon(original[:, [0, 2]])
  assert unary_union(projected).symmetric_difference(footprint).area < 1e-8
  assert sum(p.area for p in projected) == pytest.approx(footprint.area, abs=1e-8)
  for piece in pieces:
    for x, y, z in piece:
      if sample_offset(x, z) == 0:
        assert y == 3


def test_native_ground_uses_horizontal_world_aligned_terraces() -> None:
  original = np.array(
    [[2001.0, 3.15, -1797.0], [2019.0, 3.15, -1797.0], [2001.0, 3.15, -1779.0]]
  )
  pieces = drape_triangle(original, minecraft=True)
  heights = set()
  tops, risers = [], []
  for piece in pieces:
    normal = np.cross(piece[1] - piece[0], piece[2] - piece[0])
    assert np.count_nonzero(normal) == 1
    if normal[1] == 0:
      risers.append(piece)
      x, _, z = np.mean(piece, axis=0)
      if np.ptp(piece[:, 0]) == 0:
        assert x % 4 == 0
        adjacent = [
          sample_native_offset(x - 0.01, z),
          sample_native_offset(x + 0.01, z),
        ]
      else:
        assert np.ptp(piece[:, 2]) == 0
        assert z % 4 == 0
        adjacent = [
          sample_native_offset(x, z - 0.01),
          sample_native_offset(x, z + 0.01),
        ]
      np.testing.assert_allclose(
        np.unique(piece[:, 1]), np.sort(adjacent) + 3.15, atol=1e-9, rtol=0
      )
      continue
    tops.append(piece)
    assert np.ptp(piece[:, 1]) == 0
    x, y, z = np.mean(piece, axis=0)
    assert y == pytest.approx(3.15 + sample_native_offset(x, z), abs=1e-9)
    lower = np.floor(np.array([x, z]) / 4) * 4
    assert np.all(piece[:, [0, 2]] >= lower - 1e-9)
    assert np.all(piece[:, [0, 2]] <= lower + 4 + 1e-9)
    assert abs(normal[1]) > 0
    assert normal[0] == normal[2] == 0
    heights.add(round(y, 6))
  assert len(heights) > 1
  assert risers
  projected = _project(tops)
  assert sum(p.area for p in projected) == pytest.approx(
    Polygon(original[:, [0, 2]]).area, abs=1e-8
  )


@pytest.mark.parametrize("kind", ["mitte-street-fronts-v166", "scheunenviertel-v168"])
@pytest.mark.parametrize(
  ("height", "color"), [(3.22, [118, 111, 93]), (3.28, [168, 159, 133])]
)
@pytest.mark.parametrize("minecraft", [False, True])
def test_older_pavement_and_kerb_tops_follow_terrain(
  kind: str, height: float, color: list, minecraft: bool
) -> None:
  origin = [2000, -10, -1800]
  points = [[2001, height, -1797], [2041, height, -1797], [2001, height, -1757]]
  source = _mesh(points, [[0, 1, 2]], origin, kind=kind, colors=[color] * 3)
  result, receipt = elevate_mesh(
    source, origin, {}, _unexpected_fallback, minecraft=minecraft
  )
  world, colors, indices = _decode(result, origin)
  assert receipt["drapedSourceTriangles"] == 1
  assert len(indices) > 1
  assert np.min(world[:, 1]) > round(height * 100)
  assert np.all(colors == color)
  _verify_mesh_receipts(source, [result], origin, {"kind": kind, **receipt}, minecraft)


@pytest.mark.parametrize("kind", ["mitte-street-fronts-v166", "scheunenviertel-v168"])
def test_older_layer_building_face_at_pavement_height_keeps_rigid_semantics(
  kind: str,
) -> None:
  origin = [2000, -10, -1800]
  points = [[2001, 3.22, -1797], [2041, 3.22, -1797], [2001, 3.22, -1757]]
  source = _mesh(points, [[0, 1, 2]], origin, kind=kind, colors=[[119, 111, 93]] * 3)
  calls = []

  def owner(triangle: np.ndarray) -> float:
    calls.append(triangle.copy())
    return 7.89

  result, receipt = elevate_mesh(source, origin, {}, owner)
  before, rgb, indices = _decode(source, origin)
  after, actual_rgb, actual_indices = _decode(result, origin)
  assert len(calls) == 1
  assert receipt.get("drapedSourceTriangles", 0) == 0
  assert receipt["translatedSourceTriangles"] == 1
  np.testing.assert_array_equal(actual_indices, indices)
  np.testing.assert_array_equal(after, before + [0, 789, 0])
  np.testing.assert_array_equal(actual_rgb, rgb)


@pytest.mark.parametrize("kind", ["mitte-street-fronts-v166", "scheunenviertel-v168"])
@pytest.mark.parametrize("minecraft", [False, True])
@pytest.mark.parametrize("diagonal", [False, True])
def test_older_vertical_kerbs_keep_the_whole_face_on_the_terrain(
  kind: str, minecraft: bool, diagonal: bool
) -> None:
  origin = [2000, -10, -1800]
  za, zb = (-1799, -1761) if diagonal else (-1795, -1795)
  points = np.array([[2001, 3.09, za], [2039, 3.09, zb], [2039, 3.28, zb]])
  source = _mesh(points, [[0, 1, 2]], origin, kind=kind, colors=[[168, 159, 133]] * 3)
  result, receipt = elevate_mesh(
    source, origin, {}, _unexpected_fallback, minecraft=minecraft
  )
  assert receipt["drapedSourceTriangles"] == 1
  assert receipt["resultTriangles"] > 1
  _verify_mesh_receipts(source, [result], origin, {"kind": kind, **receipt}, minecraft)
  # Removing each terrain translation must recover every part of the original
  # vertical face; this also rejects extra native risers on an existing curb.
  pieces = drape_triangle(points, minecraft=minecraft)
  flattened = []
  for piece in pieces:
    flat = piece.copy()
    if minecraft:
      x, _, z = np.mean(piece, axis=0)
      flat[:, 1] -= sample_native_offset(x, z)
    else:
      flat[:, 1] -= [sample_offset(x, z) for x, _, z in piece]
    np.testing.assert_allclose(
      flat[:, 2], za + (flat[:, 0] - 2001) * (zb - za) / 38, rtol=0, atol=1e-9
    )
    flattened.append(Polygon(flat[:, :2]))
  footprint = Polygon(points[:, :2])
  assert unary_union(flattened).symmetric_difference(footprint).area < 1e-8
  assert sum(piece.area for piece in flattened) == pytest.approx(
    footprint.area, abs=1e-8
  )


@pytest.mark.parametrize("minecraft", [False, True])
def test_tapered_vertical_kerb_retains_its_quantized_endpoint_trace(
  minecraft: bool,
) -> None:
  origin = [1536, -10, -1536]
  points = np.array(
    [[1956.32, 3.09, -1072.45], [1896.56, 3.28, -1071.19], [1956.32, 3.28, -1072.45]]
  )
  source = _mesh(
    points,
    [[0, 1, 2]],
    origin,
    kind="mitte-street-fronts-v166",
    colors=[[168, 159, 133]] * 3,
  )
  result, receipt = elevate_mesh(
    source, origin, {}, _unexpected_fallback, minecraft=minecraft
  )
  assert receipt["drapedSourceTriangles"] == 1
  _verify_mesh_receipts(
    source, [result], origin, {"kind": source["kind"], **receipt}, minecraft
  )


def test_generated_native_terrace_risers_do_not_protrude_into_the_plansche() -> None:
  points = np.array(
    [[2128.0, 3.0, -1424.0], [2140.0, 3.0, -1424.0], [2128.0, 3.0, -1412.0]]
  )
  pieces = drape_triangle(points, minecraft=True)
  basin, floor = basin_shapes()[0]
  assert floor == 12.4
  interior = basin.buffer(-0.001)
  inside_tops = 0
  for piece in pieces:
    normal = np.cross(piece[1] - piece[0], piece[2] - piece[0])
    projected = MultiPoint(piece[:, [0, 2]]).convex_hull
    if abs(normal[1]) > 1e-9 and projected.intersection(interior).area > 1e-8:
      inside_tops += 1
    if abs(normal[1]) < 1e-9 and projected.intersection(interior).length > 1e-8:
      assert np.max(piece[:, 1]) <= floor + 1e-9, (
        "Generated riser protrudes through the retained basin water"
      )
  assert inside_tops > 0


@pytest.mark.parametrize("minecraft", [False, True])
def test_basin_clipping_preserves_original_vertical_source_faces(
  minecraft: bool,
) -> None:
  points = np.array(
    [[2131.0, 3.09, -1419.0], [2133.0, 3.09, -1419.0], [2133.0, 3.28, -1419.0]]
  )
  pieces = drape_triangle(points, minecraft=minecraft)
  assert pieces and max(np.max(piece[:, 1]) for piece in pieces) > 12.4
  recovered = []
  for piece in pieces:
    flat = piece.copy()
    if minecraft:
      x, _, z = np.mean(piece, axis=0)
      flat[:, 1] -= sample_native_offset(x, z)
    else:
      flat[:, 1] -= [sample_offset(x, z) for x, _, z in piece]
    recovered.append(Polygon(flat[:, :2]))
  footprint = Polygon(points[:, :2])
  assert unary_union(recovered).symmetric_difference(footprint).area < 1e-8
  assert sum(piece.area for piece in recovered) == pytest.approx(
    footprint.area, abs=1e-8
  )


def _baseline(path: Path) -> bytes:
  return subprocess.check_output(
    ["git", "show", f"{BASE}:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def _payload(raw: bytes, path: Path) -> dict:
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def _packet_limits(packet: dict) -> None:
  """Check the consumer's limits independently of the producing adapter."""
  assert len(packet["meshes"]) <= 16
  vertex_count = index_count = 0
  for mesh in packet["meshes"]:
    assert mesh["positionType"] == "u16cm"
    points, colors, indices = _decode(mesh, packet["origin"])
    assert len(points) == len(colors)
    assert indices.size == 0 or int(indices.max()) < len(points)
    vertex_count += len(points)
    index_count += indices.size
  assert vertex_count <= 400_000
  assert index_count <= 2_400_000
  if packet.get("lines"):
    position_bytes = base64.b64decode(packet["lines"]["positions"])
    assert len(position_bytes) % 12 == 0
    assert len(position_bytes) // 6 <= 400_000
    if "colors" in packet["lines"]:
      assert (
        len(base64.b64decode(packet["lines"]["colors"])) == len(position_bytes) // 2
      )


def _receipt_ranges(runs: list, source_count: int, result_count: int) -> list:
  """Require a complete ordered partition, with no omitted or repeated source."""
  ranges = []
  source_cursor = result_cursor = 0
  for start, count, kind, dy_cm, outputs_per_source in runs:
    assert start == source_cursor
    assert isinstance(count, int) and count > 0
    assert isinstance(outputs_per_source, int) and outputs_per_source >= 0
    assert isinstance(dy_cm, int)
    assert kind in {"rigid", "terrain", "bank"}
    end = result_cursor + count * outputs_per_source
    assert end <= result_count
    ranges.append((start, count, kind, dy_cm, outputs_per_source, result_cursor, end))
    source_cursor += count
    result_cursor = end
  assert source_cursor == source_count
  assert result_cursor == result_count
  return ranges


def _terrain_coverage(
  source_cm: np.ndarray, pieces_cm: np.ndarray, minecraft: bool
) -> None:
  """Centimetre clipping may move edges by at most two centimetres."""
  source = Polygon(source_cm[:, [0, 2]] / 100)
  if source.area == 0:
    source_trace = MultiPoint(source_cm[:, [0, 2]] / 100).convex_hull
    if not len(pieces_cm):
      source_normal = np.cross(source_cm[1] - source_cm[0], source_cm[2] - source_cm[0])
      assert np.all(source_normal == 0) or source_trace.length <= 0.02
      return
    coverage = unary_union(
      [MultiPoint(piece[:, [0, 2]] / 100).convex_hull for piece in pieces_cm]
    )
    assert source_trace.difference(coverage.buffer(0.02)).length < 1e-8
    assert coverage.difference(source_trace.buffer(0.02)).length < 1e-8
    return
  if not len(pieces_cm):
    assert source.buffer(-0.02).is_empty
    return
  normals = np.cross(
    pieces_cm[:, 1] - pieces_cm[:, 0], pieces_cm[:, 2] - pieces_cm[:, 0]
  )
  if minecraft:
    assert np.all(np.count_nonzero(normals, axis=1) <= 1), (
      "Native ground must retain axis-aligned faces"
    )
    if (
      np.max(source_cm[:, 0]) >= 212400
      and np.min(source_cm[:, 0]) <= 214200
      and np.max(source_cm[:, 2]) >= -142400
      and np.min(source_cm[:, 2]) <= -139300
    ):
      # These belong to an originally horizontal face, so every vertical piece
      # is a generated terrace riser, rather than a retained source curb.
      basin, floor = basin_shapes()[0]
      interior = basin.buffer(-0.02)
      for piece in pieces_cm[normals[:, 1] == 0]:
        trace = MultiPoint(piece[:, [0, 2]] / 100).convex_hull
        if trace.intersection(interior).length > 1e-8:
          assert np.max(piece[:, 1]) <= round(floor * 100), (
            "Current native packet has a generated riser inside the basin"
          )
  else:
    collapsed = pieces_cm[normals[:, 1] == 0]
    for piece, normal in zip(collapsed, normals[normals[:, 1] == 0], strict=True):
      longest_edge = max(
        np.linalg.norm(piece[a] - piece[b]) for a, b in ((0, 1), (1, 2), (2, 0))
      )
      assert np.linalg.norm(normal) <= 2 * longest_edge, (
        "Only centimetre-thin quantization slivers may lose projected area"
      )
  tops = pieces_cm[normals[:, 1] != 0]
  if not len(tops):
    assert source.buffer(-0.02).is_empty
    return
  polygons = _project(tops / 100)
  coverage = unary_union(polygons)
  assert coverage.difference(source.buffer(0.02)).area < 1e-8
  assert source.buffer(-0.02).difference(coverage.buffer(0.02)).area < 1e-8
  tolerance = source.length * 0.02 + 0.002
  assert abs(coverage.area - source.area) <= tolerance
  # This also detects duplicate faces hidden by the union comparison.
  assert abs(sum(p.area for p in polygons) - source.area) <= tolerance


def _verify_mesh_receipts(
  source: dict, pieces: list[dict], origin: list, receipt: dict, minecraft: bool
) -> None:
  before, source_colors, source_indices = _decode(source, origin)
  source_triangles, source_rgb = before[source_indices], source_colors[source_indices]
  actual_triangles, actual_rgb = [], []
  for piece in pieces:
    assert {
      k: v for k, v in piece.items() if k not in {"positions", "colors", "indices"}
    } == {
      k: v for k, v in source.items() if k not in {"positions", "colors", "indices"}
    }
    positions, colors, indices = _decode(piece, origin)
    actual_triangles.append(positions[indices])
    actual_rgb.append(colors[indices])
  result_triangles = np.concatenate(actual_triangles)
  result_rgb = np.concatenate(actual_rgb)
  assert receipt["kind"] == source["kind"]
  assert receipt["sourceTriangles"] == len(source_triangles)
  assert receipt["resultTriangles"] == len(result_triangles)
  for start, count, kind, dy_cm, outputs, begin, end in _receipt_ranges(
    receipt["placementRuns"], len(source_triangles), len(result_triangles)
  ):
    original = source_triangles[start : start + count]
    colors = source_rgb[start : start + count]
    actual, actual_colors = result_triangles[begin:end], result_rgb[begin:end]
    if kind == "rigid":
      assert outputs == 1, (
        "Rigid source faces, including degenerate faces, must survive exactly once"
      )
      np.testing.assert_array_equal(actual, original + [0, dy_cm, 0])
      np.testing.assert_array_equal(actual_colors, colors)
    elif kind == "bank":
      assert source["kind"] == "city" and outputs == 1
      np.testing.assert_array_equal(actual[:, :, [0, 2]], original[:, :, [0, 2]])
      np.testing.assert_array_equal(actual_colors, colors)
    else:
      assert np.all(colors == colors[:, :1, :])
      if source["kind"] == "city":
        assert np.all(np.ptp(original[:, :, 1], axis=1) == 0)
        assert np.all(np.isin(original[:, 0, 1], [300, 301, 309, 312, 315]))
      else:
        assert source["kind"] in {"mitte-street-fronts-v166", "scheunenviertel-v168"}
        paving = np.all(original[:, :, 1] == 322, axis=1) & np.all(
          colors[:, 0] == [118, 111, 93], axis=1
        )
        kerb = (
          (np.min(original[:, :, 1], axis=1) >= 309)
          & (np.max(original[:, :, 1], axis=1) == 328)
          & np.all(colors[:, 0] == [168, 159, 133], axis=1)
        )
        assert np.all(paving | kerb), "Only evidenced old pavement/kerb roles may drape"
      if outputs:
        expected_colors = np.repeat(colors[:, :1, :], outputs * 3, axis=1).reshape(
          -1, 3, 3
        )
        np.testing.assert_array_equal(actual_colors, expected_colors)
      for offset in range(count):
        _terrain_coverage(
          original[offset], actual[offset * outputs : (offset + 1) * outputs], minecraft
        )


def _decode_lines(lines: dict, origin: list) -> tuple[np.ndarray, np.ndarray | None]:
  positions = np.frombuffer(base64.b64decode(lines["positions"]), dtype="<u2").reshape(
    -1, 2, 3
  )
  world = positions.astype(np.int64) + np.rint(np.asarray(origin) * 100).astype(
    np.int64
  )
  colors = (
    np.frombuffer(base64.b64decode(lines["colors"]), dtype="u1").reshape(-1, 2, 3)
    if "colors" in lines
    else None
  )
  return world, colors


def _verify_ink_receipts(
  source: dict, actual: dict, origin: list, receipt: dict
) -> None:
  before, source_colors = _decode_lines(source, origin)
  after, colors = _decode_lines(actual, origin)
  assert {k: v for k, v in source.items() if k not in {"positions", "colors"}} == {
    k: v for k, v in actual.items() if k not in {"positions", "colors"}
  }
  assert (colors is None) == (source_colors is None)
  assert receipt["sourceSegments"] == len(before)
  assert receipt["resultSegments"] == len(after)
  for start, count, kind, dy_cm, outputs, begin, end in _receipt_ranges(
    receipt["placementRuns"], len(before), len(after)
  ):
    original, result = before[start : start + count], after[begin:end]
    if source_colors is not None:
      np.testing.assert_array_equal(
        colors[begin:end],
        np.repeat(source_colors[start : start + count], outputs, axis=0),
      )
    if kind == "rigid":
      assert outputs == 1
      np.testing.assert_array_equal(result, original + [0, dy_cm, 0])
      continue
    assert kind == "terrain"
    if not outputs:
      # Existing zero-length kerb records have no line coverage to subdivide.
      np.testing.assert_array_equal(original[:, 0], original[:, 1])
      continue
    for offset, segment in enumerate(original):
      parts = result[offset * outputs : (offset + 1) * outputs]
      np.testing.assert_array_equal(parts[0, 0, [0, 2]], segment[0, [0, 2]])
      np.testing.assert_array_equal(parts[-1, 1, [0, 2]], segment[1, [0, 2]])
      np.testing.assert_array_equal(parts[:-1, 1], parts[1:, 0])
      points = np.concatenate([parts[:, 0], parts[-1:, 1]])[:, [0, 2]] / 100
      a, b = segment[:, [0, 2]] / 100
      direction = b - a
      length_sq = float(direction @ direction)
      assert length_sq > 0
      fractions = ((points - a) @ direction) / length_sq
      assert np.all(np.diff(fractions) >= -0.02 / np.sqrt(length_sq))
      projection = a + fractions[:, None] * direction
      assert np.max(np.linalg.norm(points - projection, axis=1)) <= 0.02


@pytest.fixture(scope="module")
def current_terrain_audit() -> dict:
  audit = json.loads(AUDIT.read_bytes())
  assert audit["baseRelease"] == BASE
  assert audit["packets"], "The release proof requires current transformed packets"
  assert len({entry["file"] for entry in audit["packets"]}) == len(audit["packets"])
  return audit


def test_current_packets_preserve_every_source_face_and_ink_segment(
  current_terrain_audit: dict,
) -> None:
  for row in current_terrain_audit["packets"]:
    path = ROOT / row["file"]
    baseline_bytes = _baseline(path)
    assert hashlib.sha256(baseline_bytes).hexdigest() == row["sourceSha256"], row[
      "file"
    ]
    source = _payload(baseline_bytes, path)
    outputs = []
    output_paths = [ROOT / name for name in row.get("outputFiles", [row["file"]])]
    assert output_paths[0] == path
    for output_path in output_paths:
      raw = output_path.read_bytes()
      if output_path == path:
        assert hashlib.sha256(raw).hexdigest() == row["sha256"], row["file"]
      packet = _payload(raw, output_path)
      assert packet["origin"] == source["origin"]
      _packet_limits(packet)
      outputs.append(packet)
    assert outputs[0]["id"] == source["id"] == row["id"]
    mesh_counts = row.get("resultMeshPieces", [1] * len(source["meshes"]))
    assert len(mesh_counts) == len(source["meshes"]) == len(row["meshes"])
    meshes = [mesh for packet in outputs for mesh in packet["meshes"]]
    assert sum(mesh_counts) == len(meshes)
    cursor = 0
    for source_mesh, count, receipt in zip(
      source["meshes"], mesh_counts, row["meshes"], strict=True
    ):
      assert count >= 1
      _verify_mesh_receipts(
        source_mesh,
        meshes[cursor : cursor + count],
        source["origin"],
        receipt,
        row["mode"] == "minecraft",
      )
      cursor += count
    if source.get("lines", {}).get("positions"):
      _verify_ink_receipts(
        source["lines"], outputs[0]["lines"], source["origin"], row["lines"]
      )
    else:
      assert not outputs[0].get("lines", {}).get("positions")
    for companion in outputs[1:]:
      assert not companion.get("lines", {}).get("positions")
      assert all(
        not companion["nav"][field]
        for field in ("ground", "water", "buildings", "roads", "bridges")
      )


def _git_blob_hash(raw: bytes) -> str:
  return hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()


def _verified_park_relief_v182_files() -> set[str]:
  """Allow later hill placement only with complete old-face/ink receipts.

  The v176 city remains the baseline. The later park operation uses v181,
  so also prove that its input was byte-identical to the older unaffected
  packet; naming a file in an audit alone cannot exempt it from preservation.
  """
  audit = json.loads(
    (ROOT / "geo_data/regierungsviertel/park-relief-v182-audit.json").read_bytes()
  )
  assert audit["baseline"] == "v1.0.81"
  files = set()
  for row in audit["outer"]:
    path = ROOT / row["file"]
    assert path.parent == PACKETS and row["file"] not in files
    files.add(row["file"])
    raw = subprocess.check_output(
      ["git", "show", f"{audit['baseline']}:{row['file']}"], cwd=ROOT
    )
    assert hashlib.sha256(raw).hexdigest() == row["baseSha256"]
    assert raw == _baseline(path)
    before, after = _payload(raw, path), _payload(path.read_bytes(), path)
    assert {k: v for k, v in before.items() if k not in {"meshes", "lines", "nav"}} == {
      k: v for k, v in after.items() if k not in {"meshes", "lines", "nav"}
    }
    assert len(before["meshes"]) == len(after["meshes"]) == len(row["meshes"])
    for source, current, receipt in zip(
      before["meshes"], after["meshes"], row["meshes"], strict=True
    ):
      _verify_mesh_receipts(
        source,
        [current],
        before["origin"],
        {"kind": source["kind"], **receipt},
        ".minecraft." in path.name,
      )
    if before.get("lines", {}).get("positions"):
      _verify_ink_receipts(
        before["lines"], after["lines"], before["origin"], row["lines"]
      )
    else:
      assert before.get("lines") == after.get("lines")
    assert {k: v for k, v in before["nav"].items() if k != "buildings"} == {
      k: v for k, v in after["nav"].items() if k != "buildings"
    }
    for a, b in zip(before["nav"]["buildings"], after["nav"]["buildings"], strict=True):
      assert {k: v for k, v in a.items() if k != "groundOffset"} == {
        k: v for k, v in b.items() if k != "groundOffset"
      }
  return files


def test_current_packet_manifests_and_untouched_assets_match_release(
  current_terrain_audit: dict,
) -> None:
  manifest_path = PACKETS / "manifest.json"
  before = json.loads(_baseline(manifest_path))
  after = json.loads(manifest_path.read_bytes())
  old_descriptors = {entry["id"]: entry for entry in before["chunks"]}
  descriptors = {entry["id"]: entry for entry in after["chunks"]}
  assert len(descriptors) == len(after["chunks"])
  assert old_descriptors.keys() <= descriptors.keys()
  relief_files = _verified_park_relief_v182_files()
  relief_ids = {Path(name).name.split(".")[0] for name in relief_files}
  supplement = json.loads(
    (ROOT / "geo_data/regierungsviertel/ring-city-v182-manifest.json").read_bytes()
  )
  ring_descriptors = {entry["id"]: entry for entry in supplement["chunks"]}
  assert ring_descriptors and not (ring_descriptors.keys() & old_descriptors.keys())
  assert all(identity.startswith("ring182-") for identity in ring_descriptors)
  assert ring_descriptors.keys() <= descriptors.keys()
  audited_files = {
    row["file"] for row in current_terrain_audit["packets"]
  } | relief_files
  emitted = {
    name
    for row in current_terrain_audit["packets"]
    for name in row.get("outputFiles", [row["file"]])
  }
  audited_outer = {
    row["id"] for row in current_terrain_audit["packets"] if not row.get("resident")
  }
  for identity, descriptor in descriptors.items():
    if identity in old_descriptors:
      previous = old_descriptors[identity]
      if identity not in audited_outer | relief_ids:
        assert descriptor == previous
      else:
        assert {
          k: v for k, v in descriptor.items() if k not in {"drawn", "minecraft"}
        } == {k: v for k, v in previous.items() if k not in {"drawn", "minecraft"}}
    elif identity in ring_descriptors:
      assert descriptor == ring_descriptors[identity]
    else:
      parent = descriptors[descriptor["detailCompanionOf"]]
      assert descriptor["bounds"] == parent["bounds"]
      assert descriptor["buildingCount"] == 0
      assert any(
        str((PACKETS / descriptor[mode]["url"]).relative_to(ROOT)) in emitted
        for mode in ("drawn", "minecraft")
      )
    for mode in ("drawn", "minecraft"):
      spec = descriptor[mode]
      path = PACKETS / spec["url"]
      raw = path.read_bytes()
      decoded = gzip.decompress(raw)
      assert len(raw) == spec["bytes"] <= 5 * 1024 * 1024
      assert len(decoded) == spec["decodedBytes"] <= 12 * 1024 * 1024
      assert hashlib.sha256(raw).hexdigest() == spec["sha256"], str(path)
      packet = json.loads(decoded)
      assert packet["id"] == identity
      _packet_limits(packet)
      if (
        identity not in old_descriptors
        and identity not in ring_descriptors
        and str(path.relative_to(ROOT)) not in emitted
      ):
        assert packet["meshes"] == []
        assert not packet.get("lines", {}).get("positions")
        assert all(
          not packet["nav"][field]
          for field in ("ground", "water", "buildings", "roads", "bridges")
        )
  for filename in ("altMitteDrawnV169Source.json", "altMitteNativeV169Source.json"):
    path = DATA / filename
    assert path.read_bytes() == _baseline(path)
  roots = [PACKETS, DATA / "altMitteV169Drawn", DATA / "altMitteV169Native"]
  entries = subprocess.check_output(
    [
      "git",
      "ls-tree",
      "-rz",
      BASE,
      "--",
      *(str(path.relative_to(ROOT)) for path in roots),
    ],
    cwd=ROOT,
  )
  for entry in entries.split(b"\0"):
    if not entry:
      continue
    header, name = entry.split(b"\t", 1)
    path = name.decode()
    if path == str(manifest_path.relative_to(ROOT)) or path in audited_files:
      continue
    expected = header.split()[2].decode()
    assert _git_blob_hash((ROOT / path).read_bytes()) == expected, (
      f"Unrelated packet changed: {path}"
    )
