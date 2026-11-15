"""Versioned Berlin school/Kita directory snapshot; never invent a building host.

Download uses official public directories only. The retained snapshots are
allowlisted facility fields, not staff contacts, phone numbers or child data.
Rebuilding the inventory is offline and deterministic unless --refresh is used.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import math
import re
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = GEO / "education-v350-source.json.gz"
OUT = GEO / "education-v350-inventory.json.gz"
EVIDENCE = GEO / "education-v350-evidence.json"
FETCHED = "2026-11-15"
SCHOOL_URL = "https://gdi.berlin.de/services/wfs/schulen"
KITA_URL = "https://gdi.berlin.de/services/wfs/kita"
XLSX_URL = "https://www.berlin.de/sen/bildung/service/daten/kitaliste-nov-2025.xlsx"
NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def wire(value: object) -> bytes:
  return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def sha(raw: bytes) -> str:
  return hashlib.sha256(raw).hexdigest()


def clean(value: object) -> str:
  return " ".join(str(value or "").split())


def read_xlsx(raw: bytes) -> list[dict[str, str]]:
  """Read the one official tab without adding a spreadsheet dependency."""
  with zipfile.ZipFile(io.BytesIO(raw)) as archive:
    assert sum(row.file_size for row in archive.infolist()) < 16 * 1024 * 1024
    strings = [
      "".join(node.itertext())
      for node in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall(
        "x:si", NS
      )
    ]
    rows = ET.fromstring(archive.read("xl/worksheets/sheet1.xml")).findall(
      "x:sheetData/x:row", NS
    )
    output = []
    for row in rows:
      values = {}
      for cell in row.findall("x:c", NS):
        content = cell.find("x:v", NS)
        value = content.text if content is not None else ""
        if cell.attrib.get("t") == "s":
          value = strings[int(value)]
        values[re.sub(r"\d", "", cell.attrib["r"])] = clean(value)
      if re.fullmatch(r"\d{8}", values.get("C", "")):
        output.append(
          {
            "id": values["C"],
            "name": values.get("D", ""),
            "district": values.get("B", ""),
            "districtCode": values.get("A", ""),
            "street": values.get("E", ""),
            "houseNumber": values.get("F", ""),
            "postcode": values.get("G", ""),
            "facilityType": values.get("I", ""),
            "easting": values.get("M", ""),
            "northing": values.get("L", ""),
          }
        )
    return output


def fetch_wfs(url: str, type_name: str) -> tuple[list[dict], dict]:
  params = {
    "service": "WFS",
    "version": "2.0.0",
    "request": "GetFeature",
    "typeNames": type_name,
    "outputFormat": "application/json",
  }
  response = requests.get(url, params=params, timeout=60)
  response.raise_for_status()
  assert len(response.content) < 8 * 1024 * 1024
  data = response.json()
  assert data["crs"]["properties"]["name"].endswith("25833")
  assert data["numberMatched"] == data["numberReturned"] == len(data["features"])
  return data["features"], {
    "url": response.url,
    "rawSha256": sha(response.content),
    "rawBytes": len(response.content),
    "records": len(data["features"]),
    "fetched": FETCHED,
  }


def refresh() -> None:
  schools, school_receipt = fetch_wfs(SCHOOL_URL, "schulen:schulen")
  kitas, kita_receipt = fetch_wfs(KITA_URL, "kita:kita")
  response = requests.get(XLSX_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=60)
  response.raise_for_status()
  xlsx = read_xlsx(response.content)
  normalized = {
    "schemaVersion": 1,
    "sources": {},
    "schools": [],
    "kitasWfs": [],
    "kitasXlsx": xlsx,
  }
  normalized["sources"] = {
    "schools": {
      **school_receipt,
      "asOf": "2026/27",
      "license": "dl-de-zero-2.0",
      "catalogue": "https://daten.berlin.de/datensaetze/schulen-wfs-ebc64e18",
    },
    "kitasWfs": {
      **kita_receipt,
      "asOf": "2025-12-31",
      "license": "dl-de-zero-2.0",
      "catalogue": "https://daten.berlin.de/datensaetze/kindertagesstatten-wfs-d03b94d2",
    },
    "kitasXlsx": {
      "url": XLSX_URL,
      "rawSha256": sha(response.content),
      "rawBytes": len(response.content),
      "records": len(xlsx),
      "fetched": FETCHED,
      "asOf": "2025-11-14",
      "license": "CC-BY-4.0",
      "attribution": "Senatsverwaltung für Bildung, Jugend und Familie",
      "catalogue": "https://daten.berlin.de/datensaetze/kitas-in-berlin",
      "licenseEvidence": "https://www.berlin.de/sen/bildung/service/daten/",
    },
  }
  for feature in schools:
    p = feature["properties"]
    assert feature["geometry"]["type"] == "Point"
    e, n = feature["geometry"]["coordinates"]
    normalized["schools"].append(
      {
        "id": clean(p["bsn"]),
        "name": clean(p["schulname"]),
        "schoolType": clean(p["schulart"]),
        "schoolSubtype": clean(p["schultyp"]),
        "operatorType": clean(p["traeger"]),
        "district": clean(p["bezirk"]),
        "locality": clean(p["ortsteil"]),
        "street": clean(p["strasse"]),
        "houseNumber": clean(p["hausnr"]),
        "postcode": clean(p["plz"]),
        "schoolYear": clean(p["schuljahr"]),
        "easting": e,
        "northing": n,
      }
    )
  for feature in kitas:
    p = feature["properties"]
    assert feature["geometry"]["type"] == "Point"
    e, n = feature["geometry"]["coordinates"]
    normalized["kitasWfs"].append(
      {
        "id": clean(p["e_nr"]),
        "name": clean(p["e_name"]),
        "district": clean(p["e_bez"]),
        "districtCode": clean(p["e_bez_nr"]),
        "street": clean(p["e_strasse"]),
        "houseNumber": clean(p["e_hnr"]),
        "addressSupplement": clean(p["e_zusatz"]),
        "postcode": clean(p["e_plz"]),
        "facilityType": clean(p["e_art"]),
        "operatorType": clean(p["t_art"]),
        "easting": e,
        "northing": n,
      }
    )
  for key in ("schools", "kitasWfs", "kitasXlsx"):
    normalized[key].sort(key=lambda row: row["id"])
    assert len({row["id"] for row in normalized[key]}) == len(normalized[key])
  SOURCE.write_bytes(gzip.compress(wire(normalized), mtime=0))


def location(row: dict) -> tuple[float, float] | None:
  try:
    e, n = float(row["easting"]), float(row["northing"])
  except (TypeError, ValueError, KeyError):
    return None
  if not math.isfinite(e + n) or not (350000 < e < 430000 and 5780000 < n < 5860000):
    return None
  return e, n


def build(source: dict) -> tuple[dict, dict]:
  """Main-site points only; combined schools require separate primary-level evidence."""
  records, unresolved = [], []
  for row in source["schools"]:
    if row["schoolType"] != "Grundschule":
      if row["schoolType"] in {
        "Gemeinschaftsschule",
        "Freie Waldorfschule",
        "Kombinierte allgemein bildende Schule",
      }:
        unresolved.append(
          {
            "id": row["id"],
            "name": row["name"],
            "reason": "primary-stage-site-not-verified",
            "schoolType": row["schoolType"],
          }
        )
      continue
    point = location(row)
    if point is None:
      unresolved.append({"id": row["id"], "reason": "invalid-official-coordinate"})
      continue
    records.append(
      {
        **row,
        "id": "school:" + row["id"],
        "category": "primary-school",
        "easting": point[0],
        "northing": point[1],
        "sourceKey": "schools",
        "sourceUrl": SCHOOL_URL,
        "locationEvidence": "official-main-school-site-point",
        "primaryEvidence": "WFS schulart=Grundschule",
      }
    )
  merged = {
    row["id"]: {
      **row,
      "sourceKey": "kitasXlsx",
      "sourceUrl": XLSX_URL,
      "directoryStatus": "older-xlsx-only-current-status-unverified",
    }
    for row in source["kitasXlsx"]
  }
  matched = 0
  for row in source["kitasWfs"]:
    old = merged.get(row["id"])
    if old:
      matched += 1
    merged[row["id"]] = {
      **row,
      "sourceKey": "kitasWfs",
      "sourceUrl": KITA_URL,
      "directoryStatus": "in-latest-official-publicly-funded-snapshot",
    }
    if old:
      merged[row["id"]]["xlsxFacilityType"] = old["facilityType"]
  for row in sorted(merged.values(), key=lambda value: value["id"]):
    point = location(row)
    if point is None:
      unresolved.append(
        {"id": "kita:" + row["id"], "reason": "invalid-official-coordinate"}
      )
      continue
    records.append(
      {
        **row,
        "id": "kita:" + row["id"],
        "category": "kita",
        "easting": point[0],
        "northing": point[1],
        "locationEvidence": "official-facility-point-not-entrance-or-building-footprint",
      }
    )
  records.sort(key=lambda row: row["id"])
  assert len({row["id"] for row in records}) == len(records)
  output = {
    "schemaVersion": 1,
    "crs": "EPSG:25833",
    "sources": source["sources"],
    "records": records,
  }
  evidence = {
    "schemaVersion": 1,
    "sourcePath": str(SOURCE.relative_to(ROOT)),
    "sourceSha256": sha(SOURCE.read_bytes()),
    "counts": dict(Counter(row["category"] for row in records)),
    "schoolOperators": dict(
      Counter(
        row["operatorType"] for row in records if row["category"] == "primary-school"
      )
    ),
    "kitaWfsXlsxMatches": matched,
    "kitaDirectoryStatus": dict(
      Counter(row["directoryStatus"] for row in records if row["category"] == "kita")
    ),
    "byDistrict": {
      category: dict(
        sorted(
          Counter(
            row["district"] for row in records if row["category"] == category
          ).items()
        )
      )
      for category in ("primary-school", "kita")
    },
    "unresolved": unresolved,
    "geometryScope": "Directory coordinates are not measured entrances, wall ownership, building outlines, or photographic facade evidence.",
    "retainedFields": "Only public facility identity/type/address/coordinates/operator class. No telephone, staff contacts, email, capacity or pupil data.",
  }
  return output, evidence


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--refresh", action="store_true")
  args = parser.parse_args()
  if args.refresh:
    refresh()
  inventory, evidence = build(json.loads(gzip.decompress(SOURCE.read_bytes())))
  OUT.write_bytes(gzip.compress(wire(inventory), mtime=0))
  evidence["inventoryPath"] = str(OUT.relative_to(ROOT))
  evidence["inventorySha256"] = sha(OUT.read_bytes())
  evidence["inventoryBytes"] = OUT.stat().st_size
  EVIDENCE.write_bytes(
    (json.dumps(evidence, ensure_ascii=False, indent=2) + "\n").encode()
  )
  print(
    json.dumps(
      {
        "counts": evidence["counts"],
        "bytes": evidence["inventoryBytes"],
        "unresolved": len(evidence["unresolved"]),
      }
    )
  )


if __name__ == "__main__":
  main()
