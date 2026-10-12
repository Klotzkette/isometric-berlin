"""Retain exact exterior planes of the three houses around the Litfin courtyard."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
PACKET = ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-389_5821-00.json.gz"
DEST = ROOT / "src/app/src/data/litfinNeighboursV215Source.json"
OWNERS = {
  "DEBE01YYK0000AUT": "kieler3",
  "DEBE01YYK0000E2h": "kieler2",
  "DEBE01YYK0000B3h": "kieler2a",
}


def build() -> dict:
  packet = json.loads(gzip.decompress(PACKET.read_bytes()))
  selected = [b for b in packet["buildings"] if b["id"] in OWNERS]
  occupied = unary_union(
    [
      Polygon(p["ring"], p["holes"])
      for b in packet["buildings"]
      for part in b["parts"]
      for p in part["footprintPolygons"]
    ]
  )
  buildings = []
  for b in selected:
    walls = []
    for part in b["parts"]:
      for s in part["surfaces"]:
        if s["kind"] != "WallSurface":
          continue
        ring = s["rings"][0]
        a, c = max(
          ((a, c) for a in ring for c in ring),
          key=lambda ac: math.hypot(ac[1][0] - ac[0][0], ac[1][2] - ac[0][2]),
        )
        length = math.hypot(c[0] - a[0], c[2] - a[2])
        if length < 0.2:
          continue
        nx, nz = -(c[2] - a[2]) / length, (c[0] - a[0]) / length
        mx, mz = (a[0] + c[0]) / 2, (a[2] + c[2]) / 2
        left = occupied.contains(Point(mx + nx * 0.12, mz + nz * 0.12))
        right = occupied.contains(Point(mx - nx * 0.12, mz - nz * 0.12))
        if left == right:
          continue
        side = -1 if left else 1
        low = min(p[1] for p in ring)
        high = min((p[1] for p in ring if p[1] > low + 0.4), default=low)
        walls.append(
          {
            "startXZ": [a[0], a[2]],
            "endXZ": [c[0], c[2]],
            "outwardSide": side,
            "wallBaseY": low,
            "wallTopY": high,
            "ring": ring,
            "sourcePartId": part["id"],
            "sourcePolygonId": s["sourcePolygonId"],
            "street": "Kieler Straße",
            "prismId": b["id"],
          }
        )
    buildings.append(
      {
        "key": OWNERS[b["id"]],
        "ownerId": b["id"],
        "osmWayId": b["osmTags"]["osm_way_id"],
        "partIds": [p["id"] for p in b["parts"]],
        "walls": walls,
      }
    )
  return {
    "schemaVersion": 1,
    "sourceReceipts": [
      {
        "path": str(PACKET.relative_to(ROOT)),
        "sha256": hashlib.sha256(PACKET.read_bytes()).hexdigest(),
      }
    ],
    "sourceGeometryRetained": True,
    "replacementOwners": [],
    "sourceAttribution": "© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)",
    "buildings": buildings,
  }


if __name__ == "__main__":
  data = build()
  DEST.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
  print({b["key"]: len(b["walls"]) for b in data["buildings"]})
