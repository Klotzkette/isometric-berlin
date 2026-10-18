"""Bounded U2 ramp and atomic Eberswalder station correction, Step 10.

Complete retained OSM courses are immutable. Elevations and steel fittings are
qualified estimates fitted to mapped levels and retained official DGM samples.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import re
from collections import Counter

import numpy as np
import pyogrio
import shapely
from pyproj import Transformer
from shapely.geometry import LineString, Point, box, mapping, shape
from shapely.ops import transform, unary_union

from scripts import build_district_facades_v188 as base
from scripts.build_karl_marx_allee_v161 import Detail, clip_polygon, packed_detail
from scripts.build_roof_house_v233 import fingerprint, line_receipt, match_owner
from scripts.build_west_streets_v163 import partition_detail

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
SOURCE = GEO / "north-elevated-v238-source.json.gz"
EVIDENCE = GEO / "north-elevated-v238-evidence.json"
ADDITION = GEO / "north-elevated-v238-manifest-addition.json"
RUNTIME = ROOT / "src/app/src/data/northElevatedV238Replacement.json"
OWNER = "OSM-way-499263882"
TILE = box(2560, -2560, 3072, -2048)
RAIL_IDS = [
  388432539,
  388432543,
  438860773,
  438860774,
  380981358,
  380981360,
  380981362,
  380981363,
  375386236,
  24180220,
]
STAIR_IDS = [380981364, 380981366, 380981367, 380981369, 380981371, 380981372]
PRIMARY = [
  {
    "url": "https://lorenz-co.de/mehr/Mehr6.pdf",
    "supports": "Fischer/Lorenz, Stahlbau80 (2011), pp419–427, fig16/17 on p426: Eberswalder curved solid-web frames, central gabled glazed rooflight and glazed entrance. Fig14: sandstone bearing pier. Inspected 2026-10-18; photographs not copied into product.",
  },
  {
    "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050083",
    "supports": "Listed steel viaduct, Grenander/Bousset, 1911–1913 and 1930 phases.",
  },
  {
    "url": "https://fischer-co.berlin/bahnhof-eberswalder-strasse-berlin/",
    "supports": "Restoration engineer: approximately 92m × 12.5m steel-frame hall on sandstone piers.",
  },
  {
    "url": "https://www.bvg.de/dam/jcr:f3ba5662-bf34-4120-899d-35af09d0d310/eberswalder-str%20900110006.pdf",
    "supports": "BVG station plan, 2025-10-03: Eberswalder U2, entrances A/B and tram interchange.",
  },
  {
    "url": "https://denk-mal-an-berlin.de/Projekte/Das-Besondere-Denkmal/Hochbahnviadukt-der-U-2",
    "supports": "Open historic steel viaduct; retained bearing bodies and curved deck plates.",
  },
]
POLICY = (
  "Actual retained OSM two-track ramp, viaduct, station roof, platform and stair courses. "
  "DGM street samples retained in NHN; existing city is flattened at Y=3 here. "
  "Rail clearance 0.15m at tunnel portal, 1.5m at mapped bridge start and 5.7m at station "
  "is a display estimate, not surveyed railway height. Between anchors the estimated "
  "absolute rail grade is linear, then adapted to sampled street datum. No new terrain "
  "or source coverage. Roof rise, muted steel/glass tones, frame/pier spacing, ballast "
  "and platform height are recognition estimates. Only the exact erroneous ground-level "
  "3m building=roof prism is retired atomically with full station replacement. "
  "Original packet and all OSM courses remain immutable. Native geometry is separately "
  "compiled as orthogonal steps; mobile drawn is full detail. No texture or resident root."
)
STEEL = (73, 105, 90)
DARK = (57, 72, 66)
RAIL = (165, 171, 166)
STONE = (193, 180, 150)
GLASS = (129, 158, 159)
ROOF = (151, 155, 141)
PAVING = (194, 194, 180)


def tags(row):
  result = dict(re.findall(r'"([^"]+)"=>"([^"]*)"', str(row.get("other_tags", ""))))
  for k in ("name", "highway", "railway", "building"):
    if isinstance(row.get(k), str):
      result[k] = row[k]
  return result


def extract():
  """Read small indexed local caches; never scan the full PBF or fetch a new map."""
  path = GEO / "raw/outer-v159/candidate.gpkg"
  tr = Transformer.from_crs(4326, 25833, always_xy=True)
  rows = []
  for layer, field, ids in [
    ("lines", "osm_id", RAIL_IDS + STAIR_IDS),
    ("multipolygons", "osm_way_id", [380981354, 499263882]),
  ]:
    frame = pyogrio.read_dataframe(
      path,
      layer=layer,
      where=field + " IN (" + ",".join("'" + str(i) + "'" for i in ids) + ")",
    )
    for _, row in frame.iterrows():
      g = base.world(transform(tr.transform, row.geometry))
      if g.geom_type == "MultiPolygon" and len(g.geoms) == 1:
        g = g.geoms[0]
      rows.append(
        dict(
          id="way/" + str(row[field]),
          tags=tags(row),
          geometry=mapping(g),
          originalWgs84=mapping(row.geometry),
        )
      )
  assert len(rows) == len(RAIL_IDS) + len(STAIR_IDS) + 2
  # Nearby public carriageways constrain supports; no column across a crossing.
  roads = pyogrio.read_dataframe(
    path, layer="lines", bbox=(13.4117, 52.5379, 13.4128, 52.5433)
  )
  crossing = []
  for _, row in roads.iterrows():
    if row.get("highway") not in ("primary", "secondary", "tertiary", "residential"):
      continue
    if row.get("name") == "Schönhauser Allee":
      continue
    g = base.world(transform(tr.transform, row.geometry))
    if g.intersects(box(2805, -2650, 2840, -2070)):
      crossing.append(
        dict(id="way/" + str(row.osm_id), tags=tags(row), geometry=mapping(g))
      )
  samples_path = GEO / "weinberg-v176/dgm-samples.json"
  dgm = base.read_json(samples_path)
  grid = dgm["grid"]

  def sample(x, z):
    u = (x - grid["minX"]) / grid["stepM"]
    v = (z - grid["minZ"]) / grid["stepM"]
    i = min(grid["width"] - 2, max(0, math.floor(u)))
    j = min(grid["height"] - 2, max(0, math.floor(v)))
    a, b = u - i, v - j
    h = dgm["heightsNHN"]
    return (h[j][i] * (1 - a) + h[j][i + 1] * a) * (1 - b) + (
      h[j + 1][i] * (1 - a) + h[j + 1][i + 1] * a
    ) * b

  terrain = []
  for z in [-2074.04, -2164.3, -2255, -2344, -2410, -2480, -2550, -2600]:
    x = 2813 + (max(0, -z - 2344) * 0.045)
    west, east = sample(x - 14, z), sample(x + 14, z)
    terrain.append(
      dict(world=[x, z], westNHN=west, eastNHN=east, streetNHN=(west + east) / 2)
    )
  old = {}
  for family in ("drawn", "minecraft"):
    p = OUT / f"5_-5.{family}.json.gz"
    packet = base.read_json(p)
    owners = [r for r in packet["nav"]["buildings"] if r["sourceId"] == OWNER]
    assert owners
    old[family] = dict(
      path=str(p.relative_to(ROOT)),
      sha256=base.digest(p),
      origin=packet["origin"],
      groundY=packet["nav"]["groundY"],
      owners=owners,
    )
  result = dict(
    schemaVersion=1,
    policy=POLICY,
    features=rows,
    crossingRoads=crossing,
    primarySources=PRIMARY,
    sourceCache=str(path.relative_to(ROOT)),
    sourceCacheSha256=base.digest(path),
    originalPackets=old,
    terrainSamples=terrain,
    dgm=dict(
      path=str(samples_path.relative_to(ROOT)),
      sha256=base.digest(samples_path),
      sourceFiles=dgm["sourceFiles"],
      verticalDatum=dgm["verticalDatum"],
    ),
    renderBounds=[2803, -2640, 2845, -2073.98],
    sourceCoordinatesUncut=True,
  )
  base.write_json(SOURCE, result)
  return result


def each_polygon(g):
  return (
    [g]
    if g.geom_type == "Polygon"
    else [p for p in getattr(g, "geoms", []) if p.geom_type == "Polygon"]
  )


def beam(detail, a, b, width, depth, color, role, native):
  """A rectangular member, or independently stepped axis-parallel native members."""
  a = np.asarray(a, float)
  b = np.asarray(b, float)
  delta = b - a
  length = float(np.linalg.norm(delta))
  if length < 0.015:
    return
  if native:
    n = max(1, math.ceil(max(abs(delta[0]), abs(delta[2])) / 1.2))
    for i in range(n):
      p = a + delta * (i + 0.5) / n
      detail.box(
        p.tolist(),
        [
          max(width, abs(delta[0]) / n + 0.015),
          max(depth, abs(delta[1]) / n + depth),
          max(width, abs(delta[2]) / n + 0.015),
        ],
        color,
        role,
      )
    return
  horizontal = np.array([-delta[2], 0, delta[0]])
  if np.linalg.norm(horizontal) < 1e-8:
    horizontal = np.array([1.0, 0, 0])
  horizontal = horizontal / np.linalg.norm(horizontal) * width / 2
  up = np.cross(delta / length, horizontal / (width / 2)) * depth / 2
  vertices = [
    p + s * horizontal + t * up
    for p in (a, b)
    for s, t in ((-1, -1), (1, -1), (1, 1), (-1, 1))
  ]
  for face in (
    (0, 3, 2, 1),
    (4, 5, 6, 7),
    (0, 1, 5, 4),
    (1, 2, 6, 5),
    (2, 3, 7, 6),
    (3, 0, 4, 7),
  ):
    detail.polygon([vertices[i].tolist() for i in face], color, role)


def skin(detail, poly, height, thickness, color, role, native, cell=0.75):
  """Source-clipped drawn surface; independent native centre-selected small cells."""
  if poly.is_empty:
    return
  minx, minz, maxx, maxz = poly.bounds
  if native:
    for z in np.arange(math.floor(minz / cell) * cell, maxz, cell):
      for x in np.arange(math.floor(minx / cell) * cell, maxx, cell):
        if poly.covers(Point(x + cell / 2, z + cell / 2)):
          y = height(x + cell / 2, z + cell / 2)
          detail.box(
            [x + cell / 2, y - thickness / 2, z + cell / 2],
            [cell, thickness, cell],
            color(x + cell / 2, z + cell / 2) if callable(color) else color,
            role,
          )
    return
  # Clipped cells preserve the actual outline while sampling roof curvature.
  for z in np.arange(math.floor(minz / 4) * 4, maxz, 4):
    for x in np.arange(math.floor(minx / 1.2) * 1.2, maxx, 1.2):
      for p in each_polygon(poly.intersection(box(x, z, x + 1.2, z + 4))):
        for tri in shapely.constrained_delaunay_triangles(p).geoms:
          points = list(tri.exterior.coords)[:3]
          top = [[a, height(a, b), b] for a, b in points]
          tone = color(tri.centroid.x, tri.centroid.y) if callable(color) else color
          detail.polygon(top, tone, role)
          detail.polygon(
            [[a, y - thickness, b] for a, y, b in reversed(top)], tone, role
          )
  for ring in [poly.exterior, *poly.interiors]:
    for a, b in zip(ring.coords, list(ring.coords)[1:]):
      detail.polygon(
        [
          [a[0], height(*a), a[1]],
          [b[0], height(*b), b[1]],
          [b[0], height(*b) - thickness, b[1]],
          [a[0], height(*a) - thickness, a[1]],
        ],
        color((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) if callable(color) else color,
        role,
      )


def build_geometry(source, native):
  fs = {int(r["id"].split("/")[1]): r for r in source["features"]}

  def geometry(i):
    return shape(fs[i]["geometry"])

  rail = Detail()
  station = Detail()
  solids = []
  data = sorted(source["terrainSamples"], key=lambda r: r["world"][1])
  zz = [r["world"][1] for r in data]
  hh = [r["streetNHN"] for r in data]

  def street(z):
    return float(np.interp(z, zz, hh))

  anchors = [(-2410, 5.7), (-2164.3, 1.5), (-2074.04, 0.15)]
  grade = [street(z) + c for z, c in anchors]

  def rail_y(z):
    if z <= -2410:
      return 8.7
    return 3 + float(np.interp(z, [a[0] for a in anchors], grade)) - street(z)

  cross = unary_union(
    [shape(r["geometry"]).buffer(4.5) for r in source["crossingRoads"]]
  )
  station_zone = box(2795, -2569.65, 2850, -2410.93)
  track_lines = []
  for i in RAIL_IDS[2:]:
    line = geometry(i).intersection(box(2800, -2640, 2850, -2073.97))
    if line.is_empty:
      continue
    track_lines.append(line)
    n = max(1, math.ceil(line.length / 2.5))
    for k in range(n):
      a = line.interpolate(k / n, normalized=True)
      b = line.interpolate((k + 1) / n, normalized=True)
      delta = np.array([b.x - a.x, b.y - a.y])
      normal = np.array([-delta[1], delta[0]]) / np.linalg.norm(delta)
      mid = line.interpolate((k + 0.5) / n, normalized=True)
      dest = station if station_zone.covers(mid) else rail
      ya, yb = rail_y(a.y), rail_y(b.y)
      # Two exact centreline offsets give 1435mm track gauge.
      beam(
        dest,
        [a.x, ya - 0.35, a.y],
        [b.x, yb - 0.35, b.y],
        2.6,
        0.42,
        (111, 112, 103),
        "track deck",
        native,
      )
      for offset in (-0.7175, 0.7175):
        p = np.array([a.x, a.y]) + normal * offset
        q = np.array([b.x, b.y]) + normal * offset
        beam(
          dest,
          [p[0], ya, p[1]],
          [q[0], yb, q[1]],
          0.075,
          0.13,
          RAIL,
          "1435mm rail",
          native,
        )
      for offset in (-1.35, 1.35):
        p = np.array([a.x, a.y]) + normal * offset
        q = np.array([b.x, b.y]) + normal * offset
        beam(
          dest,
          [p[0], ya - 0.50, p[1]],
          [q[0], yb - 0.50, q[1]],
          0.15,
          0.75,
          STEEL,
          "longitudinal steel girder",
          native,
        )
    for t in np.arange(0.6, line.length, 1.15):
      p = line.interpolate(t)
      q = line.interpolate(min(line.length, t + 0.2))
      d = np.array([q.x - p.x, q.y - p.y])
      d = d / max(0.0001, np.linalg.norm(d))
      normal = np.array([-d[1], d[0]])
      dest = station if station_zone.covers(p) else rail
      a = np.array([p.x, p.y]) - normal * 1.08
      b = np.array([p.x, p.y]) + normal * 1.08
      beam(
        dest,
        [a[0], rail_y(p.y) - 0.1, a[1]],
        [b[0], rail_y(p.y) - 0.1, b[1]],
        0.16,
        0.13,
        (109, 96, 78),
        "track sleepers",
        native,
      )
  union = unary_union(track_lines)
  # Shared transverse steel bents, selected outside mapped road crossings.
  supports = []
  for z in np.arange(-2633, -2140, 12):
    if -2575 < z < -2410:
      continue
    cut = union.intersection(LineString([(2795, z), (2850, z)]))
    points = [g for g in getattr(cut, "geoms", [cut]) if g.geom_type == "Point"]
    if len(points) < 2:
      continue
    left = min(p.x for p in points) - 1.15
    right = max(p.x for p in points) + 1.15
    y = rail_y(z) - 0.85
    if y < 4.2 or cross.intersects(LineString([(left, z), (right, z)])):
      continue
    supports.append([left, right, float(z), y])
    beam(
      rail,
      [left, y, z],
      [right, y, z],
      0.35,
      0.48,
      STEEL,
      "transverse cross girder",
      native,
    )
    for x in (left, right):
      rail.box([x, (y + 3) / 2, z], [0.32, y - 3, 0.42], STEEL, "open viaduct pier")
      rail.box([x, 3.13, z], [0.62, 0.26, 0.72], STONE, "pier footing")
      inward = 1 if x == left else -1
      beam(
        rail,
        [x, y - 1.0, z],
        [x + inward * 0.75, y, z],
        0.18,
        0.18,
        STEEL,
        "pier knee brace",
        native,
      )
  platform = geometry(380981354)
  roof = geometry(499263882)
  platform_y = 9.55
  # Actual stair openings, rather than a slab closing the top of each stair.
  openings = unary_union(
    [geometry(i).buffer(0.8, cap_style=2) for i in (380981366, 380981367)]
  )
  platform_visible = platform.difference(openings)
  for p in each_polygon(platform_visible):
    skin(station, p, lambda x, z: platform_y, 0.43, PAVING, "mapped platform", native)
    clipped = p.intersection(TILE)
    for part in each_polygon(clipped):
      solids.append(
        dict(
          ring=[[x - 2560, z + 2560] for x, z in part.exterior.coords],
          holes=[
            [[x - 2560, z + 2560] for x, z in ring.coords] for ring in part.interiors
          ],
          minY=platform_y - 0.43,
          maxY=platform_y,
        )
      )

  # Primary restoration photograph fig16: curved full-web frames underneath
  # shallow side roofs and a central gabled, glazed rooflight (not a barrel cap).
  def roof_ratio(x, z):
    cut = roof.intersection(LineString([(2790, z), (2860, z)]))
    if cut.is_empty:
      return 1.0
    lo, _, hi, _ = cut.bounds
    return abs(2 * (x - lo) / max(0.1, hi - lo) - 1)

  def roof_y(x, z):
    ratio = roof_ratio(x, z)
    if z < -2523:
      return 13.25 + 0.42 * max(0, 1 - ratio)
    if ratio >= 0.38:
      return 13.25 + 2.0 * (1 - ratio)
    return 14.49 + 1.1 * (1 - ratio / 0.38)

  def roof_tone(x, z):
    return GLASS if z > -2523 and roof_ratio(x, z) < 0.38 else ROOF

  skin(station, roof, roof_y, 0.22, roof_tone, "source-bound hall roof", native)
  # Thin roof solids follow the same sampled curved/rooflight profile. They
  # never turn the hall or the undercroft into a ground-filled collision box.
  cell = 0.75 if native else 2.4
  minx, minz, maxx, maxz = roof.bounds
  for z in np.arange(math.floor(minz / cell) * cell, maxz, cell):
    for x in np.arange(math.floor(minx / cell) * cell, maxx, cell):
      cell_poly = box(x, z, x + cell, z + cell)
      if native:
        if not roof.covers(Point(x + cell / 2, z + cell / 2)):
          continue
        pieces = [cell_poly]
        levels = [roof_y(x + cell / 2, z + cell / 2)]
      else:
        pieces = each_polygon(roof.intersection(cell_poly))
        levels = [roof_y(a, b) for p in pieces for a, b in p.exterior.coords]
      if not levels:
        continue
      for p in pieces:
        solids.append(
          dict(
            ring=[[a - 2560, b + 2560] for a, b in p.exterior.coords],
            holes=[],
            minY=min(levels) - 0.22,
            maxY=max(levels),
          )
        )

  # Source silhouette determines frame widths and the narrower north canopy.
  for z in np.arange(-2555, -2430, 7.5):
    cut = roof.intersection(LineString([(2790, z), (2860, z)]))
    if cut.is_empty:
      continue
    lo, _, hi, _ = cut.bounds
    for x in (lo + 0.15, hi - 0.15):
      station.box(
        [x, (platform_y + 13.25) / 2, z],
        [0.17, 13.25 - platform_y, 0.2],
        STEEL,
        "hall steel mullion",
      )
      if z > -2523:
        station.box([x, 5.50, z], [0.62, 5.0, 0.78], STONE, "sandstone hall pier")
        solids.append(
          dict(
            ring=[
              [x - 0.31 - 2560, z - 0.39 + 2560],
              [x + 0.31 - 2560, z - 0.39 + 2560],
              [x + 0.31 - 2560, z + 0.39 + 2560],
              [x - 0.31 - 2560, z + 0.39 + 2560],
            ],
            holes=[],
            minY=3,
            maxY=8.0,
          )
        )
    for a, b in zip(np.linspace(lo, hi, 9), np.linspace(lo, hi, 9)[1:]):
      beam(
        station,
        [a, 12.9 + 1.6 * (1 - roof_ratio(a, z) ** 2), z],
        [b, 12.9 + 1.6 * (1 - roof_ratio(b, z) ** 2), z],
        0.16,
        0.18,
        STEEL,
        "arched hall frame",
        native,
      )
    beam(
      station, [lo, 12.5, z], [hi, 12.5, z], 0.10, 0.10, STEEL, "hall tie bar", native
    )
    if z > -2523:
      beam(
        station,
        [lo, 8.15, z],
        [hi, 8.15, z],
        0.4,
        0.55,
        STEEL,
        "station cross bearing",
        native,
      )
      for offset in (-0.19, 0.19):
        x = (lo + hi) / 2 + offset * (hi - lo)
        beam(
          station,
          [x, 14.35, z],
          [x, 14.35, z + 6.7],
          0.1,
          0.12,
          STEEL,
          "rooflight edge frame",
          native,
        )

  # Glazing above the tracks only: nothing closes the street underneath.
  for ring in [roof.exterior]:
    for a, b in zip(ring.coords, list(ring.coords)[1:]):
      length = math.dist(a, b)
      if length < 20 or (a[1] + b[1]) / 2 < -2523:
        continue
      n = math.ceil(length / 2.8)
      for k in range(n):
        p = np.array(a) + (np.array(b) - a) * (k + 0.05) / n
        q = np.array(a) + (np.array(b) - a) * (k + 0.95) / n
        beam(
          station,
          [p[0], 11.4, p[1]],
          [q[0], 11.4, q[1]],
          0.06,
          1.8,
          GLASS,
          "hall glazing",
          native,
        )
      for y in (10.45, 12.35):
        beam(
          station,
          [a[0], y, a[1]],
          [b[0], y, b[1]],
          0.1,
          0.12,
          STEEL,
          "hall glazing transom",
          native,
        )
  # Actual mapped flights, including separate north split approach.
  for i in STAIR_IDS:
    line = geometry(i)
    coords = list(line.coords)
    up = fs[i]["tags"].get("incline") != "down"
    if not up:
      coords.reverse()
      line = LineString(coords)
    upper = i in (380981366, 380981367)
    low, high = (5.8, platform_y) if upper else (3, 5.8)
    n = int(fs[i]["tags"].get("step_count", 18))
    for k in range(n):
      p = line.interpolate(k / n, normalized=True)
      q = line.interpolate((k + 1) / n, normalized=True)
      y = low + (high - low) * (k + 1) / n
      beam(
        station,
        [p.x, y - 0.09, p.y],
        [q.x, y - 0.09, q.y],
        1.45,
        0.18,
        STONE,
        "mapped staircase " + str(i),
        native,
      )
      minx, minz, maxx, maxz = (
        LineString([(p.x, p.y), (q.x, q.y)]).buffer(0.72, cap_style=2).bounds
      )
      solids.append(
        dict(
          ring=[
            [minx - 2560, minz + 2560],
            [maxx - 2560, minz + 2560],
            [maxx - 2560, maxz + 2560],
            [minx - 2560, maxz + 2560],
          ],
          holes=[],
          minY=y - 0.18,
          maxY=y,
        )
      )
    for side in (-0.78, 0.78):
      a, b = coords[0], coords[-1]
      beam(
        station,
        [a[0] + side, low + 1, a[1]],
        [b[0] + side, high + 1, b[1]],
        0.055,
        0.055,
        STEEL,
        "stair handrail",
        native,
      )
  # Unobtrusive blue U signs at both source approaches, geometric lettering.
  for x, z in [(2816.7, -2419.3), (2823.5, -2534.0)]:
    station.box([x, 5.8, z], [1.3, 1.25, 0.12], (35, 91, 143), "U entrance sign")
    for dx in (-0.33, 0.33):
      station.box(
        [x + dx, 5.91, z - 0.07], [0.13, 0.62, 0.025], (240, 240, 228), "U sign stroke"
      )
    station.box(
      [x, 5.60, z - 0.07], [0.78, 0.13, 0.025], (240, 240, 228), "U sign stroke"
    )
  # The source platform extends 9.64m beyond the old tile. Its full northern
  # continuation belongs to the ordinary companion; it retires no old object.
  for triangle, color, role in station.triangles:
    clipped = clip_polygon(triangle, 2, -2560, False)
    if len(clipped) >= 3 and min(p[2] for p in clipped) < -2560 - 0.00001:
      rail.polygon(clipped, color, role)
  return (
    station,
    rail,
    solids,
    dict(
      supports=supports,
      estimatedRailAnchors=anchors,
      roofBounds=list(roof.bounds),
      platformBounds=list(platform.bounds),
      roofArea=roof.area,
      platformArea=platform.area,
      stationRoles=dict(Counter(r for _, _, r in station.triangles)),
    ),
  )


def mesh_metrics(mesh):
  v = len(base64.b64decode(mesh["positions"])) // 6
  i = len(base64.b64decode(mesh["indices"])) // 4
  return dict(
    vertices=v, indices=i, geometryBytes=v * 12 + i * (2 if v <= 65535 else 4)
  )


def build():
  source = base.read_json(SOURCE)
  runtime = {}
  parts = {}
  metrics = {}
  audit = {}
  for family in ("drawn", "minecraft"):
    station, rail, solids, details = build_geometry(source, family == "minecraft")
    old = source["originalPackets"][family]
    path = ROOT / old["path"]
    assert base.digest(path) == old["sha256"]
    packet = base.read_json(path)
    matches = match_owner(packet, OWNER)
    assert matches, "Exact original roof owner could not be reconstructed"
    rows = [
      dict(owner=OWNER, original=o, groundY=old["groundY"], origin=old["origin"])
      for o in old["owners"]
    ]
    segments = line_receipt(packet, rows) if family == "drawn" else []
    replacement = packed_detail(station, TILE)
    replacement["kind"] = "elevated-station-v238"
    records = [
      dict(
        mesh=i,
        fingerprint=fingerprint(
          [packet["meshes"][i][k] for k in ("positions", "colors", "indices")]
        ),
        triangles=triangles,
      )
      for i, triangles in matches.items()
    ]
    runtime[family + ":5_-5"] = dict(
      origin=packet["origin"],
      records=records,
      lineFingerprint=fingerprint(
        [packet["lines"]["positions"], packet["lines"].get("colors", "")]
      )
      if segments
      else None,
      segments=segments,
      replacement=replacement,
      navigationRecords=[
        {k: r[k] for k in ("owner", "original", "groundY")} for r in rows
      ],
      navigationSolids=solids,
    )
    parts[family] = partition_detail(rail)
    metrics[family + ":station"] = mesh_metrics(replacement)
    metrics[family + ":station"]["removedTriangles"] = sum(
      len(v) for v in matches.values()
    )
    metrics[family + ":station"]["removedLines"] = len(segments)
    audit[family] = details
  descriptors = []
  for ix, iz in sorted(set(parts["drawn"]) | set(parts["minecraft"])):
    identity = f"northrail238-{ix}_{iz}"
    tile = box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
    d = dict(id=identity, bounds=list(tile.bounds))
    for family in ("drawn", "minecraft"):
      mesh = packed_detail(parts[family][(ix, iz)], tile)
      assert mesh
      mesh["kind"] = "north-elevated-v238"
      # Only the real north platform tip needs walking collision in a companion.
      # All ramp/viaduct companion navigation remains empty beneath the deck.
      platform = shape(
        next(f["geometry"] for f in source["features"] if f["id"] == "way/380981354")
      )
      nav_buildings = []
      if iz == -6:
        for p in each_polygon(platform.intersection(tile)):
          nav_buildings.append(
            dict(
              ring=[[x - ix * 512, z - iz * 512] for x, z in p.exterior.coords],
              holes=[],
              height=6.55,
              minHeight=6.12,
              sourceId="OSM-way-380981354-north-platform-v238",
            )
          )
      payload = dict(
        schemaVersion=1,
        id=identity,
        origin=[ix * 512, -10, iz * 512],
        meshes=[mesh],
        nav=dict(
          groundY=3, ground=[], water=[], roads=[], bridges=[], buildings=nav_buildings
        ),
      )
      raw = (json.dumps(payload, separators=(",", ":")) + "\n").encode()
      packed = gzip.compress(raw, mtime=0)
      name = f"{identity}.{family}.json.gz"
      (OUT / name).write_bytes(packed)
      d[family] = dict(
        url=name,
        encoding="gzip",
        bytes=len(packed),
        decodedBytes=len(raw),
        sha256=hashlib.sha256(packed).hexdigest(),
      )
      m = mesh_metrics(mesh)
      assert (
        m["vertices"] < 400000 and m["indices"] < 2400000 and len(raw) < 12 * 1024**2
      )
      metrics[family + ":" + identity] = m
    descriptors.append(d)
  base.write_json(RUNTIME, dict(schema=1, keys=sorted(runtime), packets=runtime))
  evidence = dict(
    schemaVersion=1,
    policy=POLICY,
    sourceSha256=base.digest(SOURCE),
    runtimeSha256=base.digest(RUNTIME),
    packets=metrics,
    audit=audit,
    originalPackets=source["originalPackets"],
    cameras=[
      dict(
        name="Eberswalder steel hall", eye=[2860, 20, -2390], target=[2818, 10, -2470]
      ),
      dict(
        name="Tunnel emergence south of Eberswalder",
        eye=[2848, 10, -2120],
        target=[2814, 5, -2200],
      ),
    ],
  )
  base.write_json(EVIDENCE, evidence)
  base.write_json(
    ADDITION,
    dict(
      schemaVersion=1,
      chunks=descriptors,
      footprint=[],
      source=dict(
        source=str(SOURCE.relative_to(ROOT)),
        sourceSha256=base.digest(SOURCE),
        evidence=str(EVIDENCE.relative_to(ROOT)),
        additiveOnly=True,
        exactStationProxyCorrection=True,
      ),
    ),
  )
  print(
    json.dumps(
      dict(
        chunks=len(descriptors), metrics=metrics, runtimeBytes=RUNTIME.stat().st_size
      ),
      indent=2,
    )
  )
  return evidence


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--extract", action="store_true")
  if parser.parse_args().extract:
    extract()
  build()
