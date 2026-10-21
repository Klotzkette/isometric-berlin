"""Extract retained Zoo Palast facade anchors; never alter the v166 source."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/app/src/data/cityWestCinemasV166Source.json"
TARGET = ROOT / "src/app/src/data/zooPalastV260.json"
AUDITORIUM = "DEBE3DjeP5aTIgFW"
FOYER = "DEBE3DX38LUj5DUN"


def build() -> dict:
  """Keep exact source vertices and local native occupancy for surface fittings."""
  source = json.loads(SOURCE.read_text())
  upper = [
    s
    for s in source["surfaces"]
    if s["partId"] == AUDITORIUM
    and s["kind"] == "WallSurface"
    and all(p[2] >= 1370.842 for p in s["rings"][0])
    and all(p[0] <= -2557.932 for p in s["rings"][0])
  ]
  vertices = sorted({tuple(p) for s in upper for p in s["rings"][0]})
  curve = []
  for x, z in sorted({(p[0], p[2]) for p in vertices}):
    ys = [p[1] for p in vertices if p[0] == x and p[2] == z]
    if max(ys) - min(ys) > 1:
      curve.append([x, z, min(ys), max(ys)])
  side = next(
    s
    for s in source["surfaces"]
    if s["partId"] == AUDITORIUM
    and s["kind"] == "WallSurface"
    and {(-2557.932, 1388.708), (-2554.739, 1385.492)}
    == {(p[0], p[2]) for p in s["rings"][0]}
  )
  # The actual low front, including both inset doorway returns. These exact XZ
  # vertices belong to the retained foyer; no inferred street plane is used.
  front = [
    [-2590.866, 1378.802],
    [-2588.991, 1380.31],
    [-2588.187, 1379.535],
    [-2586.252, 1381.082],
    [-2586.81, 1382.043],
    [-2582.541, 1385.436],
    [-2582.447, 1385.34],
    [-2582.398, 1385.378],
    [-2578.575, 1388.394],
    [-2572.361, 1393.295],
    [-2572.26, 1393.375],
    [-2571.525, 1393.954],
    [-2571.602, 1394.081],
    [-2571.272, 1394.34],
    [-2567.224, 1397.51],
    [-2566.452, 1396.776],
    [-2564.513, 1398.293],
    [-2565.048, 1399.208],
    [-2563.212, 1400.644],
  ]
  foyer_vertices = {
    (p[0], p[2])
    for s in source["surfaces"]
    if s["partId"] == FOYER
    for ring in s["rings"]
    for p in ring
  }
  assert all(tuple(p) in foyer_vertices for p in front)
  return {
    "owner": "DEBE00YY1EZ0000h",
    "sourcePath": str(SOURCE.relative_to(ROOT)),
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "sourcePolygonIds": [s["sourcePolygonId"] for s in [*upper, side]],
    "curve": curve,
    "side": [[-2557.932, 1388.708], [-2554.739, 1385.492]],
    "front": front,
    "groundY": 5.2,
    "foyerWallTopY": 13.07,
    "studs": [
      r
      for r in source["facadeBoxes"]
      if r[8] == 4 and -2582 < r[0] < -2556 and 1369 < r[2] < 1390
    ],
    "nativeOccupiedCells": [
      [int(r[0] // 2), int(r[1] // 2), int(r[2] // 2)]
      for r in source["nativeBlocks"]
      if -2594 < r[0] < -2550 and 1368 < r[2] < 1404
    ],
    "status": "Exact v166 facade anchors; ceramic joints, portholes, canopy and poster dimensions are photo-guided display estimates, not a new survey.",
  }


if __name__ == "__main__":
  TARGET.write_text(json.dumps(build(), separators=(",", ":")) + "\n")
