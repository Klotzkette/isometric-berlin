"""Source-bound Zoofenster and Upper West, with offline-clipped facade detail."""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import numpy as np
from shapely import constrained_delaunay_triangles
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_386_5818.zip"
DEST = ROOT / "src/app/src/data/breitscheidTowersSource.json"
NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
PARENTS = {
  "DEBE04YY500002VL": ("Zoofenster / Waldorf Astoria", "15777905"),
  "DEBE00YY1JF00008": ("Upper West", "74901812"),
}
GROUND = 5.2


def normal_of(ring: list[list[float]]) -> np.ndarray:
  n = sum(
    (np.cross(a, b) for a, b in zip(ring, ring[1:] + ring[:1], strict=True)),
    np.zeros(3),
  )
  return n / np.linalg.norm(n)


def triangles_for(rings: list[list[list[float]]]) -> list[list[list[float]]]:
  n = normal_of(rings[0])
  axes = [i for i in range(3) if i != int(np.argmax(np.abs(n)))]
  planar = [[tuple(p[i] for i in axes) for p in r] for r in rings]
  polygon = Polygon(planar[0], planar[1:])
  lookup = {
    q: p
    for r, r2 in zip(rings, planar, strict=True)
    for p, q in zip(r, r2, strict=True)
  }
  result = []
  for t in constrained_delaunay_triangles(polygon).geoms:
    ps = [lookup[tuple(p)] for p in list(t.exterior.coords)[:3]]
    if np.dot(np.cross(np.subtract(ps[1], ps[0]), np.subtract(ps[2], ps[0])), n) < 0:
      ps.reverse()
    result.append(ps)
  return result


def facade(rings: list[list[list[float]]], upper: bool) -> list[list[float]]:
  """Local visual subdivisions, clipped inside every exact measured wall."""
  normal = normal_of(rings[0])
  if abs(normal[1]) > 0.01:
    return []
  a, b = max(
    ((a, b) for a in rings[0] for b in rings[0]),
    key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
  )
  base = np.array(a)
  d = np.array([b[0] - a[0], 0, b[2] - a[2]], dtype=float)
  length = float(np.linalg.norm(d))
  if length < 0.75:
    return []
  d /= length
  poly = Polygon(
    [[(float(np.dot(np.subtract(p, base), d)), p[1]) for p in r] for r in rings][0],
    [[(float(np.dot(np.subtract(p, base), d)), p[1]) for p in r] for r in rings[1:]],
  )
  yaw = math.atan2(-d[2], d[0])
  output = []

  def emit(
    u: float,
    y: float,
    width: float,
    height: float,
    out: float,
    depth: float,
    color: int,
    role: int,
  ) -> None:
    p = base + d * u + normal * out
    output.append(
      [
        round(p[0], 3),
        round(y, 3),
        round(p[2], 3),
        round(width, 3),
        round(height, 3),
        depth,
        round(yaw, 6),
        color,
        role,
      ]
    )

  # The upper seven-storey Zoofenster crown is continuous glazing; limestone
  # punched windows continue below it. The survey fixes the outer surface.
  pitch_y = 3.56 if upper else 3.62
  bays = max(1, round(length / (1.85 if upper else 3.15)))
  pitch_x = length / bays
  for floor in range(34):
    y = GROUND + 2.35 + floor * pitch_y
    for bay in range(bays):
      u = (bay + 0.5) * pitch_x
      crown = not upper and y > GROUND + 91
      width = pitch_x * (0.93 if crown else 0.74 if upper else 0.66)
      height = 3.42 if crown else 2.72 if upper else 2.26
      if not poly.buffer(-0.025).covers(
        box(u - width / 2, y - height / 2, u + width / 2, y + height / 2)
      ):
        continue
      colors = (
        [0x45616B, 0x4D6971, 0x3D5660] if upper else [0x78968F, 0x657F7E, 0x587377]
      )
      emit(u, y, width, height, 0.07, 0.12, colors[(floor + bay) % 3], 1)
      if crown:
        emit(u - width / 2, y, 0.06, height, 0.155, 0.08, 0xACB6AA, 2)
      elif upper:
        # Offset aluminium fins and brows create the facade's staggered relief.
        emit(
          u - width / 2 - 0.08,
          y,
          0.16,
          height + 0.15,
          0.13 + (floor % 2) * 0.08,
          0.22,
          0xF0EEE5,
          2,
        )
        emit(u, y + height / 2 + 0.06, width + 0.18, 0.12, 0.16, 0.26, 0xEEEDE3, 2)
      else:
        emit(u, y - height / 2 - 0.055, width + 0.10, 0.10, 0.14, 0.22, 0xC8C1A9, 2)
  # Continuous curved floor ribbons follow the surveyed short curve segments.
  if upper:
    for floor in range(1, 35):
      y = GROUND + floor * pitch_y
      line = poly.intersection(LineString([(-1, y), (length + 1, y)]))
      for piece in (
        [line] if line.geom_type == "LineString" else getattr(line, "geoms", [])
      ):
        if piece.length < 0.4:
          continue
        low, high = piece.bounds[0], piece.bounds[2]
        emit((low + high) / 2, y, high - low, 0.28, 0.12, 0.24, 0xE8E8DF, 3)
  return output


def make_payload() -> dict:
  with zipfile.ZipFile(SOURCE) as z:
    tree = ET.fromstring(z.read(z.namelist()[0]))
  current = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )
  legacy = [
    p for p in current["buildings"] if p["id"] in [v[1] for v in PARENTS.values()]
  ]
  parts, surfaces, details, blocks = [], [], [], {}
  for parent in tree.findall(".//b:Building", NS):
    pid = parent.get(f"{{{NS['g']}}}id")
    if pid not in PARENTS:
      continue
    name, prism = PARENTS[pid]
    upper = name == "Upper West"
    # Main tower datum avoids the Zoofenster basement ground patch moving the
    # whole tower upwards. Other source part elevations stay relative to it.
    datum = 32.15 if upper else 34.107
    for part in parent.findall(".//b:BuildingPart", NS):
      sid = part.get(f"{{{NS['g']}}}id")
      all_surfaces, grounds = [], []
      for boundary in part.findall("b:boundedBy", NS):
        for s in boundary:
          kind = s.tag.split("}")[-1]
          for polygon in s.findall(".//g:Polygon", NS):
            rings = []
            for pos in polygon.findall(".//g:posList", NS):
              vals = [float(v) for v in pos.text.split()]
              ring = [
                [
                  round(vals[i] - 389500, 3),
                  round(vals[i + 2] - datum + GROUND, 3),
                  round(5820000 - vals[i + 1], 3),
                ]
                for i in range(0, len(vals), 3)
              ]
              if ring[0] == ring[-1]:
                ring.pop()
              rings.append(ring)
            all_surfaces.append({"kind": kind, "rings": rings})
            if kind == "GroundSurface":
              grounds.append(
                Polygon(
                  [(p[0], p[2]) for p in rings[0]],
                  [[(p[0], p[2]) for p in r] for r in rings[1:]],
                )
              )
      foot = unary_union(grounds)
      shapes = list(foot.geoms) if hasattr(foot, "geoms") else [foot]
      points = [p for s in all_surfaces for r in s["rings"] for p in r]
      parts.append(
        {
          "id": sid,
          "parentId": pid,
          "building": name,
          "legacyPrismId": prism,
          "groundY": min(p[1] for p in points),
          "topY": max(p[1] for p in points),
          "heightM": float(part.findtext("b:measuredHeight", namespaces=NS)),
          "rings": [
            [[round(x, 3), round(z, 3)] for x, z in p.exterior.coords[:-1]]
            for p in shapes
          ],
          "footprintAreaM2": round(foot.area, 6),
        }
      )
      for s in all_surfaces:
        if s["kind"] not in ["WallSurface", "RoofSurface"]:
          continue
        roof = s["kind"] == "RoofSurface"
        color = (
          (0x9FA7A3 if upper else 0xACAFA5)
          if roof
          else (0xE4E5DD if upper else 0xCFC8B0)
        )
        triangles = triangles_for(s["rings"])
        surfaces.append(
          {"partId": sid, "kind": s["kind"], "color": color, "triangles": triangles}
        )
        if not roof:
          details.extend(facade(s["rings"], upper))
        # Two-metre exterior voxels only; no hidden solid building volume.
        for triangle in triangles:
          a, b, c = [np.array(p) for p in triangle]
          steps = max(
            1,
            math.ceil(
              max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
              / 1.1
            ),
          )
          for i in range(steps + 1):
            for j in range(steps + 1 - i):
              p = a + (b - a) * i / steps + (c - a) * j / steps
              cell = (
                math.floor(p[0] / 2),
                math.floor((p[1] - GROUND) / 2),
                math.floor(p[2] / 2),
              )
              if roof or cell not in blocks:
                blocks[cell] = [
                  cell[0] * 2 + 1,
                  round(GROUND + cell[1] * 2 + 1, 3),
                  cell[2] * 2 + 1,
                  color,
                ]
  # Paint only existing surface voxels. This cannot add floating pixels or
  # silently convert a facade into a filled volume.
  for x, y, z, width, height, _depth, yaw, color, role in details:
    if role != 1:
      continue
    for u in np.arange(-width / 2 + 0.2, width / 2, 0.65):
      for v in np.arange(-height / 2 + 0.2, height / 2, 0.65):
        cell = (
          math.floor((x + math.cos(yaw) * u) / 2),
          math.floor((y + v - GROUND) / 2),
          math.floor((z - math.sin(yaw) * u) / 2),
        )
        if cell in blocks:
          cx, cy, cz, _old_color = blocks[cell]
          along = (cx - x) * math.cos(yaw) - (cz - z) * math.sin(yaw)
          # Centre sampling retains actual masonry/aluminium gaps. Painting
          # every voxel touched by a thin pane dilates adjacent windows until
          # their bands and piers disappear entirely at two-metre resolution.
          if abs(along) < width / 2 and abs(cy - y) < height / 2:
            blocks[cell][3] = color
  return {
    "schemaVersion": 1,
    "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_386_5818.zip",
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "licence": "dl-de/zero-2-0",
    "groundY": GROUND,
    "parts": parts,
    "legacyPrisms": legacy,
    "surfaces": surfaces,
    "facadeBoxes": details,
    "nativeBlocks": list(blocks.values()),
    "detailStatus": "Window pitch, panel depth and floor rhythm are procedural visual-reference subdivisions clipped to official LoD2 walls; no photographed texture.",
  }


def main() -> None:
  payload = make_payload()
  DEST.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
  nav = {
    "parts": payload["parts"],
    "legacyPrisms": payload["legacyPrisms"],
    "roofTriangles": [
      t
      for s in payload["surfaces"]
      if s["kind"] == "RoofSurface"
      for t in s["triangles"]
    ],
  }
  native_roofs = {}
  for x, y, z, _ in payload["nativeBlocks"]:
    native_roofs[(x, z)] = max(native_roofs.get((x, z), -100), y + 1)
  nav["nativeRoofCells"] = [[x, z, y] for (x, z), y in native_roofs.items()]
  DEST.with_name("breitscheidTowersNavigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  print(
    json.dumps(
      {
        "parts": len(payload["parts"]),
        "surfaces": len(payload["surfaces"]),
        "facadeBoxes": len(payload["facadeBoxes"]),
        "nativeBlocks": len(payload["nativeBlocks"]),
        "bytes": DEST.stat().st_size,
      }
    )
  )


if __name__ == "__main__":
  main()
