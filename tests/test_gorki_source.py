"""Bounded step-10 source retention for the Maxim Gorki Theater."""

import json
from pathlib import Path

from shapely.geometry import Point

from isometric_berlin.data.fetch_lod2 import (
  load_bounds_polygon,
  project_to_berlin,
)

ROOT = Path(__file__).resolve().parents[1]


def test_gorki_retains_all_official_parts_and_the_prior_fallback() -> None:
  """Source fusion must preserve both identities and original metric surfaces."""
  source = json.loads((ROOT / "src/app/src/gorkiBuildingSource.json").read_text())
  assert source["parent_id"] == "DEBE01YYK000039k"
  assert len(source["parts"]) == 3
  assert sum(len(p["surfaces"]) for p in source["parts"]) == 64
  assert source["replaced_osm_prism_ids"] == ["31835798"]
  assert source["previous_display_prisms"][0]["h_dm"] == 90
  assert source["osm_identity"].endswith("/way/131835798")
  assert source["license"] == "dl-de/zero-2-0"
  assert len(source["source_sha256"]) == 64
  bounds = project_to_berlin(
    load_bounds_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  for part in source["parts"]:
    for surface in part["surfaces"]:
      for ring in surface["rings"]:
        for x, _, z in ring:
          assert bounds.covers(Point(x + 389500, 5820000 - z))
  assert max(p["top_y_m"] for p in source["parts"]) == 26.777
