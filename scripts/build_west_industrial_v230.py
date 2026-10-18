"""Bounded source preservation for Eiswerder, Reuter-West and Westhafen."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pyogrio
from shapely.geometry import mapping, shape
from shapely.ops import transform, unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_townhall_source_v227 as metric
from build_district_courts_v229 import retained_part
from build_surrounding_outlines import tags_for
from build_townhall_source_v227 import (
  GEO,
  ROOT,
  TO_METRES,
  digest,
  read,
  world_geometry,
  write,
)

OSM = GEO / "west-industrial-osm-v230.json"
SOURCE = GEO / "west-industrial-source-v230.json"
NAMES = {
  "eiswerder": "Insel Eiswerder",
  "reuter-west": "Reuter-West – Naturzugkühlturm Dicke Emma",
  "westhafen": "BEHALA Westhafen – historische Speicher und Lagerhallen",
}
WAREHOUSES = {
  "26929024",  # Warehouse 1 / current WECC
  "26929021",  # Warehouse 2
  "26929022",  # Warehouse 3
  "26929025",  # Grain store, not Zollspeicher
  "26929059",  # Separately mapped grain silo
  "26929020",  # Halle 5
  "26929057",  # Halle 12
  "26932924",  # Halle 7a
  "26932923",  # Halle 7
  "26932921",  # Halle 11
  "26929058",  # Halle 11a
  "26929018",  # Halle 4
  "26932922",  # Halle 8
  "26929310",  # Historic administration / BEHALA tower
  "26929311",  # Casino
}


def record(row: dict) -> dict:
  """Keep exact OSM rings and tags from the retained dated PBF conversion."""
  tags = tags_for(row)
  way = tags.get("osm_way_id")
  return dict(
    id=("way/" + way if way else "relation/" + tags["osm_id"]),
    tags=tags,
    geometry=mapping(row["geometry"]),
  )


def extract_osm() -> None:
  """Use retained complete source caches; never regenerate surrounding districts."""
  outside = GEO / "raw/outskirts-v187/candidate.gpkg"
  central = GEO / "raw/outer-v159/candidate.gpkg"
  areas = pyogrio.read_dataframe(
    outside, layer="multipolygons", bbox=(13.214, 52.533, 13.241, 52.552)
  )
  island = areas[areas.osm_way_id == "23403130"].iloc[0].to_dict()
  cooling = areas[areas.osm_way_id == "26131445"].iloc[0].to_dict()
  outline = island["geometry"]
  buildings, context = [], []
  for row in areas.to_dict("records"):
    geometry, tags = row["geometry"], tags_for(row)
    if not geometry.intersects(outline):
      continue
    if (
      tags.get("building") and geometry.intersection(outline).area / geometry.area > 0.9
    ):
      buildings.append(record(row))
    elif any(k in tags for k in ("natural", "landuse", "leisure", "amenity")):
      context.append(record(row))
  paths = []
  for row in pyogrio.read_dataframe(
    outside, layer="lines", bbox=outline.buffer(0.002).bounds
  ).to_dict("records"):
    tags = tags_for(row)
    if row["geometry"].intersects(outline) and any(
      k in tags for k in ("highway", "railway", "barrier")
    ):
      paths.append(record(row))
  westhafen = []
  for row in pyogrio.read_dataframe(
    central, layer="multipolygons", bbox=(13.328, 52.535, 13.344, 52.54)
  ).to_dict("records"):
    if tags_for(row).get("osm_way_id") in WAREHOUSES:
      westhafen.append(record(row))
  assert len(westhafen) == len(WAREHOUSES)
  write(
    OSM,
    dict(
      source="https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      retainedCaches=[
        dict(path=str(p.relative_to(ROOT)), sha256=digest(p))
        for p in [outside, central]
      ],
      sites=[
        dict(
          key="eiswerder",
          name=NAMES["eiswerder"],
          osm=buildings,
          island=record(island),
          context=context,
          paths=paths,
        ),
        dict(key="reuter-west", name=NAMES["reuter-west"], osm=[record(cooling)]),
        dict(key="westhafen", name=NAMES["westhafen"], osm=westhafen),
      ],
    ),
  )


def extract_source() -> None:
  metric.OSM = OSM
  metric.NAMES = NAMES
  metric.part_profile = retained_part
  source = metric.extract_sources()
  # The island boundary itself is authority for the requested extent; do not
  # confuse nearby Pionierinsel or the water polygon with additional new land.
  previous = unary_union(
    [
      transform(TO_METRES, shape(feature["geometry"]))
      for name in [
        "bounds.geojson",
        "bounds-ring-v182.geojson",
        "bounds-city-v183.geojson",
        "bounds-outskirts-v187.geojson",
        "bounds-north-v190.geojson",
        "bounds-named-v194.geojson",
        "bounds-named-v198.geojson",
        "bounds-regional-v200.geojson",
        "bounds-prisons-memorials-v209.geojson",
      ]
      for feature in read(GEO / name)["features"]
    ]
  )
  for site in source["sites"]:
    extent = (
      transform(TO_METRES, shape(site["island"]["geometry"]))
      if site["key"] == "eiswerder"
      else unary_union(
        [transform(TO_METRES, shape(r["geometry"])) for r in site["osm"]]
      )
    )
    site["worldExtent"] = mapping(world_geometry(extent))
    site["newOnlyExtent"] = mapping(world_geometry(extent.difference(previous)))
    site["newOnlyAreaM2"] = extent.difference(previous).area
  for site in source["sites"]:
    site["previousOwners"] = (
      ["OSM-" + row["id"].replace("/", "-") for row in site["osm"]]
      if site["key"] == "eiswerder"
      else [p["id"] for p in site["parents"]]
      if site["key"] == "westhafen"
      else []
    )
    for parent in site["parents"]:
      parent["rigidYOffset"] = round(
        3 - min(p["ground_y_m"] for p in parent["parts"]), 3
      )
  source["policy"] = (
    "Whole exact Eiswerder island and its original mapped context; only named "
    "Reuter-West cooling-tower footprint and listed Westhafen warehouse owners. "
    "No district fill. Source roofs, courtyards, and existing dedicated Zollspeicher "
    "v229 details are protected. Construction arrays are weak and mode-specific."
  )
  write(SOURCE, source)
  for site in source["sites"]:
    print(
      site["key"], "parents", len(site["parents"]), "newArea", site["newOnlyAreaM2"]
    )


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  if args.extract:
    extract_osm()
    extract_source()
