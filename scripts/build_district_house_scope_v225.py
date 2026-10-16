"""Step 10: compact exact selectors; no city geometry generation or source rewrite."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import Polygon, box, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUTPUT = ROOT / "src/app/src/data/districtHouseScopeV225.json"
NAMES = ("Moabit", "Prenzlauer Berg", "Schöneberg", "Wilmersdorf")


def source_regions() -> dict[str, Any]:
  """Retain original ALKIS rings and the explicit 450 m school margin."""
  regions = {}
  for name in (
    "district-facades-v188-boundaries.geojson",
    "surrounding-district-boundaries.geojson",
    "wilmersdorf-boundary-v225.geojson",
  ):
    for feature in json.loads((GEO / name).read_text())["features"]:
      name = feature["properties"]["nam"]
      if name in NAMES:
        regions[name] = affine_transform(
          shape(feature["geometry"]), [1, 0, 0, -1, -389500, 5820000]
        )
  features = json.loads((GEO / "steglitz-v182-exclusions.geojson").read_text())[
    "features"
  ]
  school = next(
    f for f in features if f["properties"].get("officialId") == "DEBE06YYB0000AUq"
  )
  centre = shape(school["geometry"]).centroid
  x, y = Transformer.from_crs(4326, 25833, always_xy=True).transform(centre.x, centre.y)
  x, z = round(x - 389500, 3), round(5820000 - y, 3)
  regions["Gymnasium Steglitz surroundings"] = box(x - 450, z - 450, x + 450, z + 450)
  return {name: regions[name] for name in (*NAMES, "Gymnasium Steglitz surroundings")}


def polygons(geometry: Any) -> list:
  """Serialize exact clipped polygon pieces; retain holes and every source bend."""
  parts = [geometry] if isinstance(geometry, Polygon) else geometry.geoms
  return [
    [[[round(x, 7), round(z, 7)] for x, z in p.exterior.coords]]
    + [[[round(x, 7), round(z, 7)] for x, z in ring.coords] for ring in p.interiors]
    for p in parts
    if isinstance(p, Polygon) and not p.is_empty
  ]


def build() -> dict:
  """Preclassify whole cells; boundary queries scan only their exact fragment."""
  regions = []
  for name, geometry in source_regions().items():
    x0, z0, x1, z1 = geometry.bounds
    size, gx, gz = 128, int(x0 // 128), int(z0 // 128)
    width, height = int(x1 // size) - gx + 1, int(z1 // size) - gz + 1
    cells, boundary = [], {}
    for z in range(height):
      for x in range(width):
        cell = box(
          (gx + x) * size,
          (gz + z) * size,
          (gx + x + 1) * size,
          (gz + z + 1) * size,
        )
        code = (
          "1" if geometry.covers(cell) else "2" if geometry.intersects(cell) else "0"
        )
        if code == "2":
          boundary[str(len(cells))] = polygons(geometry.intersection(cell))
        cells.append(code)
    regions.append(
      {
        "name": name,
        "bounds": list(geometry.bounds),
        "grid": {
          "size": size,
          "x0": gx,
          "z0": gz,
          "width": width,
          "height": height,
          "cells": "".join(cells),
        },
        "boundaryCells": boundary,
      }
    )
  return {"schemaVersion": 1, "regions": regions}


if __name__ == "__main__":
  OUTPUT.write_text(json.dumps(build(), separators=(",", ":")) + "\n")
