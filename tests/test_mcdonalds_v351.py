"""Current identities, exact source additions and complete per-branch outcomes."""

import base64
import hashlib

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Point, Polygon, shape

from scripts.build_mcdonalds_inventory_v351 import (
  GEO,
  INVENTORY,
  OSM,
  PROJECTION,
  ROOT,
  SOURCE,
  boundary,
  mapped_restaurant,
  read,
)


def test_complete_operator_feed_and_all_mapped_restaurants_are_accounted_for():
  source = read(SOURCE)
  inventory = read(INVENTORY)
  osm = read(OSM)
  assert source["allLocatorRecords"] == 1406 and source["responseKeys"] == ["locations"]
  assert len(source["records"]) == len(inventory["records"]) == 40
  assert all(
    boundary().covers(Point(*PROJECTION(r["lng"], r["lat"]))) for r in source["records"]
  )
  assert (
    not source["postalBerlinOutsideBoundary"]
    and not source["insideBerlinWithDifferentPostalCity"]
  )
  ids = [r["osmId"] for r in inventory["records"]]
  assert len(set(ids)) == 40
  assert set(ids) == {r["id"] for r in osm["records"] if mapped_restaurant(r)}
  assert not inventory["audit"]["unmatchedActiveMappedRestaurants"]
  assert len(inventory["audit"]["historicalOrNonRestaurantObjects"]) == 9
  assert all(r["futureOpeningDate"] is None for r in source["records"])
  # The sanitized record contract explicitly excludes operator contacts/persons.
  allowed = {
    "id",
    "identifier",
    "name",
    "streetAndNumber",
    "addressExtra",
    "city",
    "zip",
    "lat",
    "lng",
    "futureOpeningDate",
    "services",
    "referencePhotos",
    "detailUrl",
    "detailSha256",
  }
  assert all(set(r) <= allowed for r in source["records"])


def test_indoor_concessions_never_acquire_a_false_exterior_and_hbf_is_preserved():
  receipt = read(GEO / "mcdonalds-v351-evidence.json.gz")
  outcomes = receipt["outcomes"]
  assert set(outcomes) == {r["id"] for r in read(INVENTORY)["records"]}
  assert (
    outcomes["mcdonalds:1384"]["status"] == "existing-hauptbahnhof-interior-preserved"
  )
  for fid in ["1435", "1403", "1672", "1733", "1326", "992"]:
    assert (
      outcomes["mcdonalds:" + fid]["status"]
      == "indoor-or-upper-floor-concession-no-exterior-invented"
    )
  for fid in ["1194", "1723", "1867"]:
    assert (
      outcomes["mcdonalds:" + fid]["status"] == "mall-or-platform-frontage-unresolved"
    )
  assert sum(receipt["counts"]["statuses"].values()) == 40
  assert receipt["counts"]["visibleImprovedRestaurants"] == 18


def test_all_existing_wall_signs_have_exact_production_and_full_rectangle_proofs():
  receipt = read(GEO / "mcdonalds-v351-evidence.json.gz")
  keys = set()
  for file, digest in receipt["runtimeSources"].items():
    p = ROOT / "src/app/src/data" / file
    assert hashlib.sha256(p.read_bytes()).hexdigest() == digest
    packet = read(p)
    assert len(packet["keys"]) <= 32
    keys.update(packet["keys"])
  proof = receipt["completeProductionProof"]
  assert proof["allSourceFamiliesPassed"]
  assert {r["key"] for r in proof["keys"]} == keys
  assert all(r["valid"] and r["fullyDecodedSupport"] for r in proof["keys"])
  assert len(keys) == 18


def test_nine_new_bodies_use_exact_drawn_footprints_and_independent_cardinal_native():
  report = read(GEO / "mcdonalds-v351-supplements.json.gz")
  assert len(report["sites"]) == 9
  assert report["bytes"] < 100000
  public = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
  descriptors = {r["id"]: r for r in report["descriptors"]}
  terrain = {
    r["siteId"]: r for r in read(GEO / "mcdonalds-v351-terrain.json.gz")["sites"]
  }
  for site in report["sites"]:
    assert site["osmId"] == terrain[site["id"]]["roofId"]
    assert "estimate" in site["heightEvidence"]
    assert site["terrainSamples"] == len(terrain[site["id"]]["samples"])
    for mode in ["drawn", "minecraft"]:
      descriptor = descriptors[site["host"]][mode]
      p = public / descriptor["url"]
      assert hashlib.sha256(p.read_bytes()).hexdigest() == descriptor["sha256"]
      packet = read(p)
      nav = packet["nav"]["buildings"][0]
      origin = packet["origin"]
      poly = translate(Polygon(nav["ring"], nav["holes"]), origin[0], origin[2])
      if mode == "drawn":
        assert poly.symmetric_difference(shape(site["sourceGeometry"])).area < 0.5
      else:
        for a, b in zip(nav["ring"], nav["ring"][1:]):
          assert a[0] == b[0] or a[1] == b[1]
      assert nav["minHeight"] <= 0 and nav["height"] > 0
      assert len(packet["meshes"]) == 2
      assert packet["nav"]["ground"]
      assert site["precedingOwnershipAudit"][mode]["maximumOverlapArea"] == 0
      assert site["precedingOwnershipAudit"][mode]["oldGroundOverlapArea"] == 0
      assert site["precedingOwnershipAudit"][mode]["oldGroundMeshesChanged"] == 0
      assert site["precedingOwnershipAudit"][mode]["newGroundComplementArea"] > 0
      for mesh in packet["meshes"]:
        xyz = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
        ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4")
        assert len(xyz) > 0 and max(ix) < len(xyz)
        assert len(base64.b64decode(mesh["colors"])) == xyz.size
