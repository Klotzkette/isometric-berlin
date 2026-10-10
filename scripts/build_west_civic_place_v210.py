"""Exact mapped Theodor-Heuss-Platz context missed by v182's old OSM crop."""

from __future__ import annotations

import hashlib
import json
import math
import re
from pathlib import Path

import numpy as np
import shapely
from build_breitscheid_towers_v161 import triangles_for
from build_surrounding_outlines import road_width_m
from pyproj import Transformer
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = GEO / "west-civic-place-v210-source.json"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform
VEHICLES = {
  "primary",
  "secondary",
  "tertiary",
  "residential",
  "unclassified",
  "service",
  "primary_link",
  "secondary_link",
  "tertiary_link",
}
FOOT = {"footway", "path", "pedestrian", "cycleway", "steps"}


def world(geometry):
  return transform(
    lambda x, y: (np.asarray(x) - 389500, 5820000 - np.asarray(y)),
    transform(PROJECT, geometry),
  )


def tags(feature):
  p = feature["properties"]
  t = dict(re.findall(r'"([^\"]+)"=>"([^\"]*)"', str(p.get("other_tags", ""))))
  t.update(
    {
      k: v
      for k, v in p.items()
      if isinstance(v, str) and k not in {"other_tags", "osm_id", "osm_way_id"}
    }
  )
  return t


def polygons(geom):
  if geom.is_empty:
    return []
  if geom.geom_type == "Polygon":
    return [geom]
  return [p for g in geom.geoms for p in polygons(g)]


def source():
  if SOURCE.exists():
    return json.loads(SOURCE.read_text())
  areas = json.loads(Path("/tmp/v210-theodor-multipolygons.geojson").read_text())[
    "features"
  ]
  plaza = next(
    f
    for f in areas
    if tags(f).get("place") == "square" and tags(f).get("name") == "Theodor-Heuss-Platz"
  )
  footprint = world(shape(plaza["geometry"]))
  scope = footprint.buffer(8, quad_segs=6)
  features = []
  for layer in ["lines", "multipolygons", "points"]:
    for f in json.loads(Path("/tmp/v210-theodor-" + layer + ".geojson").read_text())[
      "features"
    ]:
      t = tags(f)
      g = world(shape(f["geometry"]))
      if not g.intersects(scope):
        continue
      if layer == "lines" and (
        t.get("highway") not in VEHICLES | FOOT
        or t.get("tunnel", "no") not in {"no", "false", "0"}
      ):
        continue
      if layer == "points" and t.get("natural") != "tree":
        continue
      if layer == "multipolygons" and not (
        t.get("leisure") == "park"
        or t.get("landuse") in {"grass", "flowerbed"}
        or t.get("highway") in {"pedestrian", "footway"}
      ):
        continue
      if layer == "points":
        g = g.intersection(scope)
      features.append(
        dict(
          id=(
            "node/"
            if layer == "points"
            else "way/"
            if f["properties"].get("osm_way_id") or layer == "lines"
            else "relation/"
          )
          + str(f["properties"].get("osm_way_id") or f["properties"]["osm_id"]),
          layer=layer,
          tags={
            k: v
            for k, v in t.items()
            if k
            in {
              "name",
              "highway",
              "surface",
              "width",
              "lanes",
              "oneway",
              "sidewalk",
              "parking:lane:both",
              "parking:lane:left",
              "parking:lane:right",
              "landuse",
              "leisure",
              "natural",
              "height",
              "diameter_crown",
              "footway",
              "cycleway",
            }
          },
          geometry=mapping(g),
        )
      )
  result = dict(
    source="https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    sourceSha256=hashlib.sha256(
      (GEO / "raw/outer-v159/berlin-260929.osm.pbf").read_bytes()
    ).hexdigest(),
    license="ODbL-1.0",
    coordinateSystem="viewer metres; EPSG:25833 offset 389500,5820000, z=-north",
    square=dict(id="way/377196797", geometry=mapping(footprint)),
    scope=mapping(scope),
    scopePolicy="Only the mapped square plus 8m immediate street edge. Original PBF courses retained; no surrounding Westend expansion.",
    features=features,
  )
  SOURCE.write_text(
    json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  return result


def build_place():
  s = source()
  scope = shape(s["scope"])
  classes = {"park": [], "grass": [], "flowerbed": [], "path": [], "road": []}
  trees = []
  widths = []
  for f in s["features"]:
    t = f["tags"]
    g = shape(f["geometry"])
    if f["layer"] == "points":
      trees.append((f, g))
      continue
    if f["layer"] == "lines":
      h = t["highway"]
      isroad = h in VEHICLES
      width = (
        road_width_m(t)
        if isroad
        else float(t.get("width", "2.4").split()[0])
        if re.fullmatch(r"[0-9.]+", t.get("width", "2.4"))
        else 2.4
      )
      if width is None:
        continue
      widths.append(
        dict(
          id=f["id"],
          widthM=width,
          status="OSM tagged width or existing lane/class estimate; line vertices unchanged",
        )
      )
      classes["road" if isroad else "path"].append(
        g.buffer(width / 2, quad_segs=5, join_style="round", cap_style="round")
      )
    elif t.get("leisure") == "park":
      classes["park"].append(g)
    elif t.get("landuse") in {"grass", "flowerbed"}:
      classes[t["landuse"]].append(g)
    elif t.get("highway") in {"pedestrian", "footway"}:
      classes["path"].append(g)
  unions = {k: unary_union(v) for k, v in classes.items()}
  road = unions["road"]
  path = unions["path"]
  # Paving is the mapped park's interstitial space; mapped planted areas remain
  # green. Union precedes border generation, so junctions never get curb bars.
  occupied = Polygon()
  patches = []
  for key, y, color in [
    ("road", 3.11, 0x555955),
    ("path", 3.14, 0xC9C1AB),
    ("flowerbed", 3.08, 0x88785B),
    ("grass", 3.07, 0x7C9C64),
    ("park", 3.05, 0xBCB69F),
  ]:
    geometry = unions[key].intersection(scope).difference(occupied)
    occupied = occupied.union(geometry)
    patches.append((key, geometry, y, color))
  curbs = road.boundary.intersection(scope.buffer(-0.2)).difference(path.buffer(0.45))
  curbp = curbs.buffer(0.16, cap_style="flat", join_style="round", quad_segs=3)
  patches.append(("curb", curbp, 3.23, 0xC5C1AF))
  group = dict(
    name="Theodor-Heuss-Platz: mapped square, planted beds and street ring",
    required=False,
    boxes=[],
    roles=[],
    surfaces=[],
    rods=[],
    native=[],
    nativeSurfaceQuads=[],
  )
  for key, geom, y, color in patches:
    for p in polygons(geom):
      rings = [[[x, y, z] for x, z in r.coords] for r in [p.exterior, *p.interiors]]
      group["surfaces"].append(dict(color=color, triangles=triangles_for(rings)))
  # Independently axis-aligned native pavement: one metre cells, then exact
  # horizontal-run coalescing. No broad rotated AABB and no vertical filled slabs.
  minx, minz, maxx, maxz = scope.bounds
  xs = np.arange(math.floor(minx), math.ceil(maxx))
  zs = np.arange(math.floor(minz), math.ceil(maxz))
  for z in zs:
    points = shapely.points(xs + 0.5, np.full(len(xs), z + 0.5))
    values = np.full(len(xs), -1, dtype=int)
    for j, (_, geom, _, _) in enumerate(patches):
      values[shapely.covers(geom, points)] = j
    start = 0
    while start < len(xs):
      j = values[start]
      end = start + 1
      while end < len(xs) and values[end] == j:
        end += 1
      if j >= 0:
        _, _, y, color = patches[j]
        group["nativeSurfaceQuads"].append(
          [float(xs[start]), float(z), float(xs[end - 1] + 1), float(z + 1), y, color]
        )
      start = end
  # Preserve the selected metre cells exactly while merging identical runs
  # vertically; this changes neither their coverage nor native silhouette.
  buckets = {}
  for x0, z0, x1, z1, y, color in group["nativeSurfaceQuads"]:
    buckets.setdefault((x0, x1, y, color), []).append(z0)
  merged = []
  for (x0, x1, y, color), rows in buckets.items():
    rows.sort()
    first = last = rows[0]
    for z in rows[1:] + [None]:
      if z is not None and z == last + 1:
        last = z
        continue
      merged.append([x0, first, x1, last + 1, y, color])
      first = last = z
  group["nativeSurfaceQuads"] = merged
  # Only mapped tree nodes, modest estimated crowns; decorative/passable like
  # surrounding generic foliage. No synthetic trees or new navigation envelope.
  for i, (f, p) in enumerate(trees):
    x, z = p.x, p.y
    height = 7.0
    for y, w, h, d, color, role in [
      (4.8, 0.35, 3.6, 0.35, 0x685747, "mapped tree trunk"),
      (7.0, 3.8, 3.5, 3.8, 0x668749, "mapped tree crown"),
      (9.1, 2.9, 1.8, 2.9, 0x769954, "mapped tree crown"),
    ]:
      row = [round(x, 3), y, round(z, 3), w, h, d, 0, color]
      group["boxes"].append(row)
      group["roles"].append(role)
    f["displayEstimate"] = dict(heightM=height, crownWidthM=3.8)
  evidence = dict(
    square=s["square"],
    scope=s["scope"],
    sourceSha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    features=len(s["features"]),
    treeNodes=[f["id"] for f, p in trees],
    widths=widths,
    patches=[dict(kind=k, geometry=mapping(g), y=y, color=c) for k, g, y, c in patches],
    nativeQuads=len(group["nativeSurfaceQuads"]),
    diagnosis="Existing ring182--14_1 renders only ground y=3 at the obelisk: reused v159 candidate.gpkg omitted this west-lobe context. Existing published packets retained byte-for-byte.",
    policy="No invented crossings, signs or buildings. Curbs use only union boundary before scope clipping, and omit mapped paths/crossing gaps. Flat existing ground datum retained.",
  )
  return group, evidence
