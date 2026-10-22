"""EUREF placement, complete owner retention and exact packet complements."""

import copy
import gzip
import hashlib
import importlib
import json
import sys
from pathlib import Path

import numpy as np
import pytest
from shapely import wkb
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
build = importlib.import_module("build_euref_v262")
adapter = importlib.import_module("integrate_euref_v262")


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


SOURCE = read(build.SOURCE)
ADDITION = read(build.ADDITION)
EVIDENCE = read(build.EVIDENCE)


def test_exact_current_campus_and_numbered_owner_identity() -> None:
  campus = Polygon(SOURCE["campus"]["ring"])
  assert SOURCE["campus"]["osmId"] == 23458867
  assert campus.area == pytest.approx(54579.986, abs=0.02)
  assert len(SOURCE["buildings"]) == 19
  for building in SOURCE["buildings"]:
    old = wkb.loads(building["oldOwner"]["wkb"], hex=True)
    assert campus.buffer(0.5).covers(old), building["name"]
    assert building["osmId"] == build.OWNERS[building["id"]][1]
    full = unary_union([shape(g) for p in building["parts"] for g in p["footprints"]])
    assert full.symmetric_difference(old).area < 0.000001
    assert all(
      s["sourcePolygonId"] and len(s["rings"][0]) >= 3
      for p in building["parts"]
      for s in p["surfaces"]
    )
  water = next(b for b in SOURCE["buildings"] if b["id"] == "DEBE07YY900004na")
  assert len(water["parts"]) > 1
  assert (
    max(p["maxY"] for p in water["parts"]) - min(p["maxY"] for p in water["parts"]) > 12
  )
  assert "Werkstatt 26" in {b["name"] for b in SOURCE["buildings"]}


def test_gasometer_retained_envelope_and_source_conflict_are_explicit() -> None:
  gas = next(b for b in SOURCE["buildings"] if b["id"] == SOURCE["gasometer"]["owner"])
  assert not gas["replace"]
  assert gas["osmId"] == 1307229197 and gas["osmTags"]["start_date"] == "2024-01-31"
  assert gas["oldOwner"]["height"] == 65.48
  assert SOURCE["gasometer"]["sourceRoofY"] == pytest.approx(68.484, abs=0.001)
  assert SOURCE["gasometer"]["center"] == pytest.approx(
    [-1057.13922, 3, 4149.08124], abs=0.00001
  )
  assert SOURCE["gasometer"]["frameHeightM"] == 78
  assert SOURCE["gasometer"]["terraceHeightM"] == 66
  conflict = SOURCE["gasometer"]["geometryConflict"]
  inner, outer = Polygon(conflict["innerBodyRing"]), Polygon(conflict["outerRing"])
  retained = wkb.loads(gas["oldOwner"]["wkb"], hex=True)
  assert inner.area / retained.area == pytest.approx(0.62, abs=0.01)
  assert retained.intersection(outer).area / retained.union(outer).area > 0.99
  assert conflict["sourceEnvelopeAreaM2"] == retained.area
  assert SOURCE["gasometer"]["nativeFrameRadiusEstimateM"] == 33.5
  assert all(gas["id"] not in r["owners"] for r in EVIDENCE["receipts"])


@pytest.mark.parametrize(
  "replacement", ADDITION["replacements"], ids=lambda r: r["old"]["id"]
)
@pytest.mark.parametrize("family", ["drawn", "minecraft"])
def test_complete_exact_old_complement_and_no_unrelated_navigation_change(
  replacement: dict, family: str
) -> None:
  old = read(build.OUT / replacement["old"][family]["url"])
  new = read(build.OUT / replacement["new"][family]["url"])
  receipt = next(
    r for r in EVIDENCE["receipts"] if r["id"] == old["id"] and r["family"] == family
  )
  buildings = [b for b in SOURCE["buildings"] if b["id"] in receipt["owners"]]
  stripped = copy.deepcopy(old)
  assert build.remove_old(
    stripped, buildings, family, replacement["old"]["bounds"]
  ) == {
    k: receipt[k]
    for k in [
      "removedTriangles",
      "expectedTriangles",
      "removedSignatureSha256",
      "removedInkSegments",
      "oldOwnedNavigation",
      "unrelatedNavigationSha256",
      "retainedMeshComplementSha256",
      "retainedLineComplementSha256",
      "runtimeRecords",
      "runtimeSegments",
      "runtimeLineFingerprint",
    ]
  }
  assert receipt["removedTriangles"] == receipt["expectedTriangles"] > 0
  assert new["meshes"][: len(old["meshes"])] == old["meshes"]
  for before, after in zip(old["meshes"], new["meshes"], strict=False):
    assert (
      before["positions"] == after["positions"] and before["colors"] == after["colors"]
    )
  assert {k: v for k, v in new.items() if k != "meshes"} == {
    k: v for k, v in old.items() if k != "meshes"
  }
  runtime = read(build.TRANSFERS)["packets"][f"{family}:{old['id']}"]
  assert runtime["records"] == receipt["runtimeRecords"]
  assert runtime["segments"] == receipt["runtimeSegments"]
  assert runtime["navigationFingerprint"] == build.fingerprint(
    [build.json_for_js(old["nav"])]
  )
  assert runtime["buildings"] == build.navigation(
    buildings, replacement["old"]["bounds"], family == "minecraft"
  )
  assert all(r.get("partId") for r in runtime["buildings"])


@pytest.mark.parametrize(
  "replacement", ADDITION["replacements"], ids=lambda r: r["old"]["id"]
)
def test_independent_native_meshes_have_only_axis_aligned_faces(
  replacement: dict,
) -> None:
  old = read(build.OUT / replacement["old"]["minecraft"]["url"])
  new = read(build.OUT / replacement["new"]["minecraft"]["url"])
  for mesh in new["meshes"][len(old["meshes"]) :]:
    points, indices = build.arrays(mesh)
    p = points.astype(np.int64)[indices]
    normals = np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0])
    assert np.all((normals != 0).sum(axis=1) <= 1)


def test_adapter_preserves_every_manifest_field_and_rejects_tampering() -> None:
  current = read(build.OUT / "manifest.json")
  previous = adapter.predecessor_manifest_v262(current)
  result = adapter.merged(previous, ADDITION)
  assert adapter.predecessor_manifest_v262(result) == previous
  assert result["footprint"] == previous["footprint"]
  assert len(result["chunks"]) == len(previous["chunks"])
  for a, b in zip(previous["chunks"], result["chunks"], strict=True):
    if a["id"] not in adapter.REPLACED:
      assert a == b
  bad = copy.deepcopy(result)
  bad["waterY"] += 1
  with pytest.raises(AssertionError, match="Unreceipted"):
    adapter.predecessor_manifest_v262(bad)
  bad = copy.deepcopy(result)
  next(c for c in bad["chunks"] if c["id"] == "-3_7")["drawn"]["sha256"] = "0" * 64
  with pytest.raises(AssertionError):
    adapter.predecessor_manifest_v262(bad)


def test_frozen_source_and_all_packet_bytes_are_verified() -> None:
  adapter.verify_packets(ADDITION)
  assert hashlib.sha256(build.SOURCE.read_bytes()).hexdigest() == adapter.SOURCE_SHA256

  def damaged(path: Path) -> bytes:
    raw = path.read_bytes()
    return raw + b"broken" if path.name == "euref262--3_8.drawn.json.gz" else raw

  with pytest.raises(AssertionError):
    adapter.verify_packets(ADDITION, damaged)


def test_v261_lineage_unwinds_v262_before_its_own_complete_verification() -> None:
  from scripts.integrate_adlershof_kuehn_v261 import predecessor_manifest_v261

  current = read(build.OUT / "manifest.json")
  previous = adapter.predecessor_manifest_v262(current)
  result = adapter.merged(previous, ADDITION)
  assert predecessor_manifest_v261(result) == predecessor_manifest_v261(previous)
  damaged = copy.deepcopy(result)
  damaged["waterY"] += 1
  with pytest.raises(AssertionError, match="Unreceipted v262"):
    predecessor_manifest_v261(damaged)


def test_runtime_planes_follow_exact_source_surfaces() -> None:
  runtime = read(build.RUNTIME)
  surfaces = {
    s["sourcePolygonId"]: (b, s)
    for b in SOURCE["buildings"]
    for p in b["parts"]
    for s in p["surfaces"]
  }
  assert (
    runtime["sourceSha256"] == adapter.SOURCE_SHA256 and len(runtime["faces"]) == 201
  )
  for f in runtime["faces"]:
    b, s = surfaces[f["sourcePolygonId"]]
    assert f["owner"] == b["id"]
    assert s["kind"] == "WallSurface"
    for u, y in f["polygon"]:
      point = [f["a"][0] + f["d"][0] * u, y, f["a"][1] + f["d"][1] * u]
      assert min(np.linalg.norm(np.subtract(point, p)) for p in s["rings"][0]) < 0.002
