"""Capture the exact local map inputs used for the named Marzahn landscape."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import pyogrio
from pyproj import Transformer
from shapely.geometry import Polygon, box, mapping, shape
from shapely.ops import transform

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts
from scripts.build_bebelplatz_building_source import part_profile
from scripts.build_surrounding_outlines import (
  source_identity,
  tags_for,
  world,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw"
SOURCE = GEO / "marzahn-gardens-v330-context.json.gz"
PBF = RAW / "marzahn-v230/berlin-260929.osm.pbf"
LOD2_TILES = (
  "402_5821",
  "402_5822",
  "403_5820",
  "403_5821",
  "403_5822",
  "403_5823",
  "404_5820",
  "404_5821",
  "404_5822",
)
TAGS = (
  "name",
  "name:de",
  "highway",
  "surface",
  "width",
  "area",
  "building",
  "height",
  "building:levels",
  "landuse",
  "leisure",
  "natural",
  "water",
  "waterway",
  "bridge",
  "barrier",
  "man_made",
  "aerialway",
  "species",
  "leaf_type",
  "circumference",
  "diameter_crown",
  "tourism",
  "layer",
  "amenity",
  "lit",
  "roller_coaster",
)


def sha(path: Path) -> str:
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def official_buildings(archives, scope):
  buildings, receipts = {}, []
  for archive in archives:
    count = 0
    with zipfile.ZipFile(archive) as bundle:
      for name in bundle.namelist():
        if not name.endswith((".xml", ".gml", ".citygml")):
          continue
        with bundle.open(name) as stream:
          for _, element in ET.iterparse(stream, events=("end",)):
            if element.tag != f"{{{NS['bldg']}}}Building":
              continue
            identity = element.get(GML_ID)
            for part in leaf_building_parts(element) or [element]:
              try:
                record = part_profile(part)
              except ValueError:
                continue
              footprint = Polygon(record["ring"], record["holes"])
              if footprint.intersects(scope) and footprint.area > 0.2:
                key = (identity, record["id"])
                if key not in buildings:
                  buildings[key] = {"parentId": identity, **record}
                  count += 1
            element.clear()
    receipts.append(
      {
        "file": archive.name,
        "sha256": sha(archive),
        "parts": count,
        "url": f"https://gdi.berlin.de/data/a_lod2/atom/{archive.name}",
      }
    )
  return [buildings[key] for key in sorted(buildings)], receipts


def retain(scope, output: Path) -> None:
  project = Transformer.from_crs(25833, 4326, always_xy=True).transform
  # Scope is in the viewer's projected metre frame.
  actual = transform(lambda x, z: (389500 + x, 5820000 - z), scope)
  bbox = transform(project, box(*actual.bounds)).bounds
  mapped = {}
  for layer in ("lines", "multipolygons", "points"):
    frame = pyogrio.read_dataframe(PBF, layer=layer, bbox=bbox).to_crs(25833)
    for _, row in frame.iterrows():
      geometry = row.geometry
      if geometry is None or geometry.is_empty or not geometry.intersects(actual):
        continue
      tags = tags_for(row)
      if layer == "points" and tags.get("natural") != "tree":
        continue
      if layer != "points" and not any(
        tags.get(key)
        for key in (
          "highway",
          "natural",
          "landuse",
          "leisure",
          "building",
          "water",
          "waterway",
          "aerialway",
          "roller_coaster",
          "barrier",
          "man_made",
        )
      ):
        continue
      identity = f"node/{row['osm_id']}" if layer == "points" else source_identity(row)
      properties = {key: tags[key] for key in TAGS if key in tags}
      mapped[layer, identity] = {
        "id": identity,
        "layer": layer,
        "tags": properties,
        "geometry": mapping(world(geometry)),
      }
  archives = []
  for code in LOD2_TILES:
    name = f"LoD2_{code}.zip"
    path = next(
      (
        r / name
        for r in (RAW / "public-fidelity-v326", RAW / "lod2", RAW / "marzahn-v330")
        if (r / name).is_file()
      ),
      None,
    )
    if path is None:
      raise FileNotFoundError(
        f"Retain official tile {name} under {RAW / 'marzahn-v330'}"
      )
    archives.append(path)
  official, receipts = official_buildings(archives, scope)
  result = {
    "schemaVersion": 1,
    "frame": "EPSG:25833 easting minus 389500, 5820000 minus northing",
    "osm": {
      "source": "Geofabrik Berlin 2026-09-29",
      "sha256": sha(PBF),
      "records": [mapped[key] for key in sorted(mapped)],
    },
    "lod2": {
      "source": "Geoportal Berlin LoD2, dl-de/zero-2-0",
      "tiles": receipts,
      "buildings": sorted(official, key=lambda r: r["id"]),
    },
  }
  raw = (
    json.dumps(result, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    + "\n"
  ).encode()
  output.write_bytes(gzip.compress(raw, mtime=0))
  print(f"{len(mapped)} map elements, {len(official)} official building owners")


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--terrain", type=Path, required=True)
  parser.add_argument("--out", type=Path, default=SOURCE)
  args = parser.parse_args()
  raw = args.terrain.read_bytes()
  terrain = json.loads(gzip.decompress(raw) if args.terrain.suffix == ".gz" else raw)
  retain(shape(terrain["scope"]), args.out)


if __name__ == "__main__":
  main()
