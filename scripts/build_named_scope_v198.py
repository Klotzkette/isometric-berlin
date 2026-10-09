"""Combine only the owner-requested finite northern parks, Panke, Treptower Park and Tegel bridge."""

from __future__ import annotations

import json
from pathlib import Path

import build_surrounding_outlines as e
from build_city_coverage_v183 import bounds_payload
from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
COMPONENTS = (
  "bounds-north-parks-v198.geojson",
  "east-parks-v198-scope.geojson",
  "bounds-tegel-spandau-v198.geojson",
)


def build() -> dict:
  """Presentation reach follows source geometry; rectangular gaps add no city."""
  project = Transformer.from_crs(4326, 25833, always_xy=True).transform
  area = unary_union(
    [
      transform(project, shape(feature["geometry"]))
      for name in COMPONENTS
      for feature in json.loads((DATA / name).read_text())["features"]
    ]
  )
  w = e.world(area)
  record = {
    "revision": "1.0.98",
    "components": COMPONENTS,
    "scope": "Finite named northern parks, mapped Panke corridor, Treptower Park and Tegeler Hafenbrücke; no additional whole district",
    "policy": "Previous detailed-city polygon and all unrelated geometry unchanged; no district or rectangular city fill inferred. Other named refinements remain within previous coverage.",
    "areaM2": area.area,
    "bounds": w.bounds,
  }
  e.write_json(DATA / "bounds-named-v198.geojson", bounds_payload(area, record))
  e.write_json(
    ROOT / "src/app/src/data/namedScopeV198.json",
    {
      "groundY": 3,
      "bounds": w.bounds,
      "footprint": e.navigation_polygons(w, 0, 0),
    },
  )
  e.write_json(DATA / "named-scope-v198-evidence.json", record)
  return record


if __name__ == "__main__":
  print(json.dumps(build()))
