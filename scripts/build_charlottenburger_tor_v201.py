"""Step 10: retain the exact two OSM gate rings and their independent axes."""

from __future__ import annotations

import json
import math
from pathlib import Path

import geopandas as gpd
from shapely.geometry import mapping

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "geo_data/regierungsviertel"


def build() -> None:
  source = gpd.read_file(
    OUT / "raw/outer-v159/candidate.gpkg",
    layer="multipolygons",
    where="osm_id='13918836'",
  )
  assert len(source) == 1
  source_ring = source.geometry.iloc[0]
  metric = source.to_crs(25833).geometry.iloc[0]
  polygons = sorted(metric.geoms, key=lambda p: -p.centroid.y)
  assert len(polygons) == 2
  wings = []
  for name, polygon in zip(("north", "south"), polygons, strict=True):
    rectangle = list(polygon.minimum_rotated_rectangle.exterior.coords)
    edges = [(b[0] - a[0], b[1] - a[1]) for a, b in zip(rectangle, rectangle[1:])]
    dx, dy = max(edges, key=lambda r: math.hypot(*r))
    yaw = math.degrees(math.atan2(dy, dx)) % 180
    center = [polygon.centroid.x - 389500, 5820000 - polygon.centroid.y]
    wings.append(
      {
        "name": name,
        "centerWorldM": center,
        "yawDegrees": yaw,
        "ringWorldM": [[x - 389500, 5820000 - y] for x, y in polygon.exterior.coords],
      }
    )
  evidence = {
    "version": 201,
    "step": 10,
    "sourceOsmRelation": 13918836,
    "license": "ODbL-1.0",
    "sourceUrl": "https://www.openstreetmap.org/relation/13918836",
    "heritageUrl": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096448",
    "districtUrl": "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/artikel.1368662.php",
    "sourceGeoJsonGeometry": mapping(source_ring),
    "wings": wings,
    "publishedOpeningM": 34,
    "previousYawRadians": 0.087,
    "retention": "All 58 authored v116 primitives, their indices and colours retained. Complete wings rigidly repositioned; entire south principal bronze translated 6.9 m across its local front axis to the documented east face.",
    "sourceLimits": "OSM ring centroids and straight major axes guide alignment, not a facade survey. Slightly curved source plan retained in evidence; prior straight local columns, figures, heights and subdivisions remain unchanged presentation geometry. No matching LoD2 owner in cached official tile 386_5819.",
    "scope": "Only the two gate wings. Western candelabra, bridge, trees, source roads and Großer Stern tunnel houses untouched.",
    "cameras": [
      {
        "name": "overview-east",
        "position": [-2650, 62, 640],
        "target": [-2731, 20, 568],
      },
      {"name": "north-east", "position": [-2692, 27, 550], "target": [-2733, 22, 539]},
      {"name": "south-east", "position": [-2687, 30, 593], "target": [-2729, 22, 597]},
    ],
  }
  (OUT / "charlottenburger-tor-v201-evidence.json").write_text(
    json.dumps(evidence, ensure_ascii=False, indent=2) + "\n"
  )


if __name__ == "__main__":
  build()
