"""Extract a compact, temporary city inventory from a Geofabrik OSM PBF.

Usage: uv run --with osmium python scripts/extract_surveyed_paving_v368.py BERLIN.osm.pbf inventory.json.gz
Recompile: uv run python -m scripts.build_surveyed_paving_v368 --inventory inventory.json.gz
"""

import collections
import gzip
import json
import sys

import osmium
from pyproj import Transformer
from shapely import from_wkb, set_precision
from shapely.errors import GEOSException
from shapely.ops import transform

project = Transformer.from_crs(4326, 25833, always_xy=True).transform
path = sys.argv[1]
factory = osmium.geom.WKBFactory()
out = []
counts = collections.Counter()
roles = [
  "highway",
  "area:highway",
  "natural",
  "landuse",
  "landcover",
  "leisure",
  "place",
  "surface",
  "footway",
  "cycleway",
  "area",
  "name",
  "access",
  "width",
  "bridge",
  "tunnel",
  "layer",
  "construction",
  "indoor",
  "covered",
]
for o in (
  osmium.FileProcessor(path)
  .with_locations()
  .with_areas()
  .with_filter(osmium.filter.EntityFilter(osmium.osm.AREA | osmium.osm.WAY))
):
  t = o.tags
  if o.is_area():
    hi = t.get("highway")
    ah = t.get("area:highway")
    nat = t.get("natural")
    lu = t.get("landuse")
    lc = t.get("landcover")
    place = t.get("place")
    if t.get("building") or t.get("indoor") == "yes" or t.get("area") == "no":
      continue
    if (
      ah in {"footway", "pedestrian", "cycleway", "path", "traffic_island"}
      or hi in {"pedestrian", "footway", "cycleway", "path", "living_street"}
      and (t.get("area") == "yes" or hi == "pedestrian")
      or place == "square"
      and t.get("surface")
    ):
      role = "pave"
    elif lu == "grass" or lc in {"grass", "flowerbed"} or nat in {"grassland"}:
      role = "green"
    else:
      continue
    oid = ("w" if o.from_way() else "r") + str(o.orig_id())
    try:
      g = from_wkb(factory.create_multipolygon(o))
    except RuntimeError:
      continue
  elif (
    o.is_way()
    and t.get("highway") in {"cycleway", "footway", "path", "pedestrian", "track"}
    and len(o.nodes) > 1
    and t.get("area") != "yes"
  ):
    pt = o.nodes[0].location
    if not pt.valid():
      continue
    lon, lat = pt.lon, pt.lat
    if not (
      13.106 < lon < 13.201
      and 52.399 < lat < 52.457
      or 13.218 < lon < 13.254
      and 52.509 < lat < 52.525
      or 13.269 < lon < 13.291
      and 52.497 < lat < 52.516
      or 13.371 < lon < 13.433
      and 52.461 < lat < 52.485
    ):
      continue
    role = "path"
    oid = "w" + str(o.id)
    try:
      g = from_wkb(factory.create_linestring(o))
    except RuntimeError:
      continue
  else:
    continue
  if (
    t.get("access") in {"no", "private"}
    or t.get("tunnel") not in (None, "no")
    or t.get("bridge") not in (None, "no")
    or t.get("covered") == "yes"
    or t.get("layer") not in (None, "0")
  ):
    continue
  g = transform(project, g)
  try:
    g = set_precision(g, 0.05)
  except GEOSException:
    continue
  if g.is_empty:
    continue
  out.append([role, oid, {k: t[k] for k in roles if k in t}, g.wkb_hex])
  counts[role] += 1
print(counts, flush=True)
open(sys.argv[2], "wb").write(
  gzip.compress(
    json.dumps(out, separators=(",", ":"), ensure_ascii=False).encode(),
    compresslevel=4,
    mtime=0,
  )
)
