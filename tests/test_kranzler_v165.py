"""Source preservation and lossless native skin compaction for Kranzler."""

import json
from pathlib import Path

from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "src/app/src/data/kranzlerV165Source.json").read_text())
EVIDENCE = json.loads((ROOT / "src/app/src/data/kranzlerV165Evidence.json").read_text())
NAV = json.loads((ROOT / "src/app/src/data/kranzlerV165Navigation.json").read_text())


def test_complete_four_parents_and_nineteen_parts_keep_source_shape():
  display = {p["id"]: p for p in EVIDENCE["parts"]}
  assert len(display) == 19
  assert len(DATA["surfaces"]) == 215
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
  assert len(NAV["parts"]) == 19
  assert "parents" not in DATA  # Evidence must not create a second runtime parse.


def test_exact_legacy_identity_ownership_and_complete_native_skin_volume():
  source = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  by_id = {p["id"]: p for p in source}
  assert {p["id"] for p in EVIDENCE["legacyPrisms"]} == {
    "07959702",
    "19869019",
    "22986477",
    "19869017",
    "19869018",
  }
  for p in EVIDENCE["legacyPrisms"]:
    assert p == by_id[p["id"]]
  cells = set()
  for x, y, z, w, h, d, _ in DATA["nativeRuns"]:
    assert w > 0 and h > 0 and d > 0
    for a in range(round(x - w / 2), round(x + w / 2)):
      for b in range(round(y - 5.2 - h / 2), round(y - 5.2 + h / 2)):
        for c in range(round(z - d / 2), round(z + d / 2)):
          assert (a, b, c) not in cells
          cells.add((a, b, c))
  assert len(cells) == DATA["nativeCellCount"] == 44484
  assert len(DATA["nativeRuns"]) < 1500
  assert all(Polygon(p["ring"]).is_valid for p in EVIDENCE["parts"])
