"""Measured Moabit ownership, courtyard preservation and independent native skin."""

import json
from pathlib import Path

from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "src/app/src/data/moabitJusticeV166Source.json").read_text())
EVIDENCE = json.loads(
  (ROOT / "src/app/src/data/moabitJusticeV166Evidence.json").read_text()
)
NAV = json.loads(
  (ROOT / "src/app/src/data/moabitJusticeV166Navigation.json").read_text()
)


def test_complete_source_surfaces_are_rigidly_translated_without_lost_parts():
  assert len(EVIDENCE["parents"]) == 48
  assert len(DATA["parts"]) == len(NAV["parts"]) == 139
  assert len(DATA["surfaces"]) == 2363
  display = {p["id"]: p for p in EVIDENCE["parts"]}
  for parent in EVIDENCE["parents"]:
    for raw in parent["sourceParts"]:
      actual = display[raw["id"]]
      assert actual["ring"] == raw["ring"] and actual["holes"] == raw["holes"]
      assert actual["top_y_m"] == round(raw["top_y_m"] + parent["displayOffsetY"], 3)
      for before, after in zip(raw["surfaces"], actual["surfaces"], strict=True):
        assert after["rings"] == [
          [[x, round(y + parent["displayOffsetY"], 3), z] for x, y, z in ring]
          for ring in before["rings"]
        ]
      assert len([s for s in DATA["surfaces"] if s["partId"] == raw["id"]]) == len(
        raw["surfaces"]
      )
  assert "parents" not in DATA and "legacyPrisms" not in DATA
  assert (
    ROOT / "src/app/src/data/moabitJusticeV166Source.json"
  ).stat().st_size < 5 * 1024**2


def test_court_courtyards_and_towers_survive_the_former_nine_metre_fallback():
  court = [p for p in EVIDENCE["parts"] if p["kind"] == "court"]
  footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in court])
  assert len(court) == 15
  assert len(footprint.interiors) == 13  # Four main courts plus source light wells.
  assert sum(Polygon(r).area > 400 for r in footprint.interiors) == 4
  assert sorted(p["top_y_m"] for p in court)[-3:] == [51.299, 61.634, 63.064]
  old = next(p for p in EVIDENCE["legacyPrisms"] if p["id"] == "-7721745")
  assert old["h_dm"] == 90
  assert len([p for p in EVIDENCE["parts"] if p["kind"] == "lesserUry"]) == 19


def test_exact_legacy_owners_keep_adjacent_ulap_untouched():
  current = {
    p["id"]: p
    for p in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
    )["buildings"]
  }
  assert len(EVIDENCE["legacyPrisms"]) == 45
  for p in EVIDENCE["legacyPrisms"]:
    assert p == current[p["id"]]
  assert all(p["coveredAreaRatio"] > 0.9 for p in EVIDENCE["ownership"])
  assert not set(EVIDENCE["preservedAdjacentOwners"]) & set(NAV["parentIds"])


def test_native_runs_preserve_every_surface_cell_and_grilles_are_compact():
  cells = set()
  for x, y, z, w, h, d, _ in DATA["nativeRuns"]:
    for a in range(round(x - w / 2), round(x + w / 2)):
      for b in range(round(y - 5.2 - h / 2), round(y - 5.2 + h / 2)):
        for c in range(round(z - d / 2), round(z + d / 2)):
          assert (a, b, c) not in cells
          cells.add((a, b, c))
  assert len(cells) == DATA["nativeCellCount"] == 136491
  assert len(DATA["nativeRuns"]) == 18072
  assert len(DATA["nativeBarWindows"]) == DATA["barredWindowCount"] == 3200
  assert sum(r[8] == 3 for r in DATA["facadeBoxes"]) == 16000
  # Large court interiors have no source surface blocks, including at ground level.
  for x, z in [
    (-1139.477, -814.368),
    (-1201.675, -807.466),
    (-1099.211, -824.888),
    (-1250.603, -804.86),
  ]:
    assert not any(abs(a - x) < 2 and abs(c - z) < 2 for a, _, c in cells)
