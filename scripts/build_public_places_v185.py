"""Step 10: small additive Ackerhalle, Rosenthaler and Otto-Weidt details."""

from __future__ import annotations

import copy
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from build_concert_halls_v160 import normal_of
from build_scheunen_facades_v183 import build as cornices
from shapely.geometry import box, mapping, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app/src/data"


def read(path: Path) -> dict:
  return json.loads(path.read_text())


def build() -> tuple[dict, dict, dict]:
  """Retain every previous source file; emit only small independent members."""
  osm = read(GEO / "public-places-v185-osm.json")
  rosenthal_path = GEO / "rosenthaler-platz-v163.json"
  rosenthal = read(rosenthal_path)
  buildings = copy.deepcopy(rosenthal["buildings"])
  offsets = read(APP / "weinbergBuildingOffsetsV176.json")["offsets"]
  for building in buildings:
    datum = min(
      p[1]
      for part in building["parts"]
      for surface in part["surfaces"]
      for ring in surface["rings"]
      for p in ring
    )
    for part in building["parts"]:
      for surface in part["surfaces"]:
        for ring in surface["rings"]:
          for p in ring:
            p[1] += 3 - datum
  generated = cornices(
    {
      "buildings": buildings,
      "retainedDetailedBuildings": [],
      "scope": mapping(box(1860, -1280, 2230, -1050)),
      "roads": [f for f in osm["features"] if f["area"] == "rosenthal"],
      "excludedDetailedOwners": [],
    }
  )
  boxes, rods, labels = generated["boxes"], [], []
  for face in generated["faces"]:
    dy = offsets.get(face["parentId"], 0)
    for row in boxes[face["firstBox"] : face["firstBox"] + face["boxCount"]]:
      row[1] += dy
  roles = {"rosenthaler": len(boxes)}
  acker_path = GEO / "mitte-streets-v166.json"
  acker = next(
    b for b in read(acker_path)["buildings"] if b["id"] == "DEBE01YYK00003UA"
  )
  faces = []
  for part in acker["parts"]:
    for surface in part["surfaces"]:
      if surface["kind"] != "WallSurface":
        continue
      q = np.array(surface["rings"][0])
      n = normal_of(surface["rings"][0])
      c = q.mean(axis=0)
      if q[:, 1].min() > 3.1:
        continue
      west = c[0] < 1730 and n[0] < -0.8
      north = c[2] < -1450 and n[2] < -0.8
      if not (west or north):
        continue
      a, b = max(
        ((a, b) for a in q for b in q),
        key=lambda p: math.hypot(p[1][0] - p[0][0], p[1][2] - p[0][2]),
      )
      length = math.hypot(b[0] - a[0], b[2] - a[2])
      if length < 4:
        continue
      d = np.array([(b[0] - a[0]) / length, 0, (b[2] - a[2]) / length])
      lo, top = q[:, 1].min(), q[:, 1].max()
      yaw = -math.atan2(d[2], d[0])

      def at(u: float, y: float, out: float = 0.29) -> list[float]:
        p = a + d * u + n * out
        return [float(p[0]), y, float(p[2])]

      def member(
        u: float, y: float, w: float, h: float, depth: float, color: int
      ) -> None:
        boxes.append([*at(u, y), w, h, depth, yaw, color])

      # Terracotta bands/raised piers are visual estimates on the actual wall.
      for y, h, depth in [
        (lo + 0.45, 0.42, 0.18),
        (lo + 6.8, 0.2, 0.38),
        (top - 0.7, 0.25, 0.36),
        (top - 0.32, 0.16, 0.44),
      ]:
        member(length / 2, y, length - 0.18, h, depth, 0xB99B70)
      count = 8 if west else max(2, round(length / 4.5))
      for i in range(count + 1):
        u = 0.28 + (length - 0.56) * i / count
        if west and abs(u - length / 2) < 3.6:
          continue  # Keep the arched entrance clear of a central masonry pier.
        member(u, (lo + top) / 2, 0.22, top - lo - 0.8, 0.26, 0xC3A476)
      if west:
        center = length / 2
        radius = 3.15
        spring = lo + 7.1
        # Thin paired arches and fan glazing divisions, without a new wall.
        for r in [radius, radius + 0.3]:
          for i in range(24):
            ta, tb = math.pi * i / 24, math.pi * (i + 1) / 24
            rods.append(
              [
                *at(center + r * math.cos(ta), spring + r * math.sin(ta)),
                *at(center + r * math.cos(tb), spring + r * math.sin(tb)),
                0.16,
                0xAD8557,
              ]
            )
        for side in [-1, 1]:
          member(center + side * (radius + 0.17), lo + 3.55, 0.38, 7.1, 0.4, 0xB89363)
        for i in range(1, 6):
          angle = math.pi * i / 6
          rods.append(
            [
              *at(center, spring, 0.34),
              *at(
                center + radius * 0.96 * math.cos(angle),
                spring + radius * 0.96 * math.sin(angle),
                0.34,
              ),
              0.065,
              0x819392,
            ]
          )
        member(center, spring, 6.25, 0.1, 0.18, 0x84908B)
        labels.append(
          {
            "text": "MARKTHALLE VI",
            "center": at(center, top - 2.1, 0.49),
            "direction": [float(n[2]), 0, float(-n[0])],
            "height": 0.55,
            "color": 0x8E785A,
          }
        )
        member(center, lo + 4.5, 5.3, 0.85, 0.12, 0xB03C30)
        labels.append(
          {
            "text": "REWE",
            "center": at(center, lo + 4.17, 0.47),
            "direction": [float(n[2]), 0, float(-n[0])],
            "height": 0.62,
            "color": 0xF2EEE3,
          }
        )
      faces.append(
        {
          "parentId": acker["id"],
          "partId": part["id"],
          "rings": surface["rings"],
          "west": bool(west),
        }
      )
  roles["ackerhalle"] = len(boxes) - roles["rosenthaler"]
  ground = read(ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json")

  def terrain(x: float, z: float) -> float:
    h = ground["ground_height"]
    g = ground["grid"]
    u = (x / ground["cell_m"] - g["min_x_idx"]) / h["stride_cells"] - 0.5
    v = (z / ground["cell_m"] - g["min_z_idx"]) / h["stride_cells"] - 0.5
    col, row = math.floor(u), math.floor(v)
    tx, tz = u - col, v - row

    def value(c: int, r: int) -> float:
      c = max(0, min(h["cols"] - 1, c))
      r = max(0, min(h["rows"] - 1, r))
      return h["y_dm"][r * h["cols"] + c] / 10

    return (value(col, row) * (1 - tx) + value(col + 1, row) * tx) * (1 - tz) + (
      value(col, row + 1) * (1 - tx) + value(col + 1, row + 1) * tx
    ) * tz

  for feature in osm["features"]:
    if feature["area"] != "otto" or feature["tags"].get("amenity") != "bench":
      continue
    points = list(shape(feature["geometry"]).coords)
    for a, b in zip(points, points[1:]):
      length = math.dist(a, b)
      steps = max(1, math.ceil(length / 2))
      for i in range(steps):
        t = (i + 0.5) / steps
        x = a[0] + (b[0] - a[0]) * t
        z = a[1] + (b[1] - a[1]) * t
        # Mapped stone seat course, narrow display section; leave all paths open.
        boxes.append(
          [
            x,
            terrain(x, z) + 0.25,
            z,
            length / steps + 0.015,
            0.5,
            0.7,
            -math.atan2(b[1] - a[1], b[0] - a[0]),
            0xC9C6B9,
          ]
        )
  roles["ottoWeidt"] = len(boxes) - roles["rosenthaler"] - roles["ackerhalle"]
  boxes = [[round(float(v), 4) for v in row] for row in boxes]
  native = []
  for row in boxes:
    x, y, z, w, h, d, yaw, color = row
    dx, dz = math.cos(yaw), -math.sin(yaw)
    count = max(1, math.ceil(w / 0.85))
    for i in range(count):
      along = (i + 0.5) * w / count - w / 2
      native.append(
        [
          x + dx * along,
          y,
          z + dz * along,
          max(0.24, abs(dx) * w / count + abs(dz) * d),
          h,
          max(0.24, abs(dz) * w / count + abs(dx) * d),
          color,
        ]
      )
  for rod in rods:
    a, b = np.array(rod[:3]), np.array(rod[3:6])
    steps = max(1, math.ceil(float(np.linalg.norm(b - a)) / 0.3))
    for i in range(steps):
      native.append([*(a + (b - a) * (i + 0.5) / steps), 0.22, 0.3, 0.22, rod[7]])
  native = [[round(float(v), 4) for v in row] for row in native]
  evidence = {
    "ackerFaces": faces,
    "rosenthalFaces": generated["faces"],
    "sources": {
      str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
      for p in [acker_path, rosenthal_path, GEO / "public-places-v185-osm.json"]
    },
    "policy": "Only raised source-wall members and mapped ground-seated stone benches. No source geometry, windows, roads, courtyards or heights replaced. Sections, arch subdivisions and sign placement are bounded visual estimates. Existing dated source signs stay intact.",
  }
  return (
    {"boxes": boxes, "rods": rods, "labels": labels, "counts": roles},
    {"boxes": native, "labels": labels},
    evidence,
  )


if __name__ == "__main__":
  drawn, native, evidence = build()
  for path, value in [
    (APP / "publicPlacesV185.json", drawn),
    (APP / "publicPlacesV185Native.json", native),
    (GEO / "public-places-v185-evidence.json", evidence),
  ]:
    path.write_text(json.dumps(value, separators=(",", ":")) + "\n")
  print(
    drawn["counts"],
    len(drawn["rods"]),
    "arch strokes",
    len(native["boxes"]),
    "native members",
  )
