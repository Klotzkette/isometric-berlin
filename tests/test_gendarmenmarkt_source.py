"""Step 10 source/coverage contracts for the Gendarmenmarkt ensemble."""

from __future__ import annotations

import json
from pathlib import Path

from shapely.geometry import Polygon

from isometric_berlin.data.fetch_lod2 import load_bounds_polygon, project_to_berlin

ROOT = Path(__file__).resolve().parents[1]


def test_gendarmenmarkt_preserves_complete_bounded_source() -> None:
  source = json.loads((ROOT / "src/app/src/gendarmenmarktSource.json").read_text())
  bounds = project_to_berlin(
    load_bounds_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  assert len(source["profiles"]) == 5
  assert sum(len(p["parts"]) for p in source["profiles"].values()) == 17
  for profile in source["profiles"].values():
    assert profile["source_url"].endswith("LoD2_390_5819.zip")
    assert len(profile["source_sha256"]) == 64
    for part in profile["parts"]:
      ring = [(389500 + x, 5820000 - z) for x, z in part["ring"]]
      assert bounds.covers(Polygon(ring))
      assert part["surfaces"]
      assert {s["kind"] for s in part["surfaces"]} == {
        "WallSurface",
        "RoofSurface",
      }


def test_gendarmenmarkt_previous_prisms_remain_unmodified() -> None:
  source = json.loads((ROOT / "src/app/src/gendarmenmarktSource.json").read_text())
  prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  by_id = {p["id"]: p for p in prisms}
  previous = [
    p
    for profile in source["profiles"].values()
    for p in profile["previous_display_prisms"]
  ]
  assert len(previous) == 9
  for part in previous:
    assert part == by_id[part["id"]]
  assert source["square"]["osm_key"] == "way/844740667"
  assert source["schiller"]["osm_key"] == "node/262457570"
