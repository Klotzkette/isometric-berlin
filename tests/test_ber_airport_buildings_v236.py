"""Replayed airport solids, source preservation and the narrow bridge correction."""

import hashlib
import importlib
import sys
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Polygon, box, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
b = importlib.import_module("build_ber_airport_buildings_v236")


@pytest.fixture(scope="module")
def built():
  evidence_before, patch_before = b.EVIDENCE.read_bytes(), b.ROOF_PATCH.read_bytes()
  result = b.build()
  assert b.EVIDENCE.read_bytes() == evidence_before
  assert b.ROOF_PATCH.read_bytes() == patch_before
  return result


def polygon_set(rows):
  return unary_union([Polygon(r[0], r[1:]) for r in rows])


def box_set(rows):
  return unary_union(
    [
      box(r[0] - r[3] / 2, r[2] - r[5] / 2, r[0] + r[3] / 2, r[2] + r[5] / 2)
      for r in rows
    ]
  )


def test_complete_retained_sources_and_landside_ids_are_replayable(built):
  source = b.read(b.SOURCE)
  records = {f["id"]: f for f in source["features"]}
  assert len(records) == 259
  for path, digest in source["retainedSourceSha256"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
  regional = b.read(b.GEO / "region-outlines-v200-source.json.gz")
  old_buildings = [
    f
    for f in regional["features"]
    if f.get("site") == "BER" and f["kind"] == "building"
  ]
  assert len(old_buildings) == 165
  assert {f["id"] for f in old_buildings} <= records.keys()
  for f in b.read(b.GEO / "ber-v205-parts-source.json")["features"]:
    assert records[f["id"]]["geometry"] == f["geometry"]
    assert records[f["id"]]["tags"] == f["tags"]
  landside = [f for f in records.values() if f["origin"] == "mapped-landside-v236"]
  assert {int(f["id"].split("/")[1]) for f in landside} == b.LANDSIDE
  exact_scope = unary_union(
    [transform(b.world, shape(f["geometry"])) for f in landside]
  )
  assert built["scope"].symmetric_difference(exact_scope).area < 1e-8


def test_elevated_parts_preserve_clearances_and_do_not_become_generic_fills(built):
  records = {r["id"]: r for r in built["evidence"]["records"]}
  nav = {n["sourceId"]: n for n in built["navigation"]}
  assert records["way/519141133"]["low"] == 27
  assert records["way/519141133"]["high"] == 31
  assert records["way/1082978627"]["low"] == 9
  assert records["way/1082978627"]["high"] == 21
  assert records["way/180868586"]["parent"] == b.NORTH_PIER
  for identity in b.T2_BRIDGES:
    assert records[identity]["low"] == 8
    assert records[identity]["high"] == 12
    assert nav[identity]["minHeight"] == 5
    assert (
      nav[b.NORTH_PIER]["geometry"].intersection(nav[identity]["geometry"]).area < 1e-7
    )
  for identity in [
    *b.OUTLINE_PARENTS,
    "way/138543326",
    "way/217135854",
    "way/274931136",
    "way/1004787836",
    "way/519141135",
    "way/1458486815",
    "way/1458486816",
    "way/1501064991",
  ]:
    assert records[identity]["action"] == "retained outline only"
    assert identity not in nav
  assert len(nav) == 210
  assert nav["way/700218390"]["mappedStoreys"] == 2
  assert nav["way/157811263"]["mappedStoreys"] == 5
  t2_glass_levels = {
    round(min(p[1] for p in points), 3)
    for points, _, role in built["drawn"].triangles
    if role == "way/700218390 glazing"
  }
  assert t2_glass_levels == {4.5, 12.0}


def test_old_roof_patch_is_exactly_two_bridges_and_preserves_every_other_roof(built):
  old = b.read(b.OLD)
  p = next(p for p in old["buildings"] if p["id"] == b.NORTH_PIER)
  patch = b.read(b.ROOF_PATCH)
  assert patch["id"] == b.NORTH_PIER
  assert patch["bridgeIds"] == sorted(b.T2_BRIDGES)
  assert patch["originalFileSha256"] == hashlib.sha256(b.OLD.read_bytes()).hexdigest()
  assert patch["sourceSha256"] == old["sourceSha256"]
  assert (
    patch["buildingSourceSha256"] == hashlib.sha256(b.SOURCE.read_bytes()).hexdigest()
  )
  nav = {n["sourceId"]: n for n in built["navigation"]}
  bridges = unary_union([nav[i]["geometry"] for i in b.T2_BRIDGES])
  original = Polygon(p["rings"][0], p["rings"][1:])
  remainder = polygon_set(patch["drawnRings"])
  assert remainder.symmetric_difference(original.difference(bridges)).area < 1e-7
  assert remainder.intersection(bridges).area < 1e-8
  assert original.difference(remainder.union(bridges)).area < 1e-7
  assert patch["removedArea"]["drawn"] == pytest.approx(183.314358568, abs=1e-6)
  ncut = b.native_polygon(bridges)
  noriginal = box_set(p["native"])
  nremainder = box_set(patch["nativeRows"])
  assert nremainder.symmetric_difference(noriginal.difference(ncut)).area < 1e-7
  assert polygon_set(patch["nativeRings"]).symmetric_difference(nremainder).area < 1e-7
  for row in p["native"]:
    if box_set([row]).intersection(ncut).area < 1e-9:
      assert row in patch["nativeRows"]
  roles = {r for _, _, r in built["drawn"].triangles}
  for part in old["buildings"]:
    assert part["id"] + " source roof" not in roles
    if part["column"]:
      assert not any(r.startswith(part["id"] + " ") for r in roles)


def test_native_geometry_is_independent_orthogonal_and_all_meshes_are_finite(built):
  assert built["drawn"] is not built["minecraft"]
  for mode, max_triangles in [("drawn", 40_000), ("minecraft", 170_000)]:
    triangles = built[mode].triangles
    assert 10_000 < len(triangles) < max_triangles
    points = np.array([t[0] for t in triangles])
    assert points.shape[1:] == (3, 3)
    assert np.isfinite(points).all()
    normals = np.cross(points[:, 1] - points[:, 0], points[:, 2] - points[:, 0])
    magnitudes = np.linalg.norm(normals, axis=1)
    assert (magnitudes > 1e-10).all()
    if mode == "minecraft":
      normalized = normals / magnitudes[:, None]
      assert np.all(np.count_nonzero(abs(normalized) > 1e-7, axis=1) == 1)
    assert np.min(points[:, :, 1]) >= 3
    assert np.max(points[:, :, 1]) <= 73
  source = b.read(b.SOURCE)
  mapped = transform(
    b.world,
    shape(next(f for f in source["features"] if f["id"] == "way/69121319")["geometry"]),
  )
  shaft = next(n for n in built["navigation"] if n["sourceId"] == "way/69121319")
  assert mapped.covers(shaft["geometry"])
  assert 0 < shaft["geometry"].area < mapped.area / 4
  assert "estimated" in shaft["heightSource"]
