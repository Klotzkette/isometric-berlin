"""Source completeness, bounded grave fields and exact owner preservation v190."""

from __future__ import annotations

import json
import math
from pathlib import Path

import pytest
from shapely.geometry import box, shape

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
SOURCE = json.loads((DATA / "north-sites-v190-source.json").read_text())
EVIDENCE = json.loads((DATA / "north-sites-v190-evidence.json").read_text())
DRAWN = json.loads((ROOT / "src/app/src/data/northSitesV190.json").read_text())
NATIVE = json.loads((ROOT / "src/app/src/data/northSitesV190Native.json").read_text())


def test_every_replaced_owner_keeps_all_measured_source_surfaces() -> None:
  """The 34 replacements retain every original measured sheet, including holes."""
  owners = [b for b in SOURCE["buildings"] if b["replaceOwner"]]
  assert len(owners) == 34
  assert set(DRAWN["sourceOwnerIds"]) == {b["id"] for b in owners}
  surfaces = [s for c in DRAWN["cells"] for s in c["surfaces"]]
  for b in owners:
    target = [s for s in surfaces if s["owner"] == b["id"]]
    expected = [s for p in b["parts"] for s in p["surfaces"]]
    assert len(target) == len(expected)
    assert all(s["triangles"] for s in target)
    assert any(s["kind"] == "RoofSurface" for s in expected)
  original = json.loads((ROOT / "src/app/src/data/northV185.json").read_text())
  assert {b["id"] for b in owners if b["kind"] == "kulturbrauerei"} == {
    b["id"] for b in original["owners"] if b["kind"] == "kulturbrauerei"
  }


def test_unsurveyed_grave_fields_never_block_paths_buildings_or_named_graves() -> None:
  """Sparse anonymous display markers cannot masquerade as mapped interments."""
  assert len(EVIDENCE["graveFields"]) == 2
  for field in EVIDENCE["graveFields"]:
    assert "schematic unnamed" in field["status"]
    allowed = shape(field["allowed"]).buffer(0.002)
    assert len(field["centers"]) > 400
    for x, z in field["centers"]:
      assert allowed.covers(box(x - 0.6, z - 0.9, x + 0.6, z + 0.9))
  assert len(EVIDENCE["mappedGraves"]) == 16
  assert len({g["id"] for g in EVIDENCE["mappedGraves"]}) == 16
  assert "node/13154608101" in {g["id"] for g in EVIDENCE["mappedGraves"]}


def test_facades_remain_in_actual_source_wall_rectangles() -> None:
  """No window/cornice uses a parent height across a pitched roof or gable."""
  for f in EVIDENCE["faces"]:
    wall = shape(f["wallGeometry"])
    assert wall.buffer(0.004).covers(
      box(0.04, f["bottom"] + 0.04, f["length"] - 0.04, f["top"] - 0.04)
    )
    assert math.hypot(*f["normal"]) == pytest.approx(1, abs=1e-7)
  place = next(b for b in SOURCE["buildings"] if b["kind"] == "platzhaus")
  assert place["osmId"] == "way/121840587"
  assert len(place["parts"]) == 1
  assert len([b for b in SOURCE["buildings"] if b["kind"] == "kastanienallee"]) == 13


def test_exact_old_owner_subtraction_retains_every_unrelated_triangle_and_nav() -> None:
  """Audited substitution only affects named coarse owners in three old cells."""
  audit = json.loads((DATA / "north-sites-v190-ownership-audit.json").read_text())
  assert len(audit["sourceIds"]) == 27
  assert len(audit["chunks"]) == 3
  assert audit["allNavigationUnchanged"]
  assert audit["unrelatedGeometryPreserved"]
  for chunk in audit["chunks"]:
    assert set(chunk["modes"]) == {"drawn", "minecraft"}
    for mode in chunk["modes"].values():
      assert mode["removedOwnerTriangles"] > 0
      assert mode["preservedTriangles"] > mode["removedOwnerTriangles"]
      assert mode["allNavigationUnchanged"] and mode["unrelatedGeometryPreserved"]


def test_modes_are_finite_and_native_rows_have_no_rotation() -> None:
  """Native skins remain independent; no second smooth city is loaded."""
  assert len(DRAWN["cells"]) <= 28
  assert len(NATIVE["cells"]) == len(DRAWN["cells"])
  assert sum(len(c["boxes"]) for c in NATIVE["cells"]) < 36000
  for c in NATIVE["cells"]:
    assert "surfaces" not in c
    for r in c["boxes"]:
      assert len(r) == 7 and all(math.isfinite(x) for x in r)
      assert min(r[3:6]) > 0


def test_documented_enclosure_keeps_source_entrances_and_lapidarium_open() -> None:
  """The wall is interrupted by actual paths, rather than sealing the cemetery."""
  record = EVIDENCE["schoenhauserEnclosure"]
  wall, gaps = shape(record["geometry"]), shape(record["gaps"])
  assert wall.length > 500
  assert wall.intersection(gaps.buffer(-0.002)).length < 0.001
  site = next(p for p in SOURCE["sites"] if p["key"] == "schoenhauser")
  assert wall.difference(shape(site["geometry"]).boundary.buffer(0.002)).length < 0.001
  assert "display estimate" in record["heightStatus"]
