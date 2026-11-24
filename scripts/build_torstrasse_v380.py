"""Bake the surveyed Torstraße and above-ground tram approaches at Rosenthaler Platz.

Regenerate offline with Python 3, numpy and Shapely >=2.1. Input coordinates are
centimetre-rounded ETRS89 / UTM 33N, referred to the viewer's Berlin origin.
"""

import argparse
import base64
import gzip
import json
import math
from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path

import numpy as np
import shapely as s
from shapely.affinity import affine_transform
from shapely.geometry import LineString, MultiLineString, Point, Polygon, box, shape
from shapely.ops import substring

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
MESH = ROOT / "src/app/public/mesh"
ARCHIVE = ROOT / "geo_data/regierungsviertel/torstrasse-v380-survey.json.gz"
WFS = "https://gdi.berlin.de/services/wfs/strassenbefahrung"
ORTHO = (
  "https://gdi.berlin.de/services/wms/truedop_2026?SERVICE=WMS&VERSION=1.3.0"
  "&REQUEST=GetMap&LAYERS=truedop_2026&STYLES=&CRS=EPSG:25833"
  "&BBOX=391485,5821085,391680,5821220&WIDTH=1000&HEIGHT=692&FORMAT=image/jpeg"
)
# Material codes from the survey data dictionary. The last six entries
# are display finishes for actual transport infrastructure, measured in plan.
FINISHES = [
  "asphalt",
  "concrete",
  "mosaic",
  "smallSett",
  "largeSett",
  "pavers",
  "concreteSlab",
  "naturalSlab",
  "graniteSlab",
  "earth",
  "grass",
  "aggregate",
  "cycle",
  "trackbed",
  "platform",
  "tactile",
  "island",
  "kerb",
  "lowKerb",
  "marking",
  "groove",
  "steel",
]
MATERIALS = dict(
  zip(
    "01 02 03 04 05 06 07 08 09 10 11 12 13 14 15".split(),
    "concrete asphalt mosaic smallSett largeSett pavers concreteSlab naturalSlab graniteSlab concreteSlab asphalt asphalt aggregate earth grass".split(),
  )
)
SURVEY = (
  "cl_gehweg cm_fahrbahn bd_bordstein bw_aufmerksamkeitsfeld bn_baumscheibe ch_radweg "
  "cf_trennstreifen by_gehwegueberfahrt ck_parkflaeche ce_gruenflaeche "
  "be_fahrbahnmarkierunglinie bz_gleiskoerper_strab cb_haltestellenwartebereich at_mast_lsa"
).split()
ATTRS = ["material", "bor", "fbl", "art", "fab", "hmas", "druecker", "mas"]
COMPACT = dict(separators=(",", ":"), ensure_ascii=False)


def encode(value):
  return gzip.compress(json.dumps(value, **COMPACT).encode(), mtime=0)


def components(g, typ):
  if g.geom_type == typ:
    if not g.is_empty:
      yield g
  elif hasattr(g, "geoms"):
    for part in g.geoms:
      yield from components(part, typ)


def capture(folder):
  axes = json.loads((folder / "axes.json").read_bytes())
  centre = MultiLineString([p for _, t, p in axes if t["highway"] == "secondary"])
  scope = s.union_all(
    [centre.buffer(31, quad_segs=8), Point(2055, -1163).buffer(70, quad_segs=16)]
  )
  scope = s.set_precision(scope, 0.01)
  evidence = {
    "datum": "EPSG:25833, world x=E-389500, z=5820000-N",
    "survey": "Straßenbefahrung Berlin 2014/15",
    "wfs": WFS,
    "aerial": ORTHO,
    "osm": "https://download.geofabrik.de/europe/germany/berlin-261122.osm.pbf",
    "scope": scope.wkb_hex,
    "axes": [[i, p] for i, t, p in axes if t["highway"] == "secondary"],
    "queries": {},
    "surveyFeatures": [],
    "osmFeatures": [],
  }
  for layer in SURVEY:
    payload = json.load(gzip.open(folder / (layer + ".json.gz")))
    evidence["queries"][layer] = payload["urls"]
    for f in payload["rows"]:
      g = affine_transform(shape(f["geometry"]), [1, 0, 0, -1, -389500, 5820000])
      if not g.intersects(scope):
        continue
      g = s.intersection(s.make_valid(g), scope, grid_size=0.01)
      if not g.is_empty:
        attrs = {k: f["properties"][k] for k in ATTRS if k in f["properties"]}
        evidence["surveyFeatures"].append([f["id"], attrs, g.wkb_hex])
  for i, t, p in json.load(gzip.open(folder / "osm.json.gz")):
    if (
      not i.startswith("w")
      or t.get("tunnel") == "yes"
      or t.get("layer", "0").startswith("-")
    ):
      continue
    marked_crossing = t.get("footway") == "crossing" and len(p) > 1
    if t.get("railway") == "tram" or marked_crossing:
      g = LineString(p)
    elif (
      len(p) > 3
      and p[0] == p[-1]
      and (
        t.get("area:highway")
        or t.get("railway") == "platform"
        or t.get("shelter_type") == "public_transport"
      )
    ):
      g = s.make_valid(Polygon(p))
    else:
      continue
    if g.intersects(scope):
      # Keep whole rail ways for offsetting (avoid false end caps at a clip).
      tags = {
        k: t[k]
        for k in (
          "area:highway",
          "railway",
          "gauge",
          "surface",
          "shelter_type",
          "name",
          "bench",
          "footway",
          "crossing",
          "crossing:markings",
        )
        if k in t
      }
      evidence["osmFeatures"].append([i, tags, g.wkb_hex])
  for k in ("surveyFeatures", "osmFeatures", "axes"):
    evidence[k].sort(key=lambda r: r[0])
  ARCHIVE.write_bytes(encode(evidence))


def openings(approach=False):
  mouths = []
  for stair in json.loads((DATA / "rosenthalerV228.json").read_bytes())["stairs"]:
    a, b = np.array(stair["top"]), np.array(stair["bottom"])
    dx, dz = (b - a) / np.linalg.norm(b - a)
    n = np.array([-dz, dx]) * stair["width"] / 2
    # A one-metre connector spans the cadastral access-structure void at
    # the already modelled top landing. Never cap a run below its entrance.
    if approach:
      b = a - np.array([dx, dz])
    mouths.append(Polygon([a - n, b - n, b + n, a + n]))
  return s.union_all(mouths)


def dashed(line, stripe, gap):
  intervals = np.arange(0, line.length, stripe + gap)
  return [
    substring(line, float(a), min(float(a + stripe), line.length)) for a in intervals
  ]


def ground_layers(evidence):
  scope = s.from_wkb(evidence["scope"])
  groups = defaultdict(list)
  shelters = []
  crossings = []
  poles = []
  mark = []
  kerbs = []
  rails = []
  tracks = []
  surfaces = evidence["surveyFeatures"]
  osm = evidence["osmFeatures"]
  # Current islands/platforms own their new alignments over the older survey.
  for fid, t, wkb in osm:
    g = s.from_wkb(wkb)
    if t.get("railway") == "tram":
      gauge = float(t["gauge"]) / 1000
      assert 1.4 < gauge < 1.5, (fid, t)
      tracks.append(g)
      for offset in [-gauge / 2, gauge / 2]:
        rails.append(g.offset_curve(offset, quad_segs=3, join_style="round"))
    elif t.get("footway") == "crossing":
      crossings.append((g, t))
      if (
        g.distance(Point(2054, -1160)) >= 64
        or t.get("crossing") != "traffic_signals"
        or t.get("crossing:markings") == "no"
      ):
        continue
      for side in (-1.9, 1.9):
        for stroke in dashed(g.offset_curve(side), 0.53, 0.48):
          mark.append(stroke.buffer(0.12, cap_style="flat"))
    elif t.get("railway") == "platform":
      groups[(0, "platform", 0.30)].append(g.intersection(scope))
    elif t.get("shelter_type") == "public_transport" and scope.covers(g):
      shelters.append((fid, g))
    elif t.get("area:highway") == "traffic_island":
      groups[(1, "largeSett" if t.get("surface") == "sett" else "island", 0.27)].append(
        g.intersection(scope)
      )
    elif (
      t.get("area:highway") in ("footway", "pedestrian")
      and t.get("surface") == "asphalt"
    ):
      groups[(1, "asphalt", 0.25)].append(g.intersection(scope))
  rail_zone = s.union_all(tracks).buffer(2.5)
  for fid, attrs, wkb in surfaces:
    layer = fid.split(".")[0]
    g = s.from_wkb(wkb)
    mat = MATERIALS.get(attrs.get("material"), "concrete")
    if layer == "at_mast_lsa":
      if g.geom_type == "Point":
        poles.append((fid, attrs, g))
      continue
    if layer == "bd_bordstein":
      kerbs.append((attrs["bor"], g))
      continue
    if layer == "be_fahrbahnmarkierunglinie":
      # FBL=8 joins both solid and broken cycle markings in one code;
      # retain only the unambiguous types.
      code = int(attrs["fbl"])
      patterns = {
        1: (3, 6),
        4: (0.5, 0.5),
        5: (0.5, 0.5),
        6: (1.5, 1.5),
        7: (1.5, 1.5),
        10: (3, 3),
      }
      if code in (2, 3) or code in patterns:
        width = {3: 0.49, 4: 0.49, 5: 0.24, 10: 0.24}.get(code, 0.13)
        for part in components(g, "LineString"):
          strips = dashed(part, *patterns[code]) if code in patterns else [part]
          mark.extend(
            a.buffer(width / 2, cap_style="flat", join_style="mitre") for a in strips
          )
      continue
    if layer == "bz_gleiskoerper_strab":
      g = g.intersection(rail_zone)
    key = {
      "bw_aufmerksamkeitsfeld": (1, "tactile", 0.315),
      "bn_baumscheibe": (2, "earth", 0.235),
      "cb_haltestellenwartebereich": (3, "platform", 0.27),
      "ch_radweg": (4, "cycle" if mat not in ("asphalt", "earth") else mat, 0.244),
      "ce_gruenflaeche": (4, "grass", 0.23),
      "cf_trennstreifen": (5, mat, 0.252),
      "by_gehwegueberfahrt": (6, mat, 0.245),
      "cl_gehweg": (7, mat, 0.25),
      "ck_parkflaeche": (8, mat, 0.20),
      "bz_gleiskoerper_strab": (
        9,
        "trackbed" if attrs.get("art") == "2" else "asphalt",
        0.207,
      ),
      "cm_fahrbahn": (10, mat, 0.20),
    }[layer]
    groups[key].append(g)
  groups[(11, "concreteSlab", 0.25)].append(openings(approach=True))
  mouths = openings()
  blocked = s.union_all(
    [
      box(x / 4, z / 4, (x + 1) / 4, (z + 1) / 4)
      for mouth in components(mouths, "Polygon")
      for x in range(math.floor(mouth.bounds[0] * 4), math.ceil(mouth.bounds[2] * 4))
      for z in range(math.floor(mouth.bounds[1] * 4), math.ceil(mouth.bounds[3] * 4))
      if mouth.intersection(box(x / 4, z / 4, (x + 1) / 4, (z + 1) / 4)).area > 1e-9
    ]
  ).buffer(0.015)
  # Resolve shared edges before meshing. Roads and sidewalks have single
  # material owners; the U8 opening runs through every new ground treatment.
  visible = {}
  claimed = blocked
  for (_, kind, lift), items in sorted(groups.items()):
    geom = s.difference(
      s.union_all([p for g in items for p in components(g, "Polygon")], grid_size=0.01),
      claimed,
      grid_size=0.01,
    )
    area = s.union_all(list(components(geom, "Polygon")), grid_size=0.01)
    if not area.is_empty:
      visible[kind, lift] = s.union_all(
        [area, visible.get((kind, lift), Polygon())], grid_size=0.01
      )
      claimed = s.union_all([claimed, area], grid_size=0.01)
  # WFS intentionally leaves the carriageway empty at pedestrian crossings.
  # Only restore those gaps where a current mapped crossing meets asphalt on
  # both sides. Existing islands, sidewalk material and stair cutouts win.
  remaining = scope.difference(claimed, grid_size=0.01)
  road_parts = s.union_all(
    [a for (_, height), a in visible.items() if height in (0.2, 0.207)]
  )
  close_to_road = road_parts.buffer(5)
  voids = list(components(remaining, "Polygon"))
  tree = s.STRtree(voids)
  asphalt = []
  for axis, tags in crossings:
    if tags.get("surface") not in ("asphalt", "paving_stones") or not axis.intersects(
      close_to_road
    ):
      continue
    for j in tree.query(axis, predicate="intersects"):
      gap = voids[j]
      overlap = axis.intersection(gap).length
      if overlap < 0.9:
        continue
      # Bounded faces inherit exact measured ends; a void open to surrounding
      # land is completed only immediately around the crossing's own axis.
      if (
        3 < gap.area < 220
        and gap.distance(scope.boundary) > 0.03
        and gap.minimum_rotated_rectangle.area < gap.area * 2
      ):
        asphalt.append(gap.intersection(close_to_road))
      else:
        asphalt.append(
          gap.intersection(axis.buffer(3.5, cap_style="flat")).intersection(
            close_to_road
          )
        )
  fill = s.union_all(
    [p for g in asphalt for p in components(g, "Polygon")], grid_size=0.01
  )
  visible["asphalt", 0.2] = s.union_all([visible["asphalt", 0.2], fill], grid_size=0.01)
  footprint = s.union_all([claimed.difference(blocked), fill])
  for code, kind, lift in [
    (1, "kerb", 0.289),
    (2, "lowKerb", 0.267),
    (3, "lowKerb", 0.256),
  ]:
    parts = [
      g.buffer(0.085, quad_segs=2, cap_style="flat", join_style="round")
      for b, g in kerbs
      if b == code
    ]
    visible[kind, lift] = s.intersection(
      s.union_all(parts, grid_size=0.01), footprint, grid_size=0.01
    )
  road = s.union_all(
    [area for (kind, h), area in visible.items() if h in (0.20, 0.207)]
  )

  # The centre was the pilot district and has no linear paint layer at the
  # square. Traces below are the visible lane guides in the 2026 orthophoto,
  # in pixels of a 900 px crop (135,110)-(1140,1050) of the same 1950 px WMS
  # request. Unknown or shadow-obscured markings are omitted.
  def world(point):
    u, v = point
    return (1985 + (135 + u * 1005 / 900) * 0.1, -1220 + (110 + v * 1005 / 900) * 0.1)

  guides = [
    [(387, 446), (421, 434), (455, 421), (489, 410)],
    [
      (389, 370),
      (415, 403),
      (446, 433),
      (479, 460),
      (515, 484),
      (553, 504),
      (596, 523),
    ],
    [
      (430, 367),
      (459, 399),
      (491, 426),
      (526, 451),
      (564, 471),
      (609, 486),
      (649, 497),
    ],
    [
      (489, 278),
      (515, 303),
      (542, 332),
      (565, 364),
      (589, 405),
      (611, 451),
      (632, 501),
      (650, 552),
    ],
    [
      (505, 271),
      (533, 296),
      (559, 325),
      (584, 360),
      (607, 398),
      (629, 445),
      (650, 496),
      (668, 546),
    ],
    [(444, 576), (482, 572), (530, 568), (581, 561), (619, 555)],
  ]
  for trace in guides:
    for stroke in dashed(LineString([world(p) for p in trace]), 0.78, 0.87):
      mark.append(stroke.buffer(0.105, cap_style="flat"))
  # South approach: the hatched exclusion area and its leading painted nose.
  hatch = Polygon([world(p) for p in [(590, 694), (637, 687), (663, 834), (638, 838)]])
  mark.append(hatch.boundary.buffer(0.075))
  for k in range(-2, 15):
    a = world((570, 697 + 13 * k))
    b = world((691, 600 + 13 * k))
    mark.append(LineString([a, b]).buffer(0.135, cap_style="flat").intersection(hatch))
  visible["marking", 0.235] = s.union_all(mark, grid_size=0.01).intersection(road)
  lines = s.union_all(rails)
  for kind, width, lift in [("groove", 0.203, 0.25), ("steel", 0.073, 0.275)]:
    visible[kind, lift] = (
      lines.buffer(width / 2, cap_style="flat", quad_segs=2)
      .intersection(scope)
      .difference(blocked)
    )
  return (
    scope,
    {k: s.union_all(list(components(g, "Polygon"))) for k, g in visible.items()},
    shelters,
    poles,
  )


def core_domain(scope):
  ground = json.loads((MESH / "regierungsviertel/ground-context.json").read_bytes())
  grid = ground["grid"]
  x0 = grid["min_x_idx"] * 4
  z0 = grid["min_z_idx"] * 4
  rows = []
  for j, row in enumerate(ground["ground_rows"]):
    z = z0 + j * 4
    if scope.bounds[1] - 4 <= z <= scope.bounds[3]:
      for i, n, _ in row:
        if x0 + (i + n) * 4 >= scope.bounds[0] and x0 + i * 4 <= scope.bounds[2]:
          rows.append(box(x0 + i * 4, z, x0 + (i + n) * 4, z + 4))
  return s.union_all(rows).intersection(scope)


class Terrain:
  def __init__(self, scope):
    self.core = core_domain(scope)
    self.p = json.loads((DATA / "weinbergTerrainV176.json").read_bytes())
    self.w, self.n, self.e, self.s = self.p["support"]
    field = box(self.w, self.n, self.e, self.s)
    # Only this local survey field has variable terrain. Split its surfaces
    # on the very same four-metre cells used by the native ground renderer.
    x0, z0, x1, z1 = field.intersection(scope).bounds
    self.cells = [
      box(x, z, x + 4, z + 4).intersection(field)
      for x in range(math.floor(x0 / 4) * 4, math.ceil(x1 / 4) * 4, 4)
      for z in range(math.floor(z0 / 4) * 4, math.ceil(z1 / 4) * 4, 4)
      if scope.intersects(box(x, z, x + 4, z + 4))
    ]
    self.cellTree = s.STRtree(self.cells)
    self.field = field

  @lru_cache(maxsize=180000)
  def height(self, x, z, core):
    base = 5.2 if core else 3.0
    if not self.w < x < self.e or not self.n < z < self.s:
      return base
    u = (x - self.w) / self.p["stepM"]
    v = (z - self.n) / self.p["stepM"]
    i, j = int(u), int(v)
    a, b = u - i, v - j

    def sample(values):
      nw, ne = values[j][i : i + 2]
      sw, se = values[j + 1][i : i + 2]
      return (
        nw * (1 - a) + ne * (a - b) + se * b
        if a >= b
        else nw * (1 - b) + se * a + sw * (b - a)
      )

    return base + sample(self.p["offsets"]) + (3 - base) * sample(self.p["weights"])

  def pieces(self, region):
    for core, geom in [
      (True, region.intersection(self.core)),
      (False, region.difference(self.core)),
    ]:
      if geom.is_empty:
        continue
      yield geom.difference(self.field), core, None
      ids = self.cellTree.query(geom, predicate="intersects")
      if not len(ids):
        continue
      cells = [self.cells[i] for i in ids]
      clips = s.intersection(
        cells, s.union_all(list(components(geom, "Polygon"))), grid_size=0.01
      )
      for cell, clip in zip(cells, clips):
        if clip.area > 0.00002:
          x, z = cell.bounds[:2]
          native_y = self.height(
            math.floor(x / 4) * 4 + 2, math.floor(z / 4) * 4 + 2, core
          )
          yield clip, core, native_y


def packed(array):
  # Delta and byte planes preserve the input exactly and compress local
  # triangle fans and repeated centimetre coordinates effectively.
  words = np.asarray(array, dtype="<u2").reshape(-1)
  delta = np.diff(words, prepend=np.array([0], dtype="<u2")).astype("<u2")
  return base64.b64encode(
    gzip.compress(delta.view("u1").reshape(-1, 2).T.copy().tobytes(), mtime=0)
  ).decode()


def bake():
  evidence = json.load(gzip.open(ARCHIVE))
  scope, visible, shelters, poles = ground_layers(evidence)
  terrain = Terrain(scope)
  existing_signals = json.loads(
    (MESH / "regierungsviertel/street-details.json").read_bytes()
  )
  former = [Point(x / 10, z / 10) for x, z in existing_signals["traffic_signals_dm"]]
  former.extend(
    Point(r["position_dm"][0] / 10, r["position_dm"][1] / 10)
    for r in existing_signals.get("traffic_signal_placements", [])
  )
  former = s.STRtree(former)
  crossing_axes = [
    s.from_wkb(w)
    for _, tags, w in evidence["osmFeatures"]
    if tags.get("footway") == "crossing" and tags.get("crossing") == "traffic_signals"
  ]
  crossing_index = s.STRtree(crossing_axes)
  approved_poles = []
  for fid, attrs, g in poles:
    axis = crossing_axes[crossing_index.nearest(g)]
    if axis.distance(g) > 4.5 or len(
      former.query(g, predicate="dwithin", distance=3.5)
    ):
      continue
    # Aim towards the opposite curb on the witnessed pedestrian crossing.
    a, b = axis.coords[0], axis.coords[-1]
    x, z = g.coords[0]
    dx, dz = max(
      ((a[0] - x, a[1] - z), (b[0] - x, b[1] - z)), key=lambda d: math.hypot(*d)
    )
    if attrs.get("mas") in ("2", "3"):
      continue
    hm = float(attrs.get("hmas") or 0)
    height = hm / 100 if hm > 100 else hm
    if not 2.3 <= height <= 6:
      height = 3.25
    approved_poles.append(
      (
        fid,
        x,
        z,
        round(height, 2),
        round(math.atan2(dz, dx), 5),
        attrs.get("druecker") == "1",
      )
    )
  bounds = scope.bounds
  hosts = []
  sizes = Counter()
  total_faces = 0
  mouths = openings()
  stairs = json.loads((DATA / "rosenthalerV228.json").read_bytes())["stairs"]

  @lru_cache(maxsize=160000)
  def finish_height(x, z, lift):
    # Existing native and drawn transport beds include 22–30 cm overlays.
    # Bring measured road covers consistently above them; blend into the
    # four existing U8 upper landings at their authored 8 cm elevation.
    turn = min(1, mouths.distance(Point(x, z)) / 2.5)
    elevation = 0.08 + turn * (lift + 0.135 - 0.08)
    if turn == 1:
      return elevation, 1, 0, 0
    stair = min(stairs, key=lambda st: math.hypot(x - st["top"][0], z - st["top"][1]))
    distance = math.hypot(x - stair["top"][0], z - stair["top"][1])
    # A native four-metre terrain step can cross the very top of a run.
    # Its threshold must meet the actual stair mesh on both sides of that step.
    blend = max(0, min(1, (distance - 1.0) / 2.0))
    return elevation, blend, stair["surfaceY"], stair["nativeSurfaceY"]

  for tx in range(math.floor(bounds[0] / 512), math.ceil(bounds[2] / 512)):
    for tz in range(math.floor(bounds[1] / 512), math.ceil(bounds[3] / 512)):
      x0, z0 = tx * 512, tz * 512
      tile = box(x0, z0, x0 + 512, z0 + 512)
      if not scope.intersects(tile):
        continue
      indices = []
      vertices = {}
      counts = Counter()
      for (kind, lift), area in visible.items():
        region = s.intersection(area, tile, grid_size=0.01)
        if region.is_empty:
          continue
        serial = FINISHES.index(kind)
        for part, core, native_y in terrain.pieces(region):
          polygons = list(components(part, "Polygon"))
          if not polygons:
            continue
          triangles = s.get_parts(s.constrained_delaunay_triangles(polygons))
          if not len(triangles):
            continue
          coords = s.get_coordinates(triangles).reshape(-1, 4, 2)[:, :3]
          for tri in coords:
            uv = np.rint((tri - [x0, z0]) * 100).astype(int)
            a, b = uv[1] - uv[0]
            c, d = uv[2] - uv[0]
            cross = a * d - b * c
            if cross == 0:
              continue
            if cross > 0:
              tri = tri[[0, 2, 1]]
              uv = uv[[0, 2, 1]]
            for (x, z), (u, v) in zip(tri, uv):
              y = terrain.height(round(x, 2), round(z, 2), core)
              yn = y if native_y is None else native_y
              elevation, blend, top, native_top = finish_height(
                round(x, 2), round(z, 2), lift
              )
              key = (
                int(u),
                int(v),
                round(((y + elevation) * blend + top * (1 - blend)) * 100),
                round(((yn + elevation) * blend + native_top * (1 - blend)) * 100),
                serial,
              )
              indices.append(vertices.setdefault(key, len(vertices)))
            counts[kind] += 1
      if not indices:
        continue
      v = np.array(list(vertices))
      assert len(v) < 65536 and v.min() >= 0
      props = []
      packet_path = MESH / f"surrounding-berlin-v159/{tx}_{tz}.drawn.json.gz"
      local_shelters = [(fid, g) for fid, g in shelters if tile.covers(g.centroid)]
      known_footprints = []
      if local_shelters and packet_path.exists():
        original = json.load(gzip.open(packet_path))
        ox, _, oz = original["origin"]
        for building in original["nav"]["buildings"]:
          footprint = Polygon(building["ring"], building["holes"])
          known_footprints.append(affine_transform(footprint, [1, 0, 0, 1, ox, oz]))
      for fid, g in local_shelters:
        # Existing surveyed LoD2 shelter roofs retain sole ownership.
        if any(p.intersection(g).area > 0.15 for p in known_footprints):
          continue
        corners = list(g.minimum_rotated_rectangle.exterior.coords)[:4]
        edges = [
          (b[0] - a[0], b[1] - a[1]) for a, b in zip(corners, corners[1:] + corners[:1])
        ]
        dx, dz = max(edges, key=lambda p: math.hypot(*p))
        width = min(math.hypot(*e) for e in edges)
        x, z = g.centroid.coords[0]
        core = terrain.core.covers(Point(x, z))
        yd = terrain.height(x, z, core)
        yn = terrain.height(math.floor(x / 4) * 4 + 2, math.floor(z / 4) * 4 + 2, core)
        props.append(
          [
            fid,
            round(x, 2),
            round(z, 2),
            round(yd + 0.435, 2),
            round(yn + 0.435, 2),
            round(math.hypot(dx, dz), 2),
            round(width, 2),
            round(math.atan2(dz, dx), 5),
          ]
        )
      lamps = []
      for fid, x, z, h, a, button in approved_poles:
        if math.floor(x / 512) != tx or math.floor(z / 512) != tz:
          continue
        core = terrain.core.covers(Point(x, z))
        yd = terrain.height(x, z, core)
        yn = terrain.height(math.floor(x / 4) * 4 + 2, math.floor(z / 4) * 4 + 2, core)
        lamps.append(
          [
            fid,
            round(x, 2),
            round(z, 2),
            round(yd + 0.38, 2),
            round(yn + 0.38, 2),
            h,
            a,
            button,
          ]
        )
      ident = f"tor380-{tx}_{tz}"
      bounds2 = [
        int(x0 + v[:, 0].min() // 100),
        int(z0 + v[:, 1].min() // 100),
        math.ceil(x0 + v[:, 0].max() / 100),
        math.ceil(z0 + v[:, 1].max() / 100),
      ]
      packet = {
        "origin": [x0, z0],
        "vertices": len(v),
        "faces": len(indices) // 3,
        "position": packed(v[:, :4].T),
        "style": base64.b64encode(
          gzip.compress(v[:, 4].astype("u1").tobytes(), mtime=0)
        ).decode(),
        "index": packed(indices),
        "shelters": props,
        "signals": lamps,
      }
      path = DATA / f"torstrasseV380-{tx}_{tz}.json"
      path.write_text(json.dumps(packet, **COMPACT) + "\n")
      sizes.update(counts)
      total_faces += packet["faces"]
      hosts.append({"id": ident, "bounds": bounds2})
      print(ident, len(v), packet["faces"], len(props), path.stat().st_size, flush=True)
  (DATA / "torstrasseHostsV380.json").write_text(json.dumps(hosts, **COMPACT) + "\n")
  print(
    "Source",
    len(evidence["axes"]),
    len(evidence["surveyFeatures"]),
    len(evidence["osmFeatures"]),
  )
  print(
    "Area",
    round(s.union_all(list(visible.values())).area),
    "Triangle counts",
    dict(sizes),
    "total",
    total_faces,
  )
  print(
    "Widths / surface area",
    [
      (kind, round(area.area, 1))
      for (kind, h), area in visible.items()
      if kind in ("groove", "steel", "tactile", "kerb", "platform")
    ],
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--capture", type=Path, help="directory containing WFS and OSM source responses"
  )
  args = parser.parse_args()
  if args.capture:
    capture(args.capture)
  bake()
