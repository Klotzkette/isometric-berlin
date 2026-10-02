"""Frozen source/ownership contracts for the complete v169 Alt-Mitte inventory."""

import gzip
import hashlib
import json
import subprocess
from collections import Counter
from pathlib import Path

import geopandas as gpd
import pytest
import shapely
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
SOURCE = DATA / "alt-mitte-v169"


def canonical(value):
  return json.dumps(value, sort_keys=True, separators=(",", ":"))


def footprint(record):
  return unary_union(
    [
      shapely.make_valid(Polygon(p["ring"], p["holes"]))
      for p in record["footprintPolygons"]
    ]
  )


@pytest.fixture(scope="module")
def catalog():
  manifest = json.loads((SOURCE / "source-manifest.json").read_bytes())
  appearance = json.loads(
    gzip.decompress((SOURCE / "appearance-baseline.json.gz").read_bytes())
  )
  original = json.loads(
    subprocess.check_output(
      ["git", "show", "v1.0.68:src/app/public/mesh/regierungsviertel/lod2-prisms.json"],
      cwd=ROOT,
    )
  )["buildings"]
  original_records = {canonical(p) for p in original}
  identities, selected_legacy, leaf_ids, geometry, records = {}, set(), set(), {}, {}
  counts = Counter()
  selected_surfaces = 0
  repair_ids = {
    r["sourcePolygonId"]
    for r in json.loads((SOURCE / "source-topology-audit.json").read_bytes())["repairs"]
  }
  repaired_rings = {}
  for chunk in manifest["chunks"]:
    compressed = (SOURCE / chunk["file"]).read_bytes()
    assert len(compressed) == chunk["bytes"] < 5 * 1024 * 1024
    assert hashlib.sha256(compressed).hexdigest() == chunk["sha256"]
    raw = gzip.decompress(compressed)
    assert len(raw) == chunk["decodedBytes"]
    buildings = json.loads(raw)["buildings"]
    assert len(buildings) == chunk["buildings"]
    assert dict(Counter(b["category"] for b in buildings)) == chunk["categories"]
    for record in buildings:
      assert record["id"] not in records
      keys = {record["id"], record["id"][-8:], *record["legacyPrismIds"]}
      for part in record["parts"]:
        leaf_ids.add(part["id"])
        keys.update((part["id"], part["id"][-8:]))
        assert part["topY"] >= part["groundY"]
        for surface in part["surfaces"]:
          assert all(len(ring) >= 3 for ring in surface["rings"])
          assert all(len(point) == 3 for ring in surface["rings"] for point in ring)
          counts[surface["kind"]] += 1
          if record["category"] != "retained" and surface["kind"] != "GroundSurface":
            selected_surfaces += 1
          if surface["sourcePolygonId"] in repair_ids:
            repaired_rings[surface["sourcePolygonId"]] = surface["rings"]
      for prism in record["legacyPrisms"]:
        assert canonical(prism) in original_records
      if record["category"] == "core":
        selected_legacy.update(record["legacyPrismIds"])
      if record["sourceType"] == "official-lod2":
        counts[record["category"] + "Families"] += 1
        counts[record["category"] + "Parts"] += len(record["parts"])
        assert record["outsideReleaseAreaM2"] == 0
      identities[record["id"]] = keys
      geometry[record["id"]] = footprint(record)
      records[record["id"]] = {
        k: v for k, v in record.items() if k not in {"parts", "footprintPolygons"}
      }
  return {
    "manifest": manifest,
    "appearance": appearance,
    "original": original,
    "records": records,
    "geometry": geometry,
    "identities": identities,
    "selectedLegacy": selected_legacy,
    "leafIds": leaf_ids,
    "counts": counts,
    "selectedSurfaces": selected_surfaces,
    "repairRings": repaired_rings,
  }


def test_frozen_inputs_and_complete_catalog(catalog):
  m = catalog["manifest"]
  assert m["baseRelease"] == "v1.0.68"
  assert (
    m["boundary"]["sha256"]
    == hashlib.sha256(
      (DATA / "alt-mitte-v169-boundary.geojson").read_bytes()
    ).hexdigest()
  )
  assert (
    m["appearanceBaseline"]["sha256"]
    == hashlib.sha256(
      (SOURCE / m["appearanceBaseline"]["file"]).read_bytes()
    ).hexdigest()
  )
  assert len(m["chunks"]) == 45
  assert len(catalog["records"]) == 15_914
  assert len(catalog["leafIds"]) == 26_768
  assert (
    sum(
      catalog["counts"][key]
      for key in ("WallSurface", "RoofSurface", "GroundSurface", "ClosureSurface")
    )
    == 369_689
  )
  expected = {
    "coreFamilies": 3983,
    "coreParts": 9111,
    "outerFamilies": 4391,
    "outerParts": 7597,
    "retainedFamilies": 5171,
    "retainedParts": 10060,
  }
  assert {key: catalog["counts"][key] for key in expected} == expected
  assert not m["audit"]["missingTiles"]
  assert not m["audit"]["unclassifiedExistingCorePrisms"]
  assert not m["audit"]["outerFamiliesWithoutOldOuterOwner"]
  assert len(m["audit"]["retainedBoundaryApproximationPrisms"]) == 10
  for chunk in m["transportEvidenceChunks"]:
    compressed = (SOURCE / chunk["file"]).read_bytes()
    assert hashlib.sha256(compressed).hexdigest() == chunk["sha256"]
    assert len(compressed) < 5 * 1024 * 1024


def test_official_core_leaves_are_independently_complete(catalog):
  boundary = shape(
    json.loads((DATA / "alt-mitte-v169-boundary.geojson").read_bytes())["features"][0][
      "geometry"
    ]
  )
  official = gpd.read_file(DATA / "buildings.gpkg")
  selected = {
    r.building_id
    for r in official[official.geometry.intersects(boundary)].itertuples()
    if r.geometry.intersection(boundary).area > 0.01
  }
  assert selected <= catalog["leafIds"]
  assert not catalog["manifest"]["audit"][
    "existingOfficialCoreLeafIdsMissingFromSource"
  ]
  assert catalog["manifest"]["counts"]["boundaryStraddlers"] == 35


def test_existing_authored_facades_and_glass_are_not_replaced(catalog):
  a = catalog["appearance"]
  reserved = set(a["glassPrismIds"])
  reserved.update(a["heroPrismTones"])
  reserved.update(a["heroPrismRoofTones"])
  reserved.update(a["heroWindowFormats"])
  for identities in a["specialIdSets"].values():
    reserved.update(identities)
  assert not catalog["selectedLegacy"] & reserved
  assert len(catalog["selectedLegacy"]) == 5426
  for identity, record in catalog["records"].items():
    if record["category"] != "retained":
      assert not catalog["identities"][identity] & reserved
  retained_types = Counter(
    r.get("retentionReasonType", "authored-or-glass")
    for r in catalog["records"].values()
    if r["sourceType"] == "official-lod2" and r["category"] == "retained"
  )
  assert retained_types == {"authored-or-glass": 3812, "source-conflict": 1359}


def test_atomic_geometric_replacements_cover_whole_original_owners(catalog):
  by_id = {}
  for p in catalog["original"]:
    by_id.setdefault(p["id"], []).append(
      Polygon(
        [(x / 10, z / 10) for x, z in p["ring"]],
        [[(x / 10, z / 10) for x, z in h] for h in p["holes"]],
      )
    )
  groups = catalog["manifest"]["audit"]["coreFootprintBindingGroups"]
  assert Counter(g["status"] for g in groups) == {
    "replace-complete-legacy-group": 911,
    "retain-old-mass-source-conflict": 770,
    "new-core-source-without-old-mass": 887,
  }
  for group in groups:
    if group["status"] != "replace-complete-legacy-group":
      continue
    assert not group["reservedLegacyIds"]
    assert all(
      catalog["records"][key]["category"] == "core" for key in group["sourceFamilyIds"]
    )
    official = unary_union(
      [catalog["geometry"][key] for key in group["sourceFamilyIds"]]
    )
    legacy = unary_union(
      [shapely.make_valid(g) for key in group["legacyPrismIds"] for g in by_id[key]]
    )
    assert official.difference(legacy.buffer(0.25)).area <= official.area * 0.01
    assert legacy.difference(official.buffer(0.25)).area <= legacy.area * 0.01
    assert set(group["legacyPrismIds"]) <= catalog["selectedLegacy"]


def test_topology_repairs_and_tiny_residuals_remain_explicit(catalog):
  audit = json.loads((SOURCE / "source-topology-audit.json").read_bytes())
  assert (
    audit["sourceManifestSha256"]
    == hashlib.sha256((SOURCE / "source-manifest.json").read_bytes()).hexdigest()
  )
  assert not audit["errors"]
  assert len(audit["repairs"]) == 23
  assert audit["finalSelectedSurfaceCount"] == catalog["selectedSurfaces"] == 213_916
  assert audit["validationSuperset"]["checkedSurfaces"] == 221_529
  assert len(catalog["repairRings"]) == 23
  assert audit["originalSourceShapeProof"] == {
    "families": 13545,
    "parts": 26768,
    "polygons": 369689,
    "missingAncestorSurfaces": 0,
    "method": "Independent streamed GML exterior/interior ring-size and polygon-ID comparison for every extracted family; all match.",
  }
  first = catalog["records"]["OSM-way-1030739581"]
  assert first["category"] == "coreFallback" and first["needsResidualShell"]
  assert first["residualShellHeightM"] == 9 and first["groundY"] == 5.2
  assert first["sourceAttributes"]["height_source"] == "display_fallback:building=yes"
  assert not first["legacyPrisms"]
  assert catalog["geometry"][first["id"]].area == pytest.approx(0.016984)
  second = catalog["records"]["OSM-way-390739569"]
  assert (
    second["category"] == "retained" and second["retentionReasonType"] == "source-fused"
  )
  assert second["residualSourceAudit"]["coveredFraction"] == pytest.approx(
    0.9945504007212007
  )
  assert second["residualSourceAudit"]["uncoveredAreaM2"] == pytest.approx(
    0.003204857564669407
  )
  assert [
    r["id"] for r in catalog["records"].values() if r.get("needsResidualShell")
  ] == [first["id"]]
