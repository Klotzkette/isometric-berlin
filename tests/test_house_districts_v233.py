"""Keep the v233 presentation selection tied to complete official districts."""

import json
from pathlib import Path

from shapely.geometry import shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


def test_full_district_selection_has_no_missing_ortsteile_or_new_territory() -> None:
  source = json.loads(
    (ROOT / "geo_data/regierungsviertel/house-districts-v233.geojson").read_text()
  )
  expected = {
    "11000001": {
      "Mitte",
      "Moabit",
      "Hansaviertel",
      "Tiergarten",
      "Wedding",
      "Gesundbrunnen",
    },
    "11000002": {"Friedrichshain", "Kreuzberg"},
    "11000004": {
      "Charlottenburg",
      "Wilmersdorf",
      "Schmargendorf",
      "Grunewald",
      "Westend",
      "Charlottenburg-Nord",
      "Halensee",
    },
    "11000007": {"Schöneberg"},
    "11000006": {
      "Steglitz",
      "Lichterfelde",
      "Lankwitz",
      "Zehlendorf",
      "Dahlem",
      "Nikolassee",
      "Wannsee",
      "Schlachtensee",
    },
  }
  features = source["features"]
  assert len(features) == 24
  for prefix, names in expected.items():
    assert {
      feature["properties"]["nam"]
      for feature in features
      if feature["properties"]["sch"].startswith(prefix)
    } == names
  geometries = [shape(feature["geometry"]) for feature in features]
  assert all(g.is_valid and not g.is_empty for g in geometries)
  # Administrative boundaries must not overlap and double-assign a house.
  assert sum(g.area for g in geometries) - unary_union(geometries).area < 0.01
  assert source["crs"]["properties"]["name"].endswith("25833")
  assert source["source"]["licence"] == "dl-de/zero-2-0"
  assert len(source["source"]["responseSha256"]) == 64
