"""Read-only, bounded facade anchors for CUBIX and the RathausPassagen."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
OWNERS = {
  "cubix": ("392_5820", "DEBE01YYK000097N", "25112082"),
  "rathauspassagen": ("392_5819", "DEBE01YYK00003PR", "25094154"),
}
SELECTION = {
  "cubix": {"DEBE3DHEHDxnzL4J": [0, 7, 9, 11, 16, 20, 21, 27]},
  "rathauspassagen": {
    "DEBE3DVE8ksXnT9L": [2, 12, 16, 21, 23, 37, 39, 40],
    "DEBE3DxF6b2v0Ekh": [1, 2, 17, 19, 22, 23],
  },
}


def digest(value: object) -> str:
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def build() -> dict:
  sites = {}
  for key, (tile, parent, osm) in OWNERS.items():
    relative = f"geo_data/regierungsviertel/alt-mitte-v169/source-{tile}-00.json.gz"
    raw = (ROOT / relative).read_bytes()
    building = next(
      b for b in json.loads(gzip.decompress(raw))["buildings"] if b["id"] == parent
    )
    faces = []
    for part in building["parts"]:
      polygons = unary_union(
        [Polygon(p["ring"], p["holes"]) for p in part["footprintPolygons"]]
      )
      for index in SELECTION[key].get(part["id"], []):
        surface = part["surfaces"][index]
        assert surface["kind"] == "WallSurface"
        ring = surface["rings"][0]
        a, b = max(
          ((a, b) for a in ring for b in ring),
          key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
        )
        dx, dz = b[0] - a[0], b[2] - a[2]
        length = math.hypot(dx, dz)
        nx, nz = dz / length, -dx / length
        if polygons.covers(
          Point((a[0] + b[0]) / 2 + nx * 0.1, (a[2] + b[2]) / 2 + nz * 0.1)
        ):
          nx, nz = -nx, -nz
        faces.append(
          {
            "part": part["id"],
            "index": index,
            "a": [a[0], a[2]],
            "b": [b[0], b[2]],
            "normal": [round(nx, 8), round(nz, 8)],
            "bottom": min(p[1] for p in ring),
            "top": max(p[1] for p in ring),
            "surfaceSha256": digest(surface),
          }
        )
    sites[key] = {
      "parent": parent,
      "osmWay": osm,
      "sourcePath": relative,
      "sourceSha256": hashlib.sha256(raw).hexdigest(),
      "buildingSha256": digest(building),
      "partCount": len(building["parts"]),
      "faces": faces,
    }
  return {
    "schema": 1,
    "license": "dl-de/zero-2-0; OSM context ODbL-1.0",
    "sites": sites,
    "policy": "Original packets, all measured walls/roofs and previous details are retained. These shallow recognition fittings use reference-estimated colours, subdivisions and projections. No replacement, new ground, navigation or coverage.",
  }


if __name__ == "__main__":
  target = ROOT / "src/app/src/data/alexanderRecognitionV257.json"
  target.write_text(json.dumps(build(), separators=(",", ":")) + "\n")
  print(f"Wrote {target.name}: {target.stat().st_size:,} bytes")
