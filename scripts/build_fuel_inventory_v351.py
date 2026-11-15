"""Step 10: retain every mapped Berlin fuel site and its explicit roof/pump evidence."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

import pyogrio
from shapely import STRtree, make_valid
from shapely.geometry import Point, mapping, shape
from shapely.ops import unary_union

from scripts.build_surrounding_outlines import tags_for, world

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PBF = GEO / "raw/city-v346/berlin-2026-11-13.osm.pbf"
SOURCE = GEO / "fuel-v351-source.json.gz"
INVENTORY = GEO / "fuel-v351-inventory.json.gz"
BOUNDARY = GEO / "berlin-boundaries-v200-source.json.gz"
OLD = ROOT / "src/app/public/mesh/regierungsviertel/street-details.json"
LIFECYCLES = (
  "disused",
  "abandoned",
  "demolished",
  "razed",
  "removed",
  "proposed",
  "construction",
)


def read(path: Path) -> Any:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, value: Any) -> None:
  data = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_bytes(gzip.compress(data, mtime=0) if path.suffix == ".gz" else data)


def sha(path: Path) -> str:
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def fuel_state(tags: dict[str, str]) -> str | None:
  """Keep lifecycle evidence even when an old amenity tag remains present."""
  for phase in LIFECYCLES:
    if tags.get(phase + ":amenity") == "fuel" or (
      tags.get("amenity") == "fuel" and tags.get(phase) == "yes"
    ):
      return phase
  return "mapped-active" if tags.get("amenity") == "fuel" else None


def osm_id(row: Any, layer: str) -> str:
  way = row.get("osm_way_id")
  return (
    "way/" + way
    if isinstance(way, str)
    else (
      "node/"
      if layer == "points"
      else "relation/"
      if layer == "multipolygons"
      else "way/"
    )
    + str(row.osm_id)
  )


def category(tags: dict[str, str]) -> str:
  if tags.get("access") in {"private", "no"}:
    return "restricted-fuel-site"
  if tags.get("boat") == "yes" or tags.get("waterway") == "fuel":
    return "marine-fuel-site"
  if any(
    tags.get(k) == "yes" for k in ("fuel:hydrogen", "fuel:h35", "fuel:h70")
  ) and not any(
    tags.get(k) == "yes" for k in ("fuel:diesel", "fuel:octane_95", "fuel:e10")
  ):
    return "hydrogen-station"
  return "fuel-station"


def compatible(a: dict[str, Any], b: dict[str, Any]) -> bool:
  def brand(row: dict[str, Any]) -> str:
    tags = row["tags"]
    return (
      tags.get("brand", tags.get("name", ""))
      .casefold()
      .replace("totalenergies", "total")
    )

  return a["state"] == b["state"] and (
    not brand(a) or not brand(b) or brand(a) == brand(b)
  )


def extract() -> None:
  boundary = unary_union(
    [shape(f["geometry"]) for f in read(BOUNDARY)["state"]["features"]]
  )
  records: dict[str, Any] = {}
  roofs: dict[str, Any] = {}
  pumps: dict[str, Any] = {}
  outside: list[str] = []
  for layer in ("points", "multipolygons", "lines"):
    where = "other_tags LIKE '%fuel%'"
    if layer == "multipolygons":
      where += (
        " OR amenity='fuel' OR building IN ('roof','canopy') OR man_made='canopy'"
      )
    frame = pyogrio.read_dataframe(PBF, layer=layer, where=where).to_crs(25833)
    for _, row in frame.iterrows():
      tags = tags_for(row)
      geometry = row.geometry
      state = fuel_state(tags)
      is_roof = (
        tags.get("building") in {"roof", "canopy"} or tags.get("man_made") == "canopy"
      )
      is_pump = (
        tags.get("man_made") == "fuel_pump" or tags.get("amenity") == "fuel_pump"
      )
      if geometry is None or geometry.is_empty or not (state or is_roof or is_pump):
        continue
      identity = osm_id(row, layer)
      if not boundary.covers(geometry.representative_point()):
        if state:
          outside.append(identity)
        continue
      g = world(make_valid(geometry))
      item = dict(
        id=identity,
        tags={k: v for k, v in tags.items() if k not in {"osm_id", "osm_way_id"}},
        geometry=mapping(g),
      )
      if state:
        records[identity] = dict(**item, state=state, category=category(tags))
      if is_roof and g.geom_type in {"Polygon", "MultiPolygon"}:
        roofs[identity] = item
      if is_pump:
        pumps[identity] = item
  # Retain duplicate source features explicitly instead of counting a site's
  # area and contained label node as two separate stations.
  areas = [
    r
    for r in records.values()
    if shape(r["geometry"]).geom_type in {"Polygon", "MultiPolygon"}
  ]
  for row in records.values():
    if shape(row["geometry"]).geom_type != "Point":
      continue
    matches = [
      a
      for a in areas
      if shape(a["geometry"]).covers(shape(row["geometry"])) and compatible(a, row)
    ]
    if len(matches) == 1:
      row["duplicateOf"] = matches[0]["id"]
  sites = [r for r in records.values() if not r.get("duplicateOf")]
  active = [r for r in sites if r["state"] == "mapped-active"]
  areas_world = [shape(r["geometry"]) for r in active]
  tree = STRtree(areas_world)
  associations: dict[str, dict[str, list[str]]] = {
    r["id"]: dict(roofs=[], pumps=[]) for r in sites
  }
  unresolved: list[dict[str, Any]] = []
  selected_roofs: dict[str, Any] = {}
  selected_pumps: dict[str, Any] = {}
  for family, objects in (("roofs", roofs), ("pumps", pumps)):
    for item in objects.values():
      g = shape(item["geometry"])
      candidates = [int(i) for i in tree.query(g.buffer(35), predicate="intersects")]
      if not candidates:
        continue
      (selected_roofs if family == "roofs" else selected_pumps)[item["id"]] = item
      contained = [
        i
        for i in candidates
        if areas_world[i].geom_type != "Point" and areas_world[i].covers(g)
      ]
      touching = [i for i in candidates if g.buffer(0.05).covers(areas_world[i])]
      exact = contained or touching
      if len(exact) == 1:
        owner = active[exact[0]]["id"]
        associations[owner][family].append(item["id"])
        item["site"] = owner
        item["association"] = (
          "contained-in-site" if contained else "contains-site-point"
        )
      else:
        # A nearby roof is not automatically a petrol canopy. Keep it as an
        # unresolved candidate rather than applying a nearest-roof heuristic.
        unresolved.append(
          dict(
            id=item["id"],
            family=family,
            candidateSites=sorted(active[i]["id"] for i in candidates),
            reason="ambiguous-overlap" if exact else "proximity-only",
          )
        )
  old = read(OLD)["fuel_stations"]
  old_matches = []
  for i, station in enumerate(old):
    p = Point(station["x_dm"] / 10, station["z_dm"] / 10)
    distances = sorted((g.distance(p), j) for j, g in enumerate(areas_world))
    distance, j = distances[0]
    matched = (
      active[j]["id"]
      if distance < 65 and (len(distances) < 2 or distances[1][0] > distance + 5)
      else None
    )
    old_matches.append(
      dict(
        index=i,
        source=station,
        site=matched,
        distanceM=round(distance, 3),
        policy="preserve-complete-legacy-model",
      )
    )
    if matched:
      active[j]["legacyModelIndex"] = i
  for row in sites:
    row.update(associations[row["id"]])
  source = dict(
    schemaVersion=1,
    crs="local-east-south-from-EPSG25833",
    sources=dict(
      osm=dict(
        path=str(PBF.relative_to(ROOT)),
        date="2026-11-13",
        sha256=sha(PBF),
        url="https://download.geofabrik.de/europe/germany/berlin-261113.osm.pbf",
        license="ODbL-1.0",
        attribution="© OpenStreetMap contributors",
      ),
      boundary=dict(path=str(BOUNDARY.relative_to(ROOT)), sha256=sha(BOUNDARY)),
      legacy=dict(path=str(OLD.relative_to(ROOT)), sha256=sha(OLD)),
    ),
    records=[records[k] for k in sorted(records)],
    roofs=[selected_roofs[k] for k in sorted(selected_roofs)],
    pumps=[selected_pumps[k] for k in sorted(selected_pumps)],
    unresolvedGeometry=unresolved,
    outsideBerlin=sorted(outside),
    legacyModels=old_matches,
  )
  write(SOURCE, source)
  counts = dict(
    sourceRecords=len(records),
    duplicateRecords=sum(bool(r.get("duplicateOf")) for r in records.values()),
    sites=len(sites),
    states=dict(Counter(r["state"] for r in sites)),
    categories=dict(Counter(r["category"] for r in active)),
    matchedRoofs=sum(len(r["roofs"]) for r in sites),
    matchedPumps=sum(len(r["pumps"]) for r in sites),
    legacyModels=len(old),
    legacyMatched=sum(m["site"] is not None for m in old_matches),
  )
  write(
    INVENTORY,
    dict(
      schemaVersion=1,
      sourceSha256=sha(SOURCE),
      counts=counts,
      records=sites,
      completeness="All matching source records within the retained official Berlin state boundary; mapped-active is a source tag, not independently confirmed current operation.",
    ),
  )
  print(json.dumps(counts, ensure_ascii=False), flush=True)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.parse_args()
  extract()
