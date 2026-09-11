"""Step 10: exact source retention and bounded architecture supplements."""

import json
from pathlib import Path

from shapely.geometry import Polygon

from isometric_berlin.data.fetch_lod2 import load_bounds_polygon, project_to_berlin

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/app/src/schlossNaturkundeSource.json"


def test_source_retains_all_parts_and_original_prisms() -> None:
  source = json.loads(SOURCE.read_text())
  profiles = source["profiles"]
  assert source["license"] == "dl-de/zero-2-0"
  assert len(profiles["schloss"]["parts"]) == 17
  assert len(profiles["naturkunde"]["parts"]) == 4
  assert profiles["schloss"]["osm_identity"].endswith("relation/3007958")
  assert profiles["naturkunde"]["osm_identity"].endswith("node/538692583")
  assert profiles["naturkunde"]["display_y_translation_m"] == 2.166
  canonical = {
    p["id"]: p
    for p in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
    )["buildings"]
  }
  for profile in profiles.values():
    assert len(profile["source_sha256"]) == 64
    for part in profile["previous_display_prisms"]:
      assert part == canonical[part["id"]]
  assert len(profiles["naturkunde"]["replaced_prism_ids"]) == 4
  assert SOURCE.stat().st_size < 225_000


def test_original_planes_and_holes_stay_in_approved_bounds() -> None:
  source = json.loads(SOURCE.read_text())
  bounds = project_to_berlin(
    load_bounds_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  for profile in source["profiles"].values():
    for part in profile["parts"]:
      polygon = Polygon(
        [(x + 389500, 5820000 - z) for x, z in part["ring"]],
        [[(x + 389500, 5820000 - z) for x, z in h] for h in part["holes"]],
      )
      assert bounds.covers(polygon)
      assert part["top_y_m"] > part["ground_y_m"]
      assert part["surfaces"]
  dome = source["profiles"]["schloss"]["parts"][0]
  assert dome["id"] == "DEBE3DzLpp1avSfB"
  assert dome["top_y_m"] == 64.87
  assert sum(len(p["holes"]) for p in source["profiles"]["schloss"]["parts"]) == 2
