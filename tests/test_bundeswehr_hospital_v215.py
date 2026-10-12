"""Regression guard for the precisely owned obsolete hospital gable."""

import base64
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
AUDIT = json.loads(
  (
    ROOT / "geo_data/regierungsviertel/bundeswehr-hospital-v215-correction.json"
  ).read_bytes()
)


def test_exact_old_packet_bytes_and_scope_are_preserved():
  assert AUDIT["owner"] == "DEBE01YYK0000365"
  assert AUDIT["part"] == "DEBE3DbYCNYOhBDw"
  for original in AUDIT["originalPackets"]:
    assert (
      hashlib.sha256((ROOT / original["file"]).read_bytes()).hexdigest()
      == original["sha256"]
    )
  assert {r["part"] for r in AUDIT["records"]} == {"DEBE3DbYCNYOhBDw"}
  assert AUDIT["counts"] == {
    "transferredTriangles": 3717,
    "transferredLines": 53,
    "drawnAddedTriangles": 1143,
    "nativeAddedTriangles": 2857,
  }


def test_current_roof_has_flat_planes_and_preserves_full_lower_footprint():
  before, after = AUDIT["oldPart"], AUDIT["correctedPart"]
  assert before["footprintPolygons"] == after["footprintPolygons"]
  assert before["groundY"] == after["groundY"] == 5.2
  old_roofs = [
    r for s in before["surfaces"] if s["kind"] == "RoofSurface" for r in s["rings"]
  ]
  assert any(max(p[1] for p in r) - min(p[1] for p in r) > 7 for r in old_roofs)
  roofs = [s for s in after["surfaces"] if s["kind"] == "RoofSurface"]
  assert len(roofs) == 2
  assert [set(p[1] for r in s["rings"] for p in r) for s in roofs] == [
    {33.878},
    {38.078},
  ]
  assert Polygon([(p[0], p[2]) for p in roofs[0]["rings"][0]]).equals(
    Polygon(AUDIT["ring"])
  )
  assert Polygon(AUDIT["technicalRing"]).difference(Polygon(AUDIT["ring"])).area < 1e-8
  # Every original lower wall sheet survives without coordinate changes.
  for s in before["surfaces"]:
    if max(p[1] for r in s["rings"] for p in r) <= 30.837:
      assert s in after["surfaces"]


def test_no_other_facade_owner_or_lower_detail_is_retired():
  faces = json.loads(
    (
      ROOT / "geo_data/regierungsviertel/bundeswehr-hospital-v214-facades.json"
    ).read_bytes()
  )
  source = json.loads(
    (ROOT / "src/app/src/data/bundeswehrHospitalV214.json").read_bytes()
  )
  for mode, key in [("drawn", "boxes"), ("minecraft", "blocks")]:
    adjustments = AUDIT["adjustments"][mode]
    assert adjustments["moveY"] == []
    for index in adjustments["retire"]:
      row = source[key][index]
      assert faces[int(row[-1].split(":")[0])]["part"] == AUDIT["part"]
      assert row[1] + row[4] / 2 > AUDIT["roofY"]
    assert len(adjustments["retire"]) == (9 if mode == "drawn" else 12)


def test_native_correction_remains_axis_aligned_and_bounded():
  packet = json.loads(
    (ROOT / "src/app/src/data/bundeswehrHospitalV215Minecraft.json").read_bytes()
  )
  count = 0
  for m in packet["meshes"]:
    xyz = (
      np.frombuffer(base64.b64decode(m["positions"]), dtype="<u2")
      .reshape(-1, 3)
      .astype(float)
    )
    indices = np.frombuffer(base64.b64decode(m["indices"]), dtype="<u4").reshape(-1, 3)
    for tri in xyz[indices]:
      normal = np.cross(tri[1] - tri[0], tri[2] - tri[0])
      assert np.count_nonzero(normal) <= 1
    count += len(indices)
  assert count == 2857
  assert len(json.dumps(packet)) < 120000
