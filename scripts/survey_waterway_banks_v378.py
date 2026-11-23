"""Clip surveyed shore features to the published model and a channel-aligned bank corridor."""

import collections
import json
import math

import numpy as np
import waterways_survey_v378 as pr
from shapely import (
  STRtree,
  make_valid,
  union_all,
)
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import substring

P = pr.P
R = pr.R
A = pr.A
app = R / "src/app"
M = json.load(open(app / "public/mesh/surrounding-berlin-v159/manifest.json"))


def poly(v):
  return make_valid(Polygon(v["ring"], v.get("holes", []))).buffer(0)


model = union_all([poly(f) for f in M["footprint"]] + [poly(M["boundary"][0])])
print("area", model.area / 1e6, flush=True)
axis = [
  r
  for r in A
  if r[2].get("waterway") in ("river", "canal", "stream", "ditch", "drain")
  and not r[2].get("tunnel")
  and r[2].get("covered") != "yes"
  and r[3].intersects(model)
]
aq = STRtree([r[3] for r in axis])
waters = pr.geoall("water", True)
wet = []
bank = []
refs = []
bname = []
for i, v, t, g in waters:
  if g.is_empty or g.area < 20 or not g.intersects(model):
    continue
  possible = aq.query(g, predicate="intersects")
  if not len(possible):
    continue
  hits = [
    int(j)
    for j in possible
    if (
      axis[j][2].get("waterway") in ("river", "canal", "stream")
      or t.get("water") in ("canal", "river", "stream", "ditch", "drain")
    )
  ]
  if not hits:
    continue
  owner = max(hits, key=lambda j: g.intersection(axis[j][3]).length)
  wet.append(g)
  bank.append(g.boundary)
  refs.append((i, v, axis[owner][0]))
  bname.append(axis[owner][2].get("name", t.get("name", "")))
print("axis", len(axis), "wet", len(bank), flush=True)
# Represent mapped banks even when a narrow stream has no surveyed water polygon.
# A source stream of unknown width is an alignment, not a waterline or a fence.
lin = pr.union_all(wet)
# Never match seams between adjacent polygons that form one open water surface.
true_bank = lin.boundary
# bounded water corridor for the initial vectorized spatial selection
corridor = (
  lin.buffer(14, quad_segs=2)
  .difference(lin.buffer(0.25, quad_segs=2))
  .intersection(model)
)
sample_axes = []
scope_water = lin.buffer(1.5, quad_segs=1)
for i, row in enumerate(axis):
  s = row[3]
  if s.length < 18:
    continue
  clipped = s.difference(scope_water).intersection(model)
  for part in pr.segments(clipped):
    if part.geom_type == "LineString" and part.length > 18:
      sample_axes.append((row, part))
banks = bank + [o[1] for o in sample_axes]
refs += [(r[0], r[1], r[0]) for r, _ in sample_axes]
bname += [(r[2].get("name") or "") for r, _ in sample_axes]
qtree = STRtree(banks)
# Shared shoreline intersection as a prefilter only, then verify short stretches
# actually follow rather than approach/cross the associated channel.
narrow = union_all([r[1] for r in sample_axes]).buffer(8.5, quad_segs=1)
region = corridor.union(narrow.difference(lin.buffer(0.25, quad_segs=1))).intersection(
  model
)


def atoms(poly):
  if poly.is_empty:
    return []
  if hasattr(poly, "geoms"):
    return [v for x in poly.geoms for v in atoms(x)]
  return [poly]


ix = math.floor(region.bounds[0] / 512)
jx = math.floor(region.bounds[1] / 512)
iy = math.floor(region.bounds[2] / 512)
jy = math.floor(region.bounds[3] / 512)
grids = {}
lookup = STRtree(list(atoms(region)))
for x in range(ix, iy + 1):
  for z in range(jx, jy + 1):
    tile = box(x * 512, z * 512, (x + 1) * 512, (z + 1) * 512)
    ids = lookup.query(tile, predicate="intersects")
    if len(ids):
      grids[x, z] = union_all([lookup.geometries[n].intersection(tile) for n in ids])
print("regional cells", len(grids), flush=True)


def nearwater(g):
  minx, minz, maxx, maxz = g.bounds
  return [
    (k, p)
    for x in range(math.floor(minx / 512), math.floor(maxx / 512) + 1)
    for z in range(math.floor(minz / 512), math.floor(maxz / 512) + 1)
    for k in [(x, z)]
    if (p := grids.get(k)) is not None and p.intersects(g)
  ]


def nearest(pt):
  d, k = qtree.query_nearest(pt, all_matches=False, return_distance=True)
  if not len(d):
    return None
  j = int(d[0])
  g = banks[j]
  if g.geom_type != "LineString":
    g = min(
      [q for q in atoms(g) if q.geom_type in ("LinearRing", "LineString")],
      key=lambda q: q.distance(pt),
    )
  return j, g


def aligned(line):
  if line.length < 3:
    return None
  ds = min(2.5, line.length * 0.23)
  pt = line.interpolate(0.5, normalized=True)
  pos = nearest(pt)
  if pos is None:
    return None
  j, b = pos
  u = b.project(pt)
  v1 = np.array(b.interpolate(max(0, u - ds)).coords[0])
  v2 = np.array(b.interpolate(min(b.length, u + ds)).coords[0])
  a = np.array(line.interpolate(max(0, line.length * 0.5 - ds)).coords[0])
  z = np.array(line.interpolate(min(line.length, line.length * 0.5 + ds)).coords[0])
  length = np.linalg.norm(v2 - v1) * np.linalg.norm(z - a)
  if length < 0.1 or abs(float(np.dot(v2 - v1, z - a))) / length < 0.65:
    return None
  if j < len(bank) and true_bank.distance(pt) > 14:
    return None
  if j >= len(bank) and (pt.distance(b) < 1.8 or pt.distance(b) > 8.5):
    return None
  return j


rows = []
wetrefs = {}
names = collections.Counter()


def add(i, v, t, k, pts, j, extra):
  ref = refs[j]
  wetrefs[ref[0]] = [ref[1], ref[2], bname[j]]
  names[bname[j]] += 1
  # store geometry at original decimetric survey precision; hard host cuts
  # occur later and have no effect on the stored provenance.
  rows.append([i, v, k, ref[0], extra, [[round(x, 1), round(z, 1)] for x, z in pts]])


def process_lines(name):
  records = pr.load(name)
  print("read", name, len(records), flush=True)
  for i, v, t, gg in records:
    if name == "paths":
      if (
        t.get("bridge")
        or t.get("tunnel")
        or t.get("covered") == "yes"
        or t.get("access") in ("no", "private")
        or t.get("highway") in ("steps", "track", "bridleway")
      ):
        continue
      if t.get("surface") in ("mud", "sand") and t.get("highway") == "cycleway":
        continue
      kind = "cycle" if t.get("highway") == "cycleway" else "walk"
      extra = {
        k: t[k]
        for k in ("highway", "surface", "width", "foot", "bicycle", "access")
        if k in t
      }
    else:
      bar = t.get("barrier")
      ft = t.get("fence_type", "")
      if (
        bar in ("railing", "handrail")
        or bar == "fence"
        and ft in ("railing", "railings", "metal_railing", "balustrade")
      ):
        kind = "rail"
      elif bar == "guard_rail":
        kind = "guard"
      elif bar == "hedge":
        kind = "hedge"
      else:
        continue
      extra = {
        k: t[k]
        for k in ("barrier", "fence_type", "height", "material", "width")
        if k in t
      }
    line = LineString(pr.xy(gg))
    hits = nearwater(line)
    if not hits:
      continue
    for key, mask in hits:
      pieces = atoms(line.intersection(mask))
      for cut in pieces:
        if cut.geom_type != "LineString" or cut.length < 4.5:
          continue
        # Resolve curving banks and approaches in short consecutive strips.
        segs = max(1, math.ceil(cut.length / 18.0))
        runs = []
        for n in range(segs):
          seg = substring(cut, cut.length * n / segs, cut.length * (n + 1) / segs)
          k = aligned(seg)
          if k is None:
            continue
          if runs and runs[-1][1] == n and runs[-1][2] == k:
            runs[-1][1] = n + 1
          else:
            runs.append([n, n + 1, k])
        for lo, hi, j in runs:
          segment = substring(cut, cut.length * lo / segs, cut.length * hi / segs)
          if segment.length >= 5:
            add(i, v, t, kind, segment.coords, j, extra)
  print("recorded", name, len(rows), flush=True)


process_lines("paths")
process_lines("fences")
for i, v, t, gg in pr.load("shrubs"):
  geo = pr.ppoly(gg)
  for key, mask in nearwater(geo):
    clipped = geo.intersection(mask)
    for p in atoms(clipped):
      if p.geom_type != "Polygon" or p.area < 4:
        continue
      # A coherent mapped shrub patch is represented only within its actual
      # polygon. Grid candidates must be clear of its boundary and remain ashore.
      pts = []
      x0, z0, x1, z1 = p.bounds
      for cx in range(math.floor(x0 / 7), math.floor(x1 / 7) + 1):
        for cz in range(math.floor(z0 / 7), math.floor(z1 / 7) + 1):
          x = (cx + 0.5 + ((cx * 71 + cz * 17) % 21 - 10) / 80) * 7
          z = (cz + 0.5 + ((cx * 79 + cz * 23) % 19 - 9) / 75) * 7
          pt = Point(x, z)
          if p.contains(pt) and p.boundary.distance(pt) > 0.8:
            pts.append((x, z))
      if not pts:
        pt = p.representative_point()
        if p.boundary.distance(pt) > 0.75:
          pts.append(tuple(pt.coords)[0])
      if pts:
        pt = Point(pts[0])
        near = nearest(pt)
        if near:
          add(
            i,
            v,
            t,
            "shrubs",
            pts,
            near[0],
            {"natural": t.get("natural") or t.get("landcover")},
          )
print(
  "source stats",
  collections.Counter(r[2] for r in rows),
  names.most_common(8),
  flush=True,
)
pr.dumpjson(
  pr.GEO / "waterway-bank-survey-v378.json.gz",
  {
    "schema": 378,
    "date": "2026-11-22",
    "pbfSha256": "56551452bd0656d371ac473216324b679879eddf2a40f417ce9330a7f065c00d",
    "license": "© OpenStreetMap contributors, ODbL 1.0",
    "source": "https://download.geofabrik.de/europe/germany/berlin-261122.osm.pbf",
    "bankSources": wetrefs,
    "features": rows,
    "cityAxisSources": len(axis),
    "waterPolygons": len(wet),
    "withinReach": len(grids),
  },
)
