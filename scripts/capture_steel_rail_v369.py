"""Capture OSM bridge outlines, holes and active elevated railway ways inside Berlin.

Run with uv run --with osmium python scripts/capture_steel_rail_v369.py berlin.osm.pbf.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path

import osmium
from pyproj import Transformer
from shapely import STRtree
from shapely.geometry import LineString, Polygon, shape
from shapely.prepared import prep

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
BOUNDARY = GEO / "raw/berlin-boundaries-v200/landesgrenze.geojson"
OUTPUT = GEO / "steel-rail-osm-v369.json.gz"
RAIL = {"rail", "light_rail", "subway"}
TAGS = {
  "railway",
  "operator",
  "name",
  "bridge:name",
  "bridge",
  "bridge:structure",
  "bridge:material",
  "material",
  "layer",
  "gauge",
  "ref",
  "ref:lda",
  "man_made",
  "height",
  "min_height",
  "bridge:movable",
  "access",
  "construction",
  "disused",
  "bridge:colour",
  "tunnel",
  "usage",
  "service",
  "start_date",
  "building",
}


def world(coords):
  return [[round(x - 389500, 2), round(5820000 - y, 2)] for x, y in coords]


def capture(pbf: Path) -> None:
  transform = Transformer.from_crs(4326, 25833, always_xy=True)
  boundary = prep(shape(json.loads(BOUNDARY.read_bytes())["features"][0]["geometry"]))
  ways = []
  relations = set()
  feats = (
    osmium.FileProcessor(str(pbf))
    .with_locations()
    .with_filter(osmium.filter.KeyFilter("bridge", "man_made"))
  )
  for obj in feats:
    tags = dict(obj.tags)
    outline = tags.get("man_made") == "bridge"
    track = tags.get("railway") in RAIL and tags.get("bridge") not in {
      None,
      "no",
      "false",
      "0",
    }
    if not (track or outline):
      continue
    if isinstance(obj, osmium.osm.Relation):
      if outline and tags.get("type") == "multipolygon":
        relations.add(obj.id)
      continue
    if not isinstance(obj, osmium.osm.Way):
      continue
    coords = [transform.transform(n.lon, n.lat) for n in obj.nodes]
    if len(coords) < 2 or not boundary.intersects(LineString(coords)):
      continue
    ways.append(
      {
        "id": obj.id,
        "tags": {k: tags[k] for k in sorted(TAGS & tags.keys())},
        "points": world(coords),
      }
    )
  # Relations can have untagged, partial member ways and multiple shells or holes.
  outlines = []
  if relations:
    feats = (
      osmium.FileProcessor(str(pbf))
      .with_locations()
      .with_areas()
      .with_filter(osmium.filter.EntityFilter(osmium.osm.AREA))
      .with_filter(osmium.filter.TagFilter(("man_made", "bridge")))
    )
    for area in feats:
      if area.from_way() or area.orig_id() not in relations:
        continue
      tags = dict(area.tags)
      for part, outer in enumerate(area.outer_rings()):
        ext = [transform.transform(n.lon, n.lat) for n in outer]
        if not boundary.intersects(Polygon(ext)):
          continue
        holes = [
          world([transform.transform(n.lon, n.lat) for n in ring])
          for ring in area.inner_rings(outer)
        ]
        outlines.append(
          {
            "id": f"r{area.orig_id()}-{part}",
            "tags": {k: tags[k] for k in sorted(TAGS & tags.keys())},
            "points": world(ext),
            "holes": holes,
          }
        )
  # Some long Stadtbahn tracks carry no bridge tag at individual street gaps.
  # Keep their geometry as separate evidence; matching them later needs an
  # independently documented rail bridge and corroborating carried route.
  shells = []
  for way in ways + outlines:
    if (
      way["tags"].get("man_made") == "bridge"
      and len(way["points"]) > 3
      and way["points"][0] == way["points"][-1]
    ):
      shell = Polygon(way["points"], way.get("holes", []))
      if shell.is_valid and shell.area > 5:
        shells.append(shell)
  tree = STRtree(shells)
  missing_tags = []
  feats = (
    osmium.FileProcessor(str(pbf))
    .with_locations()
    .with_filter(osmium.filter.KeyFilter("railway"))
  )
  for obj in feats:
    if not isinstance(obj, osmium.osm.Way):
      continue
    tags = dict(obj.tags)
    if (
      tags.get("railway") not in RAIL
      or "bridge" in tags
      or tags.get("tunnel", "no") != "no"
      or tags.get("layer", "1").startswith("-")
    ):
      continue
    coords = world([transform.transform(n.lon, n.lat) for n in obj.nodes])
    if len(coords) < 2:
      continue
    line = LineString(coords)
    if any(shells[k].intersection(line).length > 3 for k in tree.query(line)):
      missing_tags.append(
        {
          "id": obj.id,
          "tags": {k: tags[k] for k in sorted(TAGS & tags.keys())},
          "points": coords,
        }
      )
  with osmium.io.Reader(str(pbf)) as reader:
    timestamp = reader.header().get("osmosis_replication_timestamp")
  with pbf.open("rb") as f:
    pbf_digest = hashlib.file_digest(f, "sha256").hexdigest()
  data = {
    "source": "OpenStreetMap contributors, ODbL 1.0; Geofabrik Berlin extract",
    "sourceURL": "https://download.geofabrik.de/europe/germany/berlin.html",
    "sourceTimestamp": timestamp,
    "pbfSha256": pbf_digest,
    "boundarySha256": hashlib.sha256(BOUNDARY.read_bytes()).hexdigest(),
    "frame": "EPSG:25833 metres x=E-389500, z=5820000-N; centimetre rounding.",
    "otherRailWaysCrossingOutlines": sorted(missing_tags, key=lambda o: o["id"]),
    "ways": sorted(ways, key=lambda o: o["id"]),
    "relations": sorted(outlines, key=lambda o: o["id"]),
  }
  raw = (json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  OUTPUT.write_bytes(gzip.compress(raw, mtime=0))
  print(len(ways), len(outlines), timestamp)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("pbf", type=Path)
  capture(parser.parse_args().pbf)
