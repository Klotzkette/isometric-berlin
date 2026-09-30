"""The v149 city hall/church supplement must never replace source evidence."""

import json
from pathlib import Path

from shapely.geometry import Point, Polygon

from isometric_berlin.data.fetch_lod2 import load_bounds_polygon, project_to_berlin
from scripts.build_alexander_civic_source import build_source

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/app/src/alexanderCivicSource.json"


def test_source_reproduces_complete_rathaus_and_marien_envelopes() -> None:
  data = json.loads(SOURCE.read_text())
  assert build_source(ROOT) == data
  old = json.loads((ROOT / "src/app/src/schlossEastSource.json").read_text())[
    "profiles"
  ]["rathaus"]
  now = data["profiles"]["rathaus"]
  for key, value in old.items():
    assert now[key] == value
  assert len(now["parts"]) == 4
  assert sum(len(p["holes"]) for p in now["parts"]) == 3
  marien = data["profiles"]["marien"]
  assert marien["osm_identity"].endswith("/way/474111581")
  assert len(marien["parts"]) == 5
  assert max(p["top_y_m"] for p in marien["parts"]) == 83.072
  assert all(
    any(s["kind"] == "WallSurface" for s in p["surfaces"])
    and any(s["kind"] == "RoofSurface" for s in p["surfaces"])
    for p in marien["parts"]
  )


def test_every_source_vertex_and_court_remains_inside_approved_bounds() -> None:
  data = json.loads(SOURCE.read_text())
  bounds = project_to_berlin(
    load_bounds_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  for profile in data["profiles"].values():
    for part in profile["parts"]:
      shape = Polygon(part["ring"], part["holes"])
      assert shape.is_valid and shape.area > 0
      for surface in part["surfaces"]:
        for ring in surface["rings"]:
          assert len(ring) >= 3
          for x, y, z in ring:
            assert bounds.covers(Point(389500 + x, 5820000 - z))
            assert part["ground_y_m"] - 0.001 <= y <= part["top_y_m"] + 0.001
