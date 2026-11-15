"""Audit current public restaurant facts against exact Berlin and mapped geometry.

The operator locator is identity evidence, not a facade or entrance survey.
No phone numbers, opening hours, personal franchise data or image pixels ship.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import re
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import pyogrio
import requests
from pyproj import Transformer
from shapely.geometry import Point, mapping, shape
from shapely.ops import transform, unary_union

from scripts.build_pharmacies_v350 import address_key

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/city-v351"
SOURCE = GEO / "mcdonalds-v351-source.json.gz"
INVENTORY = GEO / "mcdonalds-v351-inventory.json.gz"
OSM = GEO / "mcdonalds-v351-osm.json.gz"
BOUNDARY = GEO / "berlin-boundaries-v200-source.json.gz"
PBF = GEO / "raw/city-v346/berlin-2026-11-13.osm.pbf"
FINDER = "https://www.mcdonalds.com/de/de-de/restaurant-suche.html"
PROJECTION = Transformer.from_crs(4326, 25833, always_xy=True).transform


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, value: dict) -> None:
  raw = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(raw: bytes) -> str:
  return hashlib.sha256(raw).hexdigest()


def boundary():
  return unary_union(
    [shape(f["geometry"]) for f in read(BOUNDARY)["state"]["features"]]
  )


def download(url: str, limit: int = 4_000_000) -> bytes:
  with requests.get(url, timeout=45, stream=True) as response:
    response.raise_for_status()
    data = response.raw.read(limit + 1, decode_content=True)
  if len(data) > limit:
    raise ValueError("Public locator exceeds bounded source size")
  return data


def fetch() -> None:
  """Use only endpoints explicitly shipped by the official page/widget."""
  RAW.mkdir(exist_ok=True)
  page = download(FINDER).decode()
  key = re.search(r'id="store-finder-widget"\s+data-key="([A-Za-z0-9]+)"', page)
  if not key:
    raise ValueError("Official public locator identity not found")
  endpoint = f"https://locator.uberall.com/api/locators/{key[1]}/locations/all?v=20260101&language=de"
  raw = download(endpoint)
  payload = json.loads(raw)
  if payload["status"] != "SUCCESS" or set(payload["response"]) != {"locations"}:
    raise ValueError("Unexpected all-locations response or pagination metadata")
  all_rows = payload["response"]["locations"]
  if not 1000 < len(all_rows) < 2000 or len({r["identifier"] for r in all_rows}) != len(
    all_rows
  ):
    raise ValueError("Unexpected or duplicate Germany locator inventory")
  berlin = boundary()
  inside = [
    r for r in all_rows if berlin.covers(Point(*PROJECTION(r["lng"], r["lat"])))
  ]
  postal_outside = [
    r["identifier"]
    for r in all_rows
    if r["city"].casefold() == "berlin" and r not in inside
  ]

  def detail(row: dict) -> dict:
    url = f"https://locator.uberall.com/api/storefinders/{key[1]}/locations/{row['id']}?v=20260101&language=de"
    data = download(url, 100_000)
    item = json.loads(data)
    if (
      item["status"] != "SUCCESS" or item["response"]["identifier"] != row["identifier"]
    ):
      raise ValueError("Changed operator identity")
    facts = item["response"]
    fields = (
      "id",
      "identifier",
      "name",
      "streetAndNumber",
      "addressExtra",
      "city",
      "zip",
      "lat",
      "lng",
      "futureOpeningDate",
    )
    return {
      **{k: facts.get(k) for k in fields},
      "services": [
        s.get("name", "") if isinstance(s, dict) else s for s in facts["services"]
      ],
      "referencePhotos": [
        {"url": p["publicUrl"], "type": p["type"]}
        for p in facts["photos"]
        if p["type"] in {"MAIN", "PHOTO"}
      ],
      "detailUrl": url,
      "detailSha256": sha(data),
    }

  with ThreadPoolExecutor(max_workers=2) as pool:
    records = list(pool.map(detail, sorted(inside, key=lambda r: int(r["identifier"]))))
  write(
    SOURCE,
    {
      "schemaVersion": 1,
      "retrievedAt": datetime.now(timezone.utc).isoformat(),
      "finder": FINDER,
      "endpoint": endpoint,
      "responseSha256": sha(raw),
      "allLocatorRecords": len(all_rows),
      "responseKeys": sorted(payload["response"]),
      "completeness": "Official widget locations/all endpoint, no pagination metadata; all national points checked against exact Berlin boundary. This is operator-directory completeness, not a guarantee of unlisted stores.",
      "boundary": {
        "path": str(BOUNDARY.relative_to(ROOT)),
        "sha256": sha(BOUNDARY.read_bytes()),
        "crs": "EPSG:25833",
      },
      "postalBerlinOutsideBoundary": postal_outside,
      "insideBerlinWithDifferentPostalCity": [
        r["identifier"] for r in inside if r["city"].casefold() != "berlin"
      ],
      "records": records,
      "use": "Public location/service facts; external photos reference-only, no pixels or logo artwork redistributed; no runtime lookup.",
    },
  )
  print(
    "official",
    len(all_rows),
    "Berlin boundary",
    len(records),
    "postal outside",
    postal_outside,
  )


def tags(text: str | None) -> dict:
  return dict(
    re.findall(
      r'"([^"\\]+)"=>"((?:[^"\\]|\\.)*)"', text if isinstance(text, str) else ""
    )
  )


def extract_osm() -> None:
  rows = []
  berlin = boundary()
  for layer in ("points", "multipolygons"):
    data = pyogrio.read_dataframe(
      PBF, layer=layer, where="name LIKE '%McDonald%' OR other_tags LIKE '%McDonald%'"
    )
    for _, row in data.iterrows():
      if row.geometry is None or row.geometry.is_empty or not row.geometry.is_valid:
        continue
      meta = tags(row.other_tags)
      for key in ("name", "amenity", "building"):
        if key in row and isinstance(row[key], str):
          meta[key] = row[key]
      geom = transform(PROJECTION, row.geometry)
      if not berlin.intersects(geom):
        continue
      # Preserve all matching mapped objects, including nonrestaurants/history.
      keep = {
        k: v
        for k, v in meta.items()
        if k
        in {
          "name",
          "old_name",
          "was:name",
          "amenity",
          "disused:amenity",
          "abandoned:amenity",
          "brand",
          "brand:wikidata",
          "building",
          "building:levels",
          "building:material",
          "building:colour",
          "height",
          "level",
          "addr:floor",
          "indoor",
          "drive_through",
          "outdoor_seating",
          "check_date",
          "ref",
          "roof:shape",
          "roof:colour",
          "roof:material",
        }
        or k.startswith("addr:")
      }
      urls = [
        v
        for k, v in meta.items()
        if k in {"website", "contact:website"} and "mcdonalds." in v
      ]
      # Published restaurant identifier in its own official link is usable evidence.
      ids = sorted(
        set(
          m.group(1) for u in urls for m in re.finditer(r"/(\d{2,5})(?:[/?&#.]|$)", u)
        )
      )
      osm_id = (
        ("node/" + str(row.osm_id))
        if layer == "points"
        else (
          "way/" + str(row.osm_way_id)
          if isinstance(row.osm_way_id, str)
          else "relation/" + str(row.osm_id)
        )
      )
      point = geom.representative_point()
      world = transform(lambda x, y, z=None: (x - 389500, 5820000 - y), geom)
      rows.append(
        {
          "id": osm_id,
          "tags": keep,
          "officialIds": ids,
          "easting": point.x,
          "northing": point.y,
          "geometry": mapping(world),
        }
      )
  write(
    OSM,
    {
      "schemaVersion": 1,
      "source": {
        "path": str(PBF.relative_to(ROOT)),
        "sha256": sha(PBF.read_bytes()),
        "url": "https://download.geofabrik.de/europe/germany/berlin-261113.osm.pbf",
        "license": "ODbL-1.0",
      },
      "records": sorted(rows, key=lambda r: r["id"]),
    },
  )
  print("OSM", len(rows))


def mapped_restaurant(row: dict) -> bool:
  t = row["tags"]
  return t.get("amenity") == "fast_food" and (
    t.get("brand") == "McDonald's" or t.get("name") == "McDonald's"
  )


def build() -> None:
  source, osm = read(SOURCE), read(OSM)
  active = [r for r in osm["records"] if mapped_restaurant(r)]
  matched = set()
  selected_ids = set()
  records = []
  for official in source["records"]:
    fid = official["identifier"]
    east, north = PROJECTION(official["lng"], official["lat"])
    key = address_key(official["streetAndNumber"], "", official["zip"])
    options = []
    for row in active:
      t = row["tags"]
      distance = math.hypot(east - row["easting"], north - row["northing"])
      exact_id = fid in row["officialIds"]
      exact_address = (
        key
        and address_key(
          t.get("addr:street"), t.get("addr:housenumber"), t.get("addr:postcode")
        )
        == key
      )
      if exact_id or exact_address or distance <= 65:
        options.append((0 if exact_id else 1 if exact_address else 2, distance, row))
    options.sort(key=lambda o: (o[0], o[1]))
    chosen = options[0] if options else None
    if chosen and chosen[0] == 2 and sum(rank == 2 for rank, _, _ in options) != 1:
      raise ValueError(
        f"Ambiguous nearby same-brand identity for official branch {fid}"
      )
    if chosen and chosen[2]["id"] in selected_ids:
      raise ValueError(
        f"Mapped restaurant reused by another official branch: {chosen[2]['id']}"
      )
    if chosen:
      selected_ids.add(chosen[2]["id"])
    if official.get("futureOpeningDate"):
      raise ValueError(f"Future opening requires separate disposition: {fid}")
    record = {
      "id": "mcdonalds:" + fid,
      "officialId": fid,
      "name": official["name"],
      "street": official["streetAndNumber"],
      "postcode": official["zip"],
      "addressExtra": official["addressExtra"],
      "officialEasting": east,
      "officialNorthing": north,
      "services": official["services"],
      "directoryStatus": "current-operator-locator",
      "evidence": {"officialDetail": official["detailUrl"]},
    }
    if chosen:
      _, distance, row = chosen
      # Duplicate same-address nodes/areas are retained, but a second distinct branch near it remains separate.
      same = [
        r
        for rank, dist, r in options
        if r is row or rank == chosen[0] and dist <= 65 and fid in r["officialIds"]
      ]
      for r in same:
        matched.add(r["id"])
      record.update(
        {
          "easting": row["easting"],
          "northing": row["northing"],
          "osmId": row["id"],
          "mappedGeometry": row["geometry"],
          "mappedTags": row["tags"],
          "duplicateMappedIds": [r["id"] for r in same if r is not row],
        }
      )
      record["evidence"].update(
        {
          "identityMatch": [
            "official-branch-id",
            "full-address",
            "unique-brand-location-under-65m",
          ][chosen[0]],
          "operatorPointDistanceM": round(distance, 3),
          "level": row["tags"].get("level", row["tags"].get("addr:floor")),
        }
      )
    else:
      record.update(
        {
          "easting": east,
          "northing": north,
          "evidence": {**record["evidence"], "identityMatch": "operator-point-only"},
        }
      )
    records.append(record)
  unmatched = [r for r in active if r["id"] not in matched]
  write(
    INVENTORY,
    {
      "schemaVersion": 1,
      "records": records,
      "audit": {
        "officialBerlin": len(records),
        "matchedToOsm": sum("osmId" in r for r in records),
        "identityMatches": dict(
          Counter(r["evidence"]["identityMatch"] for r in records)
        ),
        "unmatchedActiveMappedRestaurants": unmatched,
        "historicalOrNonRestaurantObjects": [
          r for r in osm["records"] if not mapped_restaurant(r)
        ],
        "scope": "Identity crosswalk only. Brand proximity cannot establish a building, facade, entrance or sign. Literal supported source geometry is checked independently.",
      },
      "sources": [
        {"path": str(p.relative_to(ROOT)), "sha256": sha(p.read_bytes())}
        for p in [SOURCE, OSM]
      ],
    },
  )
  print(
    "inventory",
    len(records),
    "matched",
    sum("osmId" in r for r in records),
    "unmatched OSM",
    len(unmatched),
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--fetch", action="store_true")
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  if args.fetch:
    fetch()
  if args.extract:
    extract_osm()
  build()
