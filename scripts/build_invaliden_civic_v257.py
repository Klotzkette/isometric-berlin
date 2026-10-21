"""Bounded read-only BMV wall anchors and current Scharnhorst plant evidence."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
OWNERS = {
  "historic": (
    "DEBE01YYK00003e6",
    {"DEBE3DzFmtfBBw3p": [3, 7, 10], "DEBE3DxThGsqgL1R": [7], "DEBE3DJ3F4RN5BnD": [0]},
  ),
  "dudlerC": ("DEBE01YYK0000AaT", {"DEBE3DY2sadnS9NN": [1, 3, 4, 5, 6, 7]}),
  "dudlerD": ("DEBE01YYK00009dA", {"DEBE3DphCizeq2qQ": [1, 2, 9, 10, 11, 14]}),
  "plant": (
    "DEBE01YYK00007q7",
    {"DEBE3DUaCXdt6nfj": [1, 2, 4, 5], "DEBE3DApd6PFwd62": [1, 2, 6]},
  ),
}


def digest(value):
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def build():
  path = "geo_data/regierungsviertel/alt-mitte-v169/source-389_5821-00.json.gz"
  raw = (ROOT / path).read_bytes()
  buildings = json.loads(gzip.decompress(raw))["buildings"]
  sites = {}
  for name, (owner, selection) in OWNERS.items():
    b = next(b for b in buildings if b["id"] == owner)
    faces = []
    for p in b["parts"]:
      poly = unary_union(
        [Polygon(f["ring"], f["holes"]) for f in p["footprintPolygons"]]
      )
      for index in selection.get(p["id"], []):
        s = p["surfaces"][index]
        assert s["kind"] == "WallSurface"
        r = s["rings"][0]
        a, c = max(
          ((a, c) for a in r for c in r),
          key=lambda ac: math.hypot(ac[0][0] - ac[1][0], ac[0][2] - ac[1][2]),
        )
        dx, dz = c[0] - a[0], c[2] - a[2]
        length = math.hypot(dx, dz)
        nx, nz = dz / length, -dx / length
        if poly.covers(
          Point((a[0] + c[0]) / 2 + nx * 0.1, (a[2] + c[2]) / 2 + nz * 0.1)
        ):
          nx, nz = -nx, -nz
        faces.append(
          {
            "part": p["id"],
            "index": index,
            "a": [a[0], a[2]],
            "b": [c[0], c[2]],
            "normal": [round(nx, 8), round(nz, 8)],
            "bottom": min(v[1] for v in r),
            "top": min(v[1] for v in r if v[1] > min(q[1] for q in r) + 0.2),
            "surfaceSha256": digest(s),
          }
        )
    sites[name] = {
      "owner": owner,
      "buildingSha256": digest(b),
      "parts": len(b["parts"]),
      "faces": faces,
    }
  osm = json.loads(
    (ROOT / "geo_data/regierungsviertel/invaliden-civic-v257-osm.json").read_text()
  )
  t = Transformer.from_crs(4326, 25833, always_xy=True)
  stacks = []
  for n in osm["elements"]:
    if n["type"] != "node":
      continue
    e, north = t.transform(*n["geometry"][0])
    stacks.append(
      {
        "osmNode": n["id"],
        "point": [round(e - 389500, 3), round(5820000 - north, 3)],
        "height": float(n["tags"]["height"]),
        "radiusEstimate": 1.9,
      }
    )
  return {
    "schema": 1,
    "sourcePath": path,
    "sourceSha256": hashlib.sha256(raw).hexdigest(),
    "sites": sites,
    "stacks": stacks,
    "policy": "Retain all original envelopes and source packets; shallow reference-estimated fittings only. The old 150m chimney is absent from retained building/prism inventory; no source deletion. Two current 35m OSM node anchors. Independent native boxes, identical drawn mobile detail.",
  }


if __name__ == "__main__":
  p = ROOT / "src/app/src/data/invalidenCivicV257.json"
  p.write_text(json.dumps(build(), separators=(",", ":")) + "\n")
  print(p.stat().st_size)
