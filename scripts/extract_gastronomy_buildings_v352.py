"""Exact mapped building geometry for current exterior restaurant identities."""

from collections import defaultdict

import pyogrio
from shapely.geometry import Point, mapping
from shapely.ops import transform
from shapely.strtree import STRtree

from scripts.build_mcdonalds_inventory_v351 import (
  GEO,
  PBF,
  PROJECTION,
  ROOT,
  address_key,
  read,
  sha,
  tags,
  write,
)

INVENTORY = GEO / "gastronomy-v352-inventory.json.gz"
OUT = GEO / "gastronomy-v352-address-buildings.json.gz"


def extract():
  inv = read(INVENTORY)
  inv["records"] = [
    r for r in inv["records"] if not r.get("preOutcome") and "easting" in r
  ]
  targets = defaultdict(list)
  for r in inv["records"]:
    for street, house, zip in [
      (r["street"], "", r["postcode"]),
      (
        r["mappedTags"].get("addr:street", ""),
        r["mappedTags"].get("addr:housenumber", ""),
        r["mappedTags"].get("addr:postcode", ""),
      ),
    ]:
      key = address_key(street, house, zip)
      if key and r["id"] not in targets[key]:
        targets[key].append(r["id"])
  points = [Point(r["easting"], r["northing"]) for r in inv["records"]]
  tree = STRtree(points)
  frame = pyogrio.read_dataframe(
    PBF,
    layer="multipolygons",
    columns=["osm_id", "osm_way_id", "building", "other_tags"],
    where="building IS NOT NULL AND building != 'no'",
  )
  found = []
  byaddress = defaultdict(list)
  for _, row in frame.iterrows():
    meta = tags(row.other_tags)
    key = address_key(
      meta.get("addr:street"), meta.get("addr:housenumber"), meta.get("addr:postcode")
    )
    g = transform(PROJECTION, row.geometry)
    indices = list(tree.query(g, predicate="covers"))
    if not indices and key not in targets:
      continue
    world = transform(lambda x, y, z=None: (x - 389500, 5820000 - y), g)
    fid = (
      "way/" + str(row.osm_way_id)
      if isinstance(row.osm_way_id, str)
      else "relation/" + str(row.osm_id)
    )
    entry = {
      "type": "Feature",
      "properties": {
        "osmId": fid,
        "facilityIds": sorted(set(inv["records"][int(i)]["id"] for i in indices)),
        "building": row.building,
        "tags": {
          k: v
          for k, v in meta.items()
          if k.startswith(("addr:", "building:", "roof:"))
          or k in {"height", "levels", "min_height", "name"}
        },
      },
      "geometry": mapping(world),
    }
    found.append(entry)
    if key in targets:
      byaddress[key].append(entry)
  for key, entries in byaddress.items():
    if len(entries) == 1:
      entries[0]["properties"]["facilityIds"] = sorted(
        set(entries[0]["properties"]["facilityIds"] + targets[key])
      )
  value = {
    "schemaVersion": 1,
    "source": {
      "pbf": str(PBF.relative_to(ROOT)),
      "inventories": [
        {
          "path": str(INVENTORY.relative_to(ROOT)),
          "sha256": sha(INVENTORY.read_bytes()),
        }
      ],
    },
    "features": found,
    "audit": {
      "buildingRecords": len(found),
      "uniqueAddressKeys": sum(len(v) == 1 for v in byaddress.values()),
      "ambiguousAddressKeys": [k for k, v in byaddress.items() if len(v) > 1],
      "guard": "Mapped point containment or unique full address; compiler independently requires 90 percent mutual retained footprint overlap.",
    },
  }
  write(OUT, value)
  print(value["audit"])


if __name__ == "__main__":
  extract()
