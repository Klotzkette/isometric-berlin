"""Step 10: bounded source ownership and complete official envelope retention."""

import json
from pathlib import Path

from shapely import make_valid
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from scripts.build_bebelplatz_building_source import extract_parent, part_profile
from scripts.build_potsdamer_ministry_source import TARGETS, native_ownership
from scripts.build_potsdamer_street_wing_source import TARGETS as WING_TARGETS

ROOT = Path(__file__).resolve().parents[1]


def test_potsdamer_ministry_source_keeps_complete_envelopes_and_ownership():
  source = json.loads((ROOT / "src/app/src/potsdamerMinistrySource.json").read_text())
  ownership = json.loads(
    (ROOT / "src/app/src/potsdamerMinistryOwnership.json").read_text()
  )
  buildings = source["buildings"]
  assert [b["key"] for b in buildings] == [t[0] for t in TARGETS]
  assert sum(len(b["officialParts"]) for b in buildings) == 45
  for building, owned in zip(buildings, ownership["buildings"], strict=True):
    assert building["key"] == owned["key"]
    assert set(building["prismIds"]) == {
      p["id"][-8:] for p in building["officialParts"]
    }
    assert building["prismIds"] == owned["prismIds"]
    for part in building["officialParts"]:
      shape = Polygon(part["ring"], part["holes"])
      assert shape.area > 0
      assert any(s["kind"] == "RoofSurface" for s in part["surfaces"])
      assert (
        max(p[1] for s in part["surfaces"] for ring in s["rings"] for p in ring)
        == part["top_y_m"]
      )
      assert any(
        r["ring"] == part["ring"] and r["holes"] == part["holes"]
        for r in owned["rings"]
      )
    for edge in building["streetFronts"]:
      part = next(p for p in building["officialParts"] if p["id"] == edge["partId"])
      surface = part["surfaces"][edge["surfaceIndex"]]
      assert surface["kind"] == "WallSurface"
      assert (
        edge["wallTopY"] <= part["top_y_m"] + building["displayYTranslationM"] + 0.001
      )


def test_native_ownership_keeps_all_original_mixed_boundary_columns():
  ownership = json.loads(
    (ROOT / "src/app/src/potsdamerMinistryOwnership.json").read_text()
  )
  native = ownership["native"]
  assert native == native_ownership(ownership)
  assert len(native["safeWholeCells"]) == 483
  assert len(native["retainedBoundaryCells"]) == 183
  assert sum(c[3] > 0 for c in native["retainedBoundaryCells"]) == 29
  shape = unary_union(
    [
      make_valid(Polygon(p["ring"], p["holes"]))
      for b in ownership["buildings"]
      for p in b["rings"]
    ]
  )
  safe = {tuple(c) for c in native["safeWholeCells"]}
  for x, z in safe:
    assert shape.covers(box(x, z, x + 4, z + 4))
  for x, z, outside_area, neighbour_area in native["retainedBoundaryCells"]:
    assert (x, z) not in safe
    assert not shape.covers(box(x, z, x + 4, z + 4)) or neighbour_area > 0
  # Hyatt's nearby parents overlap even fully-owned plan cells. They must
  # remain: testing only four corners would wrongly delete their roof/walls.
  for cell in [(28, 1160), (28, 1164), (28, 1168), (28, 1172), (32, 1176)]:
    assert cell not in safe


def test_street_wings_keep_original_owners_and_use_verified_source_wall_planes():
  source = json.loads((ROOT / "src/app/src/potsdamerStreetWingSource.json").read_text())
  assert source["facadeOnly"]
  assert not source["roofModification"]
  assert not source["sourceSuppression"]
  assert [b["key"] for b in source["buildings"]] == [t[0] for t in WING_TARGETS]
  assert sum(len(b["prismIds"]) for b in source["buildings"]) == 68
  assert sum(len(b["streetFronts"]) for b in source["buildings"]) == 69
  originals = {
    p["id"]: p
    for p in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
    )["buildings"]
  }
  for building in source["buildings"]:
    parent = extract_parent(
      ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_389_5818.zip",
      building["parentId"],
    )
    parts = {
      p["id"]: p
      for p in [part_profile(n) for n in leaf_building_parts(parent) or [parent]]
    }
    assert set(building["prismIds"]) == {i[-8:] for i in parts}
    for edge in building["streetFronts"]:
      original = parts[edge["partId"]]["surfaces"][edge["surfaceIndex"]]
      assert original["kind"] == "WallSurface"
      assert edge["sourceWallRings"] == original["rings"]
      prism = originals[edge["prismId"]]
      assert edge["wallTopY"] <= (prism["y0_dm"] + prism["h_dm"]) / 10
