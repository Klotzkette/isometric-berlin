"""Correct the bounded blue rubber area without recolouring mapped sand play."""

from __future__ import annotations

import json
import math
from pathlib import Path

import geopandas as gpd
import pandas as pd
from build_breitscheid_towers_v161 import triangles_for
from build_surrounding_outlines import world
from shapely.geometry import Point, Polygon, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "src/app/src/data/weinbergPlaygroundV174Source.json"


def build() -> dict:
  frame = gpd.read_file(
    ROOT / "geo_data/regierungsviertel/raw/outer-v159/candidate.gpkg",
    layer="multipolygons",
    bbox=(13.401, 52.5325, 13.405, 52.5343),
  ).to_crs(25833)
  ids = {
    "49217749",
    "390586682",
    "409562795",
    "409562796",
    "409562797",
    "49217367",
    "409562790",
  }
  features = {}
  for _, row in frame.iterrows():
    oid = str(row.osm_id) if pd.notna(row.osm_id) else str(row.osm_way_id)
    if oid in ids:
      features[oid] = world(row.geometry)
  assert set(features) == ids
  # Inspected official spring-2025 orthophoto, 12.5 cm per pixel. These
  # material edges are image-derived estimates, never claimed as a survey.
  pixels = [
    [515, 435],
    [522, 420],
    [550, 408],
    [580, 392],
    [617, 369],
    [624, 374],
    [636, 405],
    [645, 444],
    [650, 490],
    [622, 494],
    [592, 491],
    [561, 500],
    [542, 484],
    [526, 468],
  ]
  visible = Polygon([(2115 + x * 0.125, -1570 + y * 0.125) for x, y in pixels])
  protected = unary_union([g for oid, g in features.items() if oid != "49217749"])
  evidence = json.loads(
    (ROOT / "src/app/src/data/mitteHeritageV166Evidence.json").read_text()
  )
  # Retain the source-cut paths as well as separately mapped sand and pitches.
  allowed = unary_union(
    [
      Polygon(p["rings"][0], p["rings"][1:])
      for p in evidence["groundPolygons"]
      if p["kind"] == "playground"
    ]
  )
  rubber = (
    visible.intersection(features["49217749"])
    .intersection(allowed)
    .difference(protected)
  )
  polygons = [rubber] if rubber.geom_type == "Polygon" else list(rubber.geoms)
  surfaces, native = [], []
  for poly in polygons:
    if poly.area < 0.01:
      continue
    rings = [list(poly.exterior.coords)] + [list(h.coords) for h in poly.interiors]
    surfaces.append(
      {
        "color": 0x709BB9,
        "triangles": triangles_for(
          [[[x, 3.255, z] for x, z in ring] for ring in rings]
        ),
      }
    )
    # Independent native rows at quarter-metre resolution, merged along X.
    x0, z0, x1, z1 = poly.bounds
    for iz in range(math.floor(z0 * 4), math.ceil(z1 * 4)):
      cells = [
        ix
        for ix in range(math.floor(x0 * 4), math.ceil(x1 * 4))
        if poly.covers(Point((ix + 0.5) / 4, (iz + 0.5) / 4))
      ]
      if not cells:
        continue
      start = prev = cells[0]
      for ix in cells[1:] + [cells[-1] + 2]:
        if ix != prev + 1:
          native.append(
            [
              (start + prev + 1) / 8,
              3.23,
              (iz + 0.5) / 4,
              (prev - start + 1) / 4,
              0.05,
              0.25,
              0x709BB9,
            ]
          )
          start = ix
        prev = ix
  return {
    "playgroundId": "49217749",
    "surfaceArea": rubber.area,
    "orthophotoPixelEdgeEstimate": pixels,
    "geometry": mapping(rubber),
    "preservedAreas": {
      oid: mapping(g) for oid, g in features.items() if oid != "49217749"
    },
    "surfaces": surfaces,
    "nativeRows": native,
  }


if __name__ == "__main__":
  data = build()
  DEST.write_text(json.dumps(data, separators=(",", ":")) + "\n")
  print(
    f"{data['surfaceArea']:.2f} m² blue rubber; {len(data['nativeRows'])} native rows"
  )
