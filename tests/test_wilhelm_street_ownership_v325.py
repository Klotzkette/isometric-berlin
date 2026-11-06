"""Independent retained-source and complete-complement checks; no city build."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def test_all_87_literal_prisms_and_27_foreign_contributors_are_original() -> None:
  source = read(DATA / "wilhelmStreetFrontsV325Sources.json")
  actual = read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")
  by_id = {p["id"]: p for p in actual["buildings"]}
  assert len(source["prisms"]) == 87
  assert len(source["contributorPrisms"]) == 27
  assert len({p["id"] for p in source["prisms"]}) == 87
  for prism in source["prisms"] + source["contributorPrisms"]:
    assert prism == by_id[prism["id"]]
  assert len(source["nativeVoxels"]["cells"]) == 1395
  assert all(
    len(interval) == 5
    for cell in source["nativeVoxels"]["cells"]
    for interval in cell["intervals"]
  )
  for packet in source["nativePackets"]:
    assert (
      hashlib.sha256((ROOT / packet["file"]).read_bytes()).hexdigest()
      == packet["sha256"]
    )


def test_two_additional_packet_plans_are_disjoint_retirement_only() -> None:
  current = read(DATA / "wilhelmStreetFrontsV325Packets.json")
  previous = read(DATA / "wilhelmHousingV324Packets.json")
  assert current["keys"] == ["drawn:1_0", "drawn:1_1"]
  total = 0
  for key, plan in current["packets"].items():
    assert plan["append"] is None
    assert not plan["retireLines"] and not plan["retireNav"] and not plan["appendNav"]
    assert plan["navGuard"] == plan["preparedNavGuard"] != 0
    old = {
      (record["mesh"], triangle)
      for record in previous["packets"][key]["retire"]
      for triangle in record["triangles"]
    }
    actual = {
      (record["mesh"], triangle)
      for record in plan["retire"]
      for triangle in record["triangles"]
    }
    assert not old & actual
    total += len(actual)
  assert total == 6288


def test_all_410_native_replays_keep_original_xyz_winding_and_normals() -> None:
  source = read(DATA / "wilhelmStreetFrontsV325Sources.json")
  delta = read(DATA / "wilhelmStreetFrontsV325Previous.json")["previous"]
  old = read(DATA / "wilhelmHousingV324Previous.json")["previous"]["variants"][
    "minecraft"
  ]
  total = 0
  for part in delta["parts"]:
    original = next(
      p
      for p in old["parts"]
      if p["name"] == part["name"] and p["parentName"] == part["parentName"]
    )
    assert not set(part["retire"]) & set(original["retire"])
    packet = next(
      p for p in source["nativePackets"] if part["parentName"].endswith(p["id"])
    )
    raw = read(ROOT / packet["file"])
    positions, triangles, offset = [], [], 0
    for mesh in raw["meshes"]:
      p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
      ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      positions.append(p)
      triangles.append(ix + offset)
      offset += len(p)
    points = np.concatenate(positions).astype("<f4")
    indices = np.concatenate(triangles)
    if not part["retire"]:
      assert not part["outsideAdditions"]
      continue
    assert len(part["outsideAdditions"]) == 1
    replay = part["outsideAdditions"][0]
    p = np.frombuffer(base64.b64decode(replay["positions"]), "<f4").reshape(-1, 3)
    ix = np.frombuffer(base64.b64decode(replay["indices"]), "<u4").reshape(-1, 3)
    normals = np.frombuffer(base64.b64decode(replay["normals"]), "<f4").reshape(-1, 3)
    assert len(ix) == len(part["retire"])
    for old_index, new in zip(part["retire"], ix, strict=True):
      expected = points[indices[old_index]]
      assert np.array_equal(p[new].view("<u4"), expected.view("<u4"))
      normal = np.cross(expected[1] - expected[0], expected[2] - expected[0])
      normal /= np.linalg.norm(normal)
      assert np.array_equal(normals[new], np.tile(normal, (3, 1)))
    total += len(ix)
  assert total == 410


def test_core_retirements_never_touch_body_roof_or_original_ink() -> None:
  source = read(DATA / "wilhelmStreetFrontsV325Core.json")
  assert len(source["drawn"]["owners"]) == 37
  assert len(source["drawnV8"]["owners"]) == 2
  assert {o["id"] for o in source["drawnV8"]["owners"]} == {
    "B6BxwVWS",
    "nRGU0hkP",
  }
  for key in ["drawn", "nativeFull", "nativeMobile"]:
    plan = source[key]
    assert all(o["retireBody"] is False for o in plan["owners"])
    for owner in plan["owners"]:
      for component in owner["components"]:
        if component["name"] in {
          "LoD2 prism buildings",
          "LoD2 prism ink lines",
          "Voxel building columns",
        }:
          assert component["retire"] is False
  assert (
    sum(
      len(component["retire"])
      for owner in source["drawn"]["owners"]
      for component in owner["components"]
      if isinstance(component["retire"], list)
    )
    == 630
  )
  assert (
    sum(
      component["instances"]["count"]
      for owner in source["nativeFull"]["owners"]
      for component in owner["components"]
      if component["retire"] is True
    )
    == 741
  )
  assert not any(
    component["retire"]
    for owner in source["nativeMobile"]["owners"]
    for component in owner["components"]
  )


def test_complete_street_inventory_and_actual_support_keep_all_groups() -> None:
  evidence = read(
    ROOT / "geo_data/regierungsviertel/wilhelm-street-v325-evidence.json.gz"
  )
  profile = read(DATA / "wilhelmStreetFrontsV325.json")
  assert len(evidence["wholeStreet"]["families"]) == 151
  assert len(profile["families"]) == 11
  assert len({f["group"] for f in profile["families"]}) == 9
  support = evidence["actualNativeSupport"]
  assert len(support["surfaces"]) == 185
  assert {s["family"] for s in support["surfaces"]} == {
    f["id"] for f in profile["families"]
  }
  assert {s["run"] for s in support["surfaces"]} == set(range(22)) - {11}
  assert support["unexposedNativeRuns"][0]["run"] == 11
  assert all(p["finalMissingAreaM2"] == 0 for p in support["actualBodySupportProofs"])
