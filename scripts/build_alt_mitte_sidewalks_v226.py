"""Step 10: add only missing explicitly mapped-width Alt-Mitte sidewalks."""

from __future__ import annotations

import argparse
import base64
import json
import math
import re
from collections import defaultdict
from typing import Any

import build_alt_mitte_transport_v206 as t
import numpy as np
import pyogrio
import shapely
from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

from isometric_berlin.generation.road_geometry import parse_osm_measure_m

SOURCE = t.GEO / "alt-mitte-sidewalks-v226-source.json"
OUT = t.APP / "altMitteSidewalksV226.json"
EVIDENCE = t.GEO / "alt-mitte-sidewalks-v226-evidence.json"


def parts(g: Any) -> list[Polygon]:
  if g.geom_type == "Polygon":
    return [] if g.is_empty else [g]
  return [p for c in getattr(g, "geoms", []) for p in parts(c)]


def extract() -> None:
  """Freeze positive width evidence and actual delivered surface exclusions."""
  scope = t.boundary()
  metric = affine_transform(scope, [1, 0, 0, -1, 389500, 5820000])
  bbox = transform(
    Transformer.from_crs(25833, 4326, always_xy=True).transform, metric
  ).bounds
  f = pyogrio.read_dataframe(
    t.GEO / "raw/outer-v159/candidate.gpkg", layer="lines", bbox=bbox
  ).to_crs(25833)
  features = []
  bands = []
  all_sidewalks = 0
  for r in f.to_dict("records"):
    tags = dict(re.findall(r'"([^\"]+)"=>"([^\"]*)"', str(r.get("other_tags", ""))))
    tags.update({k: r[k] for k in ("highway", "name") if isinstance(r.get(k), str)})
    geom = affine_transform(r["geometry"], [1, 0, 0, -1, -389500, 5820000])
    if tags.get("footway") != "sidewalk" or not scope.intersects(geom):
      continue
    all_sidewalks += 1
    width = parse_osm_measure_m(tags.get("width"))
    if (
      not width
      or not 0.4 <= width <= 12
      or not t.at_grade(tags)
      or tags.get("covered", "no") != "no"
      or tags.get("access") in ("no", "private")
    ):
      continue
    if tags.get("surface") not in (
      "paving_stones",
      "sett",
      "concrete",
      "concrete:plates",
      "asphalt",
    ):
      continue
    band = geom.buffer(width / 2, cap_style=2).intersection(scope)
    features.append(
      {
        "key": f"way/{r['osm_id']}",
        "tags": tags,
        "geometry": mapping(geom),
        "widthM": width,
      }
    )
    bands.append(band)
  target = unary_union(bands)
  shapely.prepare(target)
  print("source", all_sidewalks, len(features), target.area, flush=True)
  existing = []
  roads = []
  blocked = []
  inputs = {}

  def triangles(pos, ids, kind):
    polys = shapely.polygons(pos[ids])
    polys = polys[shapely.intersects(polys, target)]
    if len(polys):
      union = unary_union(polys).intersection(target)
      (roads if kind == "asphalt" else existing).append(union)

  p = t.APP / "restoredRoadSurfaces.ndjson.txt"
  inputs[str(p.relative_to(t.ROOT))] = t.digest(p)
  for line in p.read_text().splitlines()[1:]:
    r = json.loads(line)
    if r["kind"] not in ("asphalt", "paving"):
      continue
    pos = np.frombuffer(base64.b64decode(r["xz"]), dtype="<f4").reshape(-1, 2)
    if not target.intersects(box(*pos.min(axis=0), *pos.max(axis=0))):
      continue
    ids = np.frombuffer(base64.b64decode(r["indices"]), dtype="<u4").reshape(-1, 3)
    triangles(pos, ids, r["kind"])
  print("road slices", len(existing), len(roads), flush=True)
  for n in ["districtStreets", "schlossEastStreets"]:
    p = t.APP / (n + ".json")
    inputs[str(p.relative_to(t.ROOT))] = t.digest(p)
    for r in json.loads(p.read_text())["surfaces"]:
      if r["kind"] not in ("asphalt", "paving", "sidewalk", "gravel"):
        continue
      pos = (
        np.frombuffer(base64.b64decode(r["positions_cm_b64"]), dtype="<i4").reshape(
          -1, 2
        )
        / 100
      )
      ids = np.frombuffer(base64.b64decode(r["indices_b64"]), dtype="<u4").reshape(
        -1, 3
      )
      triangles(pos, ids, r["kind"])
  p = t.ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  inputs[str(p.relative_to(t.ROOT))] = t.digest(p)
  for b in json.loads(p.read_text())["buildings"]:
    # Core PrismPayload rings use decimetres; resolved outer GPKGs use metres.
    geom = Polygon(
      np.array(b["ring"]) / 10,
      [np.array(hole) / 10 for hole in b.get("holes", [])],
    )
    if geom.intersects(target):
      blocked.append(geom.buffer(0.05).intersection(target))
  for folder in ["outer-v159", "ring-v182", "city-v183"]:
    p = t.GEO / f"raw/{folder}/resolved-outlines.gpkg"
    inputs[str(p.relative_to(t.ROOT))] = t.digest(p)
    for r in pyogrio.read_dataframe(p, layer="surfaces").to_dict("records"):
      if not r["geometry"].intersects(target):
        continue
      g = r["geometry"].intersection(target)
      if r["kind"] == "path":
        existing.append(g)
      elif r["kind"] == "road":
        roads.append(g)
      elif r["kind"] == "water":
        blocked.append(g)
    for g in pyogrio.read_dataframe(p, layer="buildings").geometry:
      if g.intersects(target):
        blocked.append(g.buffer(0.05).intersection(target))
  p = t.GEO / "osm.gpkg"
  inputs[str(p.relative_to(t.ROOT))] = t.digest(p)
  for g in pyogrio.read_dataframe(p, layer="water").to_crs(25833).geometry:
    g = affine_transform(g, [1, 0, 0, -1, -389500, 5820000])
    if g.intersects(target):
      blocked.append(g.intersection(target))
  p = t.ROOT / "src/app/public/mesh/regierungsviertel/surface-polygons.json"
  inputs[str(p.relative_to(t.ROOT))] = t.digest(p)
  for r in json.loads(p.read_text())["roads"]:
    geom = shapely.make_valid(
      Polygon(np.array(r["ring"]) / 10, [np.array(h) / 10 for h in r.get("holes", [])])
    )
    if geom.intersects(target):
      (roads if r["kind"] == "asphalt" else existing).append(geom.intersection(target))
  p = t.ROOT / "src/app/public/mesh/regierungsviertel/park-details.json"
  inputs[str(p.relative_to(t.ROOT))] = t.digest(p)
  for r in json.loads(p.read_text())["paths"]:
    geom = LineString([(p[0], p[2]) for p in r["points"]]).buffer(
      r.get("w", 240) / 200, cap_style=2, join_style=2
    )
    if geom.intersects(target):
      existing.append(geom.intersection(target))
  existing = unary_union(existing)
  roads = unary_union(roads)
  blocked = unary_union(blocked)
  for p in [
    t.BOUNDARY,
    t.GEO / "raw/outer-v159/candidate.gpkg",
    t.PBF,
    t.APP / "altMitteTransportGroundV206.json",
    t.ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json",
  ]:
    inputs[str(p.relative_to(t.ROOT))] = t.digest(p)
  t.write(
    SOURCE,
    {
      "source": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      "license": "ODbL-1.0",
      "allSidewalks": all_sidewalks,
      "features": features,
      "existing": mapping(existing),
      "roads": mapping(roads),
      "blocked": mapping(blocked),
      "inputs": inputs,
    },
  )


def selected_patches(source: dict) -> list[dict]:
  """Exact positive-width complement; no default roadside strip or crossing fill."""
  scope = t.boundary()
  excluded = unary_union(
    [
      shape(source["existing"]).buffer(0.03),
      shape(source["roads"]).buffer(0.08),
      shape(source["blocked"]),
    ]
  )
  patches = []
  for f in source["features"]:
    band = shape(f["geometry"]).buffer(f["widthM"] / 2, cap_style=2).intersection(scope)
    selected = [
      p
      for p in parts(band.difference(excluded))
      if p.area >= 0.5 and not p.buffer(-0.125).is_empty
    ]
    if selected:
      patches.append({"key": f["key"], "geometry": unary_union(selected)})
  return patches


def build() -> None:
  """Triangulate complete complements; native pixels remain wholly inside them."""
  source = json.loads(SOURCE.read_text())
  patches = selected_patches(source)
  complement = unary_union([p["geometry"] for p in patches])
  shapely.prepare(complement)
  cells = defaultdict(lambda: {"points": {}, "indices": [], "nativeRuns": []})
  minx, minz, maxx, maxz = complement.bounds
  pixels = 0
  triangles = 0
  # Native runs and smooth triangles split at the original four-metre terrain
  # cells; no large flat plate bridges an existing DGM height change.
  for iz in range(math.floor(minz / 4), math.ceil(maxz / 4)):
    for ix in range(math.floor(minx / 4), math.ceil(maxx / 4)):
      tile = box(ix * 4, iz * 4, ix * 4 + 4, iz * 4 + 4)
      if not complement.intersects(tile):
        continue
      part = complement.intersection(tile)
      key = (math.floor(ix / 128), math.floor(iz / 128))
      cell = cells[key]
      for polygon in parts(part):
        for triangle in shapely.constrained_delaunay_triangles(polygon).geoms:
          points = list(triangle.exterior.coords)[:3]
          if triangle.area < 1e-9:
            continue
          indices = []
          for point in points:
            if point not in cell["points"]:
              cell["points"][point] = len(cell["points"])
            indices.append(cell["points"][point])
          a, b, c = points
          if (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0:
            indices.reverse()
          cell["indices"].extend(indices)
          triangles += 1
      for pz in range(iz * 16, iz * 16 + 16):
        start = None
        for px in range(ix * 16, ix * 16 + 17):
          hit = px < ix * 16 + 16 and complement.covers(
            box(px / 4, pz / 4, (px + 1) / 4, (pz + 1) / 4)
          )
          if hit and start is None:
            start = px
          if not hit and start is not None:
            cell["nativeRuns"].append([start, pz, px - start])
            pixels += px - start
            start = None
  output = {
    "source": source["source"],
    "sourceSha256": t.digest(SOURCE),
    "counts": {
      "auditedSidewalks": source["allSidewalks"],
      "explicitWidthWays": len(source["features"]),
      "addedWays": len(patches),
      "addedAreaM2": complement.area,
      "triangles": triangles,
      "nativePixels": pixels,
      "nativeRuns": sum(len(c["nativeRuns"]) for c in cells.values()),
    },
    "cells": [
      {
        "cell": list(key),
        "positions": [v for p in c["points"] for v in p],
        "indices": c["indices"],
        "nativeRuns": c["nativeRuns"],
      }
      for key, c in sorted(cells.items())
    ],
  }
  t.write(OUT, output)
  t.write(
    EVIDENCE,
    {
      "sourceSha256": t.digest(SOURCE),
      "boundarySha256": t.digest(t.BOUNDARY),
      "runtimeSha256": t.digest(OUT),
      "counts": output["counts"],
      "policy": "Only positive OSM footway=sidewalk with explicit width, at grade and public, minus every retained pavement/road, building and water footprint. No default width. No source geometry removed. 3cm pavement seam and 8cm carriageway clearance are display tolerances. Drawn inherits existing paving lift .10m; native .025m. Native quarter-metre pixels are full-footprint contained.",
      "patches": [
        {
          "key": p["key"],
          "areaM2": p["geometry"].area,
          "geometry": mapping(p["geometry"]),
        }
        for p in patches
      ],
    },
  )
  print(json.dumps(output["counts"]))


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  if args.extract or not SOURCE.exists():
    extract()
  build()
