"""Step 10: bounded additive hospital fittings from retained exact source walls."""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, shape
from shapely.ops import unary_union

from scripts.build_breitscheid_towers_v161 import normal_of, triangles_for

ROOT = Path(__file__).resolve().parents[1]
TARGETS = {
  "DEBE01YYK0000365": "modern-ward",
  "DEBE01YYK00004ZV": "modern-link",
  "DEBE01YYK000062n": "modern-entrance",
  "DEBE01YYK0000Dve": "historic-pavilion",
  "DEBE01YYK00008AW": "historic-north",
  "DEBE01YYK0000CdN": "historic-east",
}


def build(root: Path = ROOT) -> dict:
  """Preserve all source shells; derive clipped trim and separate native fittings."""
  source = json.loads(
    (
      root / "geo_data/regierungsviertel/bundeswehr-hospital-v214-source.json"
    ).read_bytes()
  )
  boxes, blocks, faces = [], [], []
  all_footprints = unary_union([shape(o["footprint"]) for o in source["owners"]])

  def emit(p: np.ndarray, size: list, yaw: float, color: int, role: str) -> None:
    boxes.append([*[round(float(v), 4) for v in [*p, *size, yaw]], color, role])
    # Independent axis-aligned, surface-only block reading, no hidden volume fill.
    d = np.array([math.cos(yaw), 0, -math.sin(yaw)])
    count = max(1, math.ceil(size[0] / 2.2))
    for i in range(count):
      c = p + d * ((i + 0.5) / count - 0.5) * size[0]
      dims = [
        abs(d[0]) * size[0] / count + abs(d[2]) * size[2],
        size[1],
        abs(d[2]) * size[0] / count + abs(d[0]) * size[2],
      ]
      blocks.append([*[round(float(v), 4) for v in [*c, *dims]], color, role])

  for owner in source["owners"]:
    if owner["id"] not in TARGETS:
      continue
    modern = TARGETS[owner["id"]].startswith("modern")
    for part in owner["parts"]:
      for surface in part["surfaces"]:
        if surface["kind"] != "WallSurface":
          continue
        rings = [
          [[x, y + part["displayOffsetY"], z] for x, y, z in ring]
          for ring in surface["rings"]
        ]
        normal = normal_of(rings[0])
        if abs(normal[1]) > 0.01:
          continue
        a, b = max(
          ((a, b) for a in rings[0] for b in rings[0]),
          key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
        )
        d = np.array([b[0] - a[0], 0, b[2] - a[2]], dtype=float)
        length = float(np.linalg.norm(d))
        if length < 6:
          continue
        d /= length
        base = np.array(a)
        mid = (np.array(a) + b) / 2
        if all_footprints.contains(
          Point(mid[0] + normal[0] * 0.35, mid[2] + normal[2] * 0.35)
        ):
          continue
        poly = Polygon(
          [
            [(float(np.dot(np.subtract(p, base), d)), p[1]) for p in ring]
            for ring in rings
          ][0],
          [
            [(float(np.dot(np.subtract(p, base), d)), p[1]) for p in ring]
            for ring in rings
          ][1:],
        )
        low, high = poly.bounds[1], poly.bounds[3]
        if high - low < 6:
          continue
        yaw = math.atan2(-d[2], d[0])
        face_index = len(faces)
        faces.append(
          dict(
            owner=owner["id"], part=part["id"], rings=rings, kind=TARGETS[owner["id"]]
          )
        )

        def fitting(
          u: float,
          y: float,
          width: float,
          height: float,
          depth: float,
          color: int,
          role: str,
        ) -> None:
          # Entire aperture/trim lies within the actual wall, including source holes.
          q = Polygon(
            [
              (u - width / 2, y - height / 2),
              (u + width / 2, y - height / 2),
              (u + width / 2, y + height / 2),
              (u - width / 2, y + height / 2),
            ]
          )
          if not poly.buffer(-0.07).covers(q):
            return
          centre = base + d * u + normal * 0.15
          centre[1] = y
          emit(centre, [width, height, depth], yaw, color, f"{face_index}:{role}")

        levels = max(1, round((high - max(low, 5.2)) / (3.45 if modern else 4.1)))
        floor = (high - max(low, 5.2)) / levels
        # Relief/light lines articulate the retained body; openings remain estimates.
        for level in range(levels):
          y = max(low, 5.2) + floor * (level + 0.63)
          count = max(1, int(length / (2.75 if modern else 3.3)))
          bay = length / count
          for i in range(count):
            u = (i + 0.5) * bay
            if modern:
              fitting(
                u, y, min(2.05, bay * 0.78), 1.75, 0.18, 0x9DBABC, "light glazing"
              )
              fitting(u - bay * 0.36, y, 0.15, 1.8, 0.22, 0x74A9B0, "turquoise panel")
              fitting(
                u, y - 0.95, min(2.15, bay * 0.83), 0.12, 0.26, 0x777F7E, "metal sill"
              )
              fitting(u, y, 0.055, 1.78, 0.26, 0xD6DCD5, "window mullion")
            else:
              fitting(
                u, y, min(1.15, bay * 0.46), 1.72, 0.18, 0x8DABAC, "pavilion glazing"
              )
              fitting(
                u, y - 0.93, min(1.48, bay * 0.60), 0.17, 0.25, 0xD4C7AF, "stone sill"
              )
              fitting(
                u, y + 0.95, min(1.42, bay * 0.58), 0.15, 0.24, 0xD6C8AE, "stone lintel"
              )
              fitting(u, y, 0.07, 1.74, 0.25, 0xE2D9C5, "window meeting rail")
          # Subdivide at source wall edges, not one long band across wing changes.
          fitting(
            length / 2,
            y - 1.27,
            length - 0.22,
            0.13,
            0.17,
            0xD2D3C9 if modern else 0xB9A887,
            "floor course",
          )
        fitting(
          length / 2,
          high - 0.24,
          length - 0.22,
          0.22,
          0.24,
          0xCDD0C8 if modern else 0xB8AA91,
          "eaves",
        )
  pad = shape(source["sites"]["51804908"]["geometry"]).geoms[0]
  ring = list(pad.exterior.coords)[:-1]
  centre = np.array([pad.centroid.x, 5.32, pad.centroid.y])
  u = np.subtract(ring[1], ring[0])
  u /= np.linalg.norm(u)
  yaw = -math.atan2(u[1], u[0])
  for dx in [-1.55, 1.55]:
    p = centre + np.array([u[0] * dx, 0, u[1] * dx])
    emit(p, [0.6, 0.025, 4.8], yaw, 0xF1F0D8, "pad H")
  emit(centre, [3.1, 0.025, 0.6], yaw, 0xF1F0D8, "pad H")
  for a, b in zip(ring, ring[1:] + ring[:1]):
    a, b = np.array(a), np.array(b)
    m = (a + b) / 2
    d = b - a
    p = np.array([m[0], 5.30, m[1]])
    emit(
      p,
      [float(np.linalg.norm(d)), 0.025, 0.17],
      -math.atan2(d[1], d[0]),
      0xE9E9D1,
      "mapped pad rim",
    )
  pad_triangles = triangles_for([[[x, 5.26, z] for x, z in ring]])
  # Native apron is strictly clipped to the same source polygon, with no square overspill.
  minx, minz, maxx, maxz = pad.bounds
  for x in range(math.floor(minx), math.ceil(maxx)):
    for z in range(math.floor(minz), math.ceil(maxz)):
      cell = Polygon([(x, z), (x + 1, z), (x + 1, z + 1), (x, z + 1)])
      if pad.covers(cell):
        blocks.append(
          [x + 0.5, 5.25, z + 0.5, 1, 0.025, 1, 0x626D69, "native mapped pad"]
        )
  return dict(
    boxes=boxes,
    blocks=blocks,
    padTriangles=pad_triangles,
    faces=faces,
    helipad=dict(
      centre=[round(float(x), 6) for x in centre],
      approach=[-0.8, 0.6],
      osmWay="51804908",
      surfaceElevationEvidence="Existing core flat ground y=5.2; marking relief display estimate, not surveyed height",
    ),
    sourceParents=list(TARGETS),
    sourceParts=sum(len(o["parts"]) for o in source["owners"]),
    policy="All source bodies and earlier detail retained. Unsurveyed bays and trim proportions are reference-guided display estimates. Pad boundary exact OSM; H and rim illustrative. Same static drawn detail on touch and desktop.",
  )


if __name__ == "__main__":
  result = build()
  evidence = ROOT / "geo_data/regierungsviertel/bundeswehr-hospital-v214-facades.json"
  evidence.write_text(json.dumps(result.pop("faces"), separators=(",", ":")) + "\n")
  path = ROOT / "src/app/src/data/bundeswehrHospitalV214.json"
  path.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  print({k: len(result[k]) for k in ["boxes", "blocks"]}, path.stat().st_size)
