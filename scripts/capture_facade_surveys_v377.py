"""Rebuild the ALKIS and OpenStreetMap inputs for the selected building facades.

The distributed survey is sufficient to build the viewer offline. A fresh
cadastral response may differ from the fixed 2026-11-23 capture. Install the
optional Python binding 'osmium' to read the dated, checksum-verified OSM PBF.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

from pyproj import Transformer
from shapely import from_wkb, make_valid, union_all
from shapely.affinity import affine_transform
from shapely.geometry import Point, shape
from shapely.ops import transform

from scripts.build_building_facade_profiles_v377 import (
  GEO,
  OSM_SHA,
  capture_surveys,
  load,
  save,
)
from scripts.build_windowless_buildings_v377 import bodies, entity


def footprints(rank):
  tiles = defaultdict(set)
  for target in rank["targets"]:
    for tile in target["tiles"]:
      tiles[tile].add(target["id"])
  parts = defaultdict(list)
  for tile, owners in tiles.items():
    records, _ = bodies(tile, "drawn")
    for record, poly, _, _ in records:
      if entity(record) in owners and poly.area:
        parts[entity(record)].append(
          affine_transform(poly, [1, 0, 0, -1, 389500, 5820000])
        )
  return {owner: union_all(pieces).buffer(0) for owner, pieces in parts.items()}


def capture_cadastral(footprints, cache):
  cache.mkdir(parents=True, exist_ok=True)
  summary = {}
  for owner, footprint in footprints.items():
    path = cache / (owner + ".json.gz")
    if not path.exists():
      box = [
        math.floor(v) if k < 2 else math.ceil(v) for k, v in enumerate(footprint.bounds)
      ]
      query = dict(
        service="WFS",
        version="2.0.0",
        request="GetFeature",
        typeNames="alkis:gebaeudeflaechen",
        bbox=",".join(map(str, box)) + ",EPSG:25833",
        srsName="EPSG:25833",
        outputFormat="application/json",
        count=2000,
      )
      url = "https://gdi.berlin.de/services/wfs/alkis?" + urllib.parse.urlencode(query)
      req = urllib.request.Request(
        url, headers={"User-Agent": "Isometric Berlin facade source verification"}
      )
      with urllib.request.urlopen(req, timeout=45) as response:
        features = json.load(response)["features"]
      if len(features) >= 2000:
        raise ValueError("Incomplete cadastral response for " + owner)
      save(path, dict(url=url, features=features))
    matches = []
    for feature in load(path)["features"]:
      props = feature["properties"]
      if props["bezeich"] != "AX_Gebaeude" or not feature["geometry"]:
        continue
      geom = make_valid(shape(feature["geometry"]))
      common = footprint.intersection(geom).area
      if common < 1:
        continue
      score = common / (geom.area + footprint.area - common)
      matches.append(
        (
          score,
          dict(
            uuid=props["uuid"],
            score=round(score, 4),
            coverage=round(common / footprint.area, 4),
            inside=round(common / geom.area, 4),
            address=[props["namlag"], props["hnr"]],
            usage=props["bezgfk"],
            name=props["nam"],
            levels=props["aog"],
          ),
        )
      )
    summary[owner] = [m[1] for m in sorted(matches, key=lambda m: -m[0])[:4]]
  save(cache / "summary.json", summary)


def capture_osm(footprints, pbf, output):
  import osmium

  with pbf.open("rb") as stream:
    if hashlib.file_digest(stream, "sha256").hexdigest() != OSM_SHA:
      raise ValueError("Expected Geofabrik Berlin 2026-11-22")
  to_geo = Transformer.from_crs(25833, 4326, always_xy=True).transform
  to_utm = Transformer.from_crs(4326, 25833, always_xy=True).transform
  cells = defaultdict(set)
  for owner, footprint in footprints.items():
    x0, y0, x1, y1 = transform(to_geo, footprint.buffer(75)).bounds
    for x in range(math.floor(x0 * 750), math.floor(x1 * 750) + 1):
      for y in range(math.floor(y0 * 750), math.floor(y1 * 750) + 1):
        cells[x, y].add(owner)

  def nearby(x, y):
    return cells.get((math.floor(750 * x), math.floor(750 * y)), ())

  records = {id: dict(buildings=[], entrances=[]) for id in footprints}
  keys = set(
    "name wikidata wikipedia wikimedia_commons building building:part building:use building:levels building:min_level building:material building:colour building:architecture facade:colour facade:material height roof:shape addr:housenumber addr:street historic amenity shop entrance door window windows level highway access ref office industrial craft start_date".split()
  )

  def read(obj, identifier):
    return dict(
      id=identifier,
      version=obj.version,
      tags={tag.k: tag.v for tag in obj.tags if tag.k in keys},
    )

  factory = osmium.geom.WKBFactory()
  for obj in osmium.FileProcessor(str(pbf)).with_locations().with_areas():
    if obj.is_node():
      if not any(obj.tags.get(k) for k in ("entrance", "door", "window")):
        continue
      loc = obj.location
      owners = nearby(loc.lon, loc.lat)
      if not owners:
        continue
      x, y = to_utm(loc.lon, loc.lat)
      for owner in owners:
        dist = footprints[owner].boundary.distance(Point(x, y))
        if dist < 3:
          records[owner]["entrances"].append(
            dict(
              **read(obj, "node/" + str(obj.id)),
              world=[round(x - 389500, 2), round(5820000 - y, 2)],
              dist=round(dist, 2),
            )
          )
    elif obj.is_area() and (obj.tags.get("building") or obj.tags.get("building:part")):
      ring = next(iter(obj.outer_rings()), None)
      if ring is None:
        continue
      owners = set()
      for n in ring:
        if n.location.valid():
          owners.update(nearby(n.lon, n.lat))
      if not owners:
        continue
      try:
        geom = make_valid(transform(to_utm, from_wkb(factory.create_multipolygon(obj))))
      except (ValueError, RuntimeError):
        continue
      for owner in owners:
        poly = footprints[owner]
        common = poly.intersection(geom).area
        if not common:
          continue
        score = common / (poly.area + geom.area - common)
        if score < 0.49995:
          continue
        identifier = ("way/" if obj.from_way() else "relation/") + str(obj.orig_id())
        records[owner]["buildings"].append(
          dict(
            **read(obj, identifier),
            coverage=round(common / poly.area, 4),
            inside=round(common / geom.area, 4),
            iou=round(score, 4),
          )
        )
  for result in records.values():
    result["buildings"].sort(key=lambda row: -row["iou"])
  save(output, records)


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("pbf", type=Path)
  parser.add_argument("cache", type=Path)
  parser.add_argument(
    "--rank", type=Path, default=GEO / "windowless-buildings-v377.json"
  )
  parser.add_argument(
    "--output", type=Path, default=GEO / "building-facade-surveys-v377.json.gz"
  )
  args = parser.parse_args()
  rank = load(args.rank)
  geometry = footprints(rank)
  if set(geometry) != {t["id"] for t in rank["targets"]}:
    raise ValueError("Missing footprint")
  capture_cadastral(geometry, args.cache)
  osm = args.cache / "osm-context.json.gz"
  capture_osm(geometry, args.pbf, osm)
  save(args.output, capture_surveys(rank, args.cache, osm))


if __name__ == "__main__":
  main()
