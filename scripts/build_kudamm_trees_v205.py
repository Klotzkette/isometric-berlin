"""Retain only missing, officially mapped Kurfürstendamm street trees."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from shapely.geometry import Point, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data/kudammTreesV205.json"


def build() -> dict:
  """Clip official points to the mapped boulevard and exclude existing trees."""
  raw = json.loads((GEO / "raw/kudamm-v205/trees.json").read_text())
  roads = json.loads((GEO / "west-streets-v163.json").read_text())["roads"]
  corridor = unary_union(
    [shape(r["geometry"]) for r in roads if r["name"] == "Kurfürstendamm"]
  ).buffer(32)
  old = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/park-details.json").read_text()
  )["trees"]
  positions = np.array([[t["position"][0], t["position"][2]] for t in old])
  trees = []
  source = []
  for feature in raw["features"]:
    p = feature["properties"]
    if p["strname"] != "Kurfürstendamm":
      continue
    e, n = feature["geometry"]["coordinates"]
    x, z = e - 389500, 5820000 - n
    if not corridor.covers(Point(x, z)):
      continue
    if np.any(np.sum((positions - [x, z]) ** 2, axis=1) < 9):
      continue
    height = float(p.get("baumhoehe") or 9)
    crown = float(p.get("kronedurch") or 5)
    trunk = float(p.get("stammumfg") or 75) / (100 * np.pi)
    trees.append([round(x, 4), round(z, 4), height, crown, round(trunk, 3)])
    source.append(feature)
  evidence = {
    "type": "FeatureCollection",
    "crs": {"type": "name", "properties": {"name": "EPSG:25833"}},
    "source": "https://gdi.berlin.de/services/wfs/baumbestand",
    "licence": "dl-de/zero-2-0",
    "layer": "baumbestand:strassenbaeume",
    "retrieved": "2026-10-10",
    "features": source,
  }
  (GEO / "kudamm-trees-v205-source.geojson").write_text(
    json.dumps(evidence, separators=(",", ":")) + "\n"
  )
  result = {
    "trees": trees,
    "sourceIds": [f["properties"]["gisid"] for f in source],
    "estimates": "Missing heights 9 m, crowns 5 m, circumference 75 cm; crown silhouettes are procedural. Exact catalogue locations retained; existing trees within 3 m excluded.",
  }
  DATA.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  print(f"Added {len(trees)} measured tree locations, {DATA.stat().st_size} bytes")
  return result


if __name__ == "__main__":
  build()
