#!/usr/bin/env python3
"""Extract the OSM survey used by Berlin waterway packets, including relation holes."""

import argparse
import gzip
import hashlib
import json
import pathlib

import osmium
from shapely import from_wkb
from shapely.geometry import mapping

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("pbf", type=pathlib.Path)
parser.add_argument("work", type=pathlib.Path)
args = parser.parse_args()
P = args.work
P.mkdir(parents=True, exist_ok=True)
digest = hashlib.file_digest(args.pbf.open("rb"), "sha256").hexdigest()
if digest != "56551452bd0656d371ac473216324b679879eddf2a40f417ce9330a7f065c00d":
  raise ValueError(
    "Expected berlin-261122.osm.pbf; revalidate both source inventories for a new edition"
  )

keys = set(
  "name official_name name:de loc_name alt_name bridge bridge:name bridge:structure bridge:movable bridge:material bridge:levels railway highway waterway water natural landuse man_made waterway:type barrier fence_type surface leisure access foot bicycle motor_vehicle handrail handrail:left handrail:right railing kerb width width:lanes est_width lanes sidewalk sidewalk:left sidewalk:right cycleway building covered tunnel layer level historic start_date wikidata material height tidal intermittent boat boat:conditional waterway:traffic_direction ref service area lock landcover shore backrest".split()
)


def base(o, geo, typ, id):
  return [typ + str(id), o.version, {t.k: t.v for t in o.tags if t.k in keys}, geo]


def point(n):
  return [round(n.lon, 7), round(n.lat, 7)]


poly = {"water": [], "shrubs": [], "decks": []}
ways = {
  "axis": [],
  "cross": [],
  "paths": [],
  "fences": [],
  "local-cross": [],
  "lights": [],
}
cross_types = {
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "unclassified",
  "residential",
  "motorway_link",
  "trunk_link",
  "primary_link",
  "secondary_link",
  "tertiary_link",
  "service",
  "living_street",
  "track",
  "footway",
  "path",
  "pedestrian",
  "cycleway",
  "steps",
  "bridleway",
}


def nonempty(v):
  return v not in (None, "no", "")


wkb = osmium.geom.WKBFactory()


def dump(n, v):
  (P / (n + ".json.gz")).write_bytes(
    gzip.compress(
      json.dumps(v, separators=(",", ":"), ensure_ascii=False).encode(),
      compresslevel=3,
      mtime=0,
    )
  )


f = osmium.FileProcessor(str(args.pbf)).with_locations().with_areas()
for o in f:
  tg = o.tags
  if (
    o.is_node()
    and tg.get("highway") == "street_lamp"
    and o.location.valid()
    and 13.413 < o.lon < 13.417
    and 52.494 < o.lat < 52.497
  ):
    ways["lights"].append(["n" + str(o.id), o.version, dict(tg), point(o)])
  if o.is_way():
    wt = tg.get("waterway")
    hw = tg.get("highway")
    rail = tg.get("railway")
    bar = tg.get("barrier")
    cl = []
    if wt in ("canal", "river", "stream", "ditch", "drain", "weir", "lock_gate", "dam"):
      cl.append("axis")
    if (hw in cross_types or rail or tg.get("man_made") in ("pipeline", "bridge")) and (
      nonempty(tg.get("bridge"))
      or nonempty(tg.get("tunnel"))
      or "bridge:name" in tg
      or "bridge:structure" in tg
    ):
      cl.append("cross")
    if (
      hw in ("footway", "path", "pedestrian", "cycleway", "bridleway", "steps", "track")
      and tg.get("area") != "yes"
      and tg.get("access") not in ("no", "private")
      and not tg.get("indoor")
    ):
      cl.append("paths")
    if bar in ("railing", "guard_rail", "handrail", "hedge", "fence") or tg.get(
      "man_made"
    ) in ("quay", "embankment"):
      cl.append("fences")
    local = (
      hw
      or rail
      or tg.get("man_made") == "pipeline"
      or wt in ("lock_gate", "weir", "dam")
    )
    if (
      local
      and len(o.nodes) > 1
      and any(
        n.location.valid() and 13.30 < n.lon < 13.47 and 52.48 < n.lat < 52.53
        for n in o.nodes
      )
    ):
      cl.append("local-cross")
    if cl:
      coords = [point(n) for n in o.nodes if n.location.valid()]
      if len(coords) >= 2:
        b = base(o, coords, "w", o.id)
        for k in cl:
          ways[k].append([b[0], b[1], dict(tg), b[3]] if k == "local-cross" else b)
  elif o.is_area():
    k = None
    if tg.get("natural") == "water" or tg.get("waterway") == "riverbank":
      k = "water"
    if tg.get("natural") in ("scrub", "shrubbery", "reedbed") or tg.get(
      "landcover"
    ) in ("shrubs", "scrub", "shrubbery", "reeds"):
      k = "shrubs"
    if tg.get("man_made") == "bridge":
      k = "decks"
    if k:
      try:
        g = from_wkb(wkb.create_multipolygon(o))
      except (ValueError, RuntimeError):
        continue
      poly[k].append(
        base(o, mapping(g)["coordinates"], "w" if o.from_way() else "r", o.orig_id())
      )
for k, v in (ways | poly).items():
  dump(k, v)
  print(k, len(v), flush=True)
