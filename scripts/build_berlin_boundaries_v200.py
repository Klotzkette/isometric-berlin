"""Complete official state-boundary and 1989 front-wall cartographic hairlines."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

import requests
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
RAW = DATA / "raw/berlin-boundaries-v200"
RUNTIME = ROOT / "src/app/src/data"
LAYERS = {
  "state": ("alkis_land", "landesgrenze"),
  "wall": ("berlinermauer", "a_grenzmauer"),
}


def encode(value) -> bytes:
  return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def fetch(service: str, layer: str) -> dict:
  path = RAW / f"{layer}.geojson"
  if not path.exists():
    RAW.mkdir(parents=True, exist_ok=True)
    response = requests.get(
      f"https://gdi.berlin.de/services/wfs/{service}",
      params={
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": f"{service}:{layer}",
        "srsName": "EPSG:25833",
        "outputFormat": "application/json",
        "count": 100000,
      },
      timeout=90,
    )
    response.raise_for_status()
    path.write_bytes(response.content)
  source = json.loads(path.read_bytes())
  assert source["type"] == "FeatureCollection"
  assert source["numberMatched"] == source["numberReturned"] == len(source["features"])
  return source


def source_parts(geometry):
  """Never connect different mapped pieces or confuse polygon fills with borders."""
  kind = geometry["type"]
  rows = geometry["coordinates"]
  if kind == "LineString":
    return [rows]
  if kind in ("MultiLineString", "Polygon"):
    return rows
  if kind == "MultiPolygon":
    return [ring for polygon in rows for ring in polygon]
  raise ValueError(kind)


def build() -> dict:
  runtime, evidence, retained = {}, {}, {}
  extent = [float("inf"), float("inf"), -float("inf"), -float("inf")]
  for kind, (service, layer) in LAYERS.items():
    source = fetch(service, layer)
    retained[kind] = source
    xz, segments, parts = [], [], []
    source_count, length = 0, 0.0
    for feature in source["features"]:
      length += shape(feature["geometry"]).length
      for ring in source_parts(feature["geometry"]):
        first = len(xz) // 2
        original = []
        for i, point in enumerate(ring):
          x, z = point[0] - 389500, 5820000 - point[1]
          if i:
            ax, az = ring[i - 1][0] - 389500, 5820000 - ring[i - 1][1]
            count = max(1, math.ceil(math.hypot(x - ax, z - az) / 24))
            for j in range(1, count):
              xz.extend([ax + (x - ax) * j / count, az + (z - az) * j / count])
          original.append(len(xz) // 2)
          xz.extend([x, z])
          extent = [
            min(extent[0], x),
            min(extent[1], z),
            max(extent[2], x),
            max(extent[3], z),
          ]
          source_count += 1
        count = len(xz) // 2 - first
        for index in range(first, first + count - 1):
          segments.extend([index, index + 1])
        parts.append(
          {
            "sourceId": feature["id"],
            "first": first,
            "count": count,
            "original": original,
          }
        )
    runtime[kind + "Xz"] = xz
    runtime[kind + "Segments"] = segments
    evidence[kind] = {
      "service": f"https://gdi.berlin.de/services/wfs/{service}",
      "typeName": f"{service}:{layer}",
      "srsName": "EPSG:25833",
      "numberMatched": source["numberMatched"],
      "numberReturned": source["numberReturned"],
      "sourceSha256": hashlib.sha256(
        (RAW / f"{layer}.geojson").read_bytes()
      ).hexdigest(),
      "sourceVertexCount": source_count,
      "runtimeVertexCount": len(xz) // 2,
      "segmentCount": len(segments) // 2,
      "lengthM": length,
      "sourceClasses": dict(
        Counter(
          f["properties"].get("objekt", "Landesgrenze") for f in source["features"]
        )
      ),
      "parts": parts,
    }
  runtime_path = RUNTIME / "berlinBoundariesV200.json"
  runtime_path.write_bytes(encode(runtime))
  receipt = gzip.compress(encode(retained), compresslevel=9, mtime=0)
  source_path = DATA / "berlin-boundaries-v200-source.json.gz"
  source_path.write_bytes(receipt)
  evidence.update(
    {
      "revision": "v1.0.100",
      "bounds": extent,
      "license": "dl-de/zero-2-0",
      "sourceReceipt": {
        "path": source_path.name,
        "sha256": hashlib.sha256(receipt).hexdigest(),
        "bytes": len(receipt),
      },
      "runtimeSha256": hashlib.sha256(runtime_path.read_bytes()).hexdigest(),
      "policy": "Every original XZ vertex is retained; only straight collinear subdivision at24m maximum supplies terrain sampling. No part joins, simplification, fills or collision. Native overlay retains exact geographic XZ and samples native terrain separately.",
      "stateMeaning": "Current Berlin state boundary from ALKIS, including every source polygon ring.",
      "wallMeaning": "All 118 official Grenzmauer features: 116 Vorderlandmauer and 2 explicitly mapped Unterwassergrenze sections. Not Hinterlandmauer, current border or the separate political-border layer. Mapped gaps remain open; water sections are historical boundary annotations, not invented solid walls.",
      "wallAccuracy": "Hand-digitized from 25 April 1989 aerial imagery on 1:5000/1:10000 mapping; official documentation warns preliminary and not cadastral accuracy.",
      "metadataUrls": [
        "https://daten.berlin.de/datensaetze/alkis-berlin-landesgrenze-wfs-07b1347b",
        "https://daten.berlin.de/datensaetze/verlauf-der-berliner-mauer-1989-wfs-3dcda64c",
        "https://gdi.berlin.de/data/berlinermauer/docs/mauer.pdf",
      ],
    }
  )
  (DATA / "berlin-boundaries-v200-evidence.json").write_bytes(encode(evidence))
  (RUNTIME / "berlinBoundariesV200Scope.json").write_bytes(encode({"bounds": extent}))
  print(
    encode(
      {
        k: {
          key: evidence[k][key]
          for key in ["numberMatched", "runtimeVertexCount", "segmentCount", "lengthM"]
        }
        for k in LAYERS
      }
    ).decode()
  )
  return evidence


if __name__ == "__main__":
  argparse.ArgumentParser(description=__doc__).parse_args()
  build()
