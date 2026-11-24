"""Build nine surveyed public streets around Kollwitzplatz from retained open data.

Normal builds require Shapely >=2.1 and NumPy and make no network requests.
The optional --capture directory contains the original paginated WFS responses
and an OSM extract in local x/z metres. All used IDs and WFS queries survive in
the compact input archive so the small rendering packets are reproducible.
"""

import argparse
import gzip
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

import shapely as s
from build_prenzlauer_streets_v380 import (
  COLORS,
  COURSES,
  WALK,
  Packet,
  graded_walk,
  parts,
)
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import substring

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
ARCHIVE = ROOT / "geo_data/regierungsviertel/ryke-streets-v381-source.json.gz"
OUT = DATA / "rykeStreetsV381"
NAMES = {
  "Rykestraße",
  "Knaackstraße",
  "Diedenhofer Straße",
  "Kolmarer Straße",
  "Belforter Straße",
  "Kollwitzstraße",
  "Wörther Straße",
  "Husemannstraße",
  "Sredzkistraße",
}
ROAD_CLASSES = {"secondary", "tertiary", "residential", "living_street", "pedestrian"}
LAYERS = (
  "cm_fahrbahn ck_parkflaeche cl_gehweg bn_baumscheibe ce_gruenflaeche ch_radweg "
  "cf_trennstreifen by_gehwegueberfahrt cb_haltestellenwartebereich bw_aufmerksamkeitsfeld "
  "bd_bordstein be_fahrbahnmarkierunglinie bp_fahrbahnmarkierung_flaeche "
  "bm_zugangsbauwerk cc_treppe b_radverkehrsanlagen strassenbaeume"
).split()
PARK_IDS = (24638848, 40926071)
COMPACT = dict(ensure_ascii=False, separators=(",", ":"))


def polygonal(geom):
  return s.union_all(list(parts(geom, "Polygon")), grid_size=0.01)


def capture(folder):
  osm = json.load(gzip.open(folder / "osm.json.gz"))
  axes = [
    [i, t["name"], p]
    for i, t, p in osm
    if t.get("name") in NAMES and t.get("highway") in ROAD_CLASSES
  ]
  names = {name for _, name, _ in axes}
  assert names == NAMES
  axes.sort()
  domain = s.union_all([LineString(points) for _, _, points in axes]).buffer(
    18, quad_segs=6
  )
  # The two existing park teams own all internal paths, planted beds and
  # trunks. Keep the historical and latest OSM boundary at Kollwitzplatz.
  cadastral = json.loads(
    (ROOT / "geo_data/regierungsviertel/central-named-v230-source.json").read_bytes()
  )
  park_old = shape(
    next(
      a["geometry"]
      for a in cadastral["kollwitz"]["areas"]
      if str(a["id"]) == "24638848"
    )
  )
  parks = [s.set_precision(Polygon(p), 0.01) for i, t, p in osm if i in PARK_IDS]
  assert len(parks) == 2
  prev = json.load(
    gzip.open(
      ROOT / "geo_data/regierungsviertel/prenzlauer-streets-v380-source.json.gz"
    )
  )
  neighbour = s.union_all([LineString(p) for _, _, p in prev["axes"]]).buffer(
    18, cap_style="flat"
  )
  mask = s.union_all([*parks, park_old, neighbour], grid_size=0.01)
  domain = s.difference(domain, mask, grid_size=0.01)
  result = {
    "datum": "scene X/Z = E-389500 / 5820000-N, EPSG:25833",
    "survey": "Straßenbefahrung Berlin 2014/15",
    "osm": "https://download.geofabrik.de/europe/germany/berlin-261122.osm.pbf",
    "axes": axes,
    "parkIds": PARK_IDS,
    "scope": domain.wkb_hex,
    "queries": {},
    "layers": {},
    "trees": [],
    "ways": [],
  }
  for layer in LAYERS:
    raw = json.load(gzip.open(folder / (layer + ".json.gz")))
    result["queries"][layer] = raw["urls"]
    items = []
    for f in raw["rows"]:
      geom = affine_transform(shape(f["geometry"]), [1, 0, 0, -1, -389500, 5820000])
      if not domain.intersects(geom):
        continue
      props = f["properties"]
      if layer == "strassenbaeume":
        pt = s.get_parts(geom)[0]
        result["trees"].append(
          [
            props["gisid"],
            props["strname"],
            props["gattung"],
            props["baumhoehe"],
            props["kronedurch"],
            props["stammumfg"],
            round(pt.x, 2),
            round(pt.y, 2),
          ]
        )
      else:
        g = s.intersection(s.make_valid(geom), domain, grid_size=0.01)
        if g.is_empty:
          continue
        attrs = {
          k: props[k]
          for k in ("material", "bor", "fbl", "fbf", "rva_typ", "sorvt_typ", "stst_str")
          if props.get(k) is not None
        }
        items.append([f["id"], attrs, g.wkb_hex])
    if layer != "strassenbaeume":
      result["layers"][layer] = sorted(items)
  for i, t, p in osm:
    if (
      t.get("railway") == "tram"
      and t.get("tunnel") != "yes"
      and t.get("embedded_rails") != "abandoned"
    ):
      g = LineString(p)
      attrs = {"railway": "tram", "gauge": t.get("gauge", "1435")}
    elif t.get("footway") == "crossing":
      g = LineString(p)
      attrs = {
        k: t[k]
        for k in ("footway", "crossing", "crossing:markings", "surface")
        if k in t
      }
    elif t.get("area:highway") == "traffic_island" and len(p) > 3 and p[0] == p[-1]:
      g = s.make_valid(Polygon(p))
      attrs = {"area:highway": "traffic_island", "surface": t.get("surface")}
    else:
      continue
    if domain.intersects(g):
      result["ways"].append([i, attrs, g.wkb_hex])
  result["ways"].sort()
  result["trees"].sort()
  ARCHIVE.write_bytes(gzip.compress(json.dumps(result, **COMPACT).encode(), mtime=0))


def dashed(line, width, dash=None, gap=None):
  if not dash:
    return [line.buffer(width / 2, cap_style="flat", join_style="mitre")]
  strokes = []
  start = 0.0
  while start < line.length:
    piece = substring(line, start, min(start + dash, line.length))
    strokes.append(piece.buffer(width / 2, cap_style="flat", join_style="mitre"))
    start += dash + gap
  return strokes


def assemble(source):
  scope = s.from_wkb(source["scope"])
  groups = defaultdict(list)
  curbs = []
  paint = []
  rails = []
  crossings = []
  blocked = []
  island = []
  cycle = []
  paint_areas = []
  for i, attrs, w in source["ways"]:
    g = s.from_wkb(w)
    if attrs.get("railway") == "tram":
      for side in (-1, 1):
        rails.append(g.offset_curve(side * int(attrs["gauge"]) / 2000))
    elif attrs.get("footway") == "crossing":
      crossings.append((attrs, g))
    else:
      island.append(g.intersection(scope))
  groups[1, "small-setts", 0.40].extend(island)
  for layer, features in source["layers"].items():
    for fid, t, w in features:
      g = s.from_wkb(w)
      mat = t.get("material")
      if layer in ("bm_zugangsbauwerk", "cc_treppe"):
        blocked.append(g)
        continue
      if layer == "bd_bordstein":
        curbs.append((int(t["bor"]), g))
        continue
      if layer == "b_radverkehrsanlagen":
        # The official movement axes record a route, not a painted lane.
        # Use only confirmed crossing stripes or the separate WFS cycle area.
        if "Radfahrerfurt" in t.get("sorvt_typ", ""):
          cycle.append(g)
        continue
      if layer == "be_fahrbahnmarkierunglinie":
        code = int(t.get("fbl") or 0)
        styles = {
          1: (0.12, 3.0, 6.0),
          2: (0.13, None, None),
          3: (0.48, None, None),
          4: (0.48, 0.5, 0.5),
          5: (0.23, 0.5, 0.5),
          6: (0.13, 1.5, 1.5),
          7: (0.13, 1.5, 1.5),
          10: (0.24, 3.0, 3.0),
          11: (0.12, None, None),
        }
        if code in styles:
          for line in parts(g, "LineString"):
            paint.extend(dashed(line, *styles[code]))
        continue
      if layer == "bp_fahrbahnmarkierung_flaeche":
        paint_areas.append((int(t.get("fbf") or 0), g))
        continue
      walk = WALK.get(mat, "other")
      road = {
        "02": "asphalt",
        "03": "mosaic",
        "04": "small-setts",
        "05": "carriage-setts",
        "06": "pavers",
      }.get(mat, "concrete")
      key = {
        "bw_aufmerksamkeitsfeld": (0, "tactile", 0.419),
        "bn_baumscheibe": (2, "earth", 0.374),
        "ce_gruenflaeche": (2, "grass", 0.38),
        "cf_trennstreifen": (3, walk, 0.39),
        "ch_radweg": (3, "cycle" if mat not in ("01", "02") else walk, 0.363),
        "cb_haltestellenwartebereich": (3, "platform", 0.40),
        "by_gehwegueberfahrt": (4, walk, 0.367),
        "cl_gehweg": (5, walk, 0.4),
        "ck_parkflaeche": (6, road, 0.306),
        "cm_fahrbahn": (7, road, 0.29),
      }[layer]
      groups[key].append(g)
  claimed = polygonal(s.union_all(blocked, grid_size=0.01))
  areas = {}
  for (_, tone, height), geoms in sorted(groups.items()):
    merged = polygonal(
      s.union_all([p for g in geoms for p in parts(g, "Polygon")], grid_size=0.01)
    )
    g = polygonal(merged.difference(claimed, grid_size=0.01))
    if g.is_empty:
      continue
    key = tone, height
    areas[key] = s.union_all([areas.get(key, Polygon()), g], grid_size=0.01)
    claimed = s.union_all([claimed, g], grid_size=0.01)
  road = s.union_all([a for (_, h), a in areas.items() if h in (0.29, 0.306)])
  # Crossing voids in the 2014/15 survey are bounded by the adjacent measured
  # carriageway and sidewalks. Restore them only when a current OSM crossing
  # selects an enclosed void of comparable width with the same surface.
  voids = list(parts(scope.difference(claimed, grid_size=0.01), "Polygon"))
  tree = s.STRtree(voids)
  fill = defaultdict(list)
  for t, axis in crossings:
    for j in tree.query(axis, predicate="intersects"):
      void = voids[j]
      if not (
        2 < void.area < 190
        and void.distance(scope.boundary) > 0.02
        and axis.intersection(void).length > 1
        and void.boundary.intersection(road.boundary).length > 2
      ):
        continue
      title = t.get("surface")
      tone = {
        "sett": "carriage-setts",
        "asphalt": "asphalt",
        "paving_stones": "pavers",
      }.get(title)
      if tone is None:
        adjacent = [
          (a.boundary.intersection(void.boundary).length, kind)
          for (kind, h), a in areas.items()
          if h == 0.29
        ]
        tone = max(adjacent)[1]
      fill[tone].append(void)
  for tone, geoms in fill.items():
    g = polygonal(s.union_all(geoms, grid_size=0.01))
    areas[tone, 0.29] = s.union_all([g, areas.get((tone, 0.29), Polygon())])
    claimed = s.union_all([claimed, g])
    road = s.union_all([road, g])
  for region in cycle:
    for c in (-0.80, 0.80):
      for line in parts(region, "LineString"):
        for side in parts(line.offset_curve(c), "LineString"):
          paint.extend(dashed(side, 0.17, 0.52, 0.55))
  # Use only explicit zebra-crossing areas; hatched areas cannot be rendered as
  # a solid white polygon. Their individual lines have a dedicated survey.
  for kind, g in paint_areas:
    if kind != 3:
      continue
    for p in parts(g, "Polygon"):
      rect = list(p.minimum_rotated_rectangle.exterior.coords)
      dx, dz = min(
        [(b[0] - a[0], b[1] - a[1]) for a, b in zip(rect, rect[1:])],
        key=lambda q: math.hypot(*q),
      )
      d = math.hypot(dx, dz)
      if d < 0.5:
        continue
      ux, uz = dx / d, dz / d
      ox, oz = p.centroid.coords[0]
      span = math.ceil(math.hypot(p.bounds[2] - p.bounds[0], p.bounds[3] - p.bounds[1]))
      for k in range(-span, span + 1):
        cx, cz = ox - uz * k, oz + ux * k
        stripe = LineString(
          [(cx - ux * span, cz - uz * span), (cx + ux * span, cz + uz * span)]
        ).buffer(0.245, cap_style="flat")
        paint.append(p.intersection(stripe))
  areas["paint", 0.314] = polygonal(
    s.intersection(
      s.union_all([p for g in paint for p in parts(g, "Polygon")], grid_size=0.01),
      road,
      grid_size=0.01,
    )
  )
  for tone, width, h in [("rail-bed", 0.20, 0.324), ("rail", 0.073, 0.339)]:
    areas[tone, h] = polygonal(
      s.union_all(rails)
      .buffer(width / 2)
      .intersection(scope)
      .difference(s.union_all(blocked))
    )
  surface = polygonal(claimed.difference(s.union_all(blocked)))
  bands = {}
  for code, h in [(1, 0.425), (2, 0.321), (3, 0.30)]:
    strip = s.union_all(
      [
        g.buffer(0.09, cap_style="flat", join_style="round", quad_segs=2)
        for c, g in curbs
        if c == code
      ],
      grid_size=0.01,
    )
    bands[code] = polygonal(s.intersection(strip, surface, grid_size=0.01))
  return areas, bands, surface


def tree_rows(source, scope):
  # This baseline owns the inner-city tree placements and the preceding two
  # street corridors. Match trunks in metres, including across tile seams.
  existing = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/park-details.json").read_bytes()
  )
  points = [Point(r["position"][0], r["position"][2]) for r in existing["trees"]]
  previous = json.load(
    gzip.open(
      ROOT / "geo_data/regierungsviertel/prenzlauer-streets-v380-source.json.gz"
    )
  )
  points.extend(Point(r[-2:]) for r in previous["trees"])
  seen = s.STRtree(points)
  measured = {}
  rejected = Counter()
  species = {"Aesculus": 0, "Crataegus": 1, "Platanus": 2, "Tilia": 3, "Acer": 4}
  for i, (ident, street, genus, height, spread, girth, x, z) in enumerate(
    source["trees"]
  ):
    pt = Point(x, z)
    if not scope.covers(pt) or len(seen.query(pt, predicate="dwithin", distance=0.25)):
      rejected["owned"] += 1
      continue
    if any(not v or v <= 0 for v in (height, spread, girth)):
      rejected["incomplete dimensions"] += 1
      continue
    if (x, z) in measured:
      rejected["duplicate"] += 1
      continue
    measured[x, z] = [x, z, 3.36, height, spread, girth, species.get(genus, 5), i]
  # Contiguous 128 m neighbourhoods allow the renderer to cull crowns and
  # trunks together without moving or copying any instance buffer.
  return sorted(
    measured.values(),
    key=lambda r: (math.floor(r[0] / 128), math.floor(r[1] / 128), r[7]),
  ), rejected


def bake():
  source = json.load(gzip.open(ARCHIVE))
  scope = s.from_wkb(source["scope"])
  areas, bands, public = assemble(source)
  lowered = [
    (s.from_wkb(w), 0.296 if attrs["bor"] == 3 else 0.319)
    for _, attrs, w in source["layers"]["bd_bordstein"]
    if attrs["bor"] in (2, 3)
  ]
  lowered_index = s.STRtree([g for g, _ in lowered])
  trees, rejected = tree_rows(source, scope)
  # This district is wholly outside the Weinberg terrain interpolation field;
  # the existing two outer-city mesh families both use the 3 m local datum.
  OUT.mkdir(exist_ok=True)
  hosts = []
  count = Counter()
  total = 0
  x0, z0, x1, z1 = scope.bounds
  for tx in range(math.floor(x0 / 512), math.ceil(x1 / 512)):
    for tz in range(math.floor(z0 / 512), math.ceil(z1 / 512)):
      tile = box(tx * 512, tz * 512, (tx + 1) * 512, (tz + 1) * 512)
      if not scope.intersects(tile):
        continue
      packet = Packet(tx, tz)

      def plate(region, tone, height):
        geom = polygonal(s.intersection(region, tile, grid_size=0.01))
        for poly in parts(geom, "Polygon"):
          # Grade the actual public walk into measured flush and 3 cm curb
          # lines. Never raise a full-height sidewalk across a crossing.
          graded = (
            graded_walk(poly, tone, height, lowered, lowered_index)
            if height in (0.367, 0.4, 0.419)
            else [(poly, tone, height)]
          )
          for patch, _, y in graded:
            for piece in parts(patch, "Polygon"):
              for face in s.constrained_delaunay_triangles(piece).geoms:
                coords = list(
                  s.orient_polygons(face, exterior_cw=True).exterior.coords
                )[:3]
                packet.facet(
                  [(x, 3 + (y(x, z) if callable(y) else y), z) for x, z in coords],
                  COLORS[tone],
                  COURSES.get(tone, 0),
                )

      for (tone, h), a in areas.items():
        plate(a, tone, h)
      for code, h in [(1, 0.425), (2, 0.321), (3, 0.30)]:
        plate(bands[code], "kerb" if code == 1 else "lowered", h)
        if code != 1:
          continue
        for line in parts(bands[code].boundary.intersection(tile), "LineString"):
          for a, b in zip(line.coords, list(line.coords)[1:]):
            bottomA = (a[0], 3.285, a[1])
            topA = (a[0], 3 + h, a[1])
            bottomB = (b[0], 3.285, b[1])
            topB = (b[0], 3 + h, b[1])
            packet.facet([bottomA, topA, topB], 0xA6A297)
            packet.facet([bottomA, topB, bottomB], 0xA6A297)
      packet.trees = [
        r for r in trees if int(r[0] // 512) == tx and int(r[1] // 512) == tz
      ]
      if not packet.indices:
        continue
      suffix = f"{tx}_{tz}"
      path = OUT / (suffix + ".json")
      packet.save(path)
      geom_bounds = scope.intersection(tile).bounds
      xs = [geom_bounds[0], geom_bounds[2]]
      zs = [geom_bounds[1], geom_bounds[3]]
      for x, z, _, _, w, *_ in packet.trees:
        xs.extend([x - w / 2, x + w / 2])
        zs.extend([z - w / 2, z + w / 2])
      hosts.append(
        {
          "id": "ryke381-" + suffix,
          "bounds": [
            math.floor(min(xs)),
            math.floor(min(zs)),
            math.ceil(max(xs)),
            math.ceil(max(zs)),
          ],
        }
      )
      count["vertices"] += len(packet.xyz)
      count["triangles"] += len(packet.indices) // 3
      total += path.stat().st_size
  (DATA / "rykeStreetsHostsV381.json").write_text(json.dumps(hosts, **COMPACT) + "\n")
  print(
    "Hosts",
    hosts,
    "public area",
    round(public.area),
    "trees",
    len(trees),
    "excluded",
    rejected,
    "bytes",
    total,
    dict(count),
  )
  print(
    "Source layers",
    {k: len(v) for k, v in source["layers"].items()},
    "trees",
    len(source["trees"]),
    "axes",
    len(source["axes"]),
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--capture", type=Path)
  args = parser.parse_args()
  if args.capture:
    capture(args.capture)
  bake()
