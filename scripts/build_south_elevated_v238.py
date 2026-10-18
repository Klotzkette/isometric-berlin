"""Bounded, source-bound southern elevated U-Bahn; no live geometry creation."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pyogrio
import shapely
from build_district_facades_v188 import digest, read_json, world, write_json
from build_karl_marx_allee_v161 import Detail, packed_detail
from build_roof_house_v233 import fingerprint, line_receipt, match_owner
from build_west_streets_v163 import partition_detail
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import split, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "south-elevated-v238-source.json.gz"
EVIDENCE = GEO / "south-elevated-v238-evidence.json"
ADDITION = GEO / "south-elevated-v238-manifest-addition.json"
REPLACEMENT = ROOT / "src/app/src/data/southElevatedV238Replacement.json"
PRISMS = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
VOXELS = ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
CANDIDATE = GEO / "raw/outer-v159/candidate.gpkg"
GROUND = 5.2
CORE_IDS = ["67972414", "67972418", "67972417"]
OUTER_IDS = ["OSM-way-37739169", "OSM-way-382253030"]
REFERENCES = [
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066412",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031096",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031103",
  "https://www.bvg.de/de/verbindungen/stationsuebersicht/u-buelowstr",
  "https://www.brandwerk.expert/referenzen/projekte/u-bahnstation-gleisdreieck-berlin/",
  "https://www.bbfc-cloud.de/de/public/locations/u-bahnhof-gleisdreieck-kreuzberg",
]
POLICY = "Retained OSM track/roof/platform/stair plans, 1435mm gauge and level ordering. Ground-relative station height: Buelow OSM min_height6; Kottbusser tracks OSM height6; Gleisdreieck10/15m consistent with published project descriptions, not surveyed vertical control. Roof rise, member sections, colours, support spacing and route interpolation are explicit display estimates. Exact old erroneous station envelopes transfer atomically, all other source bytes remain unchanged. No ground coverage or residency change."
STATIONS = [
  dict(
    id="buelow",
    name="Bülowstraße",
    hall="15699875",
    platforms=["391385382", "391385383"],
    height=6.0,
    rise=5.9,
    roofRise=1.7,
    group="companion",
    color=[90, 112, 102],
  ),
  dict(
    id="gleis-lower",
    name="Gleisdreieck U2",
    hall="167972414",
    platforms=["49037738"],
    height=9.08,
    rise=3.8,
    roofRise=0.8,
    group="core",
    color=[110, 128, 125],
  ),
  dict(
    id="gleis-upper",
    name="Gleisdreieck U1/U3",
    hall="167972418",
    platforms=["49037739"],
    height=14.08,
    rise=4.5,
    roofRise=1.1,
    group="core",
    color=[110, 128, 125],
  ),
  dict(
    id="kotti",
    name="Kottbusser Tor U1/U3",
    hall="37739169",
    platforms=["7030144"],
    height=6.0,
    rise=4.5,
    roofRise=0.85,
    group="outer",
    color=[168, 175, 170],
  ),
]


class RailDetail(Detail):
  def __init__(self):
    super().__init__()
    self.solids = []

  def box(self, center, size, color, role):
    super().box(center, size, color, role)
    x, y, z = center
    w, h, d = size
    self.solids.append(
      dict(
        geometry=box(x - w / 2, z - d / 2, x + w / 2, z + d / 2),
        minY=y - h / 2,
        maxY=y + h / 2,
        role=role,
      )
    )


def nav_solids(detail, clip=None, origin=(0, 0)):
  result = []
  for record in detail.solids:
    g = (
      record["geometry"].intersection(clip) if clip is not None else record["geometry"]
    )
    for p in polygons(g):
      if p.area < 0.0001:
        continue

      def ring(r):
        return [[round(x - origin[0], 3), round(z - origin[1], 3)] for x, z in r.coords]

      result.append(
        dict(
          ring=ring(p.exterior),
          holes=[ring(r) for r in p.interiors],
          minY=round(record["minY"], 3),
          maxY=round(record["maxY"], 3),
        )
      )
  return result


def tags(row):
  return dict(
    re.findall(
      r'"([^\"]+)"=>"([^\"]*)"',
      row.other_tags if isinstance(row.other_tags, str) else "",
    )
  )


def extract():
  area = box(-735, 2080, 3270, 2460)
  rows = pyogrio.read_dataframe(
    CANDIDATE, layer="lines", bbox=(13.359, 52.494, 13.425, 52.503)
  ).to_crs(25833)
  tracks = []
  stairs = []
  for row in rows.itertuples():
    t = tags(row)
    g = world(row.geometry)
    if (
      row.railway == "subway"
      and t.get("bridge") in ("yes", "viaduct")
      and not t.get("service")
      and not t.get("abandoned:railway")
    ):
      # Buelow U2 + the continuous U1/U3 crossing to Kotti; no other branches.
      if row.name not in ("U1", "U2") and str(row.osm_id) not in {
        "391385378",
        "391385379",
        "18649922",
        "26547952",
        "391385381",
        "391385380",
      }:
        continue
      family = "U1" if row.name == "U1" else "U2"
      clip = area if family == "U2" else box(-130, 2080, 3270, 2460)
      clipped = g.intersection(clip)
      if clipped.is_empty:
        continue
      tracks.append(
        dict(
          id=str(row.osm_id),
          family=family,
          tags=t,
          sourceGeometry=mapping(g),
          geometry=mapping(clipped),
        )
      )
    if row.highway == "steps" and t.get("level") and g.intersects(area):
      try:
        levels = [float(x) for x in t["level"].split(";")]
      except ValueError:
        continue
      if min(levels) < 0 or max(levels) > 2:
        continue
      for station, region in [
        ("buelow", box(-680, 2320, -520, 2405)),
        ("gleis", box(90, 2080, 195, 2220)),
        ("kotti", box(3045, 2260, 3220, 2310)),
      ]:
        if region.covers(g):
          stairs.append(
            dict(
              id=str(row.osm_id),
              station=station,
              tags=t,
              levels=levels,
              geometry=mapping(g),
            )
          )
  needed = (
    {s["hall"] for s in STATIONS}
    | {p for s in STATIONS for p in s["platforms"]}
    | {"382253030", "167972417"}
  )
  poly = pyogrio.read_dataframe(
    CANDIDATE, layer="multipolygons", bbox=(13.359, 52.494, 13.425, 52.503)
  ).to_crs(25833)
  features = {}
  for r in poly.itertuples():
    identity = str(r.osm_way_id if isinstance(r.osm_way_id, str) else r.osm_id)
    if identity in needed:
      features[identity] = dict(
        id=identity,
        tags=tags(r),
        building=r.building if isinstance(r.building, str) else None,
        geometry=mapping(world(r.geometry)),
      )
  assert set(features) == needed, needed - set(features)
  previous = [p for p in read_json(PRISMS)["buildings"] if p["id"] in CORE_IDS]
  assert len(previous) == 3
  write_json(
    SOURCE,
    dict(
      schema=1,
      policy=POLICY,
      source="Retained OpenStreetMap candidate.gpkg, EPSG:25833 converted to established world frame",
      references=REFERENCES,
      inputs={str(p.relative_to(ROOT)): digest(p) for p in [PRISMS, VOXELS, CANDIDATE]},
      tracks=tracks,
      stairs=stairs,
      features=features,
      previousPrisms=previous,
    ),
  )


def polygons(g):
  if g.geom_type == "Polygon":
    return [g]
  return [p for sub in getattr(g, "geoms", []) for p in polygons(sub)]


def lines(g):
  if g.geom_type == "LineString":
    return [g]
  return [p for sub in getattr(g, "geoms", []) for p in lines(sub)]


def slab(d, g, low, high, color, role, native, step=0.5):
  """Exact drawn plan; native contained orthogonal row runs, no diagonal caps."""
  for p in polygons(g):
    if (
      not native
      and hasattr(d, "solids")
      and not role.startswith("complete former bridge")
    ):
      samples = list(p.exterior.coords) + [p.representative_point().coords[0]]
      lo = min(low(x, z) for x, z in samples) if callable(low) else low
      hi = max(high(x, z) for x, z in samples) if callable(high) else high
      d.solids.append(dict(geometry=p, minY=lo, maxY=hi, role=role))
    if native:
      x0, z0, x1, z1 = p.bounds
      xs = np.arange(math.floor(x0 / step) * step + step / 2, x1, step)
      for z in np.arange(math.floor(z0 / step) * step + step / 2, z1, step):
        occupied = shapely.contains_xy(p, xs, np.full(len(xs), z))
        edges = np.flatnonzero(np.diff(np.r_[False, occupied, False]))
        for a, b in zip(edges[::2], edges[1::2]):
          x = (xs[a] + xs[b - 1]) / 2
          lo = low(x, z) if callable(low) else low
          hi = high(x, z) if callable(high) else high
          d.box(
            [x, (lo + hi) / 2, z],
            [xs[b - 1] - xs[a] + step, max(0.035, hi - lo), step],
            color,
            role,
          )
    else:
      for t in shapely.constrained_delaunay_triangles(p).geoms:
        q = list(t.exterior.coords)[:-1]
        d.polygon(
          [[x, high(x, z) if callable(high) else high, z] for x, z in reversed(q)],
          color,
          role,
        )
        d.polygon(
          [[x, low(x, z) if callable(low) else low, z] for x, z in q], color, role
        )
      for r in [p.exterior, *p.interiors]:
        for (x, z), (xx, zz) in zip(r.coords, list(r.coords)[1:]):
          lo = low(x, z) if callable(low) else low
          hi = high(x, z) if callable(high) else high
          ll = low(xx, zz) if callable(low) else low
          hh = high(xx, zz) if callable(high) else high
          d.polygon([[x, lo, z], [x, hi, z], [xx, hh, zz], [xx, ll, zz]], color, role)


def beam(d, a, b, width, depth, color, role, native, step=1.0):
  a = np.array(a, float)
  b = np.array(b, float)
  delta = b - a
  run = np.linalg.norm(delta[[0, 2]])
  if run < 0.01:
    return
  if (
    not native
    and hasattr(d, "solids")
    and ("elevated tray" in role or "mapped stairs" in role)
  ):
    d.solids.append(
      dict(
        geometry=LineString([a[[0, 2]], b[[0, 2]]]).buffer(width / 2, cap_style=2),
        minY=min(a[1], b[1]) - depth / 2,
        maxY=max(a[1], b[1]) + depth / 2,
        role=role,
      )
    )
  if native:
    n = max(1, math.ceil(run / step))
    for i in range(n):
      p = a + delta * (i + 0.5) / n
      d.box(
        p.tolist(),
        [
          abs(delta[0]) / n + width,
          abs(delta[1]) / n + depth,
          abs(delta[2]) / n + width,
        ],
        color,
        role,
      )
  else:
    normal = np.array([-delta[2], 0, delta[0]]) / run * width / 2
    up = np.array([0, depth / 2, 0])
    v = [
      a - normal - up,
      a + normal - up,
      a + normal + up,
      a - normal + up,
      b - normal - up,
      b + normal - up,
      b + normal + up,
      b - normal + up,
    ]
    for face in [
      (0, 3, 2, 1),
      (4, 5, 6, 7),
      (0, 4, 7, 3),
      (1, 2, 6, 5),
      (3, 7, 6, 2),
      (0, 1, 5, 4),
    ]:
      d.polygon([v[i].tolist() for i in face], color, role)


def route_height(family, x, z):
  if family == "U1":
    return GROUND + 14.08 - min(8.08, max(0, x - 225) * 8.08 / 1100)
  return GROUND + 6 + 3.08 * min(1, max(0, (x + 500) / 560))


def hall_axis(poly):
  coords = np.array(poly.minimum_rotated_rectangle.exterior.coords[:-1])
  edges = np.roll(coords, -1, axis=0) - coords
  u = max(edges, key=np.linalg.norm)
  u = u / np.linalg.norm(u)
  if u[0] < -0.01 or abs(u[0]) < 0.01 and u[1] < 0:
    u = -u
  v = np.array([-u[1], u[0]])
  c = np.array(poly.centroid.coords[0])
  points = np.array(poly.exterior.coords)
  return (
    c,
    u,
    v,
    ((points - c) @ u).min(),
    ((points - c) @ u).max(),
    max(abs((points - c) @ v)),
  )


def stair_level_height(station, level):
  # Source levels terminate at the walking surface, 0.92m above rail/deck level.
  if station == "gleis":
    return GROUND + (level * 10 if level <= 1 else 10 + (level - 1) * 5)
  return GROUND + level * 6.92


def station(d, source, s, native):
  hall = shape(source["features"][s["hall"]]["geometry"])
  hall = unary_union(polygons(hall))
  if hall.geom_type != "Polygon":
    hall = max(polygons(hall), key=lambda p: p.area)
  c, u, v, a, b, half = hall_axis(hall)
  floor = GROUND + s["height"]
  eave = floor + s["rise"]
  color = tuple(s["color"])
  role = s["id"]
  station_key = "gleis" if role.startswith("gleis") else role
  destination_level = 2 if role == "gleis-upper" else 1
  openings = unary_union(
    [
      shape(row["geometry"]).buffer(
        float(row["tags"].get("width", "1.9")) / 2 + 0.08, cap_style=2
      )
      for row in source["stairs"]
      if row["station"] == station_key and max(row["levels"]) == destination_level
    ]
  )
  # Original plan, open above-ground undercroft. Platforms stay separate from tracks.
  for pid in s["platforms"]:
    g = shape(source["features"][pid]["geometry"]).difference(openings)
    slab(
      d,
      g,
      floor - 0.2,
      floor + 0.92,
      (182, 179, 164),
      role + " mapped platform " + pid,
      native,
    )
    for p in polygons(g):
      for aa, bb in zip(p.exterior.coords, list(p.exterior.coords)[1:]):
        beam(
          d,
          [aa[0], floor + 0.94, aa[1]],
          [bb[0], floor + 0.94, bb[1]],
          0.12,
          0.035,
          (229, 219, 158),
          role + " platform edge",
          native,
        )
  # No lower roof through the upper platform crossing.
  roofplan = hall
  if s["id"] == "gleis-lower":
    roofplan = hall.difference(
      shape(source["features"]["167972418"]["geometry"]).buffer(0.12)
    )

  def roofhigh(x, z):
    return eave + s["roofRise"] * max(
      0, 1 - abs(np.dot(np.array([x, z]) - c, v)) / half
    )

  ridge_axis = LineString([c + u * (a - 5), c + u * (b + 5)])
  for roofpart in split(roofplan, ridge_axis).geoms:
    slab(
      d,
      roofpart,
      lambda x, z: roofhigh(x, z) - 0.16,
      roofhigh,
      (89, 103, 99),
      role + " pitched roof",
      native,
      0.5,
    )
  # Longitudinal glazed skylight on the actual roof envelope.
  ridge = (
    LineString([c + u * (a + 1), c + u * (b - 1)])
    .buffer(0.75, cap_style=2)
    .intersection(roofplan)
  )
  slab(
    d,
    ridge,
    lambda x, z: roofhigh(x, z) + 0.02,
    lambda x, z: roofhigh(x, z) + 0.10,
    (154, 179, 174),
    role + " roof light",
    native,
    0.5,
  )
  # Thin enclosure: low metal parapet and upper glass ribbon, real plan unchanged.
  for p in polygons(hall):
    for aa, bb in zip(p.exterior.coords, list(p.exterior.coords)[1:]):
      aa = np.array(aa)
      bb = np.array(bb)
      delta = bb - aa
      length = np.linalg.norm(delta)
      if length < 1:
        continue
      # End faces are open across the running rails.
      if abs(np.dot(delta / length, u)) < 0.6:
        continue
      beam(
        d,
        [aa[0], floor + 1.3, aa[1]],
        [bb[0], floor + 1.3, bb[1]],
        0.15,
        0.7,
        color,
        role + " steel parapet",
        native,
      )
      beam(
        d,
        [aa[0], floor + 2.45, aa[1]],
        [bb[0], floor + 2.45, bb[1]],
        0.09,
        1.5,
        (139, 169, 167),
        role + " upper glass band",
        native,
      )
      for t in np.arange(0, length, 2.5):
        at = aa + delta * min(1, t / length)
        d.box(
          [at[0], floor + 2.4, at[1]],
          [0.13, 3.0, 0.13],
          color,
          role + " glazing mullion",
        )
  # Riveted portal frames, source-plan station axis and documented Kotti7.5m rhythm.
  spacing = 7.5 if s["id"] == "kotti" else 7.0
  for at in np.arange(a + 1, b - 0.2, spacing):
    cross = LineString(
      [c + u * at - v * (half + 2), c + u * at + v * (half + 2)]
    ).intersection(hall)
    for crossline in lines(cross):
      aa = np.array(crossline.coords[0])
      bb = np.array(crossline.coords[-1])
      mid = (aa + bb) / 2
      for p in (aa, bb):
        d.box(
          [p[0], (floor + 0.9 + eave) / 2, p[1]],
          [0.26, eave - floor - 0.9, 0.26],
          color,
          role + " frame upright",
        )
      beam(
        d,
        [aa[0], eave - 0.2, aa[1]],
        [mid[0], roofhigh(*mid) - 0.2, mid[1]],
        0.22,
        0.25,
        color,
        role + " pitched frame",
        native,
        0.5,
      )
      beam(
        d,
        [mid[0], roofhigh(*mid) - 0.2, mid[1]],
        [bb[0], eave - 0.2, bb[1]],
        0.22,
        0.25,
        color,
        role + " pitched frame",
        native,
        0.5,
      )
  # Sparse undercroft portal supports; Kotti large open spans stay readable.
  positions = (
    [a + 2, (a + b) / 2, b - 2]
    if s["id"] == "kotti"
    else list(np.arange(a + 4, b - 2, 20))
  )
  for at in positions:
    ends = [c + u * at + v * sign * (half - 0.8) for sign in [-1, 1]]
    for p in ends:
      if s["id"] == "gleis-upper" and shape(
        source["features"]["167972414"]["geometry"]
      ).buffer(3).contains(Point(*p)):
        continue
      d.box(
        [p[0], GROUND + (s["height"] - 0.55) / 2, p[1]],
        [0.55, s["height"] - 0.55, 0.55],
        color,
        role + " open undercroft support",
      )
    beam(
      d,
      [ends[0][0], floor - 0.55, ends[0][1]],
      [ends[1][0], floor - 0.55, ends[1][1]],
      0.5,
      0.65,
      color,
      role + " undercroft crossbeam",
      native,
      0.6,
    )
  if s["id"] == "buelow":
    for at in [a + 1, b - 1]:
      for side in [-1, 1]:
        p = c + u * at + v * side * (half - 0.6)
        d.box(
          [p[0], floor + 2.7, p[1]],
          [0.8, 5.4, 0.8],
          (202, 187, 157),
          "buelow sandstone pylon",
        )
        d.box(
          [p[0], eave + 0.7, p[1]],
          [1.05, 0.35, 1.05],
          (215, 201, 174),
          "buelow pylon capital",
        )
  return dict(
    id=s["id"],
    hall=s["hall"],
    floorY=floor,
    roofTopY=eave + s["roofRise"],
    axis=u.tolist(),
    center=c.tolist(),
    sourcePlanArea=hall.area,
    underpass=True,
  )


def models(source):
  out = {
    g: {m: RailDetail() for m in ["drawn", "minecraft"]}
    for g in ["companion", "core", "outer"]
  }
  records = []
  features = source["features"]
  station_plans = unary_union(
    [shape(features[s["hall"]]["geometry"]) for s in STATIONS]
  )
  bridge = Polygon(
    np.array(next(p for p in source["previousPrisms"] if p["id"] == "67972417")["ring"])
    / 10
  )
  track_shapes = [(r["family"], shape(r["geometry"])) for r in source["tracks"]]

  def nearest_height(x, z):
    family, line = min(track_shapes, key=lambda r: r[1].distance(Point(x, z)))
    return route_height(family, x, z)

  for native, mode in [(False, "drawn"), (True, "minecraft")]:
    for s in STATIONS:
      rec = station(out[s["group"]][mode], source, s, native)
      if not native:
        records.append(rec)
    # Complete immutable bridge footprint remains as an elevated thin deck, not a
    # solid ground-level obstacle. Both mapped rail levels guide its varying top.
    slab(
      out["core"][mode],
      bridge,
      lambda x, z: nearest_height(x, z) - 0.65,
      lambda x, z: nearest_height(x, z) - 0.05,
      (132, 142, 132),
      "complete former bridge owner167972417",
      native,
      1,
    )
    for row in source["tracks"]:
      for line in lines(shape(row["geometry"])):
        family = row["family"]
        role = "OSM track " + row["id"]
        d = out["companion"][mode]
        # The 2-track route has a separate narrow structural tray per centreline.
        for part in lines(line):
          coords = list(part.coords)
          for a, b in zip(coords, coords[1:]):
            a = np.array(a)
            b = np.array(b)
            delta = b - a
            length = np.linalg.norm(delta)
            if length < 0.01:
              continue
            n = np.array([-delta[1], delta[0]]) / length
            ya = route_height(family, *a)
            yb = route_height(family, *b)
            beam(
              d,
              [a[0], ya - 0.45, a[1]],
              [b[0], yb - 0.45, b[1]],
              3.05,
              0.55,
              (129, 138, 128),
              role + " elevated tray",
              native,
              1.25,
            )
            for off in [-0.7175, 0.7175]:
              aa = a + n * off
              bb = b + n * off
              beam(
                d,
                [aa[0], ya + 0.12, aa[1]],
                [bb[0], yb + 0.12, bb[1]],
                0.09,
                0.13,
                (92, 101, 97),
                role + " 1435mm running rail",
                native,
                0.75,
              )
            for off in [-1.48, 1.48]:
              aa = a + n * off
              bb = b + n * off
              beam(
                d,
                [aa[0], ya + 0.15, aa[1]],
                [bb[0], yb + 0.15, bb[1]],
                0.13,
                0.65,
                (93, 113, 102),
                role + " steel edge girder",
                native,
                1.25,
              )
        # Portal supports and cross bearers at restrained intervals, omitted beneath
        # station footprints where independently composed hall supports take over.
        for distance in np.arange(12, line.length - 3, 25):
          p = line.interpolate(float(distance))
          x, z = p.x, p.y
          if station_plans.buffer(3).contains(p):
            continue
          h = route_height(family, x, z) - GROUND - 0.7
          d.box(
            [x, GROUND + h / 2, z],
            [0.38, h, 0.38],
            (91, 111, 102),
            role + " open steel pier",
          )
          tangent = np.array(
            line.interpolate(min(line.length, distance + 0.5)).coords[0]
          ) - np.array(line.interpolate(max(0, distance - 0.5)).coords[0])
          tangent /= np.linalg.norm(tangent)
          n = np.array([-tangent[1], tangent[0]])
          beam(
            d,
            [x - n[0] * 1.5, GROUND + h, z - n[1] * 1.5],
            [x + n[0] * 1.5, GROUND + h, z + n[1] * 1.5],
            0.22,
            0.4,
            (91, 111, 102),
            role + " pier crosshead",
            native,
            0.5,
          )
    # Source-mapped stair runs only, never invented pavement connections.
    for row in source["stairs"]:
      line = shape(row["geometry"])
      lev = sorted(row["levels"])
      low, high = [stair_level_height(row["station"], v) for v in [lev[0], lev[-1]]]
      if high <= low:
        continue
      if row["tags"].get("incline") == "down":
        low, high = high, low
      count = int(row["tags"].get("step_count", max(4, round(abs(high - low) / 0.18))))
      width = float(row["tags"].get("width", "1.9"))
      d = out[
        "core"
        if row["station"] == "gleis"
        else "outer"
        if row["station"] == "kotti"
        else "companion"
      ][mode]
      for i in range(count):
        a = line.interpolate(line.length * i / count)
        b = line.interpolate(line.length * (i + 1) / count)
        y = low + (high - low) * (i + 0.5) / count
        beam(
          d,
          [a.x, y, a.y],
          [b.x, y, b.y],
          width,
          0.15,
          (177, 174, 160),
          "mapped stairs " + row["id"],
          native,
          0.25,
        )
    # Retained eastern Kotti access has min_level1; replace its false ground box
    # by the actual mapped elevated access roof and narrow glazing/columns.
    g = shape(features["382253030"]["geometry"])
    floor = GROUND + 6
    slab(
      out["outer"][mode],
      g,
      floor + 2.6,
      floor + 2.85,
      (148, 158, 149),
      "Kotti east elevated access roof",
      native,
    )
    for p in polygons(g):
      for x, z in list(p.exterior.coords)[:-1]:
        out["outer"][mode].box(
          [x, floor + 1.3, z],
          [0.18, 2.6, 0.18],
          (151, 164, 158),
          "Kotti east access post",
        )
  return out, records


def mesh_stats(mesh):
  vertices = len(base64.b64decode(mesh["positions"])) // 6
  indices = len(base64.b64decode(mesh["indices"])) // 4
  return dict(
    vertices=vertices,
    indices=indices,
    geometryBytes=vertices * 12 + indices * (2 if vertices <= 65535 else 4),
  )


def packet_for(identity, detail, tile, kind):
  mesh = packed_detail(detail, tile)
  assert mesh
  mesh["kind"] = kind
  packet = dict(
    schemaVersion=1,
    id=identity,
    origin=[tile.bounds[0], -10, tile.bounds[1]],
    meshes=[mesh],
    nav=dict(groundY=GROUND, ground=[], water=[], buildings=[]),
  )
  stats = mesh_stats(mesh)
  assert stats["vertices"] < 400000 and stats["indices"] < 2400000
  return packet, stats


def core_columns(source):
  v = read_json(VOXELS)
  shapes = [(p, Polygon(np.array(p["ring"]) / 10)) for p in source["previousPrisms"]]
  columns = []
  for row_index, row in enumerate(v["building_rows"]):
    z = (row_index + v["grid"]["min_z_idx"]) * 4 + 2
    if not 1960 < z < 2280:
      continue
    for span in row:
      start, length, low, high, kind = span
      for i in range(length):
        x = (start + i + v["grid"]["min_x_idx"]) * 4 + 2
        hits = [
          p["id"]
          for p, g in shapes
          if g.covers(Point(x, z))
          and low == p["y0_dm"]
          and high == p["y0_dm"] + p["h_dm"]
        ]
        if hits:
          columns.append(dict(x=x, z=z, low=low, high=high, kind=kind, prismIds=hits))
  return columns


def build():
  source = read_json(SOURCE)
  for p, h in source["inputs"].items():
    assert digest(ROOT / p) == h, p
  details, stations = models(source)
  descriptors = []
  receipts = {}
  totals = Counter()
  parts = {m: partition_detail(d) for m, d in details["companion"].items()}
  for ix, iz in sorted(set(parts["drawn"]) | set(parts["minecraft"])):
    tile = box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
    identity = f"southrail238-{ix}_{iz}"
    desc = dict(id=identity, bounds=list(tile.bounds))
    for mode in ["drawn", "minecraft"]:
      packet, stats = packet_for(
        identity, parts[mode][(ix, iz)], tile, "south-elevated-v238"
      )
      solids = nav_solids(details["companion"]["drawn"], tile, (ix * 512, iz * 512))
      packet["nav"]["buildings"] = [
        dict(
          ring=s["ring"],
          holes=s["holes"],
          minHeight=s["minY"] - GROUND,
          height=s["maxY"] - GROUND,
          sourceId=f"southrail238-navigation-{ix}_{iz}-{i}",
        )
        for i, s in enumerate(solids)
      ]
      raw = (json.dumps(packet, separators=(",", ":")) + "\n").encode()
      data = gzip.compress(raw, mtime=0)
      name = f"{identity}.{mode}.json.gz"
      assert len(raw) < 12 * 1024 * 1024
      (OUT / name).write_bytes(data)
      desc[mode] = dict(
        url=name,
        encoding="gzip",
        bytes=len(data),
        decodedBytes=len(raw),
        sha256=hashlib.sha256(data).hexdigest(),
      )
      receipts[f"{mode}:{identity}"] = stats
      totals[mode + "GeometryBytes"] += stats["geometryBytes"]
    descriptors.append(desc)
  runtime = dict(
    schema=1,
    sourceSha256=digest(SOURCE),
    packets={},
    core=dict(
      prismIds=CORE_IDS,
      previousPrisms=source["previousPrisms"],
      navigationSolids=nav_solids(details["core"]["drawn"]),
      previousColumns=core_columns(source),
    ),
  )
  for mode in ["drawn", "minecraft"]:
    packet, stats = packet_for(
      "southrail238-core",
      details["core"][mode],
      box(0, 1850, 512, 2362),
      "elevated-station-v238",
    )
    runtime["core"][mode] = packet
    receipts[mode + ":coreReplacement"] = stats
    totals[mode + "GeometryBytes"] += stats["geometryBytes"]
  manifest = read_json(OUT / "manifest.json")
  by_id = {d["id"]: d for d in manifest["chunks"]}
  # Kotti main hall, annex and stair recipe stay in the same existing packet as
  # their exact ownership transfer. The replacement includes the full roof plan.
  for mode in ["drawn", "minecraft"]:
    old = read_json(OUT / by_id["6_4"][mode]["url"])
    owners = []
    transfers = defaultdict(list)
    for owner in OUTER_IDS:
      original = next(b for b in old["nav"]["buildings"] if b["sourceId"] == owner)
      owners.append(
        dict(
          owner=owner,
          original=original,
          origin=old["origin"],
          groundY=old["nav"]["groundY"],
        )
      )
      matched = match_owner(old, owner)
      assert matched is not None, owner
      for mi, tris in matched.items():
        transfers[mi].extend(tris)
    records = []
    for mi, tris in transfers.items():
      mesh = old["meshes"][mi]
      records.append(
        dict(
          mesh=mi,
          fingerprint=fingerprint(
            [mesh[k] for k in ["positions", "colors", "indices"]]
          ),
          triangles=sorted(tris),
        )
      )
    segments = line_receipt(old, owners) if mode == "drawn" else []
    # Coordinates before6_4's west edge occur only in the unmodified west access
    # staircase. Keep that bounded source detail in a separate companion packet.
    tile = box(3072, 2048, 3584, 2560)
    partition = partition_detail(details["outer"][mode])
    replacement = packed_detail(partition[(6, 4)], tile)
    replacement["kind"] = "elevated-station-v238"
    runtime["packets"][mode + ":6_4"] = dict(
      origin=old["origin"],
      records=records,
      lineFingerprint=fingerprint(
        [old["lines"]["positions"], old["lines"].get("colors", "")]
      )
      if segments
      else None,
      segments=segments,
      replacement=replacement,
      navigationRecords=[
        {k: o[k] for k in ["owner", "original", "groundY"]} for o in owners
      ],
      navigationSolids=nav_solids(details["outer"]["drawn"], tile, (3072, 2048)),
    )
    stats = mesh_stats(replacement)
    receipts[mode + ":outerReplacement"] = stats
    totals[mode + "GeometryBytes"] += stats["geometryBytes"]
    # No extra packet is needed: mapped west access already has a preserved body;
    # source stairs west of3072 remain in that body and are not fabricated outside.
  runtime["keys"] = list(runtime["packets"])
  write_json(REPLACEMENT, runtime)
  write_json(ADDITION, dict(chunks=descriptors))
  write_json(
    EVIDENCE,
    dict(
      policy=POLICY,
      sourceSha256=digest(SOURCE),
      replacementSha256=digest(REPLACEMENT),
      unchangedInputs=source["inputs"],
      references=REFERENCES,
      stations=stations,
      trackIds=[r["id"] for r in source["tracks"]],
      stairs=[r["id"] for r in source["stairs"]],
      packets=receipts,
      counts=dict(totals),
      coreColumns=len(runtime["core"]["previousColumns"]),
      retiredCoreIds=CORE_IDS,
      retiredOuterOwners=OUTER_IDS,
      routeHeightStatus="station-relative estimates, continuous interpolation; not a surveyed alignment",
    ),
  )
  print(
    len(descriptors),
    "companion packets;",
    len(source["tracks"]),
    "track ways;",
    dict(totals),
    flush=True,
  )


if __name__ == "__main__":
  import argparse

  p = argparse.ArgumentParser()
  p.add_argument("--refresh-source", action="store_true")
  a = p.parse_args()
  if a.refresh_source:
    extract()
  build()
