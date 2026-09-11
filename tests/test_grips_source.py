"""The GRIPS refinement retains source envelopes and its two small courts."""

import json
from pathlib import Path

from shapely.geometry import Point, Polygon

from isometric_berlin.data.fetch_lod2 import load_bounds_polygon, project_to_berlin

ROOT = Path(__file__).resolve().parents[1]


def test_grips_retains_all_parts_and_the_exact_prior_display() -> None:
  source = json.loads((ROOT / "src/app/src/gripsHansaplatzSource.json").read_text())
  assert len(source["buildings"]) == 14
  parts = [p for b in source["buildings"] for p in b["parts"]]
  assert len(parts) == len(source["replaced_prism_ids"]) == 31
  previous = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  assert source["previous_display_prisms"] == [
    p for p in previous if p["id"] in source["replaced_prism_ids"]
  ]
  assert max(p["height_m"] for p in source["buildings"][0]["parts"]) == 8.47
  assert source["monument_part"] == "09050387,T,005"
  assert "recognition estimates" in source["conflict_policy"]
  bounds = project_to_berlin(
    load_bounds_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  for building in source["buildings"]:
    assert len(building["source_sha256"]) == 64
    assert building["source_url"].startswith("https://gdi.berlin.de/")
    for part in building["parts"]:
      for surface in part["surfaces"]:
        for ring in surface["rings"]:
          for x, _, z in ring:
            assert bounds.covers(Point(x + 389500, 5820000 - z))


def test_grips_courts_stay_compact_and_covered_routes_keep_osm_evidence() -> None:
  source = json.loads((ROOT / "src/app/src/gripsHansaplatzSource.json").read_text())
  assert len(source["courts"]) == 2
  assert sorted(round(c["area_m2"]) for c in source["courts"]) == [130, 245]
  for court in source["courts"]:
    assert Polygon(court["ring"]).is_valid
    assert abs(Polygon(court["ring"]).area - court["area_m2"]) < 0.001
  paths = {p["osm_key"]: p for p in source["osm_paths"]}
  assert paths["way/1332848648"]["covered"] == "yes"
  assert paths["way/1332848649"]["covered"] == "yes"
  for key in ["way/392577199", "way/271846981", "way/392577198"]:
    assert paths[key]["kind"] == "steps"
