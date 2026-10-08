"""Source ownership and conflict checks for the bounded v183 architecture."""

import gzip
import json
from collections import Counter
from pathlib import Path

from shapely.geometry import Polygon

from scripts.build_alexander_stations_v183 import TARGETS, frame

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads(
  (ROOT / "src/app/src/data/alexanderStationsV183Source.json").read_text()
)


def test_complete_original_sheets_are_retained() -> None:
  for profile in SOURCE["profiles"]:
    assert len(profile["originalParts"]) == len(profile["parts"])
    offset = profile["displayOffsetY"]
    for original, shown in zip(profile["originalParts"], profile["parts"], strict=True):
      assert shown["id"] == original["id"]
      assert shown["ring"] == original["ring"]
      assert shown["holes"] == original["holes"]
      assert len(shown["surfaces"]) == len(original["surfaces"])
      assert abs(shown["top_y_m"] - original["top_y_m"] - offset) < 1e-5


def test_owner_selection_is_exact_and_preserves_adjacent_alexa_tower() -> None:
  assert {p["id"] for p in SOURCE["outerOwners"]} == {
    p[1] for key, p in TARGETS.items() if key != "berolinahaus"
  }
  assert "DEBE00YYy600004g" not in {p["id"] for p in SOURCE["outerOwners"]}
  assert len(SOURCE["conflicts"]) >= 8
  assert any("hip roof" in c for c in SOURCE["conflicts"])
  assert any("clerestory" in c for c in SOURCE["conflicts"])


def test_footprint_frame_derives_from_source_without_growing_its_bounds() -> None:
  for profile in SOURCE["profiles"]:
    part = max(profile["parts"], key=lambda p: Polygon(p["ring"]).area)
    assert frame(part) == profile["frame"]
    f = profile["frame"]
    assert abs(f["dx"] ** 2 + f["dz"] ** 2 - 1) < 1e-7
    assert f["length"] > f["width"] > 10


def test_existing_station_source_is_preserved_exactly() -> None:
  previous = json.loads((ROOT / "src/app/src/schlossEastSource.json").read_text())
  p = next(p for p in SOURCE["profiles"] if p["key"] == "alexanderStation")
  assert p["parts"] == previous["profiles"]["stationHall"]["parts"]


def test_replaced_outer_owners_keep_every_previous_source_sheet_and_navigation() -> (
  None
):
  """An independent v169 inventory catches missing original closing surfaces."""
  previous = {
    p["id"]: p
    for name in ("source-392_5820-00.json.gz", "source-392_5819-00.json.gz")
    for p in json.loads(
      gzip.decompress(
        (ROOT / "geo_data/regierungsviertel/alt-mitte-v169" / name).read_bytes()
      )
    )["buildings"]
  }
  navigation = json.loads(
    (ROOT / "src/app/src/data/alexanderStationsV183Navigation.json").read_bytes()
  )
  owners = {p["id"] for p in SOURCE["outerOwners"]}
  closure_count = 0
  for profile in SOURCE["profiles"]:
    if profile["parentId"] not in owners:
      continue
    parts = previous[profile["parentId"]]["parts"]
    assert {p["id"] for p in parts} == {p["id"] for p in profile["parts"]}
    nav = next(p for p in navigation["profiles"] if p["key"] == profile["key"])
    assert nav["parts"] == [
      {k: v for k, v in p.items() if k != "surfaces"} for p in profile["parts"]
    ]
    for old in parts:
      current = next(p for p in profile["parts"] if p["id"] == old["id"])
      assert old["footprintPolygons"] == [
        {"ring": current["ring"], "holes": current["holes"]}
      ]
      assert old["groundY"] == current["ground_y_m"]
      assert old["topY"] == current["top_y_m"]
      expected = Counter(
        json.dumps({"kind": s["kind"], "rings": s["rings"]}, sort_keys=True)
        for s in old["surfaces"]
        if s["kind"] in {"WallSurface", "RoofSurface", "ClosureSurface"}
      )
      assert (
        Counter(json.dumps(s, sort_keys=True) for s in current["surfaces"]) == expected
      )
      closure_count += sum(s["kind"] == "ClosureSurface" for s in current["surfaces"])
  assert closure_count == 50
