"""Attest V355 venue addresses against segmented retained shell polygons."""

from __future__ import annotations

import argparse
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from shapely.geometry import Point, Polygon, box
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union
from shapely.strtree import STRtree

from scripts import build_cluster_facades_v320 as common
from scripts import build_venue_fronts_v355 as prior

AUDIT = "venue-fronts-v355-audit.json.gz"
SOURCES = (*prior.SOURCES, AUDIT)
REVISIT = {"building-unresolved", "multiple-overlapping-source-owners"}
AIRPORTS = Path("src/app/src/data/airportsV194.json")

# These two tenants share the exactly addressed and mapped Wilma shell.
# Require the full split owner to match the original address polygon.
# Other named sites here were reviewed against their mapped building sources.
SITE_IDS = {
  "berlin-service-122219",  # Hohenzollerndamm
  "berlin-service-122227",  # Bürgeramt Wilmersdorfer Straße, Wilma
  "berlin-service-122281",  # Rathaus Spandau
  "berlin-service-122297",  # Prenzlauer Berg
  "berlin-service-122969",  # Finanzamt Steglitz
  "berlin-service-122976",  # Finanzamt Wilmersdorf
  "berlin-service-354937",  # Rathaus Köpenick
  "osm/way/1065811824",  # Ring-Center II
  "osm/way/11249452",  # Linden Center
  "osm/way/194952966",  # Boulevard Berlin
  "osm/way/23942215",  # Eastgate
  "osm/way/25498297",  # Neuköllner Tor
  "osm/way/30452383",  # Wilma
  "osm/way/382117071",  # Storchenhof
  "osm/way/165930582",  # Opel & Kia
  "osm/way/257171321",  # Renault
  "osm/way/325838138",  # Autohaus Berolina
  "osm/way/43513119",  # Nissan Auto Treff Oranke
  "osm/way/45727373",  # Autohaus an der Hansastraße
}


@dataclass(frozen=True)
class Part:
  host: str
  owner: str
  polygon: BaseGeometry
  grounds: bool


def ratio(part, whole):
  overlap = part.intersection(whole).area
  return overlap / whole.area, overlap / part.area


def load_parts(descriptor, mode):
  asset = descriptor[mode]
  path = common.PUBLIC / asset["url"]
  digest = common.sha(path.read_bytes())
  assert digest == asset["sha256"], path
  raw = common.read(path)
  parts = []
  for building in raw["nav"]["buildings"]:
    polygon = prior.building_geometry(building, raw["origin"])
    if polygon.is_valid and polygon.area > 4:
      parts.append(
        Part(
          descriptor["id"],
          building["sourceId"],
          polygon,
          building.get("minHeight", 0) <= 0.1,
        )
      )
  return digest, parts


def match_site(row, area, parts):
  point = Point(prior.project(row["lon"], row["lat"]))
  if not area.covers(point):
    return None

  building = row.get("osmBuilding", {})
  osm_id = building.get("osmId") or row.get("osmBuildingId")
  if not osm_id:
    return None
  direct_owner = "OSM-" + osm_id.replace("/", "-")
  inside = [part for part in parts if part.grounds and part.polygon.covers(point)]
  exact = [
    part
    for part in inside
    if part.owner == direct_owner and ratio(part.polygon, area)[1] >= 0.99
  ]
  if len(exact) == 1:
    part = exact[0]
    whole, fragment = ratio(part.polygon, area)
    return part, "exact-source-owner", whole, fragment

  candidates = [part for part in inside if ratio(part.polygon, area)[1] >= 0.87]
  if len(candidates) != 1:
    return None
  part = candidates[0]
  same_owner = unary_union([p.polygon for p in parts if p.owner == part.owner])
  covered, exactness = ratio(same_owner, area)
  if min(covered, exactness) >= 0.87:
    return part, "aggregate-match-of-single-owner", covered, exactness

  # An address may belong to one of several touching LoD2 source volumes
  # under a single mapped building object. Require both complete structural
  # containment and corroboration by the unchanged directory/mapped point.
  substantial = [p for p in parts if ratio(p.polygon, area)[1] >= 0.96]
  if part not in substantial:
    return None
  components = unary_union([p.polygon for p in substantial])
  covered, exactness = ratio(components, area)
  if min(covered, exactness) >= 0.87:
    return part, "contained-fragment-of-mapped-building", covered, exactness
  return None


def existing_police_headquarters():
  police = common.read(common.GEO / "polizeiwachen-v355-source.json.gz")
  row = next(site for site in police["sites"] if site["id"] == "polizei-berlin-hq")
  source_path = common.ROOT / AIRPORTS
  location = Point(prior.project(row["lon"], row["lat"]))
  owner = row["sourceOwner"]
  source = common.read(source_path)
  owner_count = 0
  located_owners = set()
  for record in source["navigation"]:
    record_owner = record["id"].split("/")[0]
    owner_count += int(record_owner == owner)
    outline, *holes = record["rings"]
    polygon = Polygon(outline, holes)
    if polygon.is_valid and polygon.covers(location):
      located_owners.add(record_owner)
  assert located_owners == {owner} and owner_count > 0
  return {
    "id": row["id"],
    "point": [row["lon"], row["lat"]],
    "owner": owner,
    "authoredLandmark": "AirportsV194",
    "sourceFile": str(AIRPORTS),
    "sourceSha256": common.sha(source_path.read_bytes()),
    "evidence": {
      "method": "official-address-covered-by-exact-authored-owner",
      "sourceUrl": row["sourceUrl"],
      "ownerNavigationRecords": owner_count,
    },
  }


def reconcile():
  audit = common.read(common.GEO / AUDIT)["sites"]
  sites = {
    site["id"]: site
    for filename in prior.SOURCES
    for site in common.read(common.GEO / filename)["sites"]
    if site["id"] in SITE_IDS and audit[site["id"]]["status"] in REVISIT
  }
  assert sites.keys() == SITE_IDS
  ids = sorted(sites)
  areas = [prior.site_geometry(sites[key]) for key in ids]
  assert all(area.area > 0 for area in areas)
  tree = STRtree(areas)
  candidates = defaultdict(list)
  manifest = common.read(common.PUBLIC / "manifest.json")
  descriptors = {desc["id"]: desc for desc in manifest["chunks"]}
  drawn_digests = {}
  for desc in descriptors.values():
    if not len(tree.query(box(*desc["bounds"]), predicate="intersects")):
      continue
    digest, parts = load_parts(desc, "drawn")
    drawn_digests[desc["id"]] = digest
    for part in parts:
      for index in tree.query(part.polygon, predicate="intersects"):
        if part.polygon.intersection(areas[index]).area > 4:
          candidates[ids[index]].append(part)

  bindings = []
  rejected = []
  native_packets = {}
  for index, key in enumerate(ids):
    row = sites[key]
    area = areas[index]
    chosen = match_site(row, area, candidates[key])
    if not chosen:
      rejected.append((key, "no exact retained association"))
      continue
    part, method, covered, exactness = chosen
    if part.host not in native_packets:
      native_packets[part.host] = load_parts(descriptors[part.host], "minecraft")
    native_digest, native_parts = native_packets[part.host]
    point = Point(prior.project(row["lon"], row["lat"]))
    unique = [
      p
      for p in native_parts
      if p.owner == part.owner
      and p.grounds
      and p.polygon.covers(point)
      and min(ratio(p.polygon, part.polygon)) >= 0.87
    ]
    if len(unique) != 1:
      rejected.append((key, "native fragment did not contain the exact point"))
      continue
    mapped = row.get("osmBuilding", {})
    osm_id = mapped.get("osmId") or row.get("osmBuildingId")
    evidence = {
      "method": method,
      "sourceUrl": row["sourceUrl"],
      "osmBuildingUrl": f"https://www.openstreetmap.org/{osm_id}",
      "coverageOfMappedBuilding": round(covered, 6),
      "coverageOfRetainedAssociation": round(exactness, 6),
    }
    entrance = row.get("entrance")
    if entrance:
      location = Point(prior.project(entrance["lon"], entrance["lat"]))
      evidence["mappedEntranceDistanceDrawnM"] = round(
        part.polygon.exterior.distance(location), 3
      )
      evidence["mappedEntranceDistanceNativeM"] = round(
        unique[0].polygon.exterior.distance(location), 3
      )
      evidence["mappedEntranceUrl"] = entrance["sourceUrl"]
    bindings.append(
      {
        "id": key,
        "hostHint": part.host,
        "ownerHint": part.owner,
        "point": [row["lon"], row["lat"]],
        "packetSha256": {"drawn": drawn_digests[part.host], "minecraft": native_digest},
        "evidence": evidence,
      }
    )
  return {
    "schemaVersion": 1,
    "sourcePins": {
      filename: common.sha((common.GEO / filename).read_bytes()) for filename in SOURCES
    },
    "sites": bindings,
    "existingAuthored": [existing_police_headquarters()],
  }, rejected


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("output", type=Path)
  args = parser.parse_args()
  supplement, rejected = reconcile()
  common.write(args.output, supplement)
  for site in supplement["sites"]:
    print(site["id"], site["hostHint"], site["ownerHint"], site["evidence"]["method"])
  for site, reason in rejected:
    print(site, reason)
  print(len(supplement["sites"]), "attested building associations")


if __name__ == "__main__":
  main()
