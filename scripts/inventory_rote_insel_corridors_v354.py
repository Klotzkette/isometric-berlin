"""Public address-point evidence for the finite V354 streetfront review.

Address points identify a building family, never a particular entrance. Named
Rote-Insel streets are a search set, not an asserted complete quarter boundary.
"""

from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

import pyogrio
from shapely.affinity import translate
from shapely.geometry import Polygon, box, mapping, shape
from shapely.strtree import STRtree

from scripts.build_district_facades_v188 import world
from scripts.build_mcdonalds_inventory_v351 import read, write

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
NAMES = [
  "Yorckstraße",
  "Hohenzollerndamm",
  "Leberstraße",
  "Gustav-Müller-Straße",
  "Gustav-Müller-Platz",
  "Cheruskerstraße",
  "Torgauer Straße",
  "Gotenstraße",
  "Naumannstraße",
  "Kolonnenstraße",
]
PBF = GEO / "raw/city-v346/berlin-2026-11-13.osm.pbf"
OUTPUT = GEO / "rote-insel-corridors-v354-addresses.json.gz"


def inventory():
  frame = pyogrio.read_dataframe(
    PBF,
    layer="points",
    where=" OR ".join("other_tags LIKE '%" + name + "%'" for name in NAMES),
  ).to_crs(25833)
  rows = []
  for raw in frame.to_dict("records"):
    tags = dict(re.findall(r'"([^"]+)"=>"([^"]*)"', raw.get("other_tags") or ""))
    if tags.get("addr:street") not in NAMES:
      continue
    rows.append(
      {
        "id": "node/" + str(raw["osm_id"]),
        "tags": {
          k: v
          for k, v in tags.items()
          if k in ["addr:street", "addr:housenumber", "building:levels"]
        },
        "geometry": mapping(world(raw["geometry"])),
        "hosts": [],
      }
    )
  tree = STRtree([shape(row["geometry"]) for row in rows])
  for desc in read(PUBLIC / "manifest.json")["chunks"]:
    if not len(tree.query(box(*desc["bounds"]))):
      continue
    packet = read(PUBLIC / desc["drawn"]["url"])
    ox, _, oz = packet["origin"]
    for building in packet["nav"]["buildings"]:
      poly = translate(Polygon(building["ring"], building["holes"]), ox, oz)
      if not poly.is_valid:
        continue
      for index in tree.query(poly.buffer(0.05), predicate="intersects"):
        rows[index]["hosts"].append({"host": desc["id"], "owner": building["sourceId"]})
  return rows


def save(rows):
  for row in rows:
    row["hosts"] = sorted(
      [
        dict(host=host, owner=owner)
        for host, owner in {(h["host"], h["owner"]) for h in row["hosts"]}
      ],
      key=lambda h: (h["host"], h["owner"]),
    )
    row["outcome"] = (
      "retained-family-at-address" if row["hosts"] else "no-retained-family-at-address"
    )
  counts = {
    name: dict(
      Counter(row["outcome"] for row in rows if row["tags"]["addr:street"] == name)
    )
    for name in NAMES
  }
  write(
    OUTPUT,
    {
      "schemaVersion": 1,
      "source": "OpenStreetMap contributors / Geofabrik Berlin 2026-11-13",
      "sourceUrl": "https://download.geofabrik.de/europe/germany/berlin.html",
      "baseline": "4bb88fa3",
      "policy": "OSM address-point search only; business points can repeat an address. Exact retained footprint containment with 5cm boundary tolerance; not a complete building census or a frontage/entrance survey.",
      "streets": counts,
      "rows": rows,
    },
  )
  return counts


if __name__ == "__main__":
  print(save(inventory()))
