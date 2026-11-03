"""Step 10: exact old-fitting receipts and independent Jägerstraße additions."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import pytest
from shapely.ops import unary_union

from scripts.historical_asset_reader_v194 import historical_asset_bytes_v194

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_moabit_mitte_v300_stream as build  # noqa: E402


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


@pytest.fixture(scope="module")
def source() -> tuple[dict, dict]:
  return read(build.PLAN), read(build.EVIDENCE)


def test_exact_finite_scope_and_distinct_photo_compositions(source: tuple) -> None:
  plan, evidence = source
  assert plan["schemaVersion"] == 1
  assert set(plan["keys"]) == {"drawn:3_1", "minecraft:3_1"}
  assert set(plan["packets"]) == set(plan["keys"])
  assert len(evidence["fronts"]) == 4
  assert {f["style"] for f in evidence["fronts"]} == {
    "historic-modern-addition",
    "neo-baroque-oriel",
    "low-classic-front",
    "stone-pier-commercial",
  }
  assert {f["owner"] for f in evidence["fronts"]} == set(build.TARGETS)
  assert evidence["bodyAndRoofRetiredTriangles"] == 0
  assert evidence["navigationChanged"] is False
  assert evidence["newDescriptors"] == 0
  assert evidence["touchDetail"] == "identical full geometry"
  assert len(evidence["omissions"]) == 3
  assert all("estimate" in f["estimateBoundary"] for f in evidence["fronts"])
  assert all(r["date"].startswith(("1999", "2009")) for r in evidence["references"])


def test_every_original_packet_field_and_line_is_guarded(source: tuple) -> None:
  plan, _ = source
  for key, recipe in plan["packets"].items():
    mode, ident = key.split(":")
    raw = read(build.OUT / f"{ident}.{mode}.json.gz")
    assert recipe["origin"] == raw["origin"]
    assert recipe["navGuard"] == build.fingerprint(
      [json.dumps(raw["nav"], ensure_ascii=False, separators=(",", ":"))]
    )
    assert recipe["records"] == [
      dict(
        mesh=i,
        kind=m["kind"],
        fingerprint=build.fingerprint([m["positions"], m["colors"], m["indices"]]),
      )
      for i, m in enumerate(raw["meshes"])
    ]
    line = raw.get("lines")
    assert recipe["lineGuard"] == (
      build.fingerprint([line["positions"], line.get("colors", "")]) if line else None
    )
    addition = recipe["append"]
    assert recipe["appendFingerprint"] == build.fingerprint(
      [addition["positions"], addition["colors"], addition["indices"]]
    )
    assert set(recipe["owners"]) == set(build.TARGETS)


def test_no_retirement_can_reach_a_body_roof_or_foreign_front(source: tuple) -> None:
  plan, evidence = source
  records = [
    b
    for c in read(build.GEO / "alt-mitte-v169/source-manifest.json")["chunks"]
    for b in read(build.GEO / "alt-mitte-v169" / c["file"])["buildings"]
  ]
  occupied = unary_union([build.footprint(b) for b in records])
  expected = set()
  raw = read(build.OUT / "3_1.drawn.json.gz")
  for f in evidence["fronts"]:
    for face in f["sourceFaces"]:
      for tri, _, role in build.facade(
        face["rings"], face["ground"], face["top"], occupied
      ).triangles:
        assert role in {
          "window surround",
          "window glazing",
          "window mullion",
          "stone window sill",
        }
        expected.add(build.packed_key(tri, raw["origin"]))
  actual = set()
  arrays = build.decoded(raw)
  total = 0
  for r in plan["packets"]["drawn:3_1"]["retire"]:
    assert raw["meshes"][r["mesh"]]["kind"] == "alt-mitte-v169"
    assert r["triangles"] == sorted(set(r["triangles"]))
    ps, ix = arrays[r["mesh"]]
    for index in r["triangles"]:
      actual.add(build.key(ps[ix[index]]))
      total += 1
  assert actual == expected
  assert total == len(expected) == 1048
  assert plan["packets"]["minecraft:3_1"]["retire"] == []


def test_native_detail_is_independent_complete_and_cardinal(source: tuple) -> None:
  plan, evidence = source
  for mode in ["drawn", "minecraft"]:
    recipe = plan["packets"][mode + ":3_1"]
    mesh = recipe["append"]
    ps = (
      np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
      .reshape(-1, 3)
      .astype("i4")
    )
    ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    assert ix.max() < len(ps)
    assert len(base64.b64decode(mesh["colors"])) == ps.size
    assert len(ix) == evidence["packedTriangleCounts"][mode]
    triangles = ps[ix]
    cross = np.cross(
      triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
    )
    assert np.all(np.any(cross != 0, axis=1))
    if mode == "minecraft":
      assert np.all(np.count_nonzero(cross, axis=1) == 1)
    for f in evidence["fronts"]:
      profile = f[mode]
      assert profile["nominalPublicAxes"] == f["axes"]
      assert profile["principalStoreys"] == f["rows"]
      assert profile["sourceWallFacets"] > 0
      assert profile["roles"]["individual-window-glazing"] > 0
      assert profile["roles"]["complete-window-reveal"] > 0
      assert profile["roles"]["sash-transom"] > 0
  assert (
    plan["packets"]["drawn:3_1"]["append"] != plan["packets"]["minecraft:3_1"]["append"]
  )


def test_native_anchor_receipts_match_retained_resident_source(source: tuple) -> None:
  _, evidence = source
  delivered = set()
  metadata = read(build.DATA / "altMitteNativeV169Source.json")
  for entry in metadata["chunkFiles"]:
    if not entry["id"].startswith("3_1-"):
      continue
    packet = read(build.DATA / entry["file"])
    for ps, ix in build.decoded(packet):
      delivered.update(build.key(t) for t in ps[ix])
  for f in evidence["fronts"]:
    assert f["nativeMatchedTriangles"]
    assert all(
      tuple(tuple(p) for p in triangle) in delivered
      for triangle in f["nativeMatchedTriangles"]
    )


def test_full_source_receipts_remain_unchanged(source: tuple) -> None:
  _, evidence = source
  for file, digest in evidence["sourceHashes"].items():
    assert hashlib.sha256(historical_asset_bytes_v194(ROOT / file, digest, reader=lambda path: path.read_bytes())).hexdigest() == digest
