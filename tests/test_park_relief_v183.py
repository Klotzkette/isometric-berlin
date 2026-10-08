"""Measured Fritz hill is additive, with exact plan/inventory preservation."""

import hashlib
import json
import subprocess
from pathlib import Path

import pytest
from relief_receipts_v183 import restore_v183_altitudes, restore_v183_metadata

from scripts.build_park_relief_v182 import sample

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "src/app/public/mesh/regierungsviertel"
DATA = ROOT / "geo_data/regierungsviertel"


def previous(path: Path) -> bytes:
  return subprocess.check_output(
    ["git", "show", f"v1.0.82:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def test_previous_three_terrain_fields_are_immutable_and_new_hill_is_measured() -> None:
  old = ROOT / "src/app/src/data/parkReliefV182.json"
  assert old.read_bytes() == previous(old)
  payload = json.loads((ROOT / "src/app/src/data/parkReliefV183.json").read_bytes())
  p = payload["profiles"][0]
  assert p["name"] == "Fritz-Schloß-Park"
  assert p["support"] == [-1310, -1520, -720, -740]
  assert max(map(max, p["offsets"])) + 3 == pytest.approx(23.29)
  for x, z in [(-1310, -1000), (-720, -1000), (-1000, -1520), (-1000, -740), (0, 0)]:
    assert sample(p, x, z) == 0
  evidence = json.loads((DATA / "park-relief-v183.json").read_bytes())
  assert (
    evidence["sources"][0]["sha256"]
    == "fc95a713a7a7691ec95477ff915ccf23094f3544e132094547d4c7b95795d144"
  )
  assert evidence["sourceResolutionM"] == 1
  assert evidence["parks"][0]["boundaryFadeDirection"] == "outside"


def test_all_recorded_altitudes_reverse_to_exact_v182_source_and_metadata() -> None:
  receipts = json.loads((DATA / "derived-provenance-v183.json").read_bytes())
  for receipt in receipts["altitudeReceipts"]:
    path = ROOT / receipt["file"]
    before, after = json.loads(previous(path)), json.loads(path.read_bytes())
    if receipt["field"]:
      before, after = before[receipt["field"]], after[receipt["field"]]
    assert restore_v183_altitudes(after, path.name) == before
  for receipt in receipts["tables"]:
    path = ROOT / receipt["file"]
    assert restore_v183_metadata(
      json.loads(path.read_bytes()), receipt["file"]
    ) == json.loads(previous(path))


def test_core_plans_courts_paths_and_building_heights_survive_the_rigid_shift() -> None:
  audit = json.loads((DATA / "park-relief-v183-audit.json").read_bytes())
  assert audit["outer"] == []
  for entry in audit["core"]:
    path = ROOT / entry["file"]
    before, after = json.loads(previous(path)), json.loads(path.read_bytes())
    heights = after["ground_height"]["y_dm"][:]
    for index, old, new in entry["changedSamples"]:
      assert heights[index] == new
      heights[index] = old
    assert heights == before["ground_height"]["y_dm"]
    for key in ("ground_rows", "classes", "grid"):
      assert after[key] == before[key]
  path = CORE / "lod2-prisms.json"
  before, after = json.loads(previous(path)), json.loads(path.read_bytes())
  changes = {
    r[0]: r
    for r in json.loads((DATA / "park-relief-v183-object-audit.json").read_bytes())[
      "buildingChanges"
    ]
  }
  assert len(before["buildings"]) == len(after["buildings"])
  for a, b in zip(before["buildings"], after["buildings"], strict=True):
    assert {k: v for k, v in a.items() if k != "y0_dm"} == {
      k: v for k, v in b.items() if k != "y0_dm"
    }
    if a != b:
      r = changes[a["id"]]
      assert r == [a["id"], a["y0_dm"], a["h_dm"], b["y0_dm"], b["h_dm"]]
  assert len(changes) > 10
  old_profiles = ROOT / "src/app/src/data/parkReliefV182.json"
  assert (
    audit["unchangedPreviousTerrainSha256"]
    == hashlib.sha256(old_profiles.read_bytes()).hexdigest()
  )


def test_every_native_building_cell_keeps_plan_class_and_rigid_height() -> None:
  path = CORE / "minecraft-voxels.json"
  before, after = json.loads(previous(path)), json.loads(path.read_bytes())
  for key in before.keys() - {"building_rows", "ground_height", "tree_rows"}:
    assert before[key] == after[key]
  shifted = 0
  for old_row, new_row in zip(
    before["building_rows"], after["building_rows"], strict=True
  ):

    def cells(row: list) -> list:
      # Several original building columns can share X/Z at different heights.
      # Preserve their complete ordered inventory, not a deduplicated map.
      return [
        (offset, bottom, top, kind)
        for x, count, bottom, top, kind in row
        for offset in range(x, x + count)
      ]

    old, new = cells(old_row), cells(new_row)
    for a, b in zip(old, new, strict=True):
      x, bottom, top, kind = a
      new_x, new_bottom, new_top, new_kind = b
      assert (new_x, new_kind) == (x, kind)
      assert new_top - new_bottom == top - bottom
      assert new_bottom - bottom == new_top - top
      shifted += new_bottom != bottom
  assert shifted == 1418
