"""Exact source preservation and bounds for Friedrichswerder/Foreign Office."""

import json
from pathlib import Path

import pytest
from shapely.geometry import Point

from isometric_berlin.data.fetch_lod2 import load_bounds_polygon, project_to_berlin

ROOT = Path(__file__).resolve().parents[1]


def test_complete_parts_and_old_prisms_survive() -> None:
  source = json.loads((ROOT / "src/app/src/eastCivicSource.json").read_text())
  old = {
    p["id"]: p
    for p in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
    )["buildings"]
  }
  profiles = list(source["profiles"].values())
  assert [len(p["parts"]) for p in profiles] == [3, 14, 40]
  assert sum(len(p["parent_ids"]) for p in profiles) == 13
  assert {v for p in profiles for v in p["replaced_prism_ids"]} == {
    "24044937",
    "15933949",
    "15933948",
    "on-57390",
  }
  for p in profiles:
    for previous in p["previous_display_prisms"]:
      assert previous == old[previous["id"]]
    for part in p["parts"]:
      assert {s["kind"] for s in part["surfaces"]} == {"RoofSurface", "WallSurface"}
  church = {p["id"]: p for p in profiles[0]["parts"]}
  assert church["DEBE3DyLqyvesbrt"]["top_y_m"] == 42.161
  assert church["DEBE3DwNDmqAIY6r"]["top_y_m"] == 42.057


def test_source_reextracts_identically_and_remains_inside_bounds() -> None:
  from scripts.build_east_civic_source import build_source

  committed = json.loads((ROOT / "src/app/src/eastCivicSource.json").read_text())
  if not (ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_391_5819.zip").exists():
    pytest.skip("Optional ignored raw ZIP is absent")
  assert build_source(ROOT) == committed
  bounds = project_to_berlin(
    load_bounds_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  for p in committed["profiles"].values():
    for part in p["parts"]:
      for s in part["surfaces"]:
        for ring in s["rings"]:
          assert all(bounds.covers(Point(389500 + x, 5820000 - z)) for x, _, z in ring)
