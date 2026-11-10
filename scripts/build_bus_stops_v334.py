"""Extract all passenger-serving bus berths inside Berlin from a VBB GTFS snapshot."""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

from pyproj import Transformer
from shapely import STRtree, Point, Polygon, prepare, union_all
from shapely.geometry import shape

from scripts.build_surrounding_outlines import load_projected_polygon, world

ROOT = Path(__file__).resolve().parents[1]
CELL = 220
FILE = "bus-stops-v334.json.gz"
CRS = "urn:ogc:def:crs:EPSG::25833"
REPLACEMENT_LINE = re.compile(r"^[US]\d+[A-Z]?$")
REPLACEMENT_TEXT = re.compile(r"ersatzverkehr|\bsev\b", re.IGNORECASE)


def csv_rows(archive, name):
  with io.TextIOWrapper(archive.open(name), encoding="utf-8-sig", newline="") as stream:
    yield from csv.DictReader(stream)


def require_projection(source):
  if source["crs"]["properties"]["name"] != CRS:
    raise ValueError("Berlin open data must be in EPSG:25833")
  if source["numberMatched"] != source["numberReturned"] or len(source["features"]) != source["numberReturned"]:
    raise ValueError("WFS response is incomplete")


def berlin_bus_berths(gtfs, boundary):
  to_utm = Transformer.from_crs(4326, 25833, always_xy=True)
  with zipfile.ZipFile(gtfs) as archive:
    bus_routes = {}
    for row in csv_rows(archive, "routes.txt"):
      route_type = int(row["route_type"])
      if route_type == 3 or 700 <= route_type <= 799:
        explicit = REPLACEMENT_TEXT.search(f"{row['route_long_name']} {row['route_desc']}")
        line = REPLACEMENT_LINE.fullmatch(row["route_short_name"])
        bus_routes[row["route_id"]] = 2 if explicit or line else 1
    bus_trips = {
      row["trip_id"].encode(): bus_routes[row["route_id"]]
      for row in csv_rows(archive, "trips.txt")
      if row["route_id"] in bus_routes
    }
    berths = {}
    for row in csv_rows(archive, "stops.txt"):
      if row["location_type"] != "0":
        continue
      x, y = to_utm.transform(float(row["stop_lon"]), float(row["stop_lat"]))
      if boundary.covers(Point(x, y)):
        berth = row["stop_id"].encode()
        if berth in berths:
          raise ValueError(f"Duplicate VBB berth {berth!r}")
        berths[berth] = (row, x, y)

    # These five GTFS fields have no embedded commas in this export. Avoid
    # retaining the 400 MB stop-time table or decoding fields we never use.
    served = {}
    with archive.open("stop_times.txt") as stream:
      if next(stream).split(b",", 5)[:5] != [
        b"trip_id", b"stop_id", b"stop_sequence", b"pickup_type", b"drop_off_type"
      ]:
        raise ValueError("Unexpected VBB stop_times column order")
      for line in stream:
        trip, stop, _, pickup, dropoff, _ = line.split(b",", 5)
        key = stop.strip(b'"')
        if key not in berths or (pickup == b"1" and dropoff == b"1"):
          continue
        if access := bus_trips.get(trip):
          served[key] = served.get(key, 0) | access

    for key in sorted(served):
      row, easting, northing = berths[key]
      explicit = REPLACEMENT_TEXT.search(f"{row['stop_name']} {row['stop_desc']}")
      yield (
        row["stop_id"],
        row["stop_name"],
        easting,
        northing,
        row["platform_code"],
        bool(explicit or served[key] == 2),
      )


def compact(obj):
  return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def digest(path):
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--gtfs", required=True, type=Path)
  parser.add_argument("--bvg", required=True, type=Path)
  parser.add_argument("--alkis", required=True, type=Path)
  args = parser.parse_args()

  alkis = json.loads(args.alkis.read_bytes())
  bvg = json.loads(args.bvg.read_bytes())
  require_projection(alkis)
  require_projection(bvg)
  berlin = union_all([shape(feature["geometry"]) for feature in alkis["features"]])
  prepare(berlin)
  bvg_berlin = [
    feature for feature in bvg["features"]
    if berlin.covers(Point(*feature["geometry"]["coordinates"][0]))
  ]

  scene = ROOT / "src/app/public/mesh/surrounding-berlin-v159/manifest.json"
  bounds = ROOT / "geo_data/regierungsviertel/bounds.geojson"
  footprint = [
    world(load_projected_polygon(bounds)),
    *(Polygon(item["ring"], item["holes"]).buffer(0)
      for item in json.loads(scene.read_bytes())["footprint"]),
  ]
  terrain_index = STRtree(footprint)
  names = {}
  cells = defaultdict(list)
  totals = Counter()
  for stop_id, name, easting, northing, platform, replacement in berlin_bus_berths(args.gtfs, berlin):
    if not name or len(name) > 180 or len(stop_id) > 80 or len(platform) > 20:
      raise ValueError(f"Unexpected GTFS stop text for {stop_id!r}")
    x, z = round(easting - 389500, 2), round(5820000 - northing, 2)
    cell = f"{math.floor(x / CELL)}_{math.floor(z / CELL)}"
    name_index = names.setdefault(name, len(names))
    cells[cell].append([stop_id, name_index, x, z, platform, int(replacement)])
    totals["berths"] += 1
    totals["replacement"] += int(replacement)
    covered = bool(len(terrain_index.query(Point(x, z), predicate="intersects")))
    totals["retainedFootprint"] += covered
    totals["retainedFootprintReplacement"] += covered and replacement

  raw = (compact({"cellMeters": CELL, "names": list(names), "cells": dict(sorted(cells.items()))}) + "\n").encode()
  packed = gzip.compress(raw, compresslevel=9, mtime=0)
  receipt = {
    "file": FILE,
    "sha256": hashlib.sha256(packed).hexdigest(),
    "rawBytes": len(raw),
    "packedBytes": len(packed),
    "berths": totals["berths"],
  }
  (ROOT / "src/app/public/mesh/regierungsviertel" / FILE).write_bytes(packed)
  (ROOT / "src/app/src/data/busStopsV334Receipt.json").write_text(compact(receipt) + "\n")
  evidence = {
    "version": "v334",
    "busSource": "VBB Verkehrsverbund Berlin-Brandenburg GmbH (CC BY 4.0)",
    "inputs": {path.name: digest(path) for path in [args.gtfs, args.alkis, args.bvg, scene, bounds]},
    "bvgServiceTimestamp": bvg["timeStamp"],
    "bvgUndisturbedNetworkPoints": bvg["numberReturned"],
    "bvgUndisturbedBerlinPoints": len(bvg_berlin),
    "bvgUndisturbedBerlinExactCoordinateLocations": len({
      tuple(feature["geometry"]["coordinates"][0]) for feature in bvg_berlin
    }),
    "alkisTimestamp": alkis["timeStamp"],
    "gtfs": dict(totals),
    "names": len(names),
    "cells": len(cells),
    "product": receipt,
  }
  (ROOT / "geo_data/regierungsviertel/bus-stops-v334-evidence.json").write_text(
    json.dumps(evidence, indent=2, ensure_ascii=False) + "\n"
  )
  print(json.dumps(evidence, indent=2, ensure_ascii=False))


if __name__ == "__main__":
  main()
