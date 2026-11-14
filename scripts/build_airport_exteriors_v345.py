"""Photo-guided fittings on the unchanged exact airport facade owners.

No new envelopes, airport traffic, proposed BHT campus or ground geometry.
Native members fit actual retained cardinal facade instances independently.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import numpy as np
from build_breitscheid_towers_v161 import normal_of
from shapely.geometry import LineString, Point, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
PIN = "e3c48aef6dae592f74e42edf226b22a296fd056e67f835664ee4018fc10d6427"


def build():
  raw = (GEO / "airports-v194-source.json").read_bytes()
  assert hashlib.sha256(raw).hexdigest() == PIN
  src = json.loads(raw)
  old = json.loads((DATA / "airportsV194.json").read_bytes())
  walls = []
  for p in src["parents"]:
    if not p["id"].endswith("0088X"):
      continue
    for f in p["surfaces"]:
      if f["kind"] != "WallSurface":
        continue
      ring = np.asarray(f["rings"][0])
      n = np.asarray(normal_of(ring.tolist()))
      if abs(n[1]) > 0.03:
        continue
      a, b = max(
        ((a, b) for a in ring for b in ring),
        key=lambda ab: np.linalg.norm((ab[1] - ab[0])[[0, 2]]),
      )
      walls.append((LineString([a[[0, 2]], b[[0, 2]]]), n[[0, 2]], p["id"], f["id"]))
  for f in src["features"]:
    if f["id"] not in ("relation/13234", "way/24378140"):
      continue
    for p in shape(f["geometry"]).geoms:
      for r in [p.exterior, *p.interiors]:
        for a, b in zip(r.coords, list(r.coords)[1:]):
          dx, dz = b[0] - a[0], b[1] - a[1]
          length = math.hypot(dx, dz)
          n = np.array([dz / length, -dx / length])
          c = (np.array(a) + b) / 2
          if p.contains(Point(c + n * 0.1)):
            n *= -1
          walls.append((LineString([a, b]), n, f["id"], f["id"]))
  drawn, native, hosts = [], [], []
  native_lookup = {tuple(np.round(r, 4)): i for i, r in enumerate(old["blocks"])}
  for bi, r in enumerate(old["boxes"]):
    x, y, z, w, h, d, yaw, color = r
    if color not in (0x45564F, 0x465F61) or (color == 0x465F61 and x > 0):
      continue
    wall, n, owner, face = min(walls, key=lambda q: q[0].distance(Point(x, z)))
    if wall.distance(Point(x, z)) > 0.3 or w < 1.5:
      continue
    site = "tempelhof" if x > 0 else "tegel"
    start = len(drawn)

    # The source pane stays intact behind the additive shallow relief.
    # Steel transoms subdivide the formerly blank tall hangar panels.
    def put(u, v, bw, bh, paint, proud=0.11):
      drawn.append(
        [
          round(x + math.cos(yaw) * u + n[0] * proud, 5),
          round(y + v, 5),
          round(z - math.sin(yaw) * u + n[1] * proud, 5),
          round(bw, 5),
          round(bh, 5),
          0.055,
          yaw,
          paint,
        ]
      )

    if site == "tempelhof":
      for v in (-h * 0.32, -h * 0.08, h * 0.16, h * 0.39):
        put(0, v, w, 0.105, 0x788376)
      put(0, -h * 0.405, w * 0.96, h * 0.15, 0x5C6961, 0.09)
      for u in (-w * 0.25, w * 0.25):
        put(u, 0, 0.055, h * 0.96, 0x899389)
    else:
      # Pale concrete lintel/sill and recessed dark glazing gaskets,
      # following both actual outer hexagon and open inner court edges.
      for v in (-h / 2 + 0.055, h / 2 - 0.055):
        put(0, v, w, 0.11, 0xBBC0B5)
      put(0, -h * 0.16, w, 0.055, 0x283C3E)
      for i in range(1, max(2, round(w / 3))):
        u = (i / max(2, round(w / 3)) - 0.5) * w
        put(u + 0.2, 0, 0.045, h * 0.96, 0x263B3D, 0.13)
    # Native support is found by the exact retained instance dimensions,
    # never by snapping the rotated Drawn fitting or shifting a new shell.
    count = max(1, math.ceil(w / 2))
    for i in range(count):
      u = (i + 0.5) * w / count - w / 2
      nr = [
        round(x + n[0] * 1.7 + math.cos(yaw) * u, 4),
        y,
        round(z + n[1] * 1.7 - math.sin(yaw) * u, 4),
        abs(math.cos(yaw)) * w / count + abs(math.sin(yaw)) * d,
        h,
        abs(math.sin(yaw)) * w / count + abs(math.cos(yaw)) * d,
        color,
      ]
      key = tuple(np.round(nr, 4))
      assert key in native_lookup, (bi, key)
      ni = native_lookup[key]
      axis = 0 if abs(n[0]) >= abs(n[1]) else 2
      sign = 1 if n[0 if axis == 0 else 1] > 0 else -1
      tangent = 2 if axis == 0 else 0

      def block(v, bh, paint):
        b = old["blocks"][ni]
        center = b[:3].copy()
        center[axis] += sign * (b[axis + 3] / 2 + 0.032)
        center[1] += v
        size = [0.06, bh, 0.06]
        size[tangent] = max(0.03, b[tangent + 3] - 0.015)
        native.append(
          [
            *map(lambda v: round(v, 5), center),
            *map(lambda v: round(v, 5), size),
            paint,
          ]
        )

      if site == "tempelhof":
        for v in (-h * 0.32, -h * 0.08, h * 0.16, h * 0.39):
          block(v, 0.105, 0x788376)
        block(-h * 0.405, h * 0.15, 0x5C6961)
      else:
        for v in (-h / 2 + 0.055, h / 2 - 0.055):
          block(v, 0.11, 0xBBC0B5)
        block(-h * 0.16, 0.055, 0x283C3E)
    hosts.append(
      {
        "site": site,
        "owner": owner,
        "face": face,
        "sourceBox": bi,
        "drawnRange": [start, len(drawn)],
        "normal": n.tolist(),
      }
    )
  result = {
    "schemaVersion": 1,
    "sourceSha256": PIN,
    "sourcePayloadSha256": hashlib.sha256(
      (DATA / "airportsV194.json").read_bytes()
    ).hexdigest(),
    "boxes": drawn,
    "blocks": native,
    "hosts": hosts,
  }
  (DATA / "airportExteriorsV345.json").write_text(
    json.dumps(result, separators=(",", ":")) + "\n"
  )
  print(
    {
      "hosts": len(hosts),
      "drawn": len(drawn),
      "native": len(native),
      "sites": {s: sum(h["site"] == s for h in hosts) for s in ("tegel", "tempelhof")},
    }
  )
  return result


if __name__ == "__main__":
  build()
