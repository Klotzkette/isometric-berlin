"""Combine only the owner-requested finite airports, western lakes and A111."""

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
  "bounds-tegel-motorway-v194.geojson",
  "bounds-airports-v194.geojson",
  "bounds-west-lakes-v194.geojson",
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
    "revision": "1.0.94",
    "components": COMPONENTS,
    "scope": "Finite owner-requested Tempelhof/Tegel terminals, Tegel runways, A111 to the northern Berlin source boundary, Tegeler See, Schloss Tegel, Villa Borsig, complete Wannsee and Pfaueninsel recognition",
    "policy": "Previous detailed-city polygon and all unrelated geometry unchanged; no district or rectangular city fill inferred. Kreuzberg refinement remains within existing city.",
    "areaM2": area.area,
    "bounds": w.bounds,
  }
  e.write_json(DATA / "bounds-named-v194.geojson", bounds_payload(area, record))
  e.write_json(
    ROOT / "src/app/src/data/namedScopeV194.json",
    {
      "groundY": 3,
      "bounds": w.bounds,
      "footprint": e.navigation_polygons(w, 0, 0),
    },
  )
  e.write_json(DATA / "named-scope-v194-evidence.json", record)
  return record


if __name__ == "__main__":
  print(json.dumps(build()))
