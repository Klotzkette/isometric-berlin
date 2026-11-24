"""Bake public street-survey polygons and current mapped public areas in historic Mitte.

The retained, clipped EPSG:25833 source is sufficient for an offline rebuild. Optional
--capture reads paginated WFS feature collections and the dated OSM way/area extract.
The citywide source geometry and existing bridge, plaza and station owners stay intact.
"""

import argparse
import gzip
import hashlib
import json
import math
from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path

import numpy as np
import shapely as s
from build_prenzlauer_streets_v380 import COLORS, COURSES, Packet, parts
from build_ryke_streets_v381 import assemble as survey_surfaces
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, box, shape

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app"
DATA = APP / "src/data"
ARCHIVE = ROOT / "geo_data/regierungsviertel/core-mitte-streets-v383-source.json.gz"
OUT = DATA / "coreMitteStreetsV383"
GROUND = APP / "public/mesh/regierungsviertel/ground-context.json"
LAYERS = (
  "cm_fahrbahn ck_parkflaeche cl_gehweg bn_baumscheibe ce_gruenflaeche ch_radweg "
  "cf_trennstreifen by_gehwegueberfahrt cb_haltestellenwartebereich bw_aufmerksamkeitsfeld "
  "bd_bordstein be_fahrbahnmarkierunglinie bp_fahrbahnmarkierung_flaeche "
  "bm_zugangsbauwerk cc_treppe b_radverkehrsanlagen"
).split()
ROAD = {
  "primary",
  "secondary",
  "tertiary",
  "residential",
  "living_street",
  "pedestrian",
  "unclassified",
  "service",
}
RADIUS = {
  "Unter den Linden": 24,
  "Schloßplatz": 22,
  "Hausvogteiplatz": 23,
  "Schinkelplatz": 20,
}
# Civil blocks defining the requested extent. The boxes select stretches of the named
# axes. Only surveyed features, OSM areas and a few mapped paths become render geometry.
ZONES = [
  ((484, 80, 1865, 376), {"Unter den Linden", "Schloßbrücke", "Am Lustgarten"}),
  (
    (1160, 208, 1565, 865),
    {
      "Friedrichstraße",
      "Charlottenstraße",
      "Markgrafenstraße",
      "Behrenstraße",
      "Französische Straße",
      "Taubenstraße",
      "Jägerstraße",
      "Anton-Wilhelm-Amo-Straße",
      "Kronenstraße",
    },
  ),
  (
    (742, 602, 1255, 892),
    {
      "Wilhelmstraße",
      "Glinkastraße",
      "Mauerstraße",
      "Anton-Wilhelm-Amo-Straße",
      "Jägerstraße",
      "Taubenstraße",
      "Kronenstraße",
      "Friedrichstraße",
    },
  ),
  (
    (1464, 210, 2000, 795),
    {
      "Französische Straße",
      "Jägerstraße",
      "Kleine Jägerstraße",
      "Werderscher Markt",
      "Hausvogteiplatz",
      "Oberwallstraße",
      "Niederwallstraße",
      "Kurstraße",
      "Niederlagstraße",
      "Werderstraße",
      "Schinkelplatz",
      "Unterwasserstraße",
      "Oberwasserstraße",
      "Hinter der Katholischen Kirche",
    },
  ),
  (
    (1805, 58, 2250, 449),
    {
      "Schloßplatz",
      "Schloßfreiheit",
      "Am Lustgarten",
      "Karl-Liebknecht-Straße",
      "Breite Straße",
      "Schloßbrücke",
      "Rathausbrücke",
      "Schleusenbrücke",
      "Liebknechtbrücke",
    },
  ),
]
# These post-reconstruction mapped areas and the planted Schinkelplatz and Zietenplatz
# exceed the street-corridor width. Their own perimeter sets the extension.
PLACES = {
  1173675373,
  1173675376,
  1173723266,
  1173733854,
  1173737832,
  1174259940,
  1174514169,
  1178053233,
  1182178817,
  27811294,
  1173733852,
  1173733853,
  1046158933,
  1046158935,
  1046158937,
  1046158939,
  1046158941,
  1046158943,
}
BASE = {"road": 0.36, "walk": 0.47, "soil": 0.43, "green": 0.42, "paint": 0.381}
PALETTE = {
  **COLORS,
  "promenade": 0xC7BBA4,
  "palace-setts": 0xBDBAB1,
  "flowers": 0x84775F,
  "sett": 0xAAA59B,
  "sandstone": 0xC9C2B4,
}
SIZES = {**COURSES, "palace-setts": 0.91, "sett": 0.16, "sandstone": 0.73}
COMPACT = dict(ensure_ascii=False, separators=(",", ":"))


def union(geoms):
  return s.union_all(list(geoms), grid_size=0.01)


def clean(g):
  return union(parts(s.make_valid(g), "Polygon"))


def valid_way(t):
  return (
    t.get("access") not in ("private", "no")
    and not t.get("indoor")
    and t.get("tunnel") not in ("yes", "building_passage")
    and not str(t.get("layer", "0")).startswith("-")
    and not str(t.get("level", "0")).startswith("-")
  )


def opening_polygons():
  result = []
  for row in json.loads((DATA / "ubahnAccessV326.json").read_bytes())["entries"]:
    if row["stair"]:
      result.append(Polygon(row["stair"]["ring"]).buffer(0.30, join_style="mitre"))
  entrance = json.loads((APP / "src/unterDenLindenEntranceSource.json").read_bytes())
  runs = entrance["stairs"] + entrance["escalators"]
  for name in "ABCDE":
    runs_for_exit = [
      LineString([r["top"], r["bottom"]]).buffer(r["width"] / 2, cap_style="flat")
      for r in runs
      if r["ref"] == name
    ]
    x, z, X, Z = union(runs_for_exit).bounds
    result.append(
      box(
        math.floor((x - 0.5) / 4) * 4,
        math.floor((z - 0.5) / 4) * 4,
        math.ceil((X + 0.5) / 4) * 4,
        math.ceil((Z + 0.5) / 4) * 4,
      )
    )
  for r in json.loads((DATA / "ubahnEntrancesV261.json").read_bytes())["stairs"]:
    result.append(
      LineString([r["top"], r["bottom"]]).buffer(
        r["width"] / 2 + 0.30, cap_style="square"
      )
    )
  return result


def classify(t, relation):
  area = t.get("area:highway")
  surface = t.get("surface", "")
  if t.get("landuse") == "flowerbed":
    return "flowers"
  if t.get("landuse") == "grass" or t.get("natural") == "shrubbery":
    return "grass"
  if t.get("leisure") == "garden" and not area:
    return "garden"
  if t.get("highway") == "steps" or area == "steps":
    return "opening"
  if not area and t.get("area") != "yes" and not relation:
    return None
  role = area or t.get("highway")
  if role in (
    "footway",
    "sidewalk",
    "pedestrian",
    "traffic_island",
    "platform",
    "cycleway",
  ):
    if surface in ("fine_gravel", "compacted", "gravel", "sand"):
      return "promenade"
    if surface in ("tactile_paving",):
      return "tactile"
    if surface in ("sett", "cobblestone", "cobblestone:flattened"):
      return "sett"
    if surface in ("asphalt",):
      return "foot-asphalt"
    if surface in ("granite", "concrete:plates"):
      return "sandstone"
    if surface in ("paving_stones", "paved"):
      return "pavers"
    return "unknown-walk"
  if role in ROAD:
    if surface in ("sett", "cobblestone", "cobblestone:flattened"):
      return "road-setts"
    if surface == "paving_stones":
      return "road-pavers"
    return "road"
  return None


def capture(folder):
  osm = json.load(gzip.open(folder / "osm.json.gz"))
  relations = json.load(gzip.open(folder / "relations.json.gz"))
  axes, extents, lane_axes = [], [], []
  for fid, t, p in osm:
    name = t.get("name")
    if (
      not valid_way(t)
      or t.get("highway") not in ROAD
      or t.get("area") == "yes"
      or p[0] == p[-1]
    ):
      continue
    zones = [box(*b) for b, names in ZONES if name in names]
    if zones:
      g = s.intersection(LineString(p), union(zones), grid_size=0.01)
      for line in parts(g, "LineString"):
        axes.append([fid, name, list(line.coords)])
        if (
          name == "Unter den Linden"
          and t.get("oneway") == "yes"
          and t.get("cycleway:right:width", "").replace(".", "", 1).isdigit()
        ):
          lane_axes.append(
            [
              fid,
              {
                k: v
                for k, v in t.items()
                if k.startswith("cycleway:right") or k == "source:cycleway:right:width"
              },
              list(line.coords),
            ]
          )
        extents.append(line.buffer(RADIUS.get(name, 15), quad_segs=5))
  for fid, t, p in osm:
    if fid in PLACES:
      extents.append(clean(Polygon(p)).buffer(0.12))
  # The Gendarmenmarkt relation's exterior belongs entirely to the restored square.
  inner = next(ps for fid, t, ps in relations if fid == 3573535)
  square = union(Polygon(rings[0]) for rings in inner)
  exclude = [square, box(292, 220, 560, 379), *opening_polygons()]
  area_rows = []
  for fid, t, p in osm:
    if len(p) > 3 and p[-1] == p[0]:
      area_rows.append(("way/" + str(fid), t, clean(Polygon(p))))
  for fid, t, polys in relations:
    g = union(clean(Polygon(rings[0], rings[1:])) for rings in polys)
    area_rows.append(("relation/" + str(fid), t, g))
  target = union(extents)
  mapped = []
  for ident, t, g in area_rows:
    if g.is_empty or not target.intersects(g) or not valid_way(t):
      continue
    if (
      (t.get("building") and t.get("building") not in ("no", "roof"))
      or t.get("natural") == "water"
      or t.get("man_made") == "bridge"
    ):
      exclude.append(g)
      continue
    role = classify(t, ident.startswith("relation/"))
    if role == "opening":
      exclude.append(g.buffer(0.1))
    elif role and t.get("bridge") != "yes":
      mapped.append((ident, role, g, t.get("name", "")))
  # Keep the deck and its independent grade at the bridge ends even where the
  # OSM bridge is mapped as an axis rather than a man_made polygon.
  for fid, t, p in osm:
    if (
      t.get("bridge") == "yes"
      and t.get("highway") in ROAD
      and t.get("name")
      in ("Schloßbrücke", "Liebknechtbrücke", "Rathausbrücke", "Schleusenbrücke")
    ):
      ln = LineString(p)
      if ln.intersects(target):
        exclude.append(
          ln.buffer(
            float(str(t.get("width", 14)).split(";")[0]) / 2 + 2, cap_style="flat"
          )
        )
  scope = clean(target.difference(union(exclude), grid_size=0.01))
  areas = []
  for ident, role, g, name in mapped:
    clipped = clean(g.intersection(scope, grid_size=0.01))
    if not clipped.is_empty:
      areas.append([ident, role, name, clipped.wkb_hex])
  result = {
    "datum": "X=easting−389500, Z=5820000−northing (EPSG:25833), metres",
    "axes": sorted(axes),
    "laneAxes": sorted(lane_axes),
    "osm": "https://download.geofabrik.de/europe/germany/berlin-261122.osm.pbf",
    "survey": "Straßenbefahrung Berlin 2014/15",
    "scope": scope.wkb_hex,
    "mapped": sorted(areas),
    "groundSha256": hashlib.sha256(GROUND.read_bytes()).hexdigest(),
    "layers": {},
    "queries": {},
    "ways": [],
    "paths": [],
  }
  for layer in LAYERS:
    raw = json.load(gzip.open(folder / (layer + ".json.gz")))
    result["queries"][layer] = raw["urls"]
    items = []
    for f in raw["rows"]:
      g = affine_transform(shape(f["geometry"]), [1, 0, 0, -1, -389500, 5820000])
      if not scope.intersects(g):
        continue
      g = s.intersection(s.make_valid(g), scope, grid_size=0.01)
      if not g.is_empty:
        props = f["properties"]
        attrs = {
          k: props[k]
          for k in ("material", "bor", "fbl", "fbf", "sorvt_typ")
          if props.get(k) is not None
        }
        items.append([f["id"], attrs, g.wkb_hex])
    result["layers"][layer] = sorted(items)
  for fid, t, p in osm:
    if not valid_way(t) or len(p) < 2 or p[0] == p[-1] or t.get("bridge") == "yes":
      continue
    if t.get("footway") == "crossing":
      group = "ways"
    elif t.get("highway") in ("path", "footway", "pedestrian") and t.get("surface") in (
      "fine_gravel",
      "compacted",
      "sett",
      "paving_stones",
      "asphalt",
    ):
      group = "paths"
    else:
      continue
    g = LineString(p)
    if g.intersects(scope):
      attrs = {
        k: t[k]
        for k in (
          "name",
          "footway",
          "crossing",
          "crossing:markings",
          "surface",
          "width",
        )
        if k in t
      }
      result[group].append(
        [fid, attrs, s.intersection(g, scope, grid_size=0.01).wkb_hex]
      )
  ARCHIVE.write_bytes(gzip.compress(json.dumps(result, **COMPACT).encode(), mtime=0))
  return result


def cycle_lane_edges(lane_axes, road):
  """Use the mapped right-hand width measured from the actual carriageway edge.

  A junction flare or missing opposite curb terminates a stroke. Different OSM
  ways do not get connected across intersections. No lane is invented where its
  width, kind or painted edge has not been recorded.
  """
  from shapely.ops import substring

  perimeter = list(parts(road.boundary, "LineString"))
  spatial = s.STRtree(perimeter)
  strokes = []
  for _, attrs, coordinates in lane_axes:
    if attrs.get("cycleway:right") != "lane":
      continue
    kind = attrs.get("cycleway:right:marking:left") or attrs.get("cycleway:right:lane")
    if kind not in ("solid_line", "dashed_line", "exclusive", "advisory"):
      continue
    lane_width = float(attrs["cycleway:right:width"])
    axis = LineString(coordinates)
    count = max(2, math.ceil(axis.length / 2.5))
    points = []
    for step in range(count + 1):
      m = axis.length * step / count
      a, b = (
        axis.interpolate(max(0.0, m - 0.15)),
        axis.interpolate(min(axis.length, m + 0.15)),
      )
      dx, dz = b.x - a.x, b.y - a.y
      length = math.hypot(dx, dz)
      if length < 0.0001:
        continue
      nx, nz = -dz / length, dx / length
      p = axis.interpolate(m)
      ray = LineString([(p.x, p.y), (p.x + 10 * nx, p.y + 10 * nz)])
      hits = [
        pt
        for index in spatial.query(ray, predicate="intersects")
        for pt in parts(ray.intersection(perimeter[index]), "Point")
      ]
      distance = min((p.distance(pt) for pt in hits), default=100.0)
      ok = lane_width + 0.25 < distance < 7.2
      pt = (p.x + nx * (distance - lane_width), p.y + nz * (distance - lane_width))
      if points and (not ok or math.dist(points[-1], pt) > 4.8):
        if len(points) >= 2:
          strokes.append((kind, LineString(points)))
        points = []
      if ok:
        points.append(pt)
    if len(points) >= 2:
      strokes.append((kind, LineString(points)))
  marks = []
  for kind, line in strokes:
    if kind in ("solid_line", "exclusive"):
      marks.append(
        line.buffer(0.115, cap_style="flat", join_style="round", quad_segs=2)
      )
    else:
      for start in np.arange(0.0, line.length, 2.0):
        segment = substring(line, start, min(line.length, start + 1.0))
        marks.append(
          segment.buffer(0.075, cap_style="flat", join_style="round", quad_segs=2)
        )
  return clean(union(marks).intersection(road, grid_size=0.01))


def footprints(source):
  scope = s.from_wkb(source["scope"])
  mapped = defaultdict(list)
  for ident, role, name, hexagon in source["mapped"]:
    if role == "sett" and int(ident.split("/")[1]) in PLACES:
      role = "palace-setts"
    mapped[role].append(s.from_wkb(hexagon))
  current = {k: union(v) for k, v in mapped.items()}
  # Use official pavement classification inside OSM footways of unspecified finish.
  # The post-U5 public footway and roadway outlines supersede the excavation-era
  # 2014 polygons only in actual mapped areas. Exits and current building plots have
  # already been cut. Cut the remaining survey stairways before paving their surrounds.
  openings = union(
    s.from_wkb(w)
    for k in ("bm_zugangsbauwerk", "cc_treppe")
    for fid, t, w in source["layers"][k]
  )
  site_rebuilt = union(
    s.from_wkb(w)
    for ident, _, _, w in source["mapped"]
    if ident.startswith("way/") and int(ident.split("/")[1]) in PLACES
  )
  openings = clean(openings.difference(site_rebuilt))
  scope = clean(scope.difference(openings, grid_size=0.01))
  survey, _, _ = survey_surfaces(
    {**source, "layers": {**source["layers"], "bm_zugangsbauwerk": [], "cc_treppe": []}}
  )
  roads = union(
    current.get(t, Polygon()) for t in ("road", "road-setts", "road-pavers")
  )
  wet = union(s.from_wkb(w) for _, t, w in source["layers"]["bn_baumscheibe"])
  raised = defaultdict(list)

  def layer(priority, tone, y, geom):
    if not geom.is_empty:
      raised[priority, tone, y].append(geom)

  # Existing quay deck, fountain basins, flowerbeds and stairs keep their own models.
  # A generic OSM 'garden' is an envelope only; its paths and basins must stay visible.
  for tone, y in [("flowers", 0.42), ("grass", 0.42), ("tactile", 0.483)]:
    layer(0, tone, y, current.get(tone, Polygon()))
  layer(1, "earth", BASE["soil"], wet.difference(roads.buffer(-0.12)))
  for t, z in [
    ("promenade", 0.47),
    ("palace-setts", 0.47),
    ("sett", 0.47),
    ("pavers", 0.47),
    ("foot-asphalt", 0.47),
    ("sandstone", 0.47),
  ]:
    layer(2, t, z, current.get(t, Polygon()))
  # Survey tactiles are too detailed for many current OSM area polygons.
  # Their location remains useful except where a newly mapped carriageway intervenes.
  layer(
    1, "tactile", 0.483, survey.get(("tactile", 0.419), Polygon()).difference(roads)
  )
  # Retain the measured materials on each side of an OSM carriageway where OSM
  # records only its geometry. Their common intersection is still the old carriageway.
  for (tone, h), g in survey.items():
    if h in (0.29, 0.306):
      layer(3, tone, BASE["road"], roads.intersection(g, grid_size=0.01))
  for tone, t in [
    ("asphalt", "road"),
    ("carriage-setts", "road-setts"),
    ("pavers", "road-pavers"),
  ]:
    layer(4, tone, BASE["road"], current.get(t, Polygon()))
  for (tone, h), g in survey.items():
    if h not in (0.29, 0.306, 0.314, 0.324, 0.339):
      actual_y = (
        BASE["soil"]
        if tone == "earth"
        else BASE["green"]
        if tone == "grass"
        else BASE["walk"]
      )
      layer(5, tone, actual_y, g)
  layer(6, "slabs", BASE["walk"], current.get("unknown-walk", Polygon()))
  # Explicitly tagged center paths in the boulevard fill the U5 construction voids.
  # Outside the promenade, use only widths supplied by the way. Side streets with
  # no measured width retain their public survey polygons.
  for _, tags, w in source["paths"]:
    line = s.from_wkb(w)
    surface = tags["surface"]
    x, z = line.centroid.coords[0]
    on_linden = 560 < x < 1520 and abs(z - (334 - 0.083 * x)) < 12
    if not tags.get("width") and not (
      on_linden and surface in ("compacted", "fine_gravel")
    ):
      continue
    try:
      width = float(tags.get("width") or 3.0)
    except ValueError:
      continue
    if not 0.5 <= width <= 16:
      continue
    tone = {
      "fine_gravel": "promenade",
      "compacted": "promenade",
      "sett": "sett",
      "paving_stones": "pavers",
      "asphalt": "foot-asphalt",
    }[surface]
    path = line.buffer(width / 2, cap_style="flat", join_style="round", quad_segs=4)
    layer(4 if on_linden and width >= 5 else 7, tone, 0.47, path.difference(roads))
  # The Schinkelplatz public garden is subdivided by mapped paths, the surviving
  # fountain and lawn. Do not overpaint an undifferentiated garden envelope.
  for (tone, h), g in survey.items():
    if h in (0.29, 0.306):
      layer(8, tone, BASE["road"], g)
  claimed = Polygon()
  plates = defaultdict(list)
  for (_, tone, y), geoms in sorted(raised.items()):
    inside = clean(clean(union(geoms)).intersection(scope, grid_size=0.01))
    piece = clean(inside.difference(claimed, grid_size=0.01))
    if piece.is_empty:
      continue
    plates[tone, y].append(piece)
    claimed = union([claimed, piece])
  plates = {k: union(v) for k, v in plates.items()}
  road = union(v for (t, y), v in plates.items() if y == BASE["road"])
  # Old kerbs drawn through current plazas or through the middle of new carriageways
  # are obsolete. At confirmed public road-pavement boundaries add the missing new
  # kerb only if there is no surveyed edge. Retain lowered crossings distinctly.
  curbs = defaultdict(list)
  current_walk = union(
    g
    for t, g in current.items()
    if t
    in (
      "sett",
      "palace-setts",
      "pavers",
      "unknown-walk",
      "promenade",
      "foot-asphalt",
      "sandstone",
    )
  )
  incompatible = union([roads.buffer(-0.5), current_walk.buffer(-0.55)])
  for _, t, w in source["layers"]["bd_bordstein"]:
    code = t["bor"]
    if code not in (1, 2, 3):
      continue
    line = union(parts(s.from_wkb(w), "LineString"))
    g = s.difference(line, incompatible, grid_size=0.01)
    curbs[code].extend(parts(g, "LineString"))
  known = union(g for rows in curbs.values() for g in rows).buffer(0.68, quad_segs=2)
  # Restrict inferred rises to OSM polygons on both sides. A scope cut at a
  # tile boundary, courtyard entrance or bridge end can never create a new kerb.
  fresh = roads.boundary.intersection(current_walk.buffer(0.32)).difference(known)
  fresh = fresh.difference(scope.boundary.buffer(0.6))
  crossings = union(
    s.from_wkb(w).buffer(1.65, cap_style="square") for _, t, w in source["ways"]
  )
  curbs[1].extend(parts(fresh.difference(crossings), "LineString"))
  curbs[3].extend(parts(fresh.intersection(crossings), "LineString"))
  bands = {}
  for code in (1, 2, 3):
    g = union(
      line.buffer(
        0.095 if code == 1 else 0.075, cap_style="flat", join_style="round", quad_segs=2
      )
      for line in curbs[code]
    )
    bands[code] = clean(s.intersection(g, claimed, grid_size=0.01))
  # OSM crossings document the walk alignment; no zebra paint is inferred from a
  # crossing alone. The cycle crossing dashes come from the street survey geometry.
  paint = clean(
    road.intersection(survey.get(("paint", 0.314), Polygon()), grid_size=0.01)
  )
  paint = union([paint, cycle_lane_edges(source["laneAxes"], road)])
  if not paint.is_empty:
    plates["paint", BASE["paint"]] = paint
  return plates, bands, claimed


class Heights:
  """A continuous piecewise-linear envelope over the existing 16 m centre-sampled DGM.

  A corner uses the maximum of the four incident slab samples. Every triangle
  consequently clears both adjoining legacy block tops on an incline. Flat domains
  are unioned by elevation and never tessellated into a regular grid.
  """

  def __init__(self, scope):
    data = json.loads(GROUND.read_bytes())
    h = data["ground_height"]
    self.size = data["cell_m"] * h["stride_cells"]
    self.x0 = data["grid"]["min_x_idx"] * data["cell_m"]
    self.z0 = data["grid"]["min_z_idx"] * data["cell_m"]
    self.dm = np.asarray(h["y_dm"]).reshape(h["rows"], h["cols"])
    x, z, X, Z = scope.bounds
    flat = defaultdict(list)
    regions = []
    levels = []
    for ix in range(
      math.floor((x - self.x0) / self.size), math.ceil((X - self.x0) / self.size)
    ):
      for iz in range(
        math.floor((z - self.z0) / self.size), math.ceil((Z - self.z0) / self.size)
      ):
        a, b = self.x0 + ix * self.size, self.z0 + iz * self.size
        quad = box(a, b, a + self.size, b + self.size)
        if not scope.intersects(quad):
          continue
        ys = [self.corner(ix + u, iz + v) for u, v in ((0, 0), (1, 0), (1, 1), (0, 1))]
        if min(ys) == max(ys):
          flat[ys[0]].append(quad)
        else:
          p = (
            (a, b),
            (a + self.size, b),
            (a + self.size, b + self.size),
            (a, b + self.size),
          )
          for tri in ((0, 1, 2), (0, 2, 3)):
            regions.append(Polygon([p[i] for i in tri]))
            levels.append(None)
    for y, geoms in sorted(flat.items()):
      for g in parts(union(geoms), "Polygon"):
        regions.append(g)
        levels.append(y)
    self.regions = regions
    self.levels = levels
    self.index = s.STRtree(regions)

  @lru_cache(maxsize=32768)
  def corner(self, ix, iz):
    return float(self.dm[iz - 1 : iz + 1, ix - 1 : ix + 1].max()) / 10

  def at(self, x, z):
    px = (x - self.x0) / self.size
    pz = (z - self.z0) / self.size
    i, j = math.floor(px), math.floor(pz)
    u, v = px - i, pz - j
    a = self.corner(i, j)
    c = self.corner(i + 1, j + 1)
    if u > v:
      return a * (1 - u) + self.corner(i + 1, j) * (u - v) + c * v
    return a * (1 - v) + self.corner(i, j + 1) * (v - u) + c * u


def bake(source):
  assert hashlib.sha256(GROUND.read_bytes()).hexdigest() == source["groundSha256"]
  plates, bands, claimed = footprints(source)
  heights = Heights(claimed)
  # Cut the sidewalk nearest a lowered kerb into an actual 80 cm descending
  # strip. Top faces and the drop face share their exact outer station xy.
  lowered = union([bands[2], bands[3]])
  ramp = clean(lowered.buffer(0.8, quad_segs=3)) if not lowered.is_empty else Polygon()
  curb_search = s.STRtree([*parts(bands[2], "Polygon"), *parts(bands[3], "Polygon")])

  def walking_height(x, z):
    if lowered.is_empty:
      return 0.47
    pt = Point(x, z)
    index = curb_search.nearest(pt)
    distance = pt.distance(curb_search.geometries[index])
    return 0.37 + 0.10 * min(distance / 0.8, 1)

  specs = []
  for (tone, h), g in plates.items():
    if h in (0.47, 0.483):
      inter = clean(g.intersection(ramp, grid_size=0.01))
      if not inter.is_empty:
        specs.append((tone, inter, walking_height))
      g = clean(g.difference(ramp, grid_size=0.01))
    specs.append((tone, g, h))
  for code, y in ((1, 0.494), (2, 0.385), (3, 0.372)):
    specs.append(("kerb" if code == 1 else "lowered", bands[code], y))
  OUT.mkdir(exist_ok=True)
  hosts = []
  stats = Counter()
  x, z, X, Z = claimed.bounds
  for tx in range(math.floor(x / 512), math.ceil(X / 512)):
    for tz in range(math.floor(z / 512), math.ceil(Z / 512)):
      tile = box(tx * 512, tz * 512, (tx + 1) * 512, (tz + 1) * 512)
      if not claimed.intersects(tile):
        continue
      packet = Packet(tx, tz)
      local_regions = [
        (heights.regions[i].intersection(tile), heights.levels[i])
        for i in sorted(heights.index.query(tile, predicate="intersects"))
      ]
      for tone, poly, lift in specs:
        local = clean(s.intersection(poly, tile, grid_size=0.01))
        if local.is_empty:
          continue
        for region, fixed in local_regions:
          if not local.intersects(region):
            continue
          patch = s.intersection(local, region, grid_size=0.01)
          for p in parts(patch, "Polygon"):
            if p.area < 0.0002:
              continue
            simplified = p if callable(lift) else p.simplify(0, preserve_topology=True)
            for tri in s.constrained_delaunay_triangles(simplified).geoms:
              pts = list(s.orient_polygons(tri, exterior_cw=True).exterior.coords)[:3]
              packet.facet(
                [
                  (
                    a,
                    (heights.at(a, b) if fixed is None else fixed)
                    + (lift(a, b) if callable(lift) else lift),
                    b,
                  )
                  for a, b in pts
                ],
                PALETTE[tone],
                1 if tone == "promenade" else SIZES.get(tone, 0),
              )
      # Split the visible vertical kerb face at exactly the terrain slopes used
      # above. Coincident patch boundaries share a single face.
      edge = bands[1].boundary.intersection(tile)
      edge_ids = set()
      for region, fixed in local_regions:
        for line in parts(edge.intersection(region), "LineString"):
          points = list(line.simplify(0).coords)
          for (a, b), (c, d) in zip(points, points[1:]):
            key = tuple(
              sorted(
                ((round(a * 100), round(b * 100)), (round(c * 100), round(d * 100)))
              )
            )
            if key in edge_ids:
              continue
            edge_ids.add(key)
            ha = heights.at(a, b) if fixed is None else fixed
            hc = heights.at(c, d) if fixed is None else fixed
            lo, hi = (a, ha + 0.352, b), (a, ha + 0.494, b)
            lo2, hi2 = (c, hc + 0.352, d), (c, hc + 0.494, d)
            packet.facet([lo, hi, hi2], 0x9A968E)
            packet.facet([lo, hi2, lo2], 0x9A968E)
      if not packet.indices:
        continue
      name = f"{tx}_{tz}"
      file = OUT / (name + ".json")
      packet.save(file)
      x0, z0, x1, z1 = claimed.intersection(tile).bounds
      hosts.append(
        {
          "id": "mitte383-street-" + name,
          "bounds": [math.floor(x0), math.floor(z0), math.ceil(x1), math.ceil(z1)],
        }
      )
      stats.update(
        bytes=file.stat().st_size,
        vertices=len(packet.xyz),
        triangles=len(packet.indices) // 3,
      )
  (DATA / "coreMitteStreetsHostsV383.json").write_text(
    json.dumps(hosts, **COMPACT) + "\n"
  )
  report = {
    "tileCount": len(hosts),
    "publicSurfaceM2": round(claimed.area),
    "finishesM2": {
      k: round(sum(g.area for (tone, y), g in plates.items() if k == tone))
      for k in sorted({t for t, _ in plates})
    },
    "kerbBandM2": {str(code): round(g.area, 1) for code, g in bands.items()},
    **stats,
  }
  print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--capture", type=Path)
  args = parser.parse_args()
  src = capture(args.capture) if args.capture else json.load(gzip.open(ARCHIVE))
  bake(src)
