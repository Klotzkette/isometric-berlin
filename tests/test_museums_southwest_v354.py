"""Finite museum corrections preserve old measured envelopes and source terrain."""

import base64
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Point, Polygon, shape
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from scripts import build_museums_southwest_v354 as museums  # noqa: E402


@pytest.fixture(scope="module")
def source():
  return museums.read(museums.SOURCE)


@pytest.fixture(scope="module")
def recipes():
  return museums.read(museums.DATA / "museumsSouthwestV354Packets.json.gz")


def test_complete_local_inventory_does_not_claim_all_huts_were_rebuilt(source):
  inventory = source["inventory"]
  assert len(inventory) == 37
  assert len({row["osmWay"] for row in inventory}) == 37
  assert Counter(row["status"] for row in inventory) == {
    "new-numbered-hut-photographic-typology-on-mapped-outline": 3,
    "unresolved-individual-photo-identity-no-guessed-house": 8,
    "existing-envelope-retained": 26,
  }
  for row in inventory:
    if row["osmWay"] in museums.HUTS:
      assert row["matches"] == {"drawn": [], "minecraft": []}
  assert "1170–1220" in source["period"]
  assert {f["id"] for f in source["originalFamilies"]} == museums.FAMILIES


@pytest.mark.parametrize("native", [False, True])
def test_material_successor_retires_only_complete_original_source_triangles(
  source, recipes, native
):
  mode = "minecraft" if native else "drawn"
  old, corrected = museums.family_models(source["originalFamilies"], native)
  plan = recipes["packets"][f"{mode}:publicInstitutions326--19_20-p0"]
  assert plan["append"] == corrected
  before = Counter(museums.key(t) for t in museums.mesh_positions(old, plan["origin"]))
  after = Counter(
    museums.key(t) for t in museums.mesh_positions(corrected, plan["origin"])
  )
  assert not before - after  # Every exact measured shell triangle survives.
  assert sum(after.values()) > sum(before.values())  # Source-attached courses.
  assert old["colors"] != corrected["colors"]
  raw = museums.read(museums.PUBLIC / f"publicInstitutions326--19_20-p0.{mode}.json.gz")
  wanted = Counter(museums.key(t) for t in museums.mesh_positions(old, raw["origin"]))
  removed = Counter()
  for retirement in plan["retire"]:
    mesh = raw["meshes"][retirement["mesh"]]
    triangles = museums.mesh_positions(mesh, raw["origin"])
    removed.update(museums.key(triangles[i]) for i in retirement["triangles"])
  assert removed == wanted
  assert plan["retireNav"] == plan["appendNav"] == plan["retireLines"] == []


def test_independent_native_hut_cells_stay_inside_each_mapped_outline(source):
  for row in source["mapped"]:
    if row["properties"].get("osm_way_id") not in museums.HUTS:
      continue
    geometry = shape(row["geometry"])
    detail, _, _ = museums.hut(row, True)
    for triangle, _, _ in detail.triangles:
      positions = np.asarray(triangle)
      normal = np.cross(positions[1] - positions[0], positions[2] - positions[0])
      assert np.count_nonzero(np.abs(normal) > 1e-8) == 1
      for x, _, z in positions:
        assert geometry.buffer(1e-7).covers(Point(x, z))


def test_six_finite_host_transfers_have_complete_receipts_and_no_ground_replacement(
  recipes,
):
  assert len(recipes["keys"]) == 6
  assert len(set(recipes["keys"])) == 6
  for plan in recipes["packets"].values():
    assert plan["records"] and plan["preparedRecords"]
    assert isinstance(plan["navGuard"], int)
    assert isinstance(plan["preparedNavGuard"], int)
    assert plan["append"]["kind"] == museums.KIND
    assert base64.b64decode(plan["append"]["indices"])
    assert not plan["retireNav"]
    assert not plan["retireLines"]
    assert not any("ground" in key.lower() for key in plan)
  index = museums.read(museums.DATA / "museumsSouthwestV354Index.json")
  assert index["decodedBytes"] < 2 * 1024 * 1024
  assert index["compressedBytes"] < 512 * 1024


def test_cafe_uses_only_mapped_seating_area_and_independent_physical_floor_samples(
  source,
):
  area = shape(
    next(
      r["geometry"]
      for r in source["brueckeMapped"]
      if r["properties"].get("osm_way_id") == "1558604602"
    )
  )
  models = [m for m in source["models"] if m.get("feature") == "kunsthaus-cafe-terrace"]
  assert len(models) == 2
  assert {m["independentNative"] for m in models} == {True, False}
  for model in models:
    assert model["tables"] == 4 and model["chairs"] == 8
    for group in model["groundSamples"]:
      assert area.covers(Point(group["center"]).buffer(1.2))
      assert len(group["support"]) == 24
      assert all(15 < sample[1] < 20 for sample in group["support"])
  assert models[0]["groundSamples"] != models[1]["groundSamples"]


def test_new_ground_stays_in_mapped_clearing_and_avoids_buildings_woodland(source):
  site = shape(source["villageSite"]["geometry"])
  forbidden = unary_union(
    [
      shape(r["geometry"])
      for r in source["mapped"]
      if r["properties"].get("building") or r["properties"].get("landuse") == "forest"
    ]
  )
  grounds = [
    m for m in source["models"] if m.get("feature") == "southern-village-ground"
  ]
  assert len(grounds) == 2
  areas = []
  for model in grounds:
    ground = unary_union([Polygon(p["ring"], p["holes"]) for p in model["coverage"]])
    assert ground.difference(site).area < 1e-6
    assert ground.intersection(forbidden).area < 1e-6
    assert 10000 < ground.area < 15000
    assert model["floorY"] == 3.02
    areas.append(ground.area)
  assert areas[1] < areas[0]  # Native cells have an independent contained edge.
