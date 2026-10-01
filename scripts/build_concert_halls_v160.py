"""Export exact Berlin LoD2 concert surfaces and a native, surface-only block form."""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import numpy as np
from shapely import constrained_delaunay_triangles
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
ZIP = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_389_5818.zip"
DEST = ROOT / "src/app/src/data/concertHallsSource.json"
NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
PARENTS = [
  ("DEBE01YYK0002ONo", "Philharmonie", 4.1),
  ("DEBE01YYK0002KxN", "Kammermusiksaal", 4.0),
  ("DEBE01YYK0003TqC", "Kammermusiksaal entrance canopy", 4.1),
  ("DEBE01YYK0003U62", "Philharmonie entrance canopy", 4.1),
]


def normal_of(ring: list[list[float]]) -> np.ndarray:
  normal = np.zeros(3)
  for a, b in zip(ring, ring[1:] + ring[:1], strict=True):
    normal += np.cross(a, b)
  return normal / np.linalg.norm(normal)


def triangulate(rings: list[list[list[float]]]) -> list[list[list[float]]]:
  """Triangulate only in the dominant plane; keep exact source 3D vertices."""
  normal = normal_of(rings[0])
  axes = [axis for axis in range(3) if axis != int(np.argmax(np.abs(normal)))]
  projection = [[(p[axes[0]], p[axes[1]]) for p in r] for r in rings]
  polygon = Polygon(projection[0], projection[1:])
  lookup = {
    tuple(q): p
    for r, pr in zip(rings, projection, strict=True)
    for p, q in zip(r, pr, strict=True)
  }
  output = []
  for triangle in constrained_delaunay_triangles(polygon).geoms:
    pts = [lookup[tuple(p)] for p in list(triangle.exterior.coords)[:3]]
    if (
      np.dot(np.cross(np.subtract(pts[1], pts[0]), np.subtract(pts[2], pts[0])), normal)
      < 0
    ):
      pts.reverse()
    output.append(pts)
  assert (
    abs(
      sum(Polygon([(p[axes[0]], p[axes[1]]) for p in t]).area for t in output)
      - polygon.area
    )
    < 1e-5
  )
  return output


def source_surfaces() -> list[dict]:
  with zipfile.ZipFile(ZIP) as archive:
    tree = ET.fromstring(archive.read(archive.namelist()[0]))
  output = []
  for parent_id, name, ground_y in PARENTS:
    parent = next(
      (p for p in tree.iter() if p.get(f"{{{NS['g']}}}id") == parent_id), None
    )
    if parent is None:
      with zipfile.ZipFile(ZIP.with_name("LoD2_389_5819.zip")) as archive:
        extra = ET.fromstring(archive.read(archive.namelist()[0]))
      parent = next(p for p in extra.iter() if p.get(f"{{{NS['g']}}}id") == parent_id)
    ground_nhn = min(
      float(v)
      for e in parent.findall(".//b:GroundSurface//g:posList", NS)
      for v in e.text.split()[2::3]
    )
    parts = []
    for part in parent.findall(".//b:BuildingPart", NS) or [parent]:
      surfaces = []
      for boundary in part.findall("b:boundedBy", NS):
        for surface in boundary:
          kind = surface.tag.split("}")[-1]
          for polygon in surface.findall(".//g:Polygon", NS):
            rings = []
            for pos in polygon.findall(".//g:posList", NS):
              numbers = [float(v) for v in pos.text.split()]
              ring = [
                [
                  round(numbers[i] - 389500, 3),
                  round(numbers[i + 2] - ground_nhn + ground_y, 3),
                  round(5820000 - numbers[i + 1], 3),
                ]
                for i in range(0, len(numbers), 3)
              ]
              if ring[-1] == ring[0]:
                ring.pop()
              rings.append(ring)
            if rings:
              surfaces.append({"kind": kind, "rings": rings})
      parts.append(
        {
          "id": part.get(f"{{{NS['g']}}}id"),
          "heightM": float(part.findtext("b:measuredHeight", namespaces=NS)),
          "surfaces": surfaces,
        }
      )
    output.append(
      {
        "name": name,
        "id": parent_id,
        "groundY": ground_y,
        "groundNHN": ground_nhn,
        "parts": parts,
      }
    )
  return output


def clipped_gold_joints(
  rings: list[list[list[float]]], ground_y: float
) -> list[list[float]]:
  """Display panel seams clipped to the measured wall polygon."""
  ring = rings[0]
  joints = []
  normal = normal_of(ring)
  if abs(normal[1]) > 0.05:
    return []
  edge = max(
    ((a, b) for a in ring for b in ring),
    key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
  )
  base = np.array(edge[0])
  direction = np.array([edge[1][0] - base[0], 0, edge[1][2] - base[2]])
  length = np.linalg.norm(direction)
  if length < 2.4:
    return []
  direction /= length
  projected = [
    [(float(np.dot(np.subtract(p, base), direction)), p[1]) for p in r] for r in rings
  ]
  polygon = Polygon(projected[0], projected[1:])
  low, high = max(ground_y + 8.7, polygon.bounds[1]), polygon.bounds[3] - 0.18
  for index in range(1, int(length / 1.6) + 1):
    along = index * 1.6
    cut = (
      polygon.intersection(LineString([(along, low), (along, high)]))
      if high > low
      else LineString()
    )
    pieces = (
      [cut]
      if cut.geom_type == "LineString"
      else list(cut.geoms)
      if hasattr(cut, "geoms")
      else []
    )
    for piece in pieces:
      if piece.length < 0.7:
        continue
      coords = list(piece.coords)
      x, z = base[0] + direction[0] * along, base[2] + direction[2] * along
      # Source exterior-ring normal is outward; tests check bounds.
      ys = [p[1] for p in coords]
      joints.append(
        [
          round(x + normal[0] * 0.055, 3),
          round((min(ys) + max(ys)) / 2, 3),
          round(z + normal[2] * 0.055, 3),
          round(max(ys) - min(ys), 3),
          round(math.atan2(-direction[2], direction[0]), 6),
          0xAD8D43,
        ]
      )
  return joints


def foyer_windows(
  rings: list[list[list[float]]], low: float, high: float, tower: bool
) -> list[list[float]]:
  """Reference-derived glazing rows clipped inside surveyed planar walls."""
  ring = rings[0]
  normal = normal_of(ring)
  if abs(normal[1]) > 0.02:
    return []
  a, b = max(
    ((a, b) for a in ring for b in ring),
    key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
  )
  base = np.array(a)
  direction = np.array([b[0] - a[0], 0, b[2] - a[2]])
  length = np.linalg.norm(direction)
  if length < 4:
    return []
  direction /= length
  projected = [
    [(float(np.dot(np.subtract(p, base), direction)), p[1]) for p in r] for r in rings
  ]
  poly = Polygon(projected[0], projected[1:])
  output = []
  pitch = 2.8
  for u in np.arange(pitch / 2, length - pitch / 2 + 0.01, pitch):
    for y in np.arange(low + 0.95, high - 0.7, 3.0 if tower else 8):
      from shapely.geometry import box

      if not poly.buffer(-0.08).covers(box(u - 1.18, y - 0.95, u + 1.18, y + 0.95)):
        continue
      x, z = base[0] + direction[0] * u, base[2] + direction[2] * u
      output.append(
        [
          round(x + normal[0] * 0.08, 3),
          round(y, 3),
          round(z + normal[2] * 0.08, 3),
          2.36,
          1.9,
          round(math.atan2(-direction[2], direction[0]), 6),
        ]
      )
  return output


def make_payload() -> dict:
  buildings = source_surfaces()
  parts = []
  triangles = []
  seams = []
  gold_joints = []
  windows = []
  canopy_evidence = []
  canopy_edges = []
  blocks = {}
  block_m = 2.0
  # Source polygons and all 25 parts remain packaged for independent QA and
  # collision/ownership; only visible exterior walls and roofs need triangles.
  for building in buildings:
    for part in building["parts"]:
      grounds = [
        Polygon(
          [(p[0], p[2]) for p in s["rings"][0]],
          [[(p[0], p[2]) for p in r] for r in s["rings"][1:]],
        )
        for s in part["surfaces"]
        if s["kind"] == "GroundSurface"
      ]
      ground = unary_union(grounds)
      parts.append(
        {
          "id": part["id"],
          "shortId": part["id"][-8:],
          "building": building["name"],
          "heightM": part["heightM"],
          "groundY": building["groundY"],
          "solidBaseY": min(
            p[1]
            for surf in part["surfaces"]
            if surf["kind"] == "RoofSurface"
            for ring in surf["rings"]
            for p in ring
          )
          - 0.35
          if part["id"].endswith(("K0003TqC", "K0003U62"))
          else building["groundY"],
          "footprintAreaM2": round(ground.area, 6),
          "rings": [
            [[round(x, 3), round(z, 3)] for x, z in poly.exterior.coords[:-1]]
            for poly in (list(ground.geoms) if hasattr(ground, "geoms") else [ground])
          ],
        }
      )
      for surface in part["surfaces"]:
        kind = surface["kind"]
        if kind not in ("RoofSurface", "WallSurface"):
          continue
        rings = surface["rings"]
        canopy = part["id"].endswith(("K0003TqC", "K0003U62"))
        if canopy and kind == "WallSurface":
          canopy_evidence.append(rings)
          continue
        roof = kind == "RoofSurface"
        main = part["heightM"] > 17
        color = (
          (0xC2C8C8 if main else 0x979D97) if roof else (0xD5B767 if main else 0xE4E5DA)
        )
        if canopy:
          color = 0xE7E8DF
        normal = normal_of(rings[0])
        tower_front = part["id"].endswith("pjxdnMvW") and not roof and normal[0] < -0.3
        if tower_front:
          color = 0xE4E5DA
        if part["id"].endswith("MsvNJFg2") and roof:
          color = 0x799797
        if not roof and (
          part["id"].endswith("rzUWjRbq")
          and (normal[0] < -0.25 or normal[2] < -0.25)
          or tower_front
        ):
          windows.extend(
            foyer_windows(
              rings,
              9.9 if not tower_front else 10.0,
              12.5 if not tower_front else 24.0,
              tower_front,
            )
          )
        row = {
          "partId": part["id"][-8:],
          "kind": kind,
          "color": color,
          "triangles": triangulate(rings),
        }
        triangles.append(row)
        # Roof edges follow actual source folds, never invented horizontal spokes.
        if roof:
          if canopy:
            canopy_edges.extend(
              [[a, b] for r in rings for a, b in zip(r, r[1:] + r[:1], strict=True)]
            )
          for r in rings:
            for a, b in zip(r, r[1:] + r[:1], strict=True):
              if math.dist(a, b) > 1.2:
                seams.append([[a[0], a[1] + 0.035, a[2]], [b[0], b[1] + 0.035, b[2]]])
        if not roof and main and not tower_front:
          gold_joints.extend(clipped_gold_joints(rings, building["groundY"]))
        # Surface-only 2 m blocks sample every source triangle with <=1 m
        # spacing. Keep no hidden solid fill; both profiles use this same form.
        for triangle in row["triangles"]:
          a, b, c = [np.array(p) for p in triangle]
          steps = max(
            1,
            math.ceil(
              max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
              / 1.0
            ),
          )
          for i in range(steps + 1):
            for j in range(steps + 1 - i):
              p = a + (b - a) * (i / steps) + (c - a) * (j / steps)
              cell = (
                math.floor(p[0] / block_m),
                math.floor((p[1] - building["groundY"]) / block_m),
                math.floor(p[2] / block_m),
              )
              key = (building["name"], *cell)
              # Roof material wins at roof/wall seams.
              if roof or key not in blocks:
                blocks[key] = [
                  round((cell[0] + 0.5) * block_m, 3),
                  round(building["groundY"] + (cell[1] + 0.5) * block_m, 3),
                  round((cell[2] + 0.5) * block_m, 3),
                  color,
                ]
  return {
    "schemaVersion": 1,
    "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5818.zip",
    "sourceSha256": hashlib.sha256(ZIP.read_bytes()).hexdigest(),
    "licence": "dl-de/zero-2-0",
    "coordinateStatus": "Exact source millimetres in local metres; each common parent floor translated onto existing main-part groundY, preserving all source heights and roof slopes.",
    "parts": parts,
    "surfaceGroups": triangles,
    "roofEdges": seams,
    "goldJoints": gold_joints,
    "foyerWindows": windows,
    "canopyWallEvidence": canopy_evidence,
    "canopyEdges": canopy_edges,
    "additionalSourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5819.zip",
    "additionalSourceSha256": hashlib.sha256(
      ZIP.with_name("LoD2_389_5819.zip").read_bytes()
    ).hexdigest(),
    "nativeBlockM": block_m,
    "nativeBlocks": list(blocks.values()),
  }


def main() -> None:
  payload = make_payload()
  DEST.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
  navigation = {
    "parts": payload["parts"],
    "roofTriangles": [
      t
      for s in payload["surfaceGroups"]
      if s["kind"] == "RoofSurface"
      for t in s["triangles"]
    ],
  }
  native_roofs = {}
  for x, y, z, _color in payload["nativeBlocks"]:
    key = (x, z)
    native_roofs[key] = max(
      native_roofs.get(key, -100), y + payload["nativeBlockM"] / 2
    )
  navigation["nativeRoofCells"] = [[x, z, y] for (x, z), y in native_roofs.items()]
  DEST.with_name("concertHallsNavigation.json").write_text(
    json.dumps(navigation, separators=(",", ":")) + "\n"
  )
  print(
    json.dumps(
      {
        "parts": len(payload["parts"]),
        "surfaceGroups": len(payload["surfaceGroups"]),
        "triangles": sum(len(s["triangles"]) for s in payload["surfaceGroups"]),
        "goldJoints": len(payload["goldJoints"]),
        "nativeBlocks": len(payload["nativeBlocks"]),
        "bytes": DEST.stat().st_size,
      }
    )
  )


if __name__ == "__main__":
  main()
