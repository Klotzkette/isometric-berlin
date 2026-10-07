"""Step 10: source-bound Steglitz shells with restrained photographic recognition.

The finite street/building context is owned by the surrounding v182 packets.
Only the explicitly inventoried owners below are replaced by these full shells.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import normal_of, triangles_for
from extract_outer_connectors_v180 import identity
from pyproj import Transformer
from shapely import orient_polygons
from shapely.geometry import Polygon, shape
from shapely.ops import transform

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
RAW = ROOT / "geo_data/regierungsviertel/raw"
GROUND = 3.55
PARENTS = [
  ("Gutshaus Steglitz", "385_5812", "DEBE06YYB0000Ele", 0xDECBB0, 0x655B50),
  ("Rathaus Steglitz", "385_5813", "DEBE06YYB0000N1G", 0xAF7050, 0x485B56),
  ("Das Schloss", "385_5813", "DEBE06YYB00001xV", 0xCBBBA1, 0x818680),
  (
    "Gymnasium Steglitz sports hall",
    "386_5813",
    "DEBE06YYB0000nL1",
    0xB7B2A4,
    0x73766A,
  ),
  ("Gymnasium Steglitz service", "386_5813", "DEBE06YYB0000nx8", 0xAEAA94, 0x73766A),
  ("Gymnasium Steglitz", "386_5813", "DEBE06YYB0000AUq", 0xB9896C, 0x5A625D),
]
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform


def world(x: float, y: float) -> tuple[float, float]:
  """Convert OSM to the unchanged local metre frame."""
  e, n = PROJECT(x, y)
  return e - 389500, 5820000 - n


def build() -> tuple[dict[str, Any], dict[str, Any]]:
  """Keep every selected LoD2 wall/roof, including courtyards and roof parts."""
  surfaces, boxes, rods, navigation, owners = [], [], [], [], []

  def surface(triangles: list, color: int, owner: str) -> None:
    surfaces.append({"triangles": triangles, "color": color, "owner": owner})

  def facade(rings: list, owner: str) -> None:
    normal = normal_of(rings[0])
    if abs(normal[1]) > 0.01:
      return
    a, b = max(
      ((a, b) for a in rings[0] for b in rings[0]),
      key=lambda p: math.hypot(p[1][0] - p[0][0], p[1][2] - p[0][2]),
    )
    d = np.array([b[0] - a[0], 0, b[2] - a[2]], dtype=float)
    length = float(np.linalg.norm(d))
    if length < 3.5:
      return
    d /= length
    wall = Polygon(
      [[(float(np.dot(np.subtract(p, a), d)), p[1]) for p in r] for r in rings][0]
    )
    low, top = wall.bounds[1], wall.bounds[3]
    bays = max(1, round(length / (3.7 if owner == "Das Schloss" else 3.2)))
    levels = max(1, round((top - low) / 3.8))
    for level in range(levels):
      y = low + (level + 0.52) * (top - low) / levels
      for i in range(bays):
        u = (i + 0.5) * length / bays
        from shapely.geometry import box

        if not wall.buffer(-0.12).covers(box(u - 0.7, y - 0.85, u + 0.7, y + 0.85)):
          continue
        p = np.array(a) + d * u + normal * 0.055
        boxes.append(
          [
            round(p[0], 3),
            round(y, 3),
            round(p[2], 3),
            min(1.55, length / bays * 0.53),
            1.7,
            0.09,
            math.atan2(-d[2], d[0]),
            0x51666A,
          ]
        )
        # Fine sill and transom are approximate facade rhythm, not survey claims.
        boxes.append(
          [
            round(p[0] + normal[0] * 0.055, 3),
            round(y - 0.9, 3),
            round(p[2] + normal[2] * 0.055, 3),
            1.7,
            0.12,
            0.15,
            math.atan2(-d[2], d[0]),
            0xDDD4BF,
          ]
        )

  for name, tile, pid, wallcolor, roofcolor in PARENTS:
    archive = RAW / "lod2" / f"LoD2_{tile}.zip"
    parent = extract_parent(archive, pid)
    parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    offset = GROUND - min(p["ground_y_m"] for p in parts)
    owners.append(
      {
        "name": name,
        "id": pid,
        "sourceUrl": f"https://gdi.berlin.de/data/a_lod2/atom/{archive.name}",
        "sourceSha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "parts": len(parts),
        "sourceSurfaceHash": hashlib.sha256(
          json.dumps(parts, sort_keys=True).encode()
        ).hexdigest(),
        "rigidYOffset": round(offset, 3),
      }
    )
    for part in parts:
      navigation.append(
        {
          "id": part["id"],
          "owner": pid,
          "ring": part["ring"],
          "holes": part["holes"],
          "groundY": round(part["ground_y_m"] + offset, 3),
          "topY": round(part["top_y_m"] + offset, 3),
        }
      )
      for s in part["surfaces"]:
        rings = [
          [[p[0], round(p[1] + offset, 3), p[2]] for p in ring] for ring in s["rings"]
        ]
        surface(
          triangles_for(rings),
          roofcolor if s["kind"] == "RoofSurface" else wallcolor,
          pid,
        )
        if s["kind"] == "WallSurface":
          facade(rings, name)

  # The authoritative LoD2 tower ends at the broad gable ridge. The narrow
  # dark lantern and needle visible in the credited photograph are absent.
  # Preserve that complete source roof and add only the missing upper tip.
  towerpart = next(p for p in navigation if p["id"] == "DEBE3DJh4DEvqKiz")
  tx, tz = -3606.519, 6787.086
  start_y = towerpart["topY"]
  layers = [
    (start_y - 0.12, 1.34),
    (start_y + 2.8, 1.34),
    (start_y + 3.2, 1.57),
    (GROUND + 55.6, 0.07),
  ]
  for (low, r0), (high, r1) in zip(layers, layers[1:]):
    for k in range(8):
      a, b = math.tau * k / 8, math.tau * (k + 1) / 8
      ring = [
        [tx + math.cos(a) * r0, low, tz + math.sin(a) * r0],
        [tx + math.cos(b) * r0, low, tz + math.sin(b) * r0],
        [tx + math.cos(b) * r1, high, tz + math.sin(b) * r1],
        [tx + math.cos(a) * r1, high, tz + math.sin(a) * r1],
      ]
      surface(triangles_for([ring]), 0x46524F, "rathaus-steeple-recognition")
      if low == layers[0][0]:
        rods.append(
          [ring[0][0], low, ring[0][2], ring[3][0], high, ring[3][2], 0.12, 0x91978B]
        )
  rods.append([tx, GROUND + 55.5, tz, tx, GROUND + 56, tz, 0.08, 0x717970])
  towerpart["sourceTopY"] = towerpart["topY"]
  towerpart["topY"] = GROUND + 56
  owners.append(
    {
      "name": "Rathaus narrow upper lantern and needle",
      "id": "rathaus-steeple-recognition",
      "heightM": 56,
      "heightSource": "Published overall height, Wikipedia Rathaus Steglitz; upper dimensions remain visual estimates",
      "reference": "https://commons.wikimedia.org/wiki/File:Rathaus_Steglitz_(Steglitz_Town_Hall)_-_geo.hlipp.de_-_26651.jpg",
      "artist": "Colin Smith",
      "license": "CC BY-SA 2.0",
      "sourcePreserved": True,
    }
  )

  rows = json.loads((RAW / "v179/kreisel-all.json").read_text())["features"]
  kreisel = {
    identity(f): f
    for f in rows
    if identity(f) in {"way/34782008", "way/34782007", "way/34782006"}
  }
  tower = None
  for oid, height, color in [
    ("way/34782008", 118.5, 0x46514F),
    ("way/34782007", 6.5, 0xC8C8B9),
    ("way/34782006", 28, 0xAEAE9F),
  ]:
    f = kreisel[oid]
    polygon = (
      Polygon(f["geometry"]["coordinates"])
      if f["geometry"]["type"] == "LineString"
      else shape(f["geometry"])
    )
    local = orient_polygons(transform(world, polygon), exterior_cw=True)
    polys = [local] if local.geom_type == "Polygon" else list(local.geoms)
    for poly in polys:
      rings = [
        list(poly.exterior.coords)[:-1],
        *[list(r.coords)[:-1] for r in poly.interiors],
      ]
      rings = [[[round(x, 3), round(z, 3)] for x, z in r] for r in rings]
      navigation.append(
        {
          "id": oid,
          "owner": oid,
          "ring": rings[0],
          "holes": rings[1:],
          "groundY": GROUND,
          "topY": GROUND + height,
        }
      )
      surface(
        triangles_for([[[x, GROUND + height, z] for x, z in ring] for ring in rings]),
        0x6A716B,
        oid,
      )
      for ring in rings:
        for a, b in zip(ring, ring[1:] + ring[:1]):
          face = [
            [
              [a[0], GROUND, a[1]],
              [b[0], GROUND, b[1]],
              [b[0], GROUND + height, b[1]],
              [a[0], GROUND + height, a[1]],
            ]
          ]
          surface(triangles_for(face), color, oid)
          if oid != "way/34782008":
            facade(face, "Kreisel podium")
      if oid == "way/34782008":
        tower = rings[0]
    owners.append(
      {
        "name": "Steglitzer Kreisel " + oid,
        "id": oid,
        "heightM": height,
        "heightSource": "OSM explicit metric height; tower agrees with published developer height",
        "footprintSource": "https://www.openstreetmap.org/" + oid,
      }
    )
  assert tower
  # 30 floor bands, narrow scaffold legs and diagonals follow every stepped
  # source edge. Owner photographs are visual references only, never textures.
  for a, b in zip(tower, tower[1:] + tower[:1]):
    dx, dz = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dz)
    for level in range(31):
      y = GROUND + 118.5 * level / 30
      rods.append([a[0], y, a[1], b[0], y, b[1], 0.105, 0xA5ADA7])
    bays = max(1, math.ceil(length / 3.6))
    for bay in range(bays + 1):
      u = bay / bays
      x, z = a[0] + dx * u, a[1] + dz * u
      rods.append([x, GROUND, z, x, GROUND + 120, z, 0.095, 0xB7BAB0])
      if bay < bays:
        v = (bay + 1) / bays
        for level in range(0, 30, 3):
          rods.append(
            [
              x,
              GROUND + 118.5 * level / 30,
              z,
              a[0] + dx * v,
              GROUND + 118.5 * (level + 3) / 30,
              a[1] + dz * v,
              0.07,
              0x8D9A90,
            ]
          )
  center = Polygon(tower).centroid
  cx, cz = center.x, center.y
  # Approximate fixed crane from supplied photo 5, oriented NW-SE; not an
  # animation and not a claim of surveyed construction-equipment placement.
  for sx, sz in [(-1.2, -1.2), (-1.2, 1.2), (1.2, -1.2), (1.2, 1.2)]:
    rods.append(
      [cx + sx, GROUND + 119, cz + sz, cx + sx, GROUND + 139, cz + sz, 0.22, 0x9EABA0]
    )
  for level in range(120, 139, 3):
    for side in [-1.2, 1.2]:
      rods.append(
        [
          cx - 1.2,
          GROUND + level,
          cz + side,
          cx + 1.2,
          GROUND + level + 3,
          cz + side,
          0.12,
          0x9EABA0,
        ]
      )
  # Lattice jib 62 m plus counterjib; photo establishes form, dimensions estimate.
  ux, uz = 0.92, 0.392
  for lateral in [-1, 1]:
    for y in [138, 140]:
      rods.append(
        [
          cx - ux * 16 - uz * lateral,
          GROUND + y,
          cz - uz * 16 + ux * lateral,
          cx + ux * 46 - uz * lateral,
          GROUND + y,
          cz + uz * 46 + ux * lateral,
          0.16,
          0xA7B1A0,
        ]
      )
    for i in range(-16, 46, 4):
      rods.append(
        [
          cx + ux * i - uz * lateral,
          GROUND + 138,
          cz + uz * i + ux * lateral,
          cx + ux * (i + 4) - uz * lateral,
          GROUND + 140,
          cz + uz * (i + 4) + ux * lateral,
          0.11,
          0xA7B1A0,
        ]
      )
  boxes.append(
    [
      cx - ux * 12,
      GROUND + 136.5,
      cz - uz * 12,
      4,
      3.1,
      3,
      math.atan2(-uz, ux),
      0x777D75,
    ]
  )
  rods.append(
    [
      cx + ux * 31,
      GROUND + 138,
      cz + uz * 31,
      cx + ux * 31,
      GROUND + 122,
      cz + uz * 31,
      0.08,
      0x454C48,
    ]
  )

  # Mapped memorial wall, independent of the market square and former synagogue.
  f = next(
    f
    for f in json.loads((RAW / "v182-steglitz/multipolygons.json").read_text())[
      "features"
    ]
    if identity(f) == "way/775632534"
  )
  poly = transform(world, shape(f["geometry"]))
  p = poly.centroid
  ring = (
    list(poly.geoms[0].exterior.coords)
    if poly.geom_type == "MultiPolygon"
    else list(poly.exterior.coords)
  )
  a, b = max(((a, b) for a in ring for b in ring), key=lambda q: math.dist(*q))
  dx, dz = b[0] - a[0], b[1] - a[1]
  length = math.hypot(dx, dz)
  ux, uz = dx / length, dz / length
  yaw = math.atan2(-uz, ux)
  for i in range(9):
    u = i - 4
    boxes.append(
      [
        p.x + ux * u,
        GROUND + 1.75,
        p.y + uz * u,
        0.985,
        3.5,
        0.2,
        yaw,
        0xA7B7BA if i % 2 else 0xBCC7C7,
      ]
    )
    # Etched name fields are thin visual lines, never invented names/text.
    for y in [1.3, 1.7, 2.1, 2.5]:
      rods.append(
        [
          p.x + ux * (u - 0.36) - uz * 0.111,
          GROUND + y,
          p.y + uz * (u - 0.36) + ux * 0.111,
          p.x + ux * (u + 0.36) - uz * 0.111,
          GROUND + y,
          p.y + uz * (u + 0.36) + ux * 0.111,
          0.018,
          0x69787B,
        ]
      )
  halfwidth = 0.12
  half = 4.5
  footprint = [
    [p.x + ux * u - uz * v, p.y + uz * u + ux * v]
    for u, v in [
      (-half, -halfwidth),
      (half, -halfwidth),
      (half, halfwidth),
      (-half, halfwidth),
    ]
  ]
  navigation.append(
    {
      "id": "way/775632534",
      "owner": "way/775632534",
      "ring": footprint,
      "holes": [],
      "groundY": GROUND,
      "topY": GROUND + 3.5,
    }
  )
  owners.append(
    {
      "name": "Spiegelwand",
      "id": "way/775632534",
      "sizeM": [9, 3.5],
      "panels": 9,
      "source": "https://bildhauerei-in-berlin.de/bildwerk/spiegelwand-5559/",
      "form": "Nine polished steel panels; inscriptions only indicated, not reproduced",
    }
  )
  runtime = {
    "surfaces": surfaces,
    "boxes": boxes,
    "rods": rods,
    "navigation": navigation,
  }
  evidence = {
    "version": "1.0.82",
    "groundY": GROUND,
    "owners": owners,
    "drawnTriangles": sum(len(s["triangles"]) for s in surfaces),
    "boxes": len(boxes),
    "rods": len(rods),
    "provenance": "All source roof/wall surfaces retained with one rigid ground translation per parent. Facade windows, colours, scaffold and crane are explicit procedural display estimates informed by the owner photos. No images or image textures shipped.",
    "omittedPhoto": "User photo 2 is an unrelated worksheet and was not used.",
  }
  return runtime, evidence


def native_blocks(source: dict[str, Any]) -> list[list[float]]:
  """One metre exterior skin; losslessly join identical vertical cube runs."""
  cells: dict[tuple[int, int, int], int] = {}

  def put(p: Any, color: int) -> None:
    cells[tuple(math.floor(float(v)) for v in p)] = color

  for surface in source["surfaces"]:
    for tri in surface["triangles"]:
      a, b, c = map(np.asarray, tri)
      n = max(
        1,
        math.ceil(
          max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
          / 0.65
        ),
      )
      for i in range(n + 1):
        for j in range(n + 1 - i):
          put(a + (b - a) * i / n + (c - a) * j / n, surface["color"])
  for x, y, z, w, h, depth, yaw, color in source["boxes"]:
    for u in np.arange(-w / 2 + 0.08, w / 2, 0.6):
      for v in np.arange(-h / 2 + 0.06, h / 2, 0.6):
        put([x + math.cos(yaw) * u, y + v, z - math.sin(yaw) * u], color)
  for r in source["rods"]:
    a, b = np.array(r[:3]), np.array(r[3:6])
    n = max(1, math.ceil(np.linalg.norm(b - a) / 0.6))
    for t in np.linspace(0, 1, n + 1):
      put(a + (b - a) * t, r[7])
  # Greedy axis-aligned boxes preserve exactly the same occupied unit cells.
  # Horizontal runs matter for broad mall roofs; vertical-only runs retain
  # tens of thousands of unnecessary cubes on the flat upper surfaces.
  lines: dict[tuple, list[int]] = {}
  for (x, y, z), color in cells.items():
    lines.setdefault((y, z, color), []).append(x)

  def runs(values: list[int]) -> list[tuple[int, int]]:
    values.sort()
    start = end = values[0]
    result = []
    for value in [*values[1:], None]:
      if value is not None and value == end + 1:
        end = value
        continue
      result.append((start, end))
      start = end = value
    return result

  slabs: dict[tuple, list[int]] = {}
  for (y, z, color), xs in lines.items():
    for x0, x1 in runs(xs):
      slabs.setdefault((x0, x1, y, color), []).append(z)
  stacks: dict[tuple, list[int]] = {}
  for (x0, x1, y, color), zs in slabs.items():
    for z0, z1 in runs(zs):
      stacks.setdefault((x0, x1, z0, z1, color), []).append(y)
  result = []
  for (x0, x1, z0, z1, color), ys in sorted(stacks.items()):
    for y0, y1 in runs(ys):
      result.append(
        [
          (x0 + x1 + 1) / 2,
          (y0 + y1 + 1) / 2,
          (z0 + z1 + 1) / 2,
          x1 - x0 + 1,
          y1 - y0 + 1,
          z1 - z0 + 1,
          color,
        ]
      )
  return result


def main() -> None:
  """Write only the dedicated Steglitz supplement, never existing city assets."""
  runtime, evidence = build()
  blocks = native_blocks(runtime)
  nav = runtime.pop("navigation")
  evidence["nativeRuns"] = len(blocks)
  navigation = {
    "buildings": nav,
    "roofTriangles": [
      t
      for s in runtime["surfaces"]
      for t in s["triangles"]
      if abs(normal_of(t)[1]) > 0.001
    ],
  }
  (DATA / "steglitzV182Native.json").write_text(
    json.dumps({"boxes": blocks}, separators=(",", ":")) + "\n"
  )
  (DATA / "steglitzV182Navigation.json").write_text(
    json.dumps(navigation, separators=(",", ":")) + "\n"
  )
  for name, data in [
    ("steglitzV182Source", runtime),
    ("steglitzV182Evidence", evidence),
  ]:
    path = DATA / (name + ".json")
    path.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    print(path.relative_to(ROOT), path.stat().st_size)
  print({k: v for k, v in evidence.items() if k not in ["owners", "provenance"]})


if __name__ == "__main__":
  main()
