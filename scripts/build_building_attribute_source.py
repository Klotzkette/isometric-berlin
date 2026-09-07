"""Step 10: bind bounded OSM building attributes to retained LoD2 footprints.

This is an additive semantic supplement, never a replacement geometry source.
Raw Overpass responses stay ignored. Only unambiguous, near-complete footprint
matches and the relevant original tags enter the small runtime manifest.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

import requests
from pyproj import Transformer
from shapely import STRtree
from shapely.geometry import Polygon, shape
from shapely.ops import transform

TAGS = (
  "building:material",
  "building:colour",
  "building:levels",
  "building:min_level",
  "roof:material",
  "roof:colour",
)
ENDPOINT = "https://overpass-api.de/api/interpreter"
MINIMUM_COVERAGE = 0.97


def source_query(bounds: dict[str, Any]) -> str:
  """Request tagged ways in the bounds envelope; output is strictly clipped."""
  ring = bounds["features"][0]["geometry"]["coordinates"][0]
  lon, lat = zip(*ring, strict=True)
  bbox = f"{min(lat)},{min(lon)},{max(lat)},{max(lon)}"
  ways = "".join(
    f'way["{key}"]({bbox});' for key in TAGS if key != "building:min_level"
  )
  return f"[out:json][timeout:90];({ways});out tags geom;"


def fetch_source(root: Path, path: Path) -> None:
  """Fetch a bounded source with an identifying public-project User-Agent."""
  bounds = json.loads((root / "geo_data/regierungsviertel/bounds.geojson").read_text())
  query = source_query(bounds)
  response = requests.post(
    ENDPOINT,
    data={"data": query},
    headers={
      "User-Agent": (
        "IsometricBerlin/0.72.43 "
        "(+https://github.com/Klotzkette/isometric-berlin; building detail)"
      ),
    },
    timeout=110,
  )
  response.raise_for_status()
  payload = response.json()
  if "remark" in payload:
    raise ValueError(f"Incomplete Overpass response: {payload['remark']}")
  payload["source_query"] = query
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text(json.dumps(payload, separators=(",", ":")) + "\n")


def world_polygon(element: dict[str, Any], projector: Transformer) -> Polygon | None:
  """Keep a closed, valid mapped building outline in the viewer frame."""
  geometry = element.get("geometry", [])
  if len(geometry) < 4 or geometry[0] != geometry[-1]:
    return None
  ring = []
  for point in geometry:
    x, north = projector.transform(point["lon"], point["lat"])
    ring.append((x - 389500, 5820000 - north))
  polygon = Polygon(ring)
  return polygon if polygon.is_valid and polygon.area > 1 else None


def bind_source(
  elements: list[dict[str, Any]],
  prisms: list[dict[str, Any]],
  bounds_world: Polygon,
) -> tuple[list[dict[str, Any]], dict[str, int], dict[str, int]]:
  """Match materials conservatively; ambiguous competing tags remain unresolved."""
  projector = Transformer.from_crs(4326, 25833, always_xy=True)
  polygons: list[Polygon] = []
  records: list[dict[str, Any]] = []
  for element in elements:
    tags = element.get("tags", {})
    if not (tags.get("building") or tags.get("building:part")):
      continue
    polygon = world_polygon(element, projector)
    if polygon is None or not bounds_world.covers(polygon):
      continue
    selected = {key: str(tags[key]) for key in TAGS if key in tags}
    if not selected:
      continue
    polygons.append(polygon)
    records.append(
      {"osm": f"way/{element['id']}", "part": "building:part" in tags, "tags": selected}
    )
  tree = STRtree(polygons)
  matches: dict[str, int] = {}
  rejected_ids: set[str] = set()
  multiplicity = Counter(prism["id"] for prism in prisms)

  def reject_duplicate(prism_id: str) -> None:
    if multiplicity[prism_id] > 1:
      matches.pop(prism_id, None)
      rejected_ids.add(prism_id)

  stats: Counter[str] = Counter()
  for prism in prisms:
    if prism["id"] in rejected_ids:
      continue
    ring = [(x / 10, z / 10) for x, z in prism["ring"]]
    holes = [[(x / 10, z / 10) for x, z in ring] for ring in prism.get("holes", [])]
    polygon = Polygon(ring, holes)
    if not polygon.is_valid or polygon.area < 1:
      reject_duplicate(prism["id"])
      continue
    candidates = []
    for raw_index in tree.query(polygon):
      index = int(raw_index)
      source = polygons[index]
      coverage = polygon.intersection(source).area / polygon.area
      # Narrow roof remnants must not borrow facade storeys/material from a
      # huge surrounding block. A part may still inherit its parent's colour.
      if coverage >= MINIMUM_COVERAGE and polygon.area / source.area >= 0.08:
        candidates.append(index)
    if not candidates:
      stats["without_unambiguous_attribute_match"] += 1
      reject_duplicate(prism["id"])
      continue
    candidates.sort(key=lambda i: (not records[i]["part"], polygons[i].area))
    selected = candidates[0]
    peers = [i for i in candidates if records[i]["part"] == records[selected]["part"]]
    if any(records[i]["tags"] != records[selected]["tags"] for i in peers[1:]):
      stats["conflicting_attribute_matches"] += 1
      reject_duplicate(prism["id"])
      continue
    previous = matches.get(prism["id"])
    if previous is not None and records[previous]["tags"] != records[selected]["tags"]:
      stats["multipart_attribute_conflicts"] += 1
      matches.pop(prism["id"], None)
      rejected_ids.add(prism["id"])
      continue
    matches[prism["id"]] = selected
    stats["matched_prism_parts"] += 1
  used = sorted(set(matches.values()), key=lambda i: records[i]["osm"])
  remap = {index: offset for offset, index in enumerate(used)}
  matched = {key: remap[index] for key, index in sorted(matches.items())}
  stats["source_buildings"] = len(used)
  stats["source_candidates_inside_bounds"] = len(records)
  stats["matched_prism_ids"] = len(matched)
  stats["matched_prism_parts"] = sum(multiplicity[prism_id] for prism_id in matched)
  stats["unmatched_prism_parts"] = len(prisms) - stats["matched_prism_parts"]
  for index in matches.values():
    for key in records[index]["tags"]:
      stats[f"matched_{key}"] += 1
  return [records[index] for index in used], matched, dict(sorted(stats.items()))


def build(root: Path, path: Path) -> dict[str, Any]:
  """Build a reproducible, source-separated semantic manifest."""
  raw = path.read_bytes()
  source = json.loads(raw)
  bounds = json.loads((root / "geo_data/regierungsviertel/bounds.geojson").read_text())
  projected = Transformer.from_crs(4326, 25833, always_xy=True)
  geometry = transform(projected.transform, shape(bounds["features"][0]["geometry"]))
  bounds_world = transform(lambda x, y: (x - 389500, 5820000 - y), geometry)
  prisms = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  records, matches, stats = bind_source(source["elements"], prisms, bounds_world)
  return {
    "schema_version": 1,
    "source": "OpenStreetMap",
    "license": "ODbL-1.0",
    "source_timestamp": source.get("osm3s", {}).get("timestamp_osm_base"),
    "source_endpoint": ENDPOINT,
    "source_query": source.get("source_query", source_query(bounds)),
    "source_sha256": hashlib.sha256(raw).hexdigest(),
    "bounds_ref": "geo_data/regierungsviertel/bounds.geojson",
    "minimum_footprint_coverage": MINIMUM_COVERAGE,
    "policy": (
      "OSM attributes only; retained Berlin LoD2 footprints, height and roof form win. "
      "Conflicting matches and outlines crossing the approved bounds are excluded. "
      "Exact storey heights, colour of uncoloured materials and joint spacing remain "
      "display estimates. No entrance/window coordinates are supplied."
    ),
    "statistics": stats,
    "records": records,
    "prisms": matches,
  }


def main() -> None:
  """Fetch only on request; regenerate offline from the ignored source cache."""
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--fetch", action="store_true")
  args = parser.parse_args()
  root = Path(__file__).resolve().parents[1]
  path = root / "geo_data/regierungsviertel/raw/osm_building_details/source.json"
  if args.fetch:
    fetch_source(root, path)
  result = build(root, path)
  output = root / "src/app/src/buildingAttributeSource.json"
  output.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  print(json.dumps({"bytes": output.stat().st_size, **result["statistics"]}, indent=2))


if __name__ == "__main__":
  main()
