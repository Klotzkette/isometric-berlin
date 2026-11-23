"""Rebuild source-backed hardware stores and IKEA sites from the bounded OSM survey.

`extract WORK` reads the Berlin candidate/context survey, the local Berlin .pbf and
OSM map XML for Waltersdorf. `build` reads the checked-in source and the unchanged
published surrounding navigation packets. No map or tile is modified in place.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import re
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

from shapely import make_valid, orient_polygons, union_all
from shapely.geometry import (
  LineString,
  Point,
  Polygon,
  box,
  mapping,
  shape,
)
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
TILES = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "retail-sites-v378-source.json.gz"
BRANDS = {
  "ikea": "IKEA",
  "bauhaus": "BAUHAUS",
  "obi": "OBI",
  "hellweg": "HELLWEG",
  "hornbach": "HORNBACH",
  "toom baumarkt": "toom",
  "globus baumarkt": "Globus Baumarkt",
  "holz possling": "Holz Possling",
}
IKEA = {
  "way/23490165": "Tempelhof",
  "way/23492513": "Spandau",
  "way/89793912": "Lichtenberg",
  "way/23492662": "Waltersdorf",
  "node/454216856": "Pankow",
  "node/9548281677": "Steglitz",
  "way/1556420080": "Reinickendorf",
}
STUDIO = {"node/454216856", "node/9548281677", "way/1556420080"}
TENANT = STUDIO | {"node/10057200156", "node/416660121"}
# The branch shop node is in the office entrance annex; the attached named sales hall is the proper owner.
PRIMARY = {"node/422779946": "way/26709558", "node/287651023": "way/1089390272"}
STREETS = {
  "way/25056951": "An der Ostbahn",
  "way/27113373": "Salvador-Allende-Straße",
  "way/160953278": "Ferdinand-Schultze-Straße",
  "way/251464504": "Albrecht-Achilles-Straße",
  "way/443454538": "Adlergestell",
}
HOME = {
  "IKEA": "https://www.ikea.com/de/de/stores/ikea-in-berlin-pub36d29cc0/",
  "BAUHAUS": "https://www.bauhaus.info/fachcentren/fachcentrensuche",
  "OBI": "https://www.obi.de/markt",
  "HELLWEG": "https://www.hellweg.de/markt/",
  "HORNBACH": "https://www.hornbach.de/mein-markt/",
  "toom": "https://toom.de/m/",
  "Globus Baumarkt": "https://www.globus-baumarkt.de/info/maerkte/",
  "Holz Possling": "https://www.possling.de/",
}
TAGS = {
  "name",
  "shop",
  "brand",
  "branch",
  "building",
  "building:part",
  "building:levels",
  "height",
  "min_height",
  "roof:shape",
  "roof:colour",
  "building:colour",
  "building:material",
  "addr:street",
  "addr:housenumber",
  "addr:city",
  "entrance",
  "door",
  "access",
  "amenity",
  "parking",
  "parking_space",
  "landuse",
  "area:highway",
  "highway",
  "service",
  "industrial",
  "loading_dock",
  "indoor",
  "level",
  "covered",
  "surface",
  "website",
  "contact:website",
  "capacity",
  "service_times",
  "goods",
  "description",
  "layer",
  "location",
  "delivery",
  "garden_centre",
  "generator:source",
  "power",
}


def packed(path, item):
  data = json.dumps(
    item, ensure_ascii=False, separators=(",", ":"), allow_nan=False
  ).encode()
  path.write_bytes(
    gzip.compress(data, mtime=0) if path.suffix == ".gz" else data + b"\n"
  )


def walk(g, kind):
  if g.geom_type == kind:
    yield g
  elif hasattr(g, "geoms"):
    for s in g.geoms:
      yield from walk(s, kind)


def clean(g):
  return make_valid(g) if not g.is_valid else g


def rr(x):
  return round(float(x), 2)


def qpt(p):
  return [rr(p[0]), rr(p[1])]


def coord(g):
  return qpt(g.coords[0])


def polygon(p):
  p = orient_polygons(p)
  return [[qpt(q) for q in r.coords[:-1]] for r in (p.exterior, *p.interiors)]


def fromring(p):
  return clean(Polygon(p[0], p[1:]))


def trace_row(i, t, g, v):
  return {
    "id": i,
    "version": v,
    "tags": {a: t[a] for a in sorted(t.keys() & TAGS)},
    "geometry": mapping(g),
  }


def xml_rows(path):
  from pyproj import Transformer

  project = Transformer.from_crs(4326, 25833, always_xy=True)
  doc = ET.parse(path).getroot()
  points = {}
  rows = {}
  for o in doc:
    if o.tag not in {"node", "way"}:
      continue
    t = {q.get("k"): q.get("v") for q in o.findall("tag")}
    ident = o.tag + "/" + o.get("id")
    version = int(o.get("version", "0"))
    if o.tag == "node":
      x, n = project.transform(float(o.get("lon")), float(o.get("lat")))
      points[o.get("id")] = [rr(x - 389500), rr(5820000 - n)]
      g = Point(points[o.get("id")])
      if (
        not t.get("entrance")
        and not t.get("door")
        and not t.get("amenity") == "loading_dock"
      ):
        continue
    else:
      pts = [points[q.get("ref")] for q in o.findall("nd") if q.get("ref") in points]
      if len(pts) < 2:
        continue
      g = clean(Polygon(pts)) if len(pts) > 3 and pts[0] == pts[-1] else LineString(pts)
    if t:
      rows[ident] = trace_row(ident, t, g, version)
  return rows


def candidate_review(rows, selected):
  evidence = []
  for key, row in sorted(rows.items()):
    tags = row["tags"]
    if key in EXCLUDE:
      decision = EXCLUDE[key]
    elif key in STUDIO:
      decision = "indoor planning studio"
    elif key in selected:
      decision = "full furniture store" if key in IKEA else "hardware or timber market"
    elif tags.get("shop") == "garden_centre":
      decision = "garden department; check host geometry"
    elif tags.get("shop") == "tiles":
      decision = "tile department; same address as recorded market"
    elif tags.get("shop") == "doityourself":
      decision = "specialist, independent or unclassified DIY source; no verified full-range branch of the seven operators"
    else:
      decision = "other facility, tenant or separate branded building"
    evidence.append(
      {
        "osm": key,
        "name": tags.get("name", ""),
        "shop": tags.get("shop", ""),
        "decision": decision,
      }
    )
  return evidence


def extract(work, pbf):
  rows = json.loads((work / "retail-locations.json").read_bytes())
  cs = json.loads((work / "retail-context.json").read_bytes())
  out = xml_rows(work / "waltersdorf.osm")
  rows["way/23492662"] = out["way/23492662"]
  cs.update(out)
  sites = {}
  scopes = {}
  for key, r in rows.items():
    t = r["tags"]
    brand = BRANDS.get((t.get("brand") or t.get("name", "")).lower())
    if (
      not brand
      or t.get("shop") not in ("doityourself", "furniture")
      and not (
        brand in ("HELLWEG", "toom")
        and t.get("landuse") == "retail"
        or key in {"way/25056951", "way/28721535", "way/1088827579"}
      )
    ):
      continue
    g = clean(shape(r["geometry"]))
    sites[key] = trace_row(key, t, g, r["version"])
    scopes[key] = g.buffer(160 if brand == "IKEA" else 115)
  street_names = {
    r["tags"].get("addr:street") or STREETS.get(k) for k, r in sites.items()
  }
  extra = {}
  geoms = list(scopes.values())
  tree = STRtree(geoms)
  if pbf:
    import osmium
    from pyproj import Transformer

    proj = Transformer.from_crs(4326, 25833, always_xy=True)

    def xz(n):
      x, y = proj.transform(n.lon, n.lat)
      return [rr(x - 389500), rr(5820000 - y)]

    class Access(osmium.SimpleHandler):
      def node(self, o):
        t = o.tags
        if not (
          o.location.valid()
          and (t.get("entrance") or t.get("amenity") == "loading_dock" or t.get("door"))
        ):
          return
        g = Point(xz(o.location))
        k = "node/" + str(o.id)
        if len(tree.query(g, predicate="intersects")):
          extra[k] = trace_row(k, dict(t), g, o.version)

      def way(self, o):
        t = o.tags
        if not (
          t.get("highway")
          and t.get("name") in street_names
          or t.get("generator:source") == "solar"
          or t.get("service") in ("parking_aisle", "driveway", "drive-through")
          or t.get("amenity") in ("parking", "parking_space", "loading_dock")
          or t.get("building") in ("greenhouse", "parking")
          or t.get("landuse") == "retail"
        ):
          return
        if not len(o.nodes) or not o.nodes[0].location.valid():
          return
        if not len(
          tree.query(Point(xz(o.nodes[0].location)).buffer(310), predicate="intersects")
        ):
          return
        pts = [xz(n.location) for n in o.nodes if n.location.valid()]
        if len(pts) < 2:
          return
        g = (
          clean(Polygon(pts)) if len(pts) > 3 and pts[0] == pts[-1] else LineString(pts)
        )
        if not len(tree.query(g, predicate="intersects")):
          return
        k = "way/" + str(o.id)
        extra[k] = trace_row(k, dict(t), g, o.version)

    Access().apply_file(str(pbf), locations=True)
  cs.update(extra)
  selected = {}
  for key, r in sorted(cs.items()):
    g = clean(shape(r["geometry"]))
    t = r["tags"]
    if not len(tree.query(g, predicate="intersects")):
      continue
    if not (
      t.get("highway")
      and t.get("name") in street_names
      or t.get("generator:source") == "solar"
      or t.get("building")
      or t.get("building:part")
      or t.get("entrance")
      or t.get("door")
      or t.get("landuse") == "retail"
      or t.get("amenity") in ("parking", "parking_space", "loading_dock")
      or t.get("service") in ("parking_aisle", "driveway", "drive-through")
    ):
      continue
    selected[key] = trace_row(key, t, g, r["version"])
  return {
    "date": "2026-11-23",
    "osmExtract": "berlin-261122.osm.pbf",
    "osmSha256": hashlib.sha256(pbf.read_bytes()).hexdigest() if pbf else None,
    "waltersdorfSha256": hashlib.sha256(
      (work / "waltersdorf.osm").read_bytes()
    ).hexdigest(),
    "sites": dict(sorted(sites.items())),
    "features": selected,
    "review": candidate_review(rows, sites),
  }


EXCLUDE = {
  "way/160953278": "Former HELLWEG Hohenschönhausen, closed at the end of 2025.",
  "way/251464504": "BAUHAUS Kurfürstendamm drive-in hall belongs to way/945724462.",
}


def geometries(source):
  return {
    k: (clean(shape(v["geometry"])), v["tags"]) for k, v in source["features"].items()
  }


def select_halls(key, g, t, features):
  if key in PRIMARY:
    return [PRIMARY[key]]
  if t.get("building") and g.area > 20:
    return [key] + (["way/251464504"] if key == "way/945724462" else [])
  if key == "way/1556420080":
    return ["relation/20954331"]  # separately mapped indoor unit at the Borsigturm
  if g.area:
    rows = [
      (i, p.area)
      for i, (p, s) in features.items()
      if p.area > 120
      and s.get("building")
      in (
        "retail",
        "commercial",
        "warehouse",
        "industrial",
        "greenhouse",
        "roof",
        "yes",
      )
      and g.intersects(p)
      and g.intersection(p).area / p.area > 0.85
    ]
    return [i for i, _ in sorted(rows, key=lambda pair: -pair[1])]
  hits = [
    (i, p.area) for i, (p, s) in features.items() if s.get("building") and p.covers(g)
  ]
  return [min(hits, key=lambda pair: pair[1])[0]] if hits else []


def select(source):
  features = geometries(source)
  sites = {}
  valid = {k: v for k, v in source["sites"].items() if k not in EXCLUDE}
  for k, r in valid.items():
    t = r["tags"]
    g = clean(shape(r["geometry"]))
    brand = BRANDS[(t.get("brand") or t["name"]).lower()]
    ids = select_halls(k, g, t, features)
    assert ids, (k, t)
    for i in ids:
      if i not in features:
        original = source["sites"][i]
        features[i] = (clean(shape(original["geometry"])), original["tags"])
    footprints = union_all([features[i][0] for i in ids])
    sites[k] = {
      "key": k,
      "brand": brand,
      "geometry": g,
      "halls": ids,
      "footprint": footprints,
      "tags": t,
      "features": defaultdict(list),
    }
  for i, (g, t) in features.items():
    if g.is_empty:
      continue
    kind = ""
    if t.get("generator:source") == "solar" and g.area:
      kind = "solar"
    elif t.get("highway") and t.get("name") and g.geom_type.endswith("LineString"):
      kind = "street"
    elif g.geom_type == "Point" and (t.get("entrance") or t.get("door")):
      kind = "doors"
    elif t.get("amenity") == "loading_dock":
      kind = "loading"
    elif (
      t.get("amenity") == "parking"
      and g.area > 10
      and t.get("parking") not in ("underground", "multi-storey", "rooftop")
      and not t.get("building")
      and t.get("location") != "underground"
    ):
      kind = "parking"
    elif t.get("amenity") == "parking_space" and g.area > 0:
      kind = "bays"
    elif (
      t.get("service") in ("driveway", "parking_aisle", "drive-through")
      and g.geom_type.endswith("LineString")
      and t.get("layer", "0") in ("0", "")
    ):
      kind = "drives"
    elif t.get("landuse") == "retail" and g.area:
      kind = "plots"
    elif (
      t.get("building") == "greenhouse" or t.get("shop") == "garden_centre"
    ) and g.area:
      kind = "garden"
    elif t.get("building:part") and g.area:
      kind = "parts"
    if not kind:
      continue
    maximum = {
      "street": 230,
      "solar": 0,
      "doors": 1.3,
      "loading": 6,
      "parking": 70,
      "bays": 85,
      "drives": 85,
      "plots": 0,
      "garden": 5,
      "parts": 0,
    }[kind]
    candidates = []
    for k, s in sites.items():
      home = s["footprint"]
      d = home.distance(g)
      if kind == "street" and t.get("name") != (
        s["tags"].get("addr:street") or STREETS.get(k)
      ):
        continue
      if kind == "solar" and home.intersection(g).area < 0.9 * g.area:
        continue
      if d > maximum:
        continue
      if kind == "plots" and (
        g.area > home.area * 12 or g.intersection(home).area < home.area * 0.43
      ):
        continue
      if kind == "parts" and g.intersection(home).area < 0.89 * g.area:
        continue
      if kind == "doors" and home.boundary.distance(g) > 1.3:
        continue
      if kind in ("parking", "bays") and home.intersection(g).area > g.area * 0.15:
        continue
      candidates.append((d, home.centroid.distance(g.centroid), k))
    if candidates:
      sites[min(candidates)[2]]["features"][kind].append(i)
  for k, s in sites.items():
    f = s["features"]
    footprint = s["footprint"]
    plot = union_all([features[i][0] for i in f["plots"]])
    eligible = []
    for i in f["parking"]:
      g, t = features[i]
      name = (t.get("name") or "").lower()
      identified = s["brand"].lower() in name
      if (
        t.get("parking")
        in ("street_side", "lane", "layby", "underground", "rooftop", "multi-storey")
        or t.get("access") == "private"
      ):
        continue
      if k in TENANT and not identified:
        continue
      if (
        identified
        or (not plot.is_empty and g.intersection(plot).area >= 0.66 * g.area)
        or (t.get("access") == "customers" and g.distance(footprint) < 52)
      ):
        eligible.append(i)
    f["parking"] = eligible
    parking = union_all([features[i][0] for i in eligible])
    developed = union_all([parking, plot])
    f["bays"] = [
      i for i in f["bays"] if parking.covers(features[i][0].representative_point())
    ]
    f["drives"] = [
      i
      for i in f["drives"]
      if not developed.is_empty
      and developed.intersects(features[i][0])
      and k not in TENANT
    ]
  return sites, features


def positive_id(k):
  return "retail-v378-" + k.replace("/", "-")


def site_name(s):
  k = s["key"]
  t = s["tags"]
  brand = s["brand"]
  return (
    ("IKEA Planungsstudio " if k in STUDIO else "IKEA Berlin-") + IKEA[k]
    if brand == "IKEA"
    else brand + " " + (t.get("addr:street") or STREETS[k])
  )


def trim(source):
  sites, features = select(source)
  needed = (
    set(EXCLUDE)
    | {i for s in sites.values() for i in s["halls"]}
    | {i for s in sites.values() for group in s["features"].values() for i in group}
  )
  source["features"] = {k: r for k, r in source["features"].items() if k in needed}
  return source


def extract_nav(sites):
  from shapely.affinity import translate

  f = json.loads((TILES / "manifest.json").read_bytes())
  sites_geoms = [site["footprint"].buffer(6) for site in sites.values()]
  sitekeys = list(sites)
  tree = STRtree(sites_geoms)
  out = {k: defaultdict(list) for k in sites}
  for d in f["chunks"]:
    indices = tree.query(box(*d["bounds"]), predicate="intersects")
    if not len(indices):
      continue
    for mode in ("drawn", "minecraft"):
      path = TILES / d[mode]["url"]
      c = json.loads(gzip.decompress(path.read_bytes()))
      nav = c["nav"]
      x, y, z = c["origin"]
      for o in nav["buildings"]:
        p = clean(Polygon(o["ring"], o.get("holes", [])))
        if p.is_empty:
          continue
        p = translate(p, xoff=x, yoff=z)
        top = nav["groundY"] + o.get("groundOffset", 0) + o["height"]
        for i in indices:
          if sites_geoms[i].intersects(p) and top > nav["groundY"] + 1.1:
            out[sitekeys[i]][mode].append((p, top, o.get("sourceId", ""), d["id"]))
  # The detailed centre and permanently loaded Alt-Mitte buildings are independent
  # of the streamed city manifest. Their real physical outlines own the same space.
  core = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"

  def include_resident(p, h, source_id, family):
    for i in tree.query(p, predicate="intersects"):
      for mode in ("drawn", "minecraft"):
        out[sitekeys[i]][mode].append((p, h, source_id, family))

  for obj in json.loads(core.read_bytes())["buildings"]:
    outer = [[x / 10, z / 10] for x, z in obj["ring"]]
    holes = [[[x / 10, z / 10] for x, z in ring] for ring in obj["holes"]]
    p = clean(Polygon(outer, holes))
    if obj["h_dm"] > 11:
      include_resident(
        p, (obj["y0_dm"] + obj["h_dm"]) / 10, "core:" + obj["id"], "core-v159"
      )
  for suffix in ("001", "002"):
    part = DATA / "altMitteV169Navigation" / f"packet-{suffix}.json"
    for obj in json.loads(part.read_bytes()):
      if obj["topY"] - obj["groundY"] > 1.1:
        include_resident(
          clean(Polygon(obj["ring"], obj["holes"])),
          obj["topY"],
          obj["sourceId"],
          "resident-alt-mitte-v169",
        )
  return out


def wall_lines(g):
  for p in walk(g, "Polygon"):
    p = orient_polygons(p)
    for ring in (p.exterior, *p.interiors):
      for a, b in zip(ring.coords, list(ring.coords)[1:]):
        if math.dist(a, b) > 0.32:
          yield a, b


def wall_at(pt, g):
  es = [
    (LineString((a, b)).distance(pt), -math.dist(a, b), a, b) for a, b in wall_lines(g)
  ]
  _, _, a, b = min(es)
  return a, b


def surface_front(g, refs, poi, parking):
  edges = list(wall_lines(g))
  if refs:
    rank = {
      "main": 0,
      "yes": 1,
      "shop": 1,
      "shop_entrance": 1,
      "service": 8,
      "exit": 7,
      "emergency": 9,
      "staircase": 6,
    }
    choices = [
      (
        rank.get(tag, 4),
        p.distance(poi)
        if poi
        else (p.distance(parking) if not parking.is_empty else 0),
        i,
        p,
      )
      for i, p, tag in refs
    ]
    _, _, fid, pt = min(choices, key=lambda t: t[:3])
    a, b = wall_at(pt, g)
    line = LineString((a, b))
    door = line.interpolate(line.project(pt))
    return a, b, door, fid
  if not parking.is_empty:
    es = sorted(
      edges,
      key=lambda e: (
        LineString(e).distance(parking) + max(0, 9 - math.dist(*e)) * 4,
        -math.dist(*e),
      ),
    )
    a, b = es[0]
  elif poi:
    a, b = wall_at(poi, g)
  else:
    a, b = max(edges, key=lambda e: math.dist(*e))
  return a, b, LineString((a, b)).interpolate(0.5, normalized=True), None


def measured_height(t, nav, area, kind):
  match = re.match(r"^[\d.]+", t.get("height", ""))
  if match:
    return rr(float(match[0])), "OSM height"
  if nav:
    return rr(
      sorted(nav)[len(nav) // 2] - 3
    ), "vertical envelope of matching base navigation"
  try:
    levels = float(t.get("building:levels", ""))
  except ValueError:
    levels = 0
  if levels:
    return rr(
      min(22, max(3.4, levels * (4.5 if kind == "retail" else 3.2)))
    ), "mapped levels × schematic storey"
  return (
    4.8
    if kind == "greenhouse"
    else (5.5 if kind == "roof" else (8.2 if area > 2500 else 5.2))
  ), "schematic retail height"


def render_polys(g, minarea=1):
  return [
    polygon(p)
    for p in sorted(walk(clean(g), "Polygon"), key=lambda p: -p.area)
    if p.area >= minarea
  ]


def transform_front(a, b, center):
  dx, dz = b[0] - a[0], b[1] - a[1]
  d = math.hypot(dx, dz)
  return qpt(center), [round(dx / d, 5), round(dz / d, 5)]


def front_spec(s, main, features):
  points = [
    (k, features[k][0], features[k][1].get("entrance", "yes"))
    for k in s["features"]["doors"]
    if features[k][0].distance(main.boundary) < 1.4
  ]
  public = [
    v
    for v in points
    if v[2]
    not in ("exit", "emergency", "service", "staircase", "garage", "private", "no")
    and features[v[0]][1].get("access") not in ("private", "no")
  ]
  park = union_all([features[k][0] for k in s["features"]["parking"]])
  poi = s["geometry"] if s["geometry"].geom_type == "Point" else None
  street = union_all([features[i][0] for i in s["features"]["street"]])
  road = street if s["key"] in TENANT or park.is_empty else park
  a, b, center, ref = surface_front(main, public, poi, road)
  c, d = transform_front(a, b, center.coords[0])
  return (
    {
      "centre": c,
      "axis": d,
      "length": rr(math.dist(a, b)),
      "entrance": ref,
      "frontEdge": [qpt(a), qpt(b)],
    },
    points,
    park,
  )


def intersections(gs, g, minarea=2):
  return [
    (p, h, i, k)
    for p, h, i, k in gs
    if p.intersects(g) and p.intersection(g).area > minarea
  ]


def build_site(s, F, nav):
  key = s["key"]
  hallids = s["halls"]
  main = F[hallids[0]][0]
  fs = s["features"]
  info = s["tags"]
  front, doors, parks = front_spec(s, main, F)
  plot = union_all([F[i][0] for i in fs["plots"]])
  limit = union_all([parks, plot])
  buildings = []
  plans = {}
  nav_by_mode = {}
  source_halls = []
  footprint = s["footprint"]
  for fid in list(dict.fromkeys(hallids + fs["garden"])):
    p, t = F[fid]
    kind = (
      "greenhouse"
      if (t.get("building") == "greenhouse" or t.get("shop") == "garden_centre")
      else t.get("building", "retail")
    )
    if (
      fid in fs["garden"]
      and fid not in hallids
      and p.intersection(footprint).area > 0.85 * p.area
    ):
      continue
    matches = intersections(nav.get("drawn", []), p, 4)
    heights = [
      top for g, top, _, _ in matches if g.intersection(p).area > 0.18 * p.area
    ]
    ht, method = measured_height(t, heights, p.area, kind)
    if key == "way/23492662" and fid == key:
      ht, method = (
        10,
        "two mapped storeys; five metres per storey architectural approximation",
      )
    buildings.append((fid, p, kind, ht))
    source_halls.append(
      {
        "id": fid,
        "use": kind,
        "areaM2": rr(p.area),
        "heightM": ht,
        "heightEvidence": method,
      }
    )
  for mode, hosts in ((m, nav.get(m, [])) for m in ("drawn", "minecraft")):
    missing = []
    preserved = []
    for hi, (fid, p, kind, ht) in enumerate(buildings):
      hits = intersections(hosts, p, 1.1)
      cover = union_all([w for w, _, _, _ in hits])
      covered = p.intersection(cover).area / p.area if not cover.is_empty else 0
      # Never add a second envelope over a mapped host (even a clipped building).
      # Small unmapped edge strips are registration differences between ALKIS and OSM.
      gaps = p if not hits else clean(p.difference(cover.buffer(0.75)))
      show = (
        [g for g in walk(gaps, "Polygon") if g.area > max(32, p.area * 0.045)]
        if covered < 0.82
        else []
      )
      if key in STUDIO and key != "way/1556420080":
        show = []  # planning unit inside a multi-tenant host, not a furniture warehouse
      for gap in show:
        new = render_polys(gap)
        sides = []
        for a, b in wall_lines(p):
          if math.dist(a, b) < 0.5:
            continue
          # Only mapped exterior segments may become walls. Cut edges between tiles/owners stay open.
          for line in walk(
            LineString([a, b]).intersection(gap.buffer(0.025)), "LineString"
          ):
            if line.length > 0.45:
              sides.append([qpt(line.coords[0]), qpt(line.coords[-1])])
        for rings in new:
          missing.append(
            {"id": fid, "kind": kind, "height": ht, "rings": rings, "walls": sides}
          )
      preserved.append(
        {
          "id": fid,
          "overlap": round(covered, 4),
          "addedM2": rr(sum(g.area for g in show)),
          "tileIds": sorted({h[3] for h in hits}),
          "owners": sorted({h[2] for h in hits}),
        }
      )
    # Position facade details on either the supplied old vertical mesh or a measured new shell.
    # For block packets the existing stepped perimeter may differ from the OSM tangent.
    oldmain = intersections(hosts, main, 3)
    represent = union_all([a[0] for a in oldmain])
    c = Point(front["centre"])
    admitted = not oldmain or (
      preserved[0]["addedM2"] > 0 and not represent.buffer(0.75).covers(c)
    )
    face = front.copy()
    if not admitted and not represent.is_empty:
      matching = []
      for a, b in wall_lines(represent):
        segment = LineString([a, b])
        direction = transform_front(a, b, a)[1]
        align = direction[0] * front["axis"][0] + direction[1] * front["axis"][1]
        distance = segment.distance(c)
        if distance <= 25 and align > 0.5 and segment.length > 1.1:
          matching.append((distance + max(0, 3 - segment.length), a, b, segment))
      if matching:
        _, a, b, segment = min(matching, key=lambda t: t[0])
        p = segment.interpolate(segment.project(c))
        face["centre"], face["axis"] = transform_front(a, b, p.coords[0])
        face["length"] = rr(segment.length)
        face["registeredOffsetM"] = rr(p.distance(c))
        admitted = True
    door_rows = []
    for oid, point, typ in doors:
      if (
        point.distance(main.boundary) > 1.4
        or key in STUDIO
        and oid != front["entrance"]
      ):
        continue
      base = main
      if (
        oldmain
        and represent.distance(point) < 1
        and represent.boundary.distance(point) < 9
      ):
        base = represent
      e = wall_at(point, base)
      edge_line = LineString(e)
      q = edge_line.interpolate(edge_line.project(point))
      ctr, axis = transform_front(*e, q.coords[0])
      door_rows.append([oid, ctr, axis, typ, rr(edge_line.length)])
    split = []
    for shell in missing:
      rest = fromring(shell["rings"])
      outlines = []
      for i in fs["parts"]:
        part, t = F[i]
        if (
          not (t.get("height") or t.get("building:levels"))
          or t.get("building:part") == "roof"
          or t.get("min_height")
        ):
          continue
        piece = clean(rest.intersection(part))
        if piece.area < 20:
          continue
        height, method = measured_height(t, [], part.area, shell["kind"])
        if abs(height - shell["height"]) < 0.4:
          continue
        for rings in render_polys(piece, 15):
          poly = fromring(rings)
          split.append(
            {
              "id": i,
              "kind": shell["kind"],
              "height": height,
              "rings": rings,
              "walls": [[qpt(a), qpt(b)] for a, b in wall_lines(poly)],
            }
          )
        rest = clean(rest.difference(part))
        outlines.append(i)
      if not outlines:
        split.append(shell)
        continue
      for rings in render_polys(rest, 1):
        poly = fromring(rings)
        split.append(
          {
            **shell,
            "rings": rings,
            "walls": [[qpt(a), qpt(b)] for a, b in wall_lines(poly)],
          }
        )
    plans[mode] = {
      "shells": split,
      "doors": door_rows,
      "front": face if admitted else None,
    }
    nav_by_mode[mode] = preserved
  # Customer courts are limited to their measured site/operator. Preserve private and public road surfaces.
  p_park = clean(parks.difference(footprint))
  courts = (
    clean(plot.difference(union_all([p_park, footprint])))
    if not plot.is_empty and key not in TENANT
    else Polygon()
  )
  if not courts.is_empty and (
    main.area < 2800 or max(v[0]["overlap"] for v in nav_by_mode.values()) > 0.82
  ):
    courts = Polygon()
  if not courts.is_empty:
    courts = clean(courts.intersection(footprint.buffer(38)))
  p_bays = []
  for i in fs["bays"]:
    area = F[i][0]
    if p_park.covers(area.representative_point()):
      p_bays.extend(render_polys(area))
  drive = []
  for i in fs["drives"]:
    g, t = F[i]
    if limit.is_empty:
      continue
    for aisle in walk(clean(g.intersection(limit).difference(footprint)), "LineString"):
      if aisle.length > 2:
        drive.append([qpt(p) for p in aisle.coords])
  # A supplier dock is placed only atop a mapped service/loading feature on an actual wall.
  label = site_name(s)
  fc = front["centre"]
  dx, dz = front["axis"]
  extent_x, w = main.bounds[2] - main.bounds[0], main.bounds[3] - main.bounds[1]
  var = key in STUDIO
  dist = (
    round(max(27, min(210, math.sqrt(max(extent_x, w) * min(extent_x, w)) * 0.8)))
    if not var
    else 34
  )
  nx, nz = dz, -dx
  has_v377 = key in {"way/23492513", "way/23490165"}
  target = [
    rr(fc[0] - nx * min(19, dist * 0.11)),
    rr(4.8 if var else buildings[0][3] * 0.55 + 3),
    rr(fc[1] - nz * min(19, dist * 0.11)),
  ]
  cam = {
    "position": [
      rr(target[0] + (nx * 0.94 + dx * 0.42) * dist),
      rr(target[1] + dist * 0.43),
      rr(target[2] + (nz * 0.94 + dz * 0.42) * dist),
    ],
    "target": target,
    "fov": 47,
  }
  bounds = union_all([footprint, p_park, courts]).bounds
  return (
    {
      "id": positive_id(key),
      "brand": s["brand"],
      "name": label,
      "studio": var,
      "previousFacade": has_v377,
      "height": buildings[0][3],
      "modes": plans,
      "parking": render_polys(p_park, 9),
      "court": render_polys(courts, 12),
      "bays": p_bays,
      "aisles": drive,
      "solar": [rings for i in fs["solar"] for rings in render_polys(F[i][0])],
    },
    {
      "id": positive_id(key),
      "bounds": [rr(v) for v in bounds],
      "name": label,
      "camera": cam,
    },
    {
      "id": positive_id(key),
      "osm": key,
      "name": label,
      "class": "planning-studio"
      if var
      else ("furniture-store" if s["brand"] == "IKEA" else "hardware-store"),
      "brand": s["brand"],
      "address": " ".join(
        v
        for v in [
          info.get("addr:street", STREETS.get(key, "")),
          info.get("addr:housenumber", ""),
        ]
        if v
      ),
      "official": (
        "https://www.ikea.com/de/de/stores/berlin-" + IKEA[key].lower() + "/"
        if s["brand"] == "IKEA"
        else info.get("website", info.get("contact:website", HOME[s["brand"]]))
      ),
      "footprints": source_halls,
      "mappedFeatures": {k: sorted(v) for k, v in fs.items() if v},
      "front": front,
      "coverage": nav_by_mode,
      "previousFacade": has_v377,
    },
  )


def build():
  src = json.loads(gzip.decompress(SOURCE.read_bytes()))
  sites, features = select(src)
  nav = extract_nav(sites)
  plans = []
  index = []
  evidence = []
  for k, s in sites.items():
    p, i, e = build_site(s, features, nav[k])
    if p["modes"]["drawn"] == p["modes"]["minecraft"]:
      p["modes"]["minecraft"] = None
    if k in {"way/89793912", "way/23492662"}:
      measured = features[s["halls"][0]][0]
      doorway = Point(e["front"]["centre"])
      hero = []
      edges = []
      for a, b in wall_lines(measured):
        line = LineString([a, b])
        n = transform_front(a, b, a)[1]
        dot = sum(x * y for x, y in zip(n, e["front"]["axis"]))
        if dot > -0.4:
          for part in walk(
            line.intersection(doorway.buffer(17 if k == "way/89793912" else 14)),
            "LineString",
          ):
            if part.length > 2:
              hero.append([qpt(part.coords[0]), qpt(part.coords[-1])])
        if line.length > 18 and dot > 0.55 and line.distance(doorway) < 60:
          edges.append((line.distance(doorway), line, n))
      p["portal"] = hero
      assert len(hero) >= 2
      if edges:
        _, wall, axis = min(edges, key=lambda t: t[0])
        distance = wall.project(doorway)
        at = min(max(distance, wall.length * 0.28), wall.length * 0.73)
        centre = wall.interpolate(at)
        p["identity"] = {
          "centre": coord(centre),
          "axis": axis,
          "length": rr(min(42, wall.length * 0.7)),
          "entrance": None,
        }
    if k == "way/89793912":
      photo = json.loads((GEO / "retail-lichtenberg-dop-v378.json").read_bytes())
      p["solar"] = [[r] for r in photo["fields"] if s["footprint"].covers(Polygon(r))]
      assert len(p["solar"]) == len(photo["fields"])
      e["measuredRoofFields"] = len(p["solar"])
    plans.append(p)
    index.append(i)
    evidence.append(e)
  groups = defaultdict(list)
  for p, i in zip(plans, index):
    x, z = i["camera"]["target"][0], i["camera"]["target"][2]
    zone = "West" if x < 1800 else ("NorthEast" if z < 1600 else "SouthEast")
    i["zone"] = zone
    groups[zone].append(p)
  packed(DATA / "retailHostsV378.json", index)
  for z, items in groups.items():
    packed(DATA / f"retailSitesV378{z}.json", items)
  packed(
    GEO / "retail-sites-v378-receipt.json",
    {
      "date": src["date"],
      "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
      "excluded": EXCLUDE,
      "candidateReview": src["review"],
      "asBuiltReferences": [
        "https://www.ikea.com/de/de/stores/ikea-in-berlin-pub36d29cc0/",
        "https://www.tagesspiegel.de/berlin/zweitgrosste-ikea-filiale-der-welt-eroffnet-am-montag-7046902.html",
        "https://wlw-1-company-facts-media20191122174836234900000006.s3.eu-central-1.amazonaws.com/9b8e5aa9-9349-4fca-bf3a-60839f69a596.pdf",
        "https://buildingsolutions-deutschland.arcelormittal.com/de/projekt/ikea-berlin-waltersdorf",
        "https://regenwasseragentur.berlin/wp-content/uploads/2025/03/Praesentation-Christmann-lpb.pdf",
      ],
      "transitionSources": [
        "https://www.obi.de/corporate/presse/pm_freigabe_uebernahme",
        "https://newsroom.hornbach.de/pressreleases/hornbach-eroeffnet-neue-maerkte-in-deutschland-und-dem-europaeischen-verbreitungsgebiet-3467757",
        "https://www.berliner-kurier.de/article/hellweg-hohenschoenhausen-muellkippe-ratten-10586004",
        "https://www.mueller-reimann.de/projekte/bauhaus-fachcentrum-berlin-halensee",
      ],
      "sites": evidence,
    },
  )
  print(
    "qualified",
    len(plans),
    dict(Counter(e["class"] for e in evidence)),
    dict(Counter(e["brand"] for e in evidence)),
    flush=True,
  )
  for s, e in zip(plans, evidence):
    print(
      s["name"],
      [
        (
          m,
          len((v or s["modes"]["drawn"])["shells"]),
          bool((v or s["modes"]["drawn"])["front"]),
          len((v or s["modes"]["drawn"])["doors"]),
        )
        for m, v in s["modes"].items()
      ],
      len(s["parking"]),
      flush=True,
    )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  sub = parser.add_subparsers(dest="cmd", required=True)
  e = sub.add_parser("extract")
  e.add_argument("workspace", type=Path)
  e.add_argument("--pbf", type=Path, required=True)
  sub.add_parser("build")
  opts = parser.parse_args()
  if opts.cmd == "extract":
    packed(SOURCE, trim(extract(opts.workspace, opts.pbf)))
  else:
    build()
