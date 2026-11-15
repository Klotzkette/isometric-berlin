"""Bounded offline exact-address building cache from the retained Berlin PBF.

Only actual building polygons with a unique full street/house/postcode key are
eligible. No nearest building, campus ring, inferred address or entrance is used.
The cache is evidence for a separate mutual-footprint-overlap check, not a
permission to place a fitting on the nearest facade.
"""

from __future__ import annotations

import re
from collections import defaultdict

import pyogrio
from build_pharmacies_v350 import GEO, PBF, address_key, digest, read, write
from pyproj import Transformer
from shapely import get_coordinates
from shapely.geometry import mapping
from shapely.ops import transform

OUT = GEO / "civic-facilities-v350-address-buildings.json.gz"


def key(street: str, house: str, postcode: str) -> str:
  # Berlin's official education directory pads house numbers (023 = 23).
  house = re.sub(r"(?<!\d)0+(?=\d)", "", house)
  return address_key(street, house, postcode)


def extract() -> dict:
  inventory_paths = [
    GEO / "education-v350-inventory.json.gz",
    GEO / "pharmacies-v350-inventory.json.gz",
  ]
  targets = defaultdict(list)
  skipped_non_ground = []
  for path in inventory_paths:
    for row in read(path)["records"]:
      level = row.get("evidence", {}).get("level")
      if row["category"] == "pharmacy" and level not in (None, "", "0", 0):
        skipped_non_ground.append(row["id"])
        continue
      k = key(
        row.get("street", ""), row.get("houseNumber", ""), row.get("postcode", "")
      )
      if k:
        targets[k].append(row["id"])
  frame = pyogrio.read_dataframe(
    PBF,
    layer="multipolygons",
    columns=["osm_id", "osm_way_id", "building", "other_tags"],
    where=(
      "building IS NOT NULL AND building != 'no' "
      "AND other_tags LIKE '%\"addr:street\"=>%' "
      "AND other_tags LIKE '%\"addr:housenumber\"=>%' "
      "AND other_tags LIKE '%\"addr:postcode\"=>%'"
    ),
  )
  groups = defaultdict(list)
  project = Transformer.from_crs(frame.crs, "EPSG:25833", always_xy=True).transform
  inspected = len(frame)
  for _, row in frame.iterrows():
    tags = dict(re.findall(r'"([^"\\]+)"=>"((?:[^"\\]|\\.)*)"', row.other_tags or ""))
    street, house, postcode = [
      tags.get(k, "") for k in ("addr:street", "addr:housenumber", "addr:postcode")
    ]
    k = key(street, house, postcode)
    if k not in targets:
      continue
    geom = row.geometry
    if (
      geom is None
      or geom.is_empty
      or not geom.is_valid
      or geom.geom_type not in ("Polygon", "MultiPolygon")
    ):
      continue
    osm_id = (
      "OSM-way-" + row.osm_way_id
      if isinstance(row.osm_way_id, str)
      else "OSM-relation-" + row.osm_id
    )
    projected = transform(project, geom)
    world = transform(lambda x, y, z=None: (x - 389500, 5820000 - y), projected)
    if world.area <= 2 or len(get_coordinates(world)) > 20000:
      continue
    groups[k].append(
      {
        "type": "Feature",
        "properties": {
          "facilityIds": sorted(targets[k]),
          "osmId": osm_id,
          "street": street,
          "houseNumber": house,
          "postcode": postcode,
          "building": row.building,
          "match": "unique-full-address-building-polygon",
        },
        "geometry": mapping(world),
      }
    )
  features = sorted(
    (rows[0] for rows in groups.values() if len(rows) == 1),
    key=lambda r: r["properties"]["osmId"],
  )
  ambiguous = sorted(
    facility_id
    for k, rows in groups.items()
    if len(rows) != 1
    for facility_id in targets[k]
  )
  return {
    "type": "FeatureCollection",
    "schemaVersion": 1,
    "coordinateSystem": "viewer-world-x=easting-389500,z=5820000-northing; EPSG:25833 source",
    "source": {
      "path": str(PBF.relative_to(GEO.parents[1])),
      "url": "https://download.geofabrik.de/europe/germany/berlin-261113.osm.pbf",
      "license": "ODbL-1.0",
      "sha256": digest(PBF.read_bytes()),
      "inventories": [
        {"path": str(p.relative_to(GEO.parents[1])), "sha256": digest(p.read_bytes())}
        for p in inventory_paths
      ],
    },
    "audit": {
      "addressedBuildingsInspected": inspected,
      "uniqueAddressedBuildings": len(features),
      "matchedFacilities": sum(len(f["properties"]["facilityIds"]) for f in features),
      "ambiguousFacilitiesExcluded": ambiguous,
      "nonGroundPharmaciesExcluded": skipped_non_ground,
      "guard": "Requires independent >=90% mutual overlap with the literal retained owner footprint before use; does not establish entrance or facade detail.",
    },
    "features": features,
  }


if __name__ == "__main__":
  result = extract()
  OUT.parent.mkdir(parents=True, exist_ok=True)
  write(OUT, result)
  print(result["audit"])
  print(str(OUT), OUT.stat().st_size)
