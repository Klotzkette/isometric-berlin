"""Retain mapped building/entrance evidence for Berlin's public office addresses."""

from __future__ import annotations

import argparse
import hashlib
import re
from collections import Counter, defaultdict
from pathlib import Path

import pyogrio
from shapely.geometry import Point, mapping, shape
from shapely.strtree import STRtree

from scripts.build_aemter_v355 import archive
from scripts.build_pharmacies_v350 import PBF, address_key, read

PBF_SOURCE = "https://download.geofabrik.de/europe/germany/berlin-261113.osm.pbf"
TAG_PATTERN = re.compile(r'"([^"\\]+)"=>"((?:[^"\\]|\\.)*)"')


def tags_for(text: str | None) -> dict:
  return dict(TAG_PATTERN.findall(text)) if isinstance(text, str) else {}


def address(tags: dict) -> str:
  return address_key(
    tags.get("addr:street"), tags.get("addr:housenumber"), tags.get("addr:postcode")
  )


def evidence(sites: list[dict], pbf: Path) -> dict:
  grouped = defaultdict(list)
  anchors = [(site["id"], True, Point(site["lon"], site["lat"])) for site in sites]
  anchors.extend(
    (site["id"], False, Point(point["lon"], point["lat"]))
    for site in sites
    for point in site.get("alternateOfficialPoints", [])
  )
  point_to_exact_address = defaultdict(list)
  for site in sites:
    point_to_exact_address[site["addressKey"]].append(site["id"])
  buildings = pyogrio.read_dataframe(
    pbf,
    layer="multipolygons",
    columns=["osm_id", "osm_way_id", "building", "name", "other_tags"],
    where="building IS NOT NULL AND building != 'no'",
  )
  # All address candidates are examined once. Spatial hits only supplement
  # exact address evidence when the official point actually lies on a shell.
  tree = STRtree([row[2] for row in anchors])
  for row in buildings.itertuples(index=False):
    geo = row.geometry
    if (
      geo is None
      or geo.is_empty
      or not geo.is_valid
      or geo.geom_type not in ("Polygon", "MultiPolygon")
    ):
      continue
    exact_key = address(tags_for(row.other_tags))
    contained = defaultdict(set)
    for index in tree.query(geo, predicate="covers"):
      site_id, primary, _ = anchors[index]
      contained[site_id].add(primary)
    exact = set(point_to_exact_address.get(exact_key, ()))
    ids = set(contained) | exact
    if not ids:
      continue
    osm_id = (
      f"way/{row.osm_way_id}"
      if isinstance(row.osm_way_id, str)
      else f"relation/{row.osm_id}"
    )
    for site_id in ids:
      primary = True in contained.get(site_id, ())
      alternate = False in contained.get(site_id, ())
      if site_id in exact:
        why = "exact-address-polygon"
      elif primary:
        why = "official-point-contained"
      else:
        why = "alternate-official-point-contained"
      grouped[site_id].append(
        {
          "osmId": osm_id,
          "sourceUrl": f"https://www.openstreetmap.org/{osm_id}",
          "match": why,
          "containsPrimaryPoint": primary,
          "containsAlternatePoint": alternate,
          "name": row.name if isinstance(row.name, str) else None,
          "building": row.building,
          "geometry": mapping(geo),
        }
      )
  del buildings
  shells = []
  shell_ids = []
  outcomes = Counter()
  for site in sites:
    candidates = grouped[site["id"]]
    exact = [row for row in candidates if row["match"] == "exact-address-polygon"]
    pool = exact or candidates
    if len(exact) > 1:
      exact_and_containing = [row for row in exact if row["containsPrimaryPoint"]]
      if len(exact_and_containing) == 1:
        pool = exact_and_containing
    if len(pool) == 1:
      matched = pool[0]
      site["buildingGeometry"] = matched.pop("geometry")
      site["osmBuilding"] = matched
      outcomes[matched["match"]] += 1
      shells.append(shape(site["buildingGeometry"]))
      shell_ids.append(site)
    else:
      site["osmBuildingStatus"] = (
        "multiple-mapped-buildings" if pool else "no-exact-mapped-building"
      )
      outcomes[site["osmBuildingStatus"]] += 1
      if pool:
        site["osmBuildingCandidates"] = sorted(row["osmId"] for row in pool)
  if not shells:
    return dict(outcomes)
  shell_tree = STRtree([s.boundary.buffer(0.000006) for s in shells])
  entrances = pyogrio.read_dataframe(
    pbf,
    layer="points",
    columns=["osm_id", "name", "other_tags"],
    where="other_tags LIKE '%\"entrance\"=>%'",
  )
  for row in entrances.itertuples(index=False):
    tags = tags_for(row.other_tags)
    entrance = tags.get("entrance")
    if entrance != "main" or row.geometry is None or row.geometry.is_empty:
      continue
    owners = shell_tree.query(row.geometry, predicate="within")
    if len(owners) != 1:
      continue
    site = shell_ids[owners[0]]
    site.setdefault("mappedBuildingEntrances", []).append(
      {
        "sourceUrl": f"https://www.openstreetmap.org/node/{row.osm_id}",
        "lon": row.geometry.x,
        "lat": row.geometry.y,
        "tag": "entrance=main",
        "scope": "main entrance to the mapped building; service suite entrance not established",
      }
    )
  for site in sites:
    tagged = site.get("mappedBuildingEntrances", [])
    if len(tagged) == 1:
      site["entrance"] = tagged[0]
  outcomes["buildingsWithMappedMainEntrance"] = sum(
    "mappedBuildingEntrances" in site for site in sites
  )
  outcomes["unambiguousMappedMainEntrances"] = sum("entrance" in site for site in sites)
  return dict(outcomes)


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("inventory", type=Path)
  parser.add_argument("output", type=Path)
  parser.add_argument("--pbf", type=Path, default=PBF)
  args = parser.parse_args()
  data = read(args.inventory)
  with args.pbf.open("rb") as handle:
    checksum = hashlib.file_digest(handle, "sha256").hexdigest()
  data["sources"].append({"url": PBF_SOURCE, "license": "ODbL-1.0", "sha256": checksum})
  data["audit"]["osmEvidence"] = evidence(data["sites"], args.pbf)
  archive(args.output, data)
  print(data["audit"]["osmEvidence"])


if __name__ == "__main__":
  main()
