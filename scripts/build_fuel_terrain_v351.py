"""Step 10: retain exact official DGM1 samples for finite filling-station sites."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import tempfile
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Any

import requests
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
BASE = "https://gdi.berlin.de/data/dgm1/atom/"


def cell_for(x: float, z: float) -> tuple[str, int, int]:
  """Bind a world point to its actual one-metre DGM cell centre."""
  east, north = math.floor(x + 389500), math.floor(5820000 - z)
  code = f"{east // 2000 * 2}_{north // 2000 * 2}"
  return code, east, north


def site_points(row: dict[str, Any]) -> list[tuple[float, float]]:
  """Sample original polygon vertices and a two-metre support lattice."""
  roof = shape(row["roof"]["geometry"])
  site = shape(row["site"]["geometry"])
  floor = site if site.geom_type in ("Polygon", "MultiPolygon") else roof
  assert floor.area < 50000 and roof.area < 10000
  points = {(roof.representative_point().x, roof.representative_point().y)}
  for geom in (roof, floor):
    for poly in list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]:
      for ring in (poly.exterior, *poly.interiors):
        points.update((float(x), float(z)) for x, z in ring.coords)
  # Include one surrounding source cell for interpolation at the source edges.
  minx, minz, maxx, maxz = floor.bounds
  for x in range(math.floor(minx) - 2, math.ceil(maxx) + 3, 2):
    for z in range(math.floor(minz) - 2, math.ceil(maxz) + 3, 2):
      points.add((x + 0.5, z + 0.5))
  assert len(points) < 25000
  return sorted(points)


def read_cells(
  path: Path, code: str, wanted: set[tuple[int, int]]
) -> tuple[dict[tuple[int, int], float], str]:
  """Stream the source once; parse only requested exact coordinate records."""
  base_e, base_n = (int(v) * 1000 for v in code.split("_"))
  assert all(
    base_e <= e < base_e + 2000 and base_n <= n < base_n + 2000 for e, n in wanted
  )
  found = {}
  with zipfile.ZipFile(path) as archive:
    members = [name for name in archive.namelist() if name.lower().endswith(".xyz")]
    assert len(members) == 1
    member = members[0]
    with archive.open(member) as stream:
      for line in stream:
        fields = line.split()
        east, north = float(fields[0]), float(fields[1])
        e, n = math.floor(east), math.floor(north)
        if (e, n) not in wanted:
          continue
        height = float(fields[2])
        assert east == e + 0.5 and north == n + 0.5
        assert math.isfinite(height) and -10 <= height <= 150
        found[(e, n)] = height
        if len(found) == len(wanted):
          break
  assert found.keys() == wanted, (code, sorted(wanted - found.keys())[:8])
  return found, member


def build(candidates: Path) -> dict[str, Any]:
  source_bytes = (GEO / "fuel-v351-source.json.gz").read_bytes()
  source = json.loads(gzip.decompress(source_bytes))
  source_roofs = {r["id"]: r for r in source["roofs"]}
  rows = [r for r in json.loads(candidates.read_text()) if not r["hosts"]]
  for row in rows:
    assert row["roof"]["geometry"] == source_roofs[row["roof"]["id"]]["geometry"]
  return build_sites(rows, source_bytes)


def build_sites(rows: list[dict[str, Any]], source_bytes: bytes) -> dict[str, Any]:
  """Retain source-bound heights for a finite collection of mapped site outlines."""
  requested = defaultdict(set)
  by_roof = {}
  for row in rows:
    points = site_points(row)
    by_roof[row["roof"]["id"]] = points
    for x, z in points:
      code, e, n = cell_for(x, z)
      requested[code].add((e, n))
  local = {
    p.name.lower(): p
    for p in (GEO / "raw").rglob("*.zip")
    if p.name.lower().startswith("dgm1_")
  }
  heights, receipts = {}, []
  cache = GEO / "raw/city-v351/fuel-dgm-samples"
  cache.mkdir(parents=True, exist_ok=True)
  with tempfile.TemporaryDirectory(prefix="fuel-v351-dgm-") as temp:
    for code, wanted in sorted(requested.items()):
      cached = cache / f"{code}.json"
      if cached.exists():
        saved = json.loads(cached.read_text())
        cells = {(e, n): height for e, n, height in saved["cells"]}
        if wanted <= cells.keys():
          heights.update({(code, e, n): cells[(e, n)] for e, n in wanted})
          receipts.append(saved["receipt"])
          print(code, len(wanted), "sample-cache", flush=True)
          continue
      name = f"DGM1_{code}.zip"
      path = local.get(name.lower())
      downloaded = path is None
      if downloaded:
        path = Path(temp) / name
        with requests.get(BASE + name, stream=True, timeout=(20, 60)) as response:
          response.raise_for_status()
          with path.open("wb") as target:
            for chunk in response.iter_content(1024 * 1024):
              target.write(chunk)
      assert path is not None
      with path.open("rb") as handle:
        digest = hashlib.file_digest(handle, "sha256").hexdigest()
      cells, member = read_cells(path, code, wanted)
      heights.update({(code, e, n): height for (e, n), height in cells.items()})
      receipts.append(
        {
          "tile": code,
          "url": BASE + name,
          "bytes": path.stat().st_size,
          "sha256": digest,
          "member": member,
          "sampleCount": len(cells),
        }
      )
      cached.write_text(
        json.dumps(
          {
            "receipt": receipts[-1],
            "cells": [[e, n, h] for (e, n), h in sorted(cells.items())],
          }
        )
      )
      print(code, len(cells), "downloaded" if downloaded else "retained", flush=True)
      if downloaded:
        path.unlink()  # Only this job's disposable downloaded archive, after sampling.
  sites = []
  for row in rows:
    samples = []
    for x, z in by_roof[row["roof"]["id"]]:
      code, e, n = cell_for(x, z)
      nhn = heights[(code, e, n)]
      samples.append(
        {
          "queryXZ": [x, z],
          "sourceXZ": [e + 0.5 - 389500, 5820000 - (n + 0.5)],
          "heightNHN": nhn,
          "worldY": round(nhn - 30, 2),
          "tile": code,
        }
      )
    sites.append(
      {"roofId": row["roof"]["id"], "siteId": row["site"]["id"], "samples": samples}
    )
  return {
    "schemaVersion": 1,
    "sourceSha256": hashlib.sha256(source_bytes).hexdigest(),
    "source": "Geoportal Berlin ATKIS DGM1 / dl-de-zero-2.0",
    "datum": "DHHN2016; world y = NHN - 30m",
    "policy": "Exact nearest original 1m cell centres at mapped vertices and a 2m support lattice; interpolation between these samples is a model approximation. No existing terrain is modified.",
    "tiles": receipts,
    "sites": sites,
  }


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--candidates", type=Path, required=True)
  args = parser.parse_args()
  payload = build(args.candidates)
  destination = GEO / "fuel-v351-terrain.json.gz"
  data = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode()
  destination.write_bytes(gzip.compress(data, compresslevel=9, mtime=0))
  print(
    {
      "sites": len(payload["sites"]),
      "tiles": len(payload["tiles"]),
      "bytes": destination.stat().st_size,
    },
    flush=True,
  )


if __name__ == "__main__":
  main()
