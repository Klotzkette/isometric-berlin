"""Normalize the official Service Berlin map feeds and exact street addresses."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import date
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

from scripts.build_pharmacies_v350 import address_key

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "geo_data/regierungsviertel/aemter-v355-source.json.gz"
PORTAL = "https://service.berlin.de"
SOURCES = {
  "tax-office": ("tax", "finanzaemter", "finanzamt"),
  "citizen-office": ("citizen", "buergeraemter", "buergeramt"),
}
# Typographical faults in the secondary listing, explicitly linked to its
# identical geocoded main location. Preserve each raw spelling in the evidence.
ADDRESS_ALIASES = {327320: 122251, 351364: 351358}
# Shared facility. Choose the principal public service shown on that building.
PREFERRED = {324108, 122951}
NON_ORDINARY = {
  326001: "dedicated education and participation service",
  327066: "housing-benefit advice, not a general citizen office",
  327603: "backoffice, no public citizen office",
  327761: "mobile service administration at Ausbildungsbürgeramt",
  353815: "mobile service administration at Schlesische Straße",
  350510: "scheduled mobile service in a senior centre",
  317869: "scheduled mobile service in a senior centre",
}
# Exterior roof/facade photographs are a separate source, optionally produced
# by the evidence step. Keep each building source and room use distinguished.


def sha(contents: bytes) -> str:
  return hashlib.sha256(contents).hexdigest()


def urls(list_slug: str, feed_slug: str) -> tuple[str, str]:
  return f"{PORTAL}/standorte/{list_slug}/", f"{PORTAL}/standorte/geojson/{feed_slug}"


def download(url: str) -> bytes:
  return urlopen(
    Request(url, headers={"User-Agent": "Isometric Berlin geodata verification"}),
    timeout=30,
  ).read()


def fetch(directory: Path) -> None:
  directory.mkdir(parents=True, exist_ok=True)
  for name, list_slug, map_slug in SOURCES.values():
    listing, feed = urls(list_slug, map_slug)
    (directory / f"{name}.html").write_bytes(download(listing))
    (directory / f"{name}.json").write_bytes(download(feed))


def clean(value: str) -> str:
  return " ".join(unescape(value).split())


def extract(feature: dict) -> dict:
  source_id = int(feature["id"])
  properties = feature["properties"]
  description = properties["description"]
  address_match = re.search(r"<p>([^<]*?)<br\s*/?>", description)
  authority_match = re.search(r"<div>([^<]*?)</div>", description)
  href = re.search(r'href="(https://service\.berlin\.de/standort/\d+/)"', description)
  if address_match is None or authority_match is None or href is None:
    raise ValueError(f"Missing portal fields for {source_id}")
  address = clean(address_match[1])
  name = clean(properties["name"])
  if (
    feature["geometry"]["type"] != "Point"
    or href[1] != f"{PORTAL}/standort/{source_id}/"
  ):
    raise ValueError(f"Invalid portal location {source_id}")
  lon, lat = map(float, feature["geometry"]["coordinates"])
  raw_coordinates = [lon, lat]
  # One non-fixed mobile entry in the feed has its latitude and longitude
  # reversed. Preserve the original pair and reject any unknown invalid pair.
  if source_id == 327761 and 52.3 < lon < 52.7 and 12.9 < lat < 13.9:
    lon, lat = lat, lon
  if not 12.9 < lon < 13.9 or not 52.3 < lat < 52.7:
    raise ValueError(f"Portal point for {source_id} lies outside the Berlin extent")
  return {
    "portalId": source_id,
    "name": name,
    "address": address,
    "authority": clean(authority_match[1]),
    "sourceUrl": href[1],
    "lon": lon,
    "lat": lat,
    **(
      {"portalCoordinateOrder": raw_coordinates}
      if raw_coordinates != [lon, lat]
      else {}
    ),
  }


def key(address: str) -> str:
  match = re.fullmatch(r"(.*?),\s*(\d{5})\s+Berlin", address)
  return address_key(match[1], postcode=match[2]) if match else ""


def priority(row: dict) -> tuple:
  name = row["name"]
  secondary = bool(
    re.search(
      r" - | -[Zz]weitwohnung|Grunderwerbsteuerstelle|Hundesteuerstelle|^Flüchtlings|\(Außenstelle\)",
      name,
    )
  )
  return (row["portalId"] not in PREFERRED, secondary, row["portalId"])


def prepare(directory: Path, checked_at: str) -> dict:
  sites = []
  unresolved = []
  sources = []
  audit = {}
  for kind, (file_name, list_slug, map_slug) in SOURCES.items():
    html = (directory / f"{file_name}.html").read_bytes()
    raw = (directory / f"{file_name}.json").read_bytes()
    listing_url, map_url = urls(list_slug, map_slug)
    id_list = set(map(int, re.findall(r'href="/standort/(\d+)/"', html.decode())))
    rows = [extract(r) for r in json.loads(raw)[map_slug]["data"]["features"]]
    by_id = {row["portalId"]: row for row in rows}
    if id_list != by_id.keys() or len(by_id) != len(rows):
      raise ValueError(f"Listed and geocoded portal coverage differs for {kind}")
    sources += [
      {"url": listing_url, "sha256": sha(html)},
      {"url": map_url, "sha256": sha(raw)},
    ]
    physical = defaultdict(list)
    outcomes = Counter()
    for row in rows:
      portal_id = row["portalId"]
      if portal_id in NON_ORDINARY:
        unresolved.append({"kind": kind, **row, "reason": NON_ORDINARY[portal_id]})
        outcomes["nonOrdinaryService"] += 1
        continue
      normalized = key(by_id[ADDRESS_ALIASES.get(portal_id, portal_id)]["address"])
      if not normalized:
        raise ValueError(f"Missing exact street/house/postcode for {portal_id}")
      if portal_id in ADDRESS_ALIASES:
        alias = by_id[ADDRESS_ALIASES[portal_id]]
        if (row["lon"], row["lat"]) != (alias["lon"], alias["lat"]):
          raise ValueError(f"Known typo alias no longer at main point: {portal_id}")
      physical[normalized].append(row)
    for normalized, group in physical.items():
      main, *aliases = sorted(group, key=priority)
      _, number, postal_code = normalized.split("|")
      site_id = f"berlin-service-{main['portalId']}"
      sites.append(
        {
          "id": site_id,
          "kind": kind,
          **main,
          "houseNumber": number,
          "postcode": postal_code,
          "coordinateEvidence": "official-service-berlin-map-point",
          "addressKey": normalized,
          "services": aliases,
        }
      )
      outcomes["combinedAddressRows"] += len(aliases)
    outcomes["physicalAddresses"] = len(physical)
    outcomes["officialPortalRows"] = len(rows)
    if kind == "tax-office":
      outcomes["taxAuthorities"] = len({row["authority"] for row in rows})
    if sum(
      outcomes[x]
      for x in ("physicalAddresses", "combinedAddressRows", "nonOrdinaryService")
    ) != len(rows):
      raise ValueError(f"Portal record lost: {kind}")
    audit[kind] = dict(outcomes)
  return {
    "schemaVersion": 1,
    "checkedAt": checked_at,
    "sources": sources,
    "sites": sorted(sites, key=lambda row: (row["kind"], row["name"], row["id"])),
    "unresolved": sorted(unresolved, key=lambda row: row["portalId"]),
    "audit": audit,
  }


def archive(output: Path, data: dict) -> None:
  output.write_bytes(
    gzip.compress(
      json.dumps(
        data, ensure_ascii=False, sort_keys=True, separators=(",", ":")
      ).encode(),
      mtime=0,
    )
  )


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "directory", type=Path, help="Scratch location for HTML and JSON source snapshots"
  )
  parser.add_argument(
    "--fetch", action="store_true", help="Refresh both official portal snapshots"
  )
  parser.add_argument("--date", default=str(date.today()))
  parser.add_argument("--out", type=Path, default=OUTPUT)
  args = parser.parse_args()
  if args.fetch:
    fetch(args.directory)
  data = prepare(args.directory, args.date)
  archive(args.out, data)
  print(json.dumps(data["audit"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
  main()
