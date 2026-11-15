"""Compare actual browser-side expanded sheets to every original new surface."""

from __future__ import annotations

import base64
import gzip
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import shapely
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "geo_data/regierungsviertel/raw/facility-paths-v350"


def regions(mesh):
  p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  c = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
  ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  grouped = defaultdict(list)
  for tri in ix:
    assert np.all(p[tri, 1] == p[tri[0], 1])
    assert np.all(c[tri] == c[tri[0]])
    grouped[(int(p[tri[0], 1]), *[int(v) for v in c[tri[0]]])].append(p[tri][:, [0, 2]])
  return {
    key: unary_union(shapely.polygons(np.array(rows))) for key, rows in grouped.items()
  }


def main():
  original = json.loads(gzip.decompress((RAW / "full-plans.json.gz").read_bytes()))
  expanded = json.loads(gzip.decompress((RAW / "expanded-meshes.json.gz").read_bytes()))
  assert original.keys() == expanded.keys()
  compared = 0
  worst = 0.0
  for key, plan in original.items():
    a, b = regions(plan["append"]), regions(expanded[key])
    assert a.keys() == b.keys(), f"Changed height/material groups: {key}"
    for group in a:
      difference = a[group].symmetric_difference(b[group]).area
      assert difference < 1e-5, (key, group, difference)
      worst = max(worst, difference)
      compared += 1
  result = dict(
    schemaVersion=1,
    plans=len(original),
    materialHeightRegions=compared,
    maxSymmetricDifferenceSquareCentimetres=worst,
    policy="Every source-colour and exact-centimetre-height footprint remains equal through actual TypeScript expansion; holes, islands and fractional quantization intersections retained. No baseline city faces changed.",
  )
  (
    ROOT / "geo_data/regierungsviertel/education-v350-paths-surface-proof.json"
  ).write_text(json.dumps(result, indent=2) + "\n")
  print(json.dumps(result))


if __name__ == "__main__":
  main()
