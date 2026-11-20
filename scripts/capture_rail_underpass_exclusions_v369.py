"""Freeze other railway axes that may occupy the ground beneath the new decks.

Run with uv run --no-sync --with osmium python scripts/capture_rail_underpass_exclusions_v369.py berlin.osm.pbf.
"""

from __future__ import annotations

import argparse
import hashlib
from collections import Counter
from pathlib import Path

import numpy as np
import osmium
from build_steel_rail_catalogue_v369 import DATA, EVIDENCE, GEO, OSM, parts, read, save
from pyproj import Transformer
from shapely import STRtree
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

OUTPUT = GEO / "ground-rail-exclusions-v369.json.gz"
TYPES = {
  "rail",
  "light_rail",
  "subway",
  "tram",
  "narrow_gauge",
  "funicular",
  "preserved",
}


def eligible_spans():
  tiles = read(DATA / "steelRailSpansV369.json")["tiles"]
  indexes = Counter()
  for row in read(EVIDENCE)["outlineAudit"]:
    if row["outcome"] != "rendered":
      continue
    host = row["host"]
    span = tiles[host]["drawn"][indexes[host]]
    indexes[host] += 1
    if not span["deck"] or host.startswith("steel369-"):
      continue
    # Include track centres immediately outside the bridge if their ballast
    # or gauge still enters the repaired ground. Widen the offline search a
    # further ten centimetres beyond the actual runtime exclusion buffer.
    yield (
      set(row["trackWays"]),
      Polygon(span["edges"][0] + span["edges"][1][::-1]).buffer(3.10),
    )


def freeze(pbf):
  osm = read(OSM)
  with pbf.open("rb") as handle:
    digest = hashlib.file_digest(handle, "sha256").hexdigest()
  if digest != osm["pbfSha256"]:
    raise ValueError("Expected the PBF used for the carried-track catalogue")
  registered = list(eligible_spans())
  tree = STRtree([plan for ways, plan in registered])
  transform = Transformer.from_crs(4326, 25833, always_xy=True)
  matches = []
  ways = (
    osmium.FileProcessor(str(pbf))
    .with_locations()
    .with_filter(osmium.filter.KeyFilter("railway"))
  )
  for row in ways:
    if not isinstance(row, osmium.osm.Way):
      continue
    t = dict(row.tags)
    if (
      t.get("railway") not in TYPES
      or t.get("tunnel", "no") != "no"
      or t.get("disused") == "yes"
    ):
      continue
    east, north = transform.transform(
      [n.lon for n in row.nodes], [n.lat for n in row.nodes]
    )
    if len(east) < 2:
      continue
    line = LineString(np.c_[np.asarray(east) - 389500, 5820000 - np.asarray(north)])
    cuts = [
      registered[k][1]
      for k in tree.query(line, predicate="intersects")
      if row.id not in registered[k][0]
    ]
    if not cuts:
      continue
    for section in parts(line.intersection(unary_union(cuts))):
      coords = np.round(section.coords, 2).tolist()
      if section.length > 0.04 and coords[0] != coords[-1]:
        matches.append(
          {
            "id": row.id,
            "points": coords,
            "railway": t["railway"],
            "layer": t.get("layer", "0"),
            "bridge": t.get("bridge", "no"),
          }
        )
  save(
    OUTPUT,
    {
      "source": osm["source"],
      "stamp": osm["sourceTimestamp"],
      "pbfSha256": digest,
      "frame": osm["frame"],
      "note": "Active non-tunnel rail axes incl. tram, preserved and narrow gauge, other than the individually known carried tracks for each deck, clipped to a 3.10 m perimeter of lifted, ordinary-packet survey areas. Keep a 3 m strip of previous ground-rail pigment around these axes. A record can represent a separate rail above or below the crossing.",
      "records": sorted(matches, key=lambda r: (r["id"], r["points"])),
    },
  )
  print(
    "Potentially competing rail pieces",
    len(matches),
    "OSM ways",
    len({r["id"] for r in matches}),
    "bytes",
    OUTPUT.stat().st_size,
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("pbf", type=Path)
  freeze(parser.parse_args().pbf)
