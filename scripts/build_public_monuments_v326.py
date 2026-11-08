"""Strict public-memorial accounting and finite missing Stolperstein supplements.

Heritage building records and nearby rendered buildings are never sculpture
coverage. Original sources and all earlier monument geometry stay unchanged.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/public-fidelity-v326"
DATA = ROOT / "src/app/src/data"
STREET = ROOT / "src/app/public/mesh/regierungsviertel/street-details.json"
AUTHORED = {
  "node/278738513": "TiergartenLiteraryMemorials.ts",
  "node/884700390": "TiergartenLiteraryMemorials.ts",
  "node/243487615": "WagnerMemorial.ts",
  "node/276956108": "MusicComposerMemorial.ts",
  "node/270687313": "BismarckMoltkeMonuments.ts",
  "node/278706862": "BismarckMoltkeMonuments.ts",
  "node/262457570": "SchillerMonument.ts",
  "way/187360886": "BerlinJunction.ts",
  "node/966034352": "AlterDessauerMonument.ts",
}


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path, value):
  raw = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def build():
  audit = read(RAW / "public-inventory-audit.json.gz")
  source_rows = [q for q in audit["sites"] if q["category"] == "monument"]
  if len(source_rows) != 9029:
    raise ValueError("Changed complete Berlin memorial inventory")
  old = {q["osm_key"]: q for q in read(STREET)["monuments"]}
  # References elsewhere are only candidates. Exact rendering still requires
  # its actual caller/geometry; a source string alone cannot upgrade accuracy.
  references = {}
  for file in sorted((ROOT / "src/app/src").glob("*.ts")):
    for match in set(re.findall(r"(?:node|way|relation)/\d+", file.read_text())):
      references.setdefault(match, []).append(file.name)
  entries, ledger = [], []
  for item in source_rows:
    t, sid = item["tags"], item["sourceIdentity"]
    subtype = t.get("memorial", t.get("historic", "unclassified"))
    result = {
      "id": item["id"],
      "sourceIdentity": sid,
      "name": item["name"],
      "subtype": subtype,
      "geometry": item["geometry"],
      "tags": t,
      "suppliedDimensions": {
        k: t[k]
        for k in [
          "height",
          "width",
          "length",
          "material",
          "direction",
          "inscription",
          "artist_name",
          "start_date",
        ]
        if k in t
      },
      "codeReferenceCandidates": references.get(sid, []),
      "candidateBuildingOwnersAreNotMonumentCoverage": True,
    }
    if sid in AUTHORED:
      result.update(
        status="retained-specific-authored",
        module=AUTHORED[sid],
        accuracy="Existing individual source-bound model retained; no new photographic survey claimed",
      )
    elif sid in old:
      result.update(
        status="retained-existing-caller-record",
        existingCaller="TiergartenMonuments.ts / street-details.json",
        previousRecord=old[sid],
        accuracy="Existing typed or authored representation preserved; individual accuracy not inferred from the input record",
      )
    elif subtype == "stolperstein" and item["geometry"]["type"] == "Point":
      point = item["geometry"]["coordinates"]
      key = str(math.floor(point[0] / 512)) + "_" + str(math.floor(point[1] / 512))
      entries.append(
        {
          "id": sid,
          "key": key,
          "point": point,
          "name": item["name"],
          "inscription": t.get("inscription"),
          "sourceDirection": t.get("direction"),
        }
      )
      result.update(
        status="source-supported-standard-supplement",
        key=key,
        accuracy="Actual source point; documented10x10cm horizontal brass top. Surface height must be sampled by the actual caller. Exact text retained as source metadata, not a reproduced lettering facsimile.",
      )
    else:
      result.update(
        status="unresolved-individual-geometry",
        accuracy="Source identity retained. Missing measured footprint/height/material/orientation or individual interpretation; no identical generic statue or guessed wall plaque added",
      )
    ledger.append(result)
  counts = Counter(q["status"] for q in ledger)
  source = {
    "schemaVersion": 1,
    "sourceDate": "2026-09-29",
    "checked": "2026-11-08",
    "policy": "Strict Berlin OSM public memorial inventory; protected building areas are a separate heritage inventory, never counted as statues. Building proximity and code references alone are not rendered monument coverage.",
    "inputs": {
      str(p.relative_to(ROOT)): sha(p)
      for p in [
        RAW / "memorial_points.geojson.gz",
        RAW / "memorial_areas.geojson.gz",
        RAW / "denkmale-current.geojson",
        STREET,
      ]
    },
    "retainedAuthoredModules": {
      file: sha(ROOT / "src/app/src" / file) for file in sorted(set(AUTHORED.values()))
    },
    "heritageRecordCount": len(read(RAW / "denkmale-current.geojson")["features"]),
    "publicMemorialCount": len(ledger),
    "subtypeCounts": dict(Counter(q["subtype"] for q in ledger)),
    "statusCounts": dict(counts),
    "records": ledger,
  }
  target = GEO / "public-monuments-v326-source.json.gz"
  write(target, source)
  keys = sorted({q["key"] for q in entries})
  reference_rows = [
    {
      "kind": "primary",
      "url": "https://www.stolpersteine-berlin.de/de",
      "facts": "Concrete cube10cm with horizontal brass upper plate, flush within the pavement",
      "accessed": "2026-11-08",
    },
    {
      "kind": "primary",
      "url": "https://museen-tempelhof-schoeneberg.de/stolpersteine/",
      "facts": "10x10cm individualized pavement brass memorials",
      "accessed": "2026-11-08",
    },
    {
      "kind": "external-photo-reference",
      "title": "Stolpersteine, Berlin (LRM20250228134639).jpg",
      "url": "https://commons.wikimedia.org/wiki/File:Stolpersteine,_Berlin_(LRM_20250228_134639).jpg",
      "author": "Matti Blume",
      "date": "2025-02-28",
      "license": "CC BY-SA4.0 (selected from author's multi-license)",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
      "use": "Per-file page/license checked; no pixels bundled or rendered",
    },
  ]
  profile = {
    "schemaVersion": 1,
    "sourceSha256": sha(target),
    "widthM": 0.1,
    "depthM": 0.1,
    "keys": keys,
    "entries": entries,
    "references": reference_rows,
  }
  write(DATA / "publicMonumentsV326.json", profile)
  write(
    DATA / "publicMonumentsV326Index.json",
    {
      "schemaVersion": 1,
      "keys": keys,
      "entries": [
        {"id": q["id"], "key": q["key"], "point": q["point"]} for q in entries
      ],
    },
  )
  print(
    {
      "strictPublicMemorials": len(ledger),
      "separateHeritage": source["heritageRecordCount"],
      "counts": dict(counts),
      "newStones": len(entries),
      "keys": len(keys),
      "largestKey": max(Counter(q["key"] for q in entries).values()),
    }
  )


if __name__ == "__main__":
  build()
