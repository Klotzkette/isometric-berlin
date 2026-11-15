"""The new church may replace its proven old proxy, never its neighbours."""

import base64
import sys
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_nikolaikirche_v353 as church  # noqa: E402


@pytest.fixture(scope="module")
def source():
  return church.church_source()


@pytest.mark.parametrize("native", [False, True])
def test_exact_original_geometry_is_the_complete_retirement(source, native):
  original, building = source
  mode = "minecraft" if native else "drawn"
  recipes = church.read(ROOT / "src/app/src/data/nikolaikircheV353Packets.json.gz")
  old, fittings = church.old_details(original, building, native)
  for host, detail, kind in [
    ("4_0", old, "alt-mitte-v169"),
    ("nikolai239-4_0", fittings, "nikolaiviertel-v239"),
  ]:
    packet = church.read(
      ROOT / f"src/app/public/mesh/surrounding-berlin-v159/{host}.{mode}.json.gz"
    )
    expected = church.select_exact(packet, detail, kind)
    plan = recipes["packets"][f"{mode}:{host}"]
    assert plan["retire"] == expected
    assert plan["owners"] == [church.CHURCH]
    assert len(plan["retireNav"]) == (2 if host == "4_0" else 0)


def test_roof_partition_covers_actual_church_plan_without_new_ground(source):
  _, building = source
  full, parts = church.hall_parts(building)
  assert full.symmetric_difference(unary_union([p for p, _, _ in parts])).area < 1e-8
  for poly, eave, role in parts:
    triangles = church.roof_triangles(poly, eave, role)
    coverage = unary_union([Polygon([(p[0], p[2]) for p in t]) for t in triangles])
    assert coverage.symmetric_difference(poly).area < 1e-8
  assert church.BASE == building["groundY"] == 3
  assert church.TOP - church.BASE == 84.4
  assert len(church.CENTERS) == 2


def test_specific_materials_and_independent_native_geometry(source):
  _, building = source
  drawn, _ = church.drawn_body(building)
  roles = {role for _, _, role in drawn.triangles}
  assert {
    "fieldstone blocks",
    "west oculus",
    "clock dial",
    "pale blind tracery",
    "chapel stepped gable",
    "hall tile roof",
    "sacristy tile roof",
  } <= roles
  assert "window glazing" not in roles  # old ordinary-house recipe
  native, columns = church.native_body(building)
  spires, _ = church.native_spires()
  for triangle, _, _ in native.triangles + spires.triangles:
    a, b, c = np.asarray(triangle)
    assert np.count_nonzero(np.abs(np.cross(b - a, c - a)) > 1e-8) == 1
  for triangle, _, role in native.triangles:
    if role == "native merged coplanar surface":
      continue
    points = np.asarray(triangle)
    axis = 0 if np.ptp(points[:, 0]) < 1e-8 else 2
    tangent = 2 if axis == 0 else 0
    plane = float(points[0, axis])
    boundary = round(plane)
    assert abs(plane - boundary) <= 0.23
    tangential_cell = int(np.floor(points[:, tangent].mean()))
    candidates = []
    for coordinate in [boundary - 1, boundary]:
      key = (
        (coordinate, tangential_cell) if axis == 0 else (tangential_cell, coordinate)
      )
      height = columns.get(key, (0, 0))[1]
      if height >= points[:, 1].max() - 0.001:
        candidates.append(key)
    assert candidates, (role, triangle)
  merged = church.merge_native_faces(native)
  assert len(merged.triangles) < len(native.triangles)

  def coverage(detail):
    groups = {}
    for triangle, color, _ in detail.triangles:
      points = np.asarray(triangle)
      normal = np.cross(points[1] - points[0], points[2] - points[0])
      axis = int(np.argmax(np.abs(normal)))
      axes = [i for i in range(3) if i != axis]
      key = (axis, np.sign(normal[axis]), round(points[0, axis], 9), tuple(color))
      groups.setdefault(key, []).append(Polygon(points[:, axes]))
    return {key: unary_union(polygons) for key, polygons in groups.items()}

  before, after = coverage(native), coverage(merged)
  assert before.keys() == after.keys()
  for key in before:
    assert before[key].symmetric_difference(after[key]).area < 1e-7


def test_runtime_source_has_only_five_bounded_local_hosts():
  data = ROOT / "src/app/src/data"
  recipes = church.read(data / "nikolaikircheV353Packets.json.gz")
  index = church.read(data / "nikolaikircheV353Index.json")
  assert set(recipes["keys"]) == {
    "drawn:4_0",
    "minecraft:4_0",
    "drawn:nikolai239-4_0",
    "minecraft:nikolai239-4_0",
    "drawn:4_0-alt-mitte-v169-1",
  }
  assert index["decodedBytes"] < 2 * 1024 * 1024
  assert index["compressedBytes"] < 512 * 1024
  for plan in recipes["packets"].values():
    assert plan["append"]["kind"] == church.KIND
    assert base64.b64decode(plan["append"]["indices"])
    assert not any("ground" in key.lower() for key in plan)
