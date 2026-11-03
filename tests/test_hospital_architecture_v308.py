"""Measured hospital completeness, finite corrections and old packet complements."""

from __future__ import annotations

import base64
import gzip
import importlib
import math
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
hospital = importlib.import_module("build_hospital_architecture_v308")
fingerprint = importlib.import_module("build_rixdorf_v304").fingerprint

SOURCE = hospital.read(hospital.SOURCE)
HEIGHTS = hospital.read(hospital.HEIGHTS)
PROFILE = hospital.read(hospital.PROFILE)
CORE = hospital.read(hospital.CORE)


def test_complete_original_families_and_archives() -> None:
  """The false original main roof remains source evidence, never erased input."""
  assert [
    (s["key"], len(s["parents"]), sum(len(p["parts"]) for p in s["parents"]))
    for s in SOURCE["sites"]
  ] == [("benjamin-franklin", 1, 32), ("friedrichshain", 37, 100)]
  assert (
    sum(
      len(p["surfaces"])
      for s in SOURCE["sites"]
      for b in s["parents"]
      for p in b["parts"]
    )
    == 1368
  )
  for archive in SOURCE["archives"]:
    path = hospital.GEO / "raw/lod2" / archive["url"].rsplit("/", 1)[-1]
    assert hospital.sha(path) == archive["sha256"]
  assert SOURCE["heightEvidenceSha256"] == hospital.sha(hospital.HEIGHTS)


def test_only_exact_cbf_main_component_changes() -> None:
  """Each visible mapped region has its own finite independent height samples."""
  site = SOURCE["sites"][0]
  parent = site["parents"][0]
  corrected, receipt = hospital.cbf_corrected_parts(parent, HEIGHTS)
  original = next(p for p in parent["parts"] if p["id"] == hospital.CBF_MAIN)
  unchanged = [p for p in parent["parts"] if p["id"] != hospital.CBF_MAIN]
  assert corrected[:31] == unchanged
  assert receipt["untouchedParts"] == 31
  footprint = Polygon(original["ring"], original["holes"])
  new = [Polygon(p["ring"], p["holes"]) for p in corrected[31:]]
  assert unary_union(new).symmetric_difference(footprint).area < 1e-6
  assert receipt["originalPart"] == original
  for region in receipt["regions"]:
    expected = round(float(np.median(region["observationsNhnM"])) / 0.05) * 0.05
    assert math.isclose(region["roofNhnM"], expected)
    assert len(region["observationsNhnM"]) >= 3
  assert 52 < receipt["remainingLowRoofNhnM"] < 53
  assert any(74.5 < region["roofNhnM"] < 75.5 for region in receipt["regions"])


def test_all_old_outside_fragments_and_courts_survive() -> None:
  """Complete source sheets may refine the envelope, never trim old XZ outside."""
  for site in SOURCE["sites"]:
    parts, _ = hospital.transformed_parts(site, HEIGHTS)
    rendered = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
    for old in site["oldOwners"]:
      assert shape(old["geometry"]).difference(rendered).area < 1e-6
    for parent in site["parents"]:
      old = next(
        r
        for r in site["oldOwners"]
        if r["sourceId"]
        == (
          "OSM-relation-5943188" if site["key"] == "benjamin-franklin" else parent["id"]
        )
      )
      actual = min(p["ground_y_m"] for p in parent["parts"]) + parent["renderOffset"]
      assert abs(actual - (3 + old["minHeight"] + old["groundOffset"])) < 1e-8
    polygons = [rendered] if rendered.geom_type == "Polygon" else rendered.geoms
    assert any(p.interiors for p in polygons)


def test_explicit_earlier_materials_and_companions_audited() -> None:
  evidence = hospital.read(hospital.GEO / "hospitals-v308-reference-evidence.json")
  assert len(evidence["materialAudit"]["exactOwnerIds"]) >= 170
  for source in evidence["materialAudit"]["sources"]:
    assert hospital.sha(ROOT / source["path"]) == source["sha256"]
    assert not source["exactOwnerHits"]
  assert not evidence["district188Audit"]["exactOwnerHits"]
  assert all(r["checked"] == "2026-11-02" for r in evidence["references"])


def test_exact_native_roof_caps_and_region_holes() -> None:
  for site in PROFILE["sites"][:2]:
    rectangles = site["nativeNavigation"]
    assert rectangles and site["nativeRegions"]
    cardinal = unary_union(
      [
        box(x0 * 0.5, z0 * 0.5, x1 * 0.5, z1 * 0.5)
        for _, x0, z0, x1, z1, _, _ in rectangles
      ]
    )
    regions = unary_union(
      [Polygon(p["ring"], p["holes"]) for p in site["nativeRegions"]]
    )
    assert cardinal.symmetric_difference(regions).area < 1e-6
    assert all(
      hi > lo and abs((hi - 0.05) * 2 - round((hi - 0.05) * 2)) < 1e-7
      for _, _, _, _, _, lo, hi in rectangles
    )
  for site in PROFILE["sites"][2:]:
    receipt = site["retainedNativeWallReceipt"]
    assert receipt["wallTriangles"] > 0 and receipt["wallPlanePolygons"] > 0
    for source in receipt["packets"]:
      assert hospital.sha(ROOT / source["path"]) == source["sha256"]


def test_atomic_packet_plans_preserve_every_foreign_owner() -> None:
  source = hospital.read(hospital.DATA / "hospitalArchitectureV308Packets.json")
  audit = hospital.read(hospital.GEO / "hospitals-v308-packet-evidence.json")
  assert len(source["packets"]) == 8
  assert {k.split(":")[1] for k in source["keys"]} == {
    "8_-2",
    "9_-2",
    "outer187--8_16",
    "outer187--7_16",
  }
  for key, plan in source["packets"].items():
    mode, identity = key.split(":")
    raw = hospital.read(
      ROOT / f"src/app/public/mesh/surrounding-berlin-v159/{identity}.{mode}.json.gz"
    )
    prepared = hospital.read(hospital.RAW / f"{identity}.{mode}.prepared.json.gz")
    for packet, label in [(raw, "records"), (prepared, "preparedRecords")]:
      assert plan["origin"] == packet["origin"]
      assert len(plan[label]) == len(packet["meshes"])
      assert [fingerprint(m) for m in packet["meshes"]] == [
        p["fingerprint"] for p in plan[label]
      ]
    assert not plan["appendNav"] and "append" not in plan
    ids = {n["sourceId"] for n in plan["retireNav"]}
    assert ids == set(plan["owners"])
    assert all(n in prepared["nav"]["buildings"] for n in plan["retireNav"])
    for retirement in plan["retire"]:
      mesh = prepared["meshes"][retirement["mesh"]]
      assert mesh["kind"] == "city"
      rows = retirement["triangles"]
      assert rows == sorted(set(rows))
      assert max(rows) < len(base64.b64decode(mesh["indices"])) // 12
    assert all(
      n["sourceId"] not in ids or n in plan["retireNav"]
      for n in prepared["nav"]["buildings"]
    )
  assert all(p["requiredCompleteReplacement"] for p in audit["packets"])


def test_finite_product_payload_and_no_photo_pixels() -> None:
  paths = [
    hospital.CORE,
    hospital.PROFILE,
    hospital.DATA / "hospitalArchitectureV308Previous.json",
    hospital.DATA / "hospitalArchitectureV308Packets.json",
  ]
  total = sum(len(gzip.compress(path.read_bytes(), mtime=0)) for path in paths)
  assert total < 720_000
  assert len(CORE["sites"]) == 4
  for path in paths:
    text = path.read_text()
    assert "data:image" not in text and ".jpg" not in text and ".png" not in text
  assert [s["counts"]["sourceTriangles"] > 0 for s in CORE["sites"]] == [
    True,
    True,
    False,
    False,
  ]
