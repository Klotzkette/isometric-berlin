"""Source preservation and ownership at parks and cemeteries north of Mitte."""

import json
from pathlib import Path

from shapely.geometry import Polygon, shape

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads(
  (ROOT / "src/app/src/data/mitteHeritageV166Source.json").read_text()
)
EVIDENCE = json.loads(
  (ROOT / "src/app/src/data/mitteHeritageV166Evidence.json").read_text()
)
NAV = json.loads(
  (ROOT / "src/app/src/data/mitteHeritageV166Navigation.json").read_text()
)


def test_all_surveyed_parts_and_surfaces_survive() -> None:
  originals = {p["id"]: p for b in EVIDENCE["parents"] for p in b["sourceParts"]}
  assert (
    set(originals)
    == {p["id"] for p in SOURCE["parts"]}
    == {p["id"] for p in NAV["parts"]}
  )
  assert len(SOURCE["surfaces"]) == sum(len(p["surfaces"]) for p in originals.values())
  display = {p["id"]: p for p in EVIDENCE["parts"]}
  for parent in EVIDENCE["parents"]:
    for old in parent["sourceParts"]:
      new = display[old["id"]]
      assert new["ring"] == old["ring"] and new["holes"] == old["holes"]
      assert abs(new["top_y_m"] - new["ground_y_m"] - old["height_m"]) < 0.003
      assert (
        abs(new["ground_y_m"] - old["ground_y_m"] - parent["displayOffsetY"]) < 0.002
      )


def test_six_real_parks_paths_and_known_anchors() -> None:
  assert {p["id"] for p in SOURCE["parks"]} == {
    "104954713",
    "340138573",
    "1089402877",
    "16573560",
    "25335920",
    "449835634",
  }
  assert len(SOURCE["paths"]) == 193
  heine = next(p for p in SOURCE["props"] if p["id"] == "1884384977")
  assert [heine["x"], heine["z"]] == [1961.049, -1476.786]
  assert heine["tags"]["artist_name"] == "Waldemar Grzimek"
  assert {
    p["tags"]["name"] for p in SOURCE["props"] if p["tags"].get("cemetery") == "grave"
  } == {"Walter Kollo", "Carl Bechstein", "Max Stirner"}
  for p in SOURCE["props"]:
    assert any(
      shape(park["geometry"])
      .buffer(2.01)
      .covers(__import__("shapely").Point(p["x"], p["z"]))
      for park in SOURCE["parks"]
    )


def test_native_keeps_open_courts_and_stays_separate() -> None:
  assert SOURCE["nativeRows"] and SOURCE["groundRuns"]
  assert all(row[3] > 0 and row[4] > 0 and row[5] > 0 for row in SOURCE["nativeRows"])
  for p in SOURCE["parts"]:
    for hole in p["holes"]:
      interior = Polygon(hole).buffer(-1.5)
      for x, y, z, w, h, d, _ in SOURCE["nativeRows"]:
        if p["ground_y_m"] + 1 < y < p["top_y_m"] - 1:
          assert not interior.contains(__import__("shapely").Point(x, z))
  app = (ROOT / "src/app/src/MinecraftVoxelWorld.ts").read_text()
  assert "createMinecraftMitteHeritageV166()" in app
  assert "mitteHeritageV166SourceColumn" in app
