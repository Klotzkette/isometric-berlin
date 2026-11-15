"""Public pharmacy location inventory, with a current chamber-directory cross-check.

Location evidence is not architectural or entrance evidence. This generator
never changes geometry, provides medical advice or stores contact/notdienst data.
Default operation is deterministic and offline against the retained snapshot.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = GEO / "pharmacies-v350-source.json.gz"
OUT = GEO / "pharmacies-v350-inventory.json.gz"
EVIDENCE = GEO / "pharmacies-v350-evidence.json"
OSM = GEO / "pharmacies-v350-osm.json.gz"
REVIEW = GEO / "pharmacies-v350-address-review.json"
PBF = GEO / "raw/city-v346/berlin-2026-11-13.osm.pbf"
CATALOGUE = "https://daten.berlin.de/datensaetze/apothekenstandorte-wfs-58e80465"
CHAMBER = "https://www.akberlin.de/patientinnen/apothekenfinder"
WFS = (
  "https://gdi.berlin.de/services/wfs/apotheken?service=WFS&version=2.0.0"
  "&request=GetFeature&typeNames=apotheken:apotheken"
  "&outputFormat=application/json&srsName=EPSG:25833"
)


def digest(raw: bytes) -> str:
  return hashlib.sha256(raw).hexdigest()


def read(path: Path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, value) -> None:
  raw = (
    json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n"
  ).encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def download(url: str, maximum: int = 4 * 1024 * 1024) -> bytes:
  with urlopen(
    Request(url, headers={"User-Agent": "isometric-berlin/1.0 public-location-audit"}),
    timeout=45,
  ) as response:
    raw = response.read(maximum + 1)
  if len(raw) > maximum:
    raise ValueError("Public directory response exceeds bounded input")
  return raw


def spelling(value: str) -> str:
  value = value.casefold().replace("ß", "ss")
  value = unicodedata.normalize("NFKD", value)
  return "".join(c for c in value if not unicodedata.combining(c))


def split_address(street: str | None, house: str | None = "") -> tuple[str, str]:
  if not street:
    return "", ""
  if not house:
    match = re.fullmatch(
      r"(.*?)(\d+\s*[A-Za-z]?(?:\s*[-/]\s*\d+\s*[A-Za-z]?)?)\s*", street
    )
    if not match:
      return "", ""
    street, house = match.groups()
  name = re.sub(r"strasse\b|str\.?(?=\s|$)", "str", spelling(street.strip()))
  return re.sub(r"[^a-z0-9]", "", name), re.sub(r"\s", "", house.casefold())


def address_key(
  street: str | None, house: str | None = "", postcode: str | None = ""
) -> str:
  """Normalize street spelling, preserving house suffix/range and postcode."""
  name, number = split_address(street, house)
  return (
    f"{name}|{number}|{postcode}"
    if name and number and postcode and re.fullmatch(r"\d{5}", postcode)
    else ""
  )


def name_key(name: str) -> str:
  return re.sub(r"[^a-z0-9]", "", spelling(name))


def contains_house(current: str, official: str) -> bool:
  """A stated numeric address range can contain the official single address."""
  if current == official:
    return True
  if "/" in current:
    return official in current.split("/")
  if re.fullmatch(r"\d+-\d+", current) and official.isdigit():
    lo, hi = map(int, current.split("-"))
    return lo <= int(official) <= hi
  return False


def fetch() -> None:
  """Acquire open geodata and only the public facility facts from the finder."""
  raw = download(WFS)
  wfs = json.loads(raw)
  if (
    wfs["numberReturned"] != wfs["numberMatched"]
    or len(wfs["features"]) != wfs["numberMatched"]
  ):
    raise ValueError("Incomplete official pharmacy response")
  page = download(CHAMBER).decode()
  endpoint = re.search(r"const apiPointApotheken = '([^']+)'", page)
  if not endpoint:
    raise ValueError("Public finder endpoint not found in its own page")
  parts = urlsplit(endpoint[1])
  if parts.scheme != "https" or parts.netloc != "www.akberlin.de":
    raise ValueError("Unexpected finder origin")

  def get_page(number: int):
    query = dict(parse_qsl(parts.query))
    query["tx_apis_calluniplus[path]"] = f"apotheken/suche/?page={number}&mnb=o"
    url = urlunsplit((*parts[:3], urlencode(query), parts.fragment))
    response = download(url, 512 * 1024)
    data = json.loads(response)
    if data["status"] != "success" or data["num_items"] != len(data["data"]):
      raise ValueError("Incomplete chamber result page")
    # Deliberately exclude phone numbers, staffing and emergency duty schedules.
    records = [
      {k: r.get(k, "") for k in ("name", "street", "zip", "city", "bezirkkey")}
      for r in data["data"]
    ]
    return {
      "page": number,
      "url": url,
      "sha256": digest(response),
      "total": data["num_total"],
      "records": records,
    }

  first = get_page(1)
  page_size = len(first["records"])
  if not page_size or not 1 <= first["total"] <= 2000:
    raise ValueError("Unexpected chamber directory size")
  pages = (first["total"] + page_size - 1) // page_size
  with ThreadPoolExecutor(max_workers=2) as pool:
    results = [first, *pool.map(get_page, range(2, pages + 1))]
  if (
    any(r["total"] != first["total"] for r in results)
    or sum(len(r["records"]) for r in results) != first["total"]
  ):
    raise ValueError("Chamber directory changed during pagination")
  write(
    SOURCE,
    {
      "schemaVersion": 1,
      "retrievedAt": datetime.now(timezone.utc).isoformat(),
      "official": {
        "url": WFS,
        "catalogueUrl": CATALOGUE,
        "sha256": digest(raw),
        "licence": "DL-DE-Zero-2.0",
        "catalogueUpdated": "2024-07-03",
        "payload": wfs,
      },
      "chamber": {
        "url": CHAMBER,
        "usage": "Public facility facts for current-directory cross-check only; no contact or duty data",
        "pages": results,
      },
    },
  )


def extract_osm() -> None:
  """Retain public location/name/address facts from the existing mapped extract."""
  import pyogrio

  records = []
  for layer in ("points", "multipolygons"):
    frame = pyogrio.read_dataframe(
      PBF, layer=layer, where='other_tags LIKE \'%"amenity"=>"pharmacy"%\''
    ).to_crs(25833)
    for _, row in frame.iterrows():
      tags = dict(
        re.findall(r'"([^"\\]+)"=>"((?:[^"\\]|\\.)*)"', row.get("other_tags") or "")
      )
      if (
        tags.get("amenity") != "pharmacy"
        or row.geometry is None
        or row.geometry.is_empty
      ):
        continue
      point = row.geometry if layer == "points" else row.geometry.representative_point()
      osm_id = (
        "way/" + row.osm_way_id
        if isinstance(row.get("osm_way_id"), str)
        else ("relation/" if layer == "multipolygons" else "node/") + row.osm_id
      )
      records.append(
        {
          "id": osm_id,
          "name": row.get("name") if isinstance(row.get("name"), str) else "",
          "easting": round(point.x, 5),
          "northing": round(point.y, 5),
          "geometryType": row.geometry.geom_type,
          "tags": {
            k: v
            for k, v in tags.items()
            if k
            in (
              "amenity",
              "addr:street",
              "addr:housenumber",
              "addr:postcode",
              "addr:city",
              "addr:suburb",
              "addr:district",
              "level",
              "indoor",
              "entrance",
            )
          },
        }
      )
  with PBF.open("rb") as stream:
    source_sha = hashlib.file_digest(stream, "sha256").hexdigest()
  write(
    OSM,
    {
      "schemaVersion": 1,
      "source": "https://download.geofabrik.de/europe/germany/berlin-261113.osm.pbf",
      "sourceDate": "2026-11-13",
      "sourceSha256": source_sha,
      "licence": "OpenStreetMap ODbL 1.0",
      "records": sorted(records, key=lambda r: r["id"]),
    },
  )


def build(
  source: dict, osm: dict | None = None, review: dict | None = None
) -> tuple[dict, dict]:
  """Join current public names to unambiguous official address coordinates."""
  features = source["official"]["payload"]["features"]
  current = [r for page in source["chamber"]["pages"] for r in page["records"]]
  current = [r for r in current if r["city"].casefold() == "berlin"]
  by_address = defaultdict(list)
  for feature in features:
    p = feature["properties"]
    key = address_key(p["gc_strasse"], p["gc_haus"], p["gc_plz"])
    if key:
      by_address[key].append(feature)
  records, unresolved, used, keys = [], [], set(), set()
  for pharmacy in current:
    key = address_key(pharmacy["street"], postcode=pharmacy["zip"])
    identity = (pharmacy["name"], key)
    if identity in keys:
      raise ValueError("Duplicate chamber directory identity")
    keys.add(identity)
    candidates = by_address.get(key, [])
    match_method = "unique-normalized-full-address"
    if not candidates:
      current_street, current_house = split_address(pharmacy["street"])
      candidates = []
      for feature in features:
        p = feature["properties"]
        official_street, official_house = split_address(p["gc_strasse"], p["gc_haus"])
        if (
          current_street
          and current_house
          and name_key(p["aponame"]) == name_key(pharmacy["name"])
          and p["gc_plz"] == pharmacy["zip"]
          and current_street == official_street
          and contains_house(current_house, official_house)
        ):
          candidates.append(feature)
      match_method = "unique-name-postcode-street-and-contained-house-number"
    if len(candidates) != 1:
      unresolved.append(
        {
          "name": pharmacy["name"],
          "street": pharmacy["street"],
          "postcode": pharmacy["zip"],
          "reason": "ambiguous-official-address"
          if candidates
          else "no-official-address-match",
        }
      )
      continue
    feature = candidates[0]
    p = feature["properties"]
    points = feature["geometry"]["coordinates"]
    if (
      feature["geometry"]["type"] != "MultiPoint"
      or len(points) != 1
      or p["gc_id"] in used
    ):
      unresolved.append(
        {
          "name": pharmacy["name"],
          "street": pharmacy["street"],
          "postcode": pharmacy["zip"],
          "reason": "non-unique-official-location",
        }
      )
      continue
    used.add(p["gc_id"])
    easting, northing = points[0]
    records.append(
      {
        "id": "pharmacy:" + p["gc_id"],
        "category": "pharmacy",
        "name": pharmacy["name"],
        "easting": easting,
        "northing": northing,
        "street": p["gc_strasse"],
        "houseNumber": p["gc_haus"],
        "postcode": p["gc_plz"],
        "district": p["gc_ortsteil"],
        "sourceUrl": CATALOGUE,
        "sourceId": feature["id"],
        "evidence": {
          "location": "official-address-point",
          "currentDirectory": CHAMBER,
          "currentStreetAddress": pharmacy["street"],
          "match": match_method,
          "building": "unresolved",
          "entrance": "unresolved",
          "facade": "unverified",
        },
      }
    )
  if osm:
    remaining = []
    for pharmacy in unresolved:
      key = address_key(pharmacy["street"], postcode=pharmacy["postcode"])
      matches = [
        r
        for r in osm["records"]
        if key
        and address_key(
          r["tags"].get("addr:street"),
          r["tags"].get("addr:housenumber"),
          r["tags"].get("addr:postcode"),
        )
        == key
      ]
      method = "unique-mapped-pharmacy-full-address"
      if not matches:
        current_street, current_house = split_address(pharmacy["street"])
        matches = []
        for row in osm["records"]:
          tags = row["tags"]
          street, house = split_address(
            tags.get("addr:street"), tags.get("addr:housenumber")
          )
          if (
            name_key(row["name"]) == name_key(pharmacy["name"])
            and tags.get("addr:postcode") == pharmacy["postcode"]
            and current_street
            and current_street == street
            and contains_house(current_house, house)
          ):
            matches.append(row)
        method = "unique-mapped-name-postcode-street-and-contained-house-number"
      if len(matches) != 1:
        remaining.append({**pharmacy, "osmMatchCount": len(matches)})
        continue
      row = matches[0]
      tags = row["tags"]
      records.append(
        {
          "id": "pharmacy:OSM-" + row["id"].replace("/", "-"),
          "category": "pharmacy",
          "name": pharmacy["name"],
          "easting": row["easting"],
          "northing": row["northing"],
          "street": tags["addr:street"],
          "houseNumber": tags["addr:housenumber"],
          "postcode": tags["addr:postcode"],
          "district": tags.get("addr:suburb", tags.get("addr:district", "")),
          "sourceUrl": "https://www.openstreetmap.org/" + row["id"],
          "sourceId": row["id"],
          "evidence": {
            "location": "mapped-pharmacy-point"
            if row["geometryType"] == "Point"
            else "mapped-pharmacy-area-representative-point",
            "currentDirectory": CHAMBER,
            "currentStreetAddress": pharmacy["street"],
            "match": method,
            "building": "unresolved",
            "entrance": "unresolved",
            "facade": "unverified",
            "level": tags.get("level"),
            "indoor": tags.get("indoor"),
          },
        }
      )
    unresolved = remaining
  reviewed = []
  if review:
    remaining = []
    existing = {r["id"] for r in records}
    for pharmacy in unresolved:
      matches = [
        r
        for r in review["reviews"]
        if r["current"] == {k: pharmacy[k] for k in ("name", "street", "postcode")}
      ]
      if len(matches) != 1:
        remaining.append(pharmacy)
        continue
      decision = matches[0]
      if decision["targetKind"] == "wfs":
        target = next(
          (f for f in features if f["properties"]["gc_id"] == decision["targetId"]),
          None,
        )
        if target != decision["expectedTarget"]:
          raise ValueError("Changed individually reviewed official pharmacy location")
        p = target["properties"]
        easting, northing = target["geometry"]["coordinates"][0]
        row = {
          "id": "pharmacy:" + p["gc_id"],
          "easting": easting,
          "northing": northing,
          "street": p["gc_strasse"],
          "houseNumber": p["gc_haus"],
          "postcode": p["gc_plz"],
          "district": p["gc_ortsteil"],
          "sourceUrl": CATALOGUE,
          "sourceId": target["id"],
        }
        used.add(p["gc_id"])
        location, level = "official-address-point", None
      else:
        if not osm or decision["targetKind"] != "osm":
          raise ValueError("Missing reviewed map source")
        target = next(
          (r for r in osm["records"] if r["id"] == decision["targetId"]), None
        )
        if target != decision["expectedTarget"]:
          raise ValueError("Changed individually reviewed mapped pharmacy location")
        tags = target["tags"]
        row = {
          "id": "pharmacy:OSM-" + target["id"].replace("/", "-"),
          "easting": target["easting"],
          "northing": target["northing"],
          "street": tags["addr:street"],
          "houseNumber": tags.get("addr:housenumber", ""),
          "postcode": tags.get("addr:postcode", pharmacy["postcode"]),
          "district": tags.get("addr:suburb", tags.get("addr:district", "")),
          "sourceUrl": "https://www.openstreetmap.org/" + target["id"],
          "sourceId": target["id"],
        }
        location, level = "mapped-pharmacy-point", tags.get("level")
      if row["id"] in existing:
        raise ValueError(
          "Reviewed pharmacy source already belongs to another current facility"
        )
      existing.add(row["id"])
      records.append(
        {
          **row,
          "name": pharmacy["name"],
          "category": "pharmacy",
          "evidence": {
            "location": location,
            "match": "individually-reviewed-source-identity",
            "currentDirectory": CHAMBER,
            "currentStreetAddress": pharmacy["street"],
            "addressReview": decision["reason"],
            "reviewSources": decision["sources"],
            "building": "unresolved",
            "entrance": "unresolved",
            "facade": "unverified",
            "level": level,
          },
        }
      )
      reviewed.append(decision["current"])
    unresolved = remaining
  records.sort(key=lambda r: r["id"])
  official_matched = sum(r["sourceUrl"] == CATALOGUE for r in records)
  inventory = {
    "schemaVersion": 1,
    "crs": "EPSG:25833",
    "retrievedAt": source["retrievedAt"],
    "sources": [
      {
        "url": CATALOGUE,
        "service": WFS,
        "licence": "DL-DE-Zero-2.0",
        "catalogueUpdated": "2024-07-03",
      },
      {"url": CHAMBER, "role": "current-public-directory-name-and-address-cross-check"},
      *(
        [
          {
            "url": osm["source"],
            "licence": osm["licence"],
            "sourceDate": osm["sourceDate"],
          }
        ]
        if osm
        else []
      ),
    ],
    "records": records,
  }
  evidence = {
    "schemaVersion": 1,
    "retrievedAt": source["retrievedAt"],
    "officialLocationCount": len(features),
    "currentBerlinDirectoryCount": len(current),
    "matchedCurrentLocations": len(records),
    "matchedOfficialLocations": official_matched,
    "matchedOsmLocations": len(records) - official_matched,
    "unresolvedCurrentDirectory": unresolved,
    "individuallyReviewedAddresses": reviewed,
    "officialLocationsWithoutCurrentMatch": [
      {
        "id": f["id"],
        "name": f["properties"]["aponame"],
        "street": f["properties"]["gc_strasse"],
        "houseNumber": f["properties"]["gc_haus"],
        "postcode": f["properties"]["gc_plz"],
      }
      for f in features
      if f["properties"]["gc_id"] not in used
    ],
    "matchedByOrtsteil": dict(sorted(Counter(r["district"] for r in records).items())),
    "policy": "Not an assertion that every directory location is currently open. No obsolete unmatched location becomes a current pharmacy; no guessed storefront, building, interior, medical or opening-hours claim. Facility points require exact host admission before rendering.",
  }
  return inventory, evidence


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--fetch", action="store_true")
  parser.add_argument("--extract-osm", action="store_true")
  args = parser.parse_args()
  if args.fetch:
    fetch()
  if args.extract_osm:
    extract_osm()
  inventory, evidence = build(
    read(SOURCE),
    read(OSM) if OSM.exists() else None,
    read(REVIEW) if REVIEW.exists() else None,
  )
  write(OUT, inventory)
  evidence["sourceSha256"] = digest(SOURCE.read_bytes())
  evidence["inventorySha256"] = digest(OUT.read_bytes())
  if OSM.exists():
    evidence["osmSnapshotSha256"] = digest(OSM.read_bytes())
  if REVIEW.exists():
    evidence["addressReviewSha256"] = digest(REVIEW.read_bytes())
  write(EVIDENCE, evidence)
  print(
    {
      k: evidence[k]
      for k in (
        "officialLocationCount",
        "currentBerlinDirectoryCount",
        "matchedCurrentLocations",
      )
    }
  )


if __name__ == "__main__":
  main()
