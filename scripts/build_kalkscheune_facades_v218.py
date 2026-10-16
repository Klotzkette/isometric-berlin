"""Extract only Kalkscheune's measured exterior wall anchors, without city edits."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-390_5820-00.json.gz"
OWNERS = ["DEBE01YYK0000Boq", "DEBE01YYK0000BWc", "DEBE01YYK000068w"]


def build() -> dict:
  records = json.loads(gzip.decompress(SOURCE.read_bytes()))["buildings"]
  buildings = [next(b for b in records if b["id"] == owner) for owner in OWNERS]
  parts = [p for b in buildings for p in b["parts"]]
  footprint = unary_union(
    [
      Polygon(f["ring"], f.get("holes", []))
      for p in parts
      for f in p["footprintPolygons"]
    ]
  )
  # These exact shared surfaces face taller neighbouring source envelopes:
  # JOH3 (DEBE01YYK00002ou, top 28.943) and Kalkscheunenstrasse 3
  # (DEBE01YYK00001eQ, top 22.061). The original facade recipe emitted none.
  party_walls = {
    ("DEBE3DrhL2W8tGoj", 18),
    ("DEBE01YYK000068w", 1),
    ("DEBE01YYK000068w", 8),
    ("DEBE3DwQI2F5EFKF", 0),
  }
  walls = []
  for part in parts:
    for index, surface in enumerate(part["surfaces"]):
      if (part["id"], index) in party_walls:
        continue
      ring = surface["rings"][0]
      if surface["kind"] != "WallSurface" or min(q[1] for q in ring) > 4.71:
        continue
      bottom = [q for q in ring if abs(q[1] - 4.7) < 0.01]
      if len(bottom) < 2:
        continue
      a, b = max(
        ((a, b) for a in bottom for b in bottom), key=lambda pair: math.dist(*pair)
      )
      length = math.dist(a, b)
      if length < 2.4:
        continue
      dx, dz = (b[0] - a[0]) / length, (b[2] - a[2]) / length
      nx, nz = dz, -dx
      mid = [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2]
      if footprint.contains(Point(mid[0] + nx * 0.2, mid[1] + nz * 0.2)):
        nx, nz = -nx, -nz
      if footprint.contains(Point(mid[0] + nx * 0.2, mid[1] + nz * 0.2)):
        continue
      corner = part["id"] == "DEBE3DgSEf0tiEqn"
      walls.append(
        dict(
          id=part["id"],
          surface=index,
          a=[a[0], a[2]],
          b=[b[0], b[2]],
          normal=[nx, nz],
          base=4.7,
          eave=min(q[1] for q in ring if q[1] > 4.71),
          role="corner-west"
          if corner and index == 6
          else "corner"
          if corner
          else "factory",
        )
      )
  return dict(
    schemaVersion=1,
    sourceFile=SOURCE.relative_to(ROOT).as_posix(),
    sourceFileSha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    parents=OWNERS,
    walls=walls,
    policy="Exact source wall endpoints. Body, roof, holes and navigation stay in original v169 resident packets. Facade subdivisions are photo-informed display estimates, not a survey.",
  )


if __name__ == "__main__":
  destination = ROOT / "src/app/src/data/kalkscheuneFacadesV218.json"
  destination.write_text(json.dumps(build(), separators=(",", ":")) + "\n")
