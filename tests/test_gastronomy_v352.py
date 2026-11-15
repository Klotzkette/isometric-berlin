"""Complete dispositions and finite two-mode, source-owned gastronomy additions."""

import base64
import hashlib
from collections import Counter

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Polygon, shape

from scripts.build_mcdonalds_inventory_v351 import GEO, ROOT, read


def test_primary_inventories_are_complete_with_explicit_limits():
  source = read(GEO / "gastronomy-v352-source.json.gz")
  inventory = read(GEO / "gastronomy-v352-inventory.json.gz")
  assert len(source["records"]) == 102
  assert len(inventory["records"]) == 108
  bk = [r for r in source["records"] if r["category"] == "burger-king"]
  assert len(bk) == 44
  assert Counter(r["officialStatus"] for r in bk) == {
    "Open": 26,
    "Closed": 16,
    "Temp Closed": 1,
    "Projected": 1,
  }
  assert source["sources"][1]["cityCards"] == 23
  assert source["sources"][1]["distinctDetailPages"] == 22
  assert source["sources"][2]["verifiedDetailPages"] == 17
  assert "not an all-current-store guarantee" in source["sources"][2]["completeness"]
  assert len({r["id"] for r in inventory["records"]}) == 108


def test_every_site_has_an_outcome_and_closed_indoor_sites_are_not_reinvented():
  inv = read(GEO / "gastronomy-v352-inventory.json.gz")
  report = read(GEO / "gastronomy-v352-evidence.json.gz")
  assert set(report["outcomes"]) == {r["id"] for r in inv["records"]}
  assert sum(report["counts"]["statuses"].values()) == 108
  assert report["counts"]["admittedPlates"] == 5
  assert report["counts"]["supplementHosts"] == 5
  assert report["counts"]["visibleImprovedGastronomySites"] == 10
  for r in inv["records"]:
    status = report["outcomes"][r["id"]]["status"]
    if r.get("officialStatus") in ("Closed", "Temp Closed", "Projected"):
      assert status.startswith("operator-")
    if r.get("preOutcome") and (
      "concession" in r["preOutcome"] or "preserved" in r["preOutcome"]
    ):
      assert status == r["preOutcome"]
  assert (
    report["outcomes"]["starbucks/80337-309540"]["status"] == "source-wall-recognition"
  )
  assert (
    report["outcomes"]["starbucks/53208-282067"]["status"]
    == "existing-detailed-pariser-platz-model-preserved"
  )


def test_all_five_facades_have_full_production_support_and_old_geometry_proofs():
  report = read(GEO / "gastronomy-v352-evidence.json.gz")
  keys = set()
  for name, digest in report["runtimeSources"].items():
    path = ROOT / "src/app/src/data" / name
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest
    source = read(path)
    assert len(source["keys"]) <= 32
    assert set(source["keys"]) == set(source["packets"])
    keys.update(source["keys"])
    for p in source["packets"].values():
      assert not p["retire"] and p["preparedNavGuard"] and p["navGuard"]
  assert len(keys) == 10
  assert not report["pendingBunPrimaryGuards"]
  assert {r["key"] for r in report["actualPreparedGuards"]} == keys
  assert all(
    r["productionWordsAndNavigationUnchanged"]
    and r["fullyDecodedSignRectangleSupported"]
    for r in report["actualPreparedGuards"]
  )


def test_five_new_bodies_are_exact_source_owned_with_independent_native_and_dgm():
  report = read(GEO / "gastronomy-v352-supplements.json.gz")
  terrain = read(GEO / "gastronomy-v352-terrain.json.gz")
  assert len(report["sites"]) == 5 and report["bytes"] == 42471
  assert len(terrain["sites"]) == 5
  for name, digest in report["sourceFiles"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest
  public = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
  descriptors = {d["id"]: d for d in report["descriptors"]}
  for site in report["sites"]:
    assert site["officialStatus"] == "Open"
    assert site["coreAbsence"]["nativeEntireGridDisjoint"]
    assert "estimat" in site["heightEvidence"]
    assert (
      site["referencePhoto"] is not None
      if site["id"] == "bk/14659"
      else site["referencePhoto"] is None
    )
    for mode in ("drawn", "minecraft"):
      d = descriptors[site["host"]]
      pth = public / d[mode]["url"]
      assert hashlib.sha256(pth.read_bytes()).hexdigest() == d[mode]["sha256"]
      packet = read(pth)
      nav = packet["nav"]["buildings"][0]
      origin = packet["origin"]
      poly = translate(Polygon(nav["ring"], nav["holes"]), origin[0], origin[2])
      if mode == "drawn":
        assert poly.symmetric_difference(shape(site["sourceGeometry"])).area < 0.5
      else:
        assert all(
          a[0] == b[0] or a[1] == b[1] for a, b in zip(nav["ring"], nav["ring"][1:])
        )
      audit = site["precedingOwnershipAudit"][mode]
      assert audit["maximumOverlapArea"] == 0
      assert audit["oldGroundMeshesChanged"] == 0
      assert audit["newGroundComplementArea"] > 0
      assert packet["nav"]["ground"] and nav["height"] > 0
      for mesh in packet["meshes"]:
        xyz = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
        ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4")
        assert len(xyz) and max(ix) < len(xyz)
        assert len(base64.b64decode(mesh["colors"])) == xyz.size
        assert all(
          d["bounds"][0] - 0.011 <= x / 100 + origin[0] <= d["bounds"][2] + 0.011
          and d["bounds"][1] - 0.011 <= z / 100 + origin[2] <= d["bounds"][3] + 0.011
          for x, _, z in xyz
        )


def test_new_packets_are_actually_rendered_by_both_production_decoders():
  proof = read(GEO / "gastronomy-v352-supplement-production.json.gz")
  assert len(proof["proofs"]) == 10
  assert all(
    p["valid"] and p["vertices"] > 0 and p["triangles"] > 0 and p["groundPolygons"] > 0
    for p in proof["proofs"]
  )
  assert all(
    "gastronomy-buildings-v352" in p["sourceKinds"]
    and "gastronomy-v352" in p["sourceKinds"]
    for p in proof["proofs"]
  )
