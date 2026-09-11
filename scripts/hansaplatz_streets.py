"""Bounded OSM street presentation around GRIPS and Gymnasium Tiergarten."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
import shapely
from shapely.affinity import affine_transform
from shapely.geometry import Polygon, box
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from isometric_berlin.generation.build_surface_polygons import line_parts
from isometric_berlin.generation.road_geometry import road_width_m

# Presentation window only: no road, crossing or district boundary is invented.
HANSAPLATZ_WINDOW = (387285, 5819900, 387595, 5820200)
ORIGIN = (389500, 5820000)
# Both are mapped above-ground asphalt carriageways covered by the railway.
# Their `covered=yes` tag describes an overhead roof, not a raised road deck.
HANSAPLATZ_COVERED_ROAD_IDS = frozenset({"455280943", "455280945"})


def hansaplatz_clearance(root: Path) -> BaseGeometry:
  """Keep existing roofs, small courts and U9 stair approaches unobscured."""
  buildings = gpd.read_file(
    root / "geo_data/regierungsviertel/buildings.gpkg",
    layer="buildings",
    bbox=HANSAPLATZ_WINDOW,
  )
  grips = json.loads((root / "src/app/src/gripsHansaplatzSource.json").read_text())
  roads = gpd.read_file(
    root / "geo_data/regierungsviertel/osm.gpkg",
    layer="roads",
    bbox=HANSAPLATZ_WINDOW,
  )
  protected_approaches = [
    row.geometry.buffer((road_width_m(row) or 2.0) / 2 + 0.12)
    for _, row in roads.iterrows()
    if str(row["id"]) not in HANSAPLATZ_COVERED_ROAD_IDS
    and (
      row["highway"] == "steps"
      or any(
        isinstance(row.get(tag), str) and row[tag] != "no"
        for tag in ("covered", "bridge", "tunnel")
      )
    )
  ]
  rings = [
    Polygon(p["ring"], p["holes"]) for b in grips["buildings"] for p in b["parts"]
  ] + [Polygon(c["ring"]) for c in grips["courts"]]
  return unary_union(
    [
      *buildings.geometry,
      *protected_approaches,
      *(affine_transform(p, [1, 0, 0, -1, *ORIGIN]) for p in rings),
    ]
  ).buffer(0.04)


def hansaplatz_block_payload(
  asphalt: BaseGeometry,
  paving: BaseGeometry,
  curbs: BaseGeometry,
  exclusion: BaseGeometry,
) -> dict[str, Any]:
  """One-metre native top cells, losslessly run-encoded without solid infill."""
  scope = box(*HANSAPLATZ_WINDOW)
  # Reject every cell whose square could overlap an authored floor/structure.
  native_exclusion = exclusion.buffer(math.sqrt(0.5))
  visible_curbs = unary_union(
    [line for line in line_parts(curbs) if line.length >= 0.25]
  )
  # A one-cell kerb reading is native to Minecraft. The sampled centre must
  # still lie within 0.5 m of an actual open kerb; gaps are never bridged.
  geometries = [
    asphalt.intersection(scope).difference(native_exclusion),
    paving.intersection(scope).difference(native_exclusion),
    visible_curbs.intersection(scope.buffer(-0.3))
    .buffer(0.5)
    .difference(native_exclusion),
  ]
  min_x, min_y, max_x, max_y = HANSAPLATZ_WINDOW
  xs = np.arange(math.ceil(min_x), math.floor(max_x)) + 0.5
  ys = np.arange(math.ceil(min_y), math.floor(max_y)) + 0.5
  xx, yy = np.meshgrid(xs, ys)
  points = shapely.points(xx, yy)
  classes = np.full(xx.shape, -1, dtype=np.int8)
  for kind, geometry in enumerate(geometries):
    classes[shapely.covers(geometry, points)] = kind
  runs: list[list[int]] = []
  for row, y in zip(classes, ys):
    start = 0
    for end in range(1, len(row) + 1):
      if end < len(row) and row[start] == row[end]:
        continue
      if row[start] >= 0:
        runs.append(
          [
            int(xs[start] - 0.5 - ORIGIN[0]),
            int(ORIGIN[1] - y - 0.5),
            end - start,
            int(row[start]),
          ]
        )
      start = end
  return {
    "schema_version": 1,
    "license": "ODbL-1.0",
    "scope_epsg25833": list(HANSAPLATZ_WINDOW),
    "cell_m": 1,
    "classes": ["asphalt", "paving", "kerb"],
    "runs": runs,
    "cell_count": sum(run[2] for run in runs),
    "policy": "Source-derived one-metre Minecraft top cells; small courts, buildings and U9 remain with their authored models; no hidden solid fill",
  }
