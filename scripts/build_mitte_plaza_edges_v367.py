"""Recover the sub-cell course of paved pedestrian areas and their planted islands."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

import numpy as np
import pyogrio
import shapely
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

from isometric_berlin.generation.build_minecraft_voxels import aboveground, to_world

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app"
GROUND = APP / "public/mesh/regierungsviertel/ground-context.json"
OSM = GEO / "osm.gpkg"
BOUNDARY = GEO / "house-districts-v233.geojson"
CORE = APP / "src/data/surroundingCityScope.json"
OUTPUT = APP / "src/data/mittePlazaEdgesV367.json"
PAVING = {
  "sett",
  "cobblestone",
  "paving_stones",
  "paved",
  "concrete",
  "asphalt",
  "sett;paving_stones",
  "concrete:plates",
  "concrete:lanes",
  "cobblestone:flattened",
}


def build(*, outer_districts=None, clip=None, output=None):
  ground = json.loads(GROUND.read_bytes())
  grid, cell = ground["grid"], ground["cell_m"]
  core = json.loads(CORE.read_bytes())["core"]
  scope = Polygon(core["ring"], core["holes"])
  districts = {
    f["properties"]["nam"]: to_world(shape(f["geometry"]))
    for f in json.loads(BOUNDARY.read_bytes())["features"]
    if (
      f["properties"]["nam"] in outer_districts
      if outer_districts is not None
      else f["properties"]["sch"].startswith("11000001")
    )
  }
  assert len(districts) == (len(outer_districts) if outer_districts is not None else 6)
  scope = scope.intersection(unary_union(list(districts.values())))

  if clip is not None:
    scope = scope.intersection(clip)

  roads = aboveground(pyogrio.read_dataframe(OSM, layer="roads"))
  # Only literal, at-grade pedestrian AREAS with a mapped hard surface qualify.
  # In particular a station platform, bridge deck or footway line is no plaza.
  # The Kirchplatz and its approaches already have their surveyed floor.
  kirchplatz_file = GEO / "nikolaikirchplatz-v367.geojson.gz"
  kirchplatz = json.loads(gzip.decompress(kirchplatz_file.read_bytes()))
  scope = scope.difference(
    unary_union(
      [to_world(shape(f["geometry"])) for f in kirchplatz["features"]]
    ).buffer(8)
  )
  access_file = APP / "src/data/ubahnAccessV326.json"
  access = json.loads(access_file.read_bytes())
  openings = [
    Polygon(entry["stair"]["ring"]).buffer(0.005)
    for entry in access["entries"]
    if entry["stair"]
  ]
  openings_tree = STRtree(openings)
  areas = roads[
    roads.geom_type.isin(["Polygon", "MultiPolygon"])
    & roads.highway.isin(["pedestrian", "footway", "path"])
    & roads.surface.isin(PAVING)
    & (roads.bridge.isna() | (roads.bridge == "no"))
    & (roads.layer.isna() | (roads.layer == "0"))
  ]
  paved, ids, names = [], [], []
  for _, row in areas.iterrows():
    geom = shapely.make_valid(to_world(row.geometry)).intersection(scope)
    if geom.area > 0.01:
      paved.append(geom)
      ids.append(str(row.id))
      names.append(None if not isinstance(row["name"], str) else row["name"])
  parks = pyogrio.read_dataframe(OSM, layer="parks")
  # An administrative park perimeter can include large stone squares. Only
  # explicit planted land cover supplies green paint or cuts a planted hole.
  leaves = parks[
    parks.landuse.isin(["grass", "meadow", "flowerbed"])
    | parks.natural.isin(["grassland", "scrub"])
  ]
  planted = [
    shapely.make_valid(to_world(g))
    for g in leaves.geometry
    if g.geom_type in ("Polygon", "MultiPolygon")
  ]
  planted_tree = STRtree(planted)
  # Compare the original raster rows offline. Send triangles only where a
  # recorded material disagrees with the polygon covering that part of a cell.
  grid_classes = np.full((grid["rows"], grid["cols"]), -1, dtype=np.int8)
  for iz, runs in enumerate(ground["ground_rows"]):
    for start, count, kind in runs:
      grid_classes[iz, start : start + count] = kind
  grass, brick = (ground["classes"].index(v) for v in ("grass", "plazaBrick"))
  candidates = set()
  for p in paved:
    minx, minz, maxx, maxz = p.bounds
    for z in range(math.floor(minz / cell) - 1, math.ceil(maxz / cell) + 1):
      for x in range(math.floor(minx / cell) - 1, math.ceil(maxx / cell) + 1):
        candidates.add((z, x))
  paved_tree = STRtree(paved)
  words, seen, by_district, corrected = [], set(), Counter(), Counter()
  sample = {}
  quant = 1000
  vertex_count = 0
  for z, x in sorted(candidates):
    row, col = z - grid["min_z_idx"], x - grid["min_x_idx"]
    if not (0 <= row < grid["rows"] and 0 <= col < grid["cols"]):
      continue
    old = grid_classes[row, col]
    if old not in (grass, brick):
      continue
    cell_x, cell_z = x * cell, z * cell
    tile = box(cell_x, cell_z, cell_x + cell, cell_z + cell)
    # Both materials are clipped to the core and borough, including cells
    # that cross either administrative or render-coverage boundaries.
    nearby = paved_tree.query(tile, predicate="intersects")
    if not len(nearby):
      continue
    land = unary_union([paved[i] for i in nearby]).intersection(tile)
    beds = planted_tree.query(tile, predicate="intersects")
    green = unary_union([planted[i] for i in beds]).intersection(tile)
    if old == grass:
      correction = land.difference(green)
    else:
      # Beyond the mapped planting we cannot infer the adjacent material
      # (another sidewalk, steps, or an untagged verge). Its paint is retained.
      correction = green.intersection(scope)
    mouths = openings_tree.query(tile, predicate="intersects")
    if len(mouths):
      correction = correction.difference(unary_union([openings[i] for i in mouths]))
    if correction.area < 0.002:
      continue
    local = []
    for tri in shapely.constrained_delaunay_triangles(correction).geoms:
      xy = list(tri.exterior.coords)[:3]
      points = [
        (round((a - cell_x) * quant), round((b - cell_z) * quant)) for a, b in xy
      ]
      a, b, c = points
      area2 = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
      if not area2:
        continue
      if area2 > 0:  # upwards in the world's XZ plane
        points.reverse()
      assert all(0 <= v <= cell * quant for p in points for v in p)
      for p in points:
        local.extend(p)
    if not local:
      continue
    vertex_count += len(set(zip(local[::2], local[1::2])))
    words.extend([row, col, int(old), len(local) // 6, *local])
    by_district.update(
      [next(n for n, g in districts.items() if g.intersects(correction))]
    )
    corrected["paving" if old == grass else "planting"] += correction.area
    for i in nearby:
      seen.add(int(i))
      if names[i] and (names[i] not in sample or correction.area > sample[names[i]][2]):
        sample[names[i]] = [
          cell_x + cell / 2,
          cell_z + cell / 2,
          round(correction.area, 3),
        ]
  data = {
    "grid": grid,
    "cellM": cell,
    "subunits": quant,
    "maxVertices": vertex_count,
    "triangles": (len(words) - sum(by_district.values()) * 4) // 6,
    "classIds": {"grass": grass, "plazaBrick": brick},
    "cells": sum(by_district.values()),
    "words": base64.b64encode(np.asarray(words, dtype="<u2").tobytes()).decode(),
  }
  (output or OUTPUT).write_text(json.dumps(data, separators=(",", ":")) + "\n")
  proof = {
    "sourceFiles": {
      str(f.relative_to(ROOT)): hashlib.sha256(f.read_bytes()).hexdigest()
      for f in [OSM, GROUND, CORE, BOUNDARY, access_file, kirchplatz_file]
    },
    "features": [ids[i] for i in sorted(seen)],
    "mappedAreas": len(seen),
    "districtCells": by_district,
    "correctedSquareMetres": {k: round(v, 2) for k, v in corrected.items()},
    "triangles": (len(words) - data["cells"] * 4) // 6,
    "sampleXZ": sample,
  }
  print(json.dumps(proof, ensure_ascii=False, indent=2))


if __name__ == "__main__":
  build()
