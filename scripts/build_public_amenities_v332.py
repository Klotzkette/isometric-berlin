"""Compile attributed public amenity locations onto existing Berlin coverage."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

from shapely import STRtree, box, union_all
from shapely.geometry import Point, Polygon, shape

from scripts.build_surrounding_outlines import load_projected_polygon, world

ROOT = Path(__file__).resolve().parents[1]
CELL = 240
EXCLUDED_STATUS = {"restricted", "conditional", "event", "pilot-verify"}
PLAY_TYPES = {
  "swing",
  "slide",
  "seesaw",
  "sandbox",
  "sandpit",
  "climbingframe",
  "climbing_frame",
  "springy",
}
WATER_KEEP = (
  "neptun",
  "weltkugel",
  "rathenau",
  "mierendorff",
  "strausberger",
  "hermann-ehlers",
  "otto-weidt",
  "kanzleramt",
  "orankesee",
  "olympiastadion",
)


def local(easting, northing):
  return round(easting - 389500, 2), round(5820000 - northing, 2)


def cell_key(x, z):
  return f"{math.floor(x / CELL)}_{math.floor(z / CELL)}"


def encoded_ring(ring):
  return [[round(x, 2), round(z, 2)] for x, z in list(ring.coords)[:-1]]


def native_runs(area):
  """Emit only complete cardinal one-metre cells of the measured basin."""
  x0, z0, x1, z1 = area.bounds
  runs = []
  for z in range(math.ceil(z0), math.floor(z1)):
    start = None
    for x in range(math.ceil(x0), math.floor(x1) + 1):
      inside = x < x1 and area.covers(box(x, z, x + 1, z + 1))
      if inside and start is None:
        start = x
      if not inside and start is not None:
        runs.append([start, z, x, z + 1])
        start = None
  return runs


def compile_amenities(inputs, coverage, toilet_variants, recreation, existing_devices):
  counts, skipped, represented = Counter(), Counter(), Counter()
  cells, water_cells = defaultdict(list), defaultdict(list)
  water_ids, device_ids, ids = set(), set(), set()
  tree = STRtree(coverage)

  def covered(point):
    return bool(len(tree.query(point, predicate="intersects")))

  def admit(row):
    site_id, kind = row["id"], row["kind"]
    if site_id in ids:
      raise ValueError(f"Duplicate amenity source identity {site_id}")
    ids.add(site_id)
    counts[kind] += 1
    status = row.get("status", "")
    x, z = local(row["x"], row["y"])
    if status in EXCLUDED_STATUS or not covered(Point(x, z)):
      skipped[kind] += 1
      return False
    model = row.get("model", "")
    if status == "indoor":
      model = ""
    variant = toilet_variants.get(site_id, "")
    name = row["name"]
    address = row.get("address", "")
    cells[cell_key(x, z)].append([site_id, kind, name, x, z, model, variant, address])
    represented[kind] += 1
    return True

  # Preserve exact source location labels even where only a site or address
  # is known. Add physical geometry only when the source supplies its owner.
  for row in sorted(inputs, key=lambda item: item["id"]):
    if not admit(row):
      continue
    site = recreation.get(row["id"], {})
    if row["kind"] == "playground" and not site.get("retainedV255"):
      for device in site.get("mappedDevices", ()):
        source_id = "play-equipment:" + device["id"]
        model = device["tags"].get("playground")
        geom = device["geometry"]
        if (
          model not in PLAY_TYPES
          or geom["type"] != "Point"
          or source_id in device_ids
          or device["id"] in existing_devices
        ):
          continue
        device_ids.add(source_id)
        admit(
          dict(
            id=source_id,
            kind="play-equipment",
            name="",
            model=model,
            x=geom["coordinates"][0],
            y=geom["coordinates"][1],
          )
        )
    if any(
      word in (row["name"] + " " + row.get("address", "")).casefold()
      for word in WATER_KEEP
    ):
      continue
    basins = site.get("enclosedSwimmingPoolPolygons", ())
    fountain = site.get("verifiedMappedFootprint")
    if fountain:
      basins = [fountain]
    for basin in basins:
      if basin["id"] in water_ids or basin["tags"].get("location") == "indoor":
        continue
      geometry = world(shape(basin["geometry"]))
      polygons = getattr(geometry, "geoms", (geometry,))
      for part, polygon in enumerate(polygons):
        if polygon.geom_type != "Polygon" or not 1 <= polygon.area <= 14_000:
          continue
        if not union_all([coverage[i] for i in tree.query(polygon)]).covers(polygon):
          continue
        center = polygon.representative_point()
        water_cells[cell_key(center.x, center.y)].append(
          [
            f"{basin['id']}:{part}",
            row["id"],
            round(center.x, 2),
            round(center.y, 2),
            [encoded_ring(polygon.exterior), *map(encoded_ring, polygon.interiors)],
            native_runs(polygon),
          ]
        )
        water_ids.add(basin["id"])
  return (
    {
      "schemaVersion": 1,
      "cellMeters": CELL,
      "cells": dict(sorted(cells.items())),
      "basins": dict(sorted(water_cells.items())),
    },
    {
      "inputs": dict(counts),
      "placements": dict(represented),
      "excluded": dict(skipped),
      "mappedBasinParts": sum(map(len, water_cells.values())),
    },
  )


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("inputs", type=Path)
  parser.add_argument("output", type=Path)
  parser.add_argument("--receipt", required=True, type=Path)
  args = parser.parse_args()
  sources = {}

  def read(name):
    raw = (args.inputs / name).read_bytes()
    sources[name] = hashlib.sha256(raw).hexdigest()
    return json.loads(raw)

  data = [
    row
    for name in (
      "services.json",
      "recreation.json",
      "police.json",
      "police-supplement.json",
    )
    for row in read(name)
  ]
  facilities = read("toiletten-wfs.geojson")["features"]
  variants = {
    "berlin-toilette:" + f["id"].rsplit(".", 1)[-1]: f["properties"].get("modelltyp")
    or ""
    for f in facilities
  }
  core = world(
    load_projected_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  manifest = json.loads(
    (ROOT / "src/app/public/mesh/surrounding-berlin-v159/manifest.json").read_text()
  )
  coverage = [
    core,
    *[
      Polygon(entry["ring"], entry["holes"]).buffer(0)
      for entry in manifest["footprint"]
    ],
  ]
  owners = read("retained-playground-owners.json")
  existing_devices = {
    site
    for site, owner in owners["parkDetailsRecords"].items()
    if owner["rendersDrawnGeometry"]
  }
  existing_devices.update(owners["mitteHeritageV166MappedFixtures"])
  for emitted in owners["v255ActualEmittedByMode"].values():
    existing_devices.update(emitted)
  result, receipt = compile_amenities(
    data, coverage, variants, read("osm-geometry-evidence.json"), existing_devices
  )
  raw = (json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  args.output.write_bytes(raw)
  args.receipt.write_text(
    json.dumps(
      {
        **receipt,
        "inputSha256": sources,
        "compiledSha256": hashlib.sha256(raw).hexdigest(),
        "compiledBytes": len(raw),
      },
      indent=2,
    )
    + "\n"
  )


if __name__ == "__main__":
  main()
