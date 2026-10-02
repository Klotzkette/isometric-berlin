"""Step 10: complete present Neue Synagoge survey and additive hero detail.

The destroyed prayer hall is not reconstructed. Every official boundary is
retained; the current twin crowns and gilded roof are documented local estimates.
"""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile

import geopandas as gpd
import numpy as np
from build_breitscheid_towers_v161 import triangles_for
from build_citywest_cinemas_v166 import NS, RAW, ROOT, footprints, polygons_of
from build_surrounding_outlines import tags_for, world
from shapely.geometry import Polygon, mapping
from shapely.ops import unary_union

DEST = ROOT / "src/app/src/data/neueSynagogeV167Source.json"
PARENT = "DEBE01YYK00007VT"
TILE = "391_5820"
DATUM, GROUND = 34.144, 5.2
MAIN = "DEBE3DNfKjXQh90W"
LEFT = "DEBE3DYIHbEo8Vy5"
RIGHT = "DEBE3DUO8TFzQeXH"
BODY = "DEBE3DB2ldlC5fDa"
A = np.array([1540.517, -629.916])
D = np.array([26.312, 12.128])
D /= np.linalg.norm(D)
N = np.array([-D[1], D[0]])
BRICK, PALE, DARK, GOLD = 0xA9987C, 0xD0BFA0, 0x485253, 0xD4AB4C


def official_source() -> tuple[list[dict], list[dict], dict]:
  """Extract original IDs, rings, measured elevations and unsimplified triangles."""
  archive = ROOT / f"geo_data/regierungsviertel/raw/lod2/LoD2_{TILE}.zip"
  with zipfile.ZipFile(archive) as z:
    tree = ET.fromstring(z.read(z.namelist()[0]))
  parent = next(
    p
    for p in tree.findall(".//b:Building", NS)
    if p.get("{" + NS["g"] + "}id") == PARENT
  )
  parts, surfaces = [], []
  for part in parent.findall(".//b:BuildingPart", NS):
    sid = part.get("{" + NS["g"] + "}id")
    ss = []
    for boundary in part.findall("b:boundedBy", NS):
      for surface in boundary:
        for polygon in surface.findall(".//g:Polygon", NS):
          rings = []
          for e in polygon.findall(".//g:posList", NS):
            a = list(map(float, e.text.split()))
            ring = [
              [
                round(a[i] - 389500, 3),
                round(a[i + 2] - DATUM + GROUND, 3),
                round(5820000 - a[i + 1], 3),
              ]
              for i in range(0, len(a), 3)
            ]
            if ring[0] == ring[-1]:
              ring.pop()
            rings.append(ring)
          kind = surface.tag.split("}")[-1]
          ss.append(
            {
              "partId": sid,
              "kind": kind,
              "sourcePolygonId": polygon.get("{" + NS["g"] + "}id"),
              "rings": rings,
              "triangles": triangles_for(rings)
              if kind in ["WallSurface", "RoofSurface"]
              else [],
              "color": DARK if kind == "RoofSurface" else BRICK,
            }
          )
    surfaces.extend(ss)
    foot = footprints(ss)
    points = [p for s in ss for r in s["rings"] for p in r]
    parts.append(
      {
        "id": sid,
        "parentId": PARENT,
        "building": "Neue Synagoge — preserved present building",
        "groundY": min(p[1] for p in points),
        "topY": max(p[1] for p in points),
        "heightM": float(part.findtext("b:measuredHeight", "0", NS)),
        "polygons": [
          {
            "ring": [[round(x, 3), round(z, 3)] for x, z in p.exterior.coords[:-1]],
            "holes": [
              [[round(x, 3), round(z, 3)] for x, z in h.coords[:-1]]
              for h in p.interiors
            ],
          }
          for p in polygons_of(foot)
        ],
        "footprintAreaM2": round(foot.area, 6),
      }
    )
  assert len(parts) == 4 and len(surfaces) == 127
  return (
    parts,
    surfaces,
    {
      "url": f"https://gdi.berlin.de/data/a_lod2/atom/LoD2_{TILE}.zip",
      "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    },
  )


def hero_detail(parts: list[dict]) -> dict:
  """Independent procedural geometry; proportions are not claimed as survey."""
  boxes, rods, shapes, domes = [], [], [], []

  def rounded(v: list | np.ndarray) -> list:
    return [round(float(x), 4) for x in v]

  def rod(a: list, b: list, radius: float, color: int, role: int) -> None:
    if np.linalg.norm(np.subtract(a, b)) > 0.001:
      rods.append(rounded(a) + rounded(b) + [radius, color, role])

  def path(points: list, radius: float, color: int, role: int) -> None:
    for a, b in zip(points, points[1:]):
      rod(a, b, radius, color, role)

  def plane(p: list, d: np.ndarray, u: float, y: float, out: float) -> list:
    n = np.array([-d[1], d[0]])
    q = p + d * u + n * out
    return [q[0], y, q[1]]

  def box(
    p: list,
    d: np.ndarray,
    u: float,
    y: float,
    w: float,
    h: float,
    depth: float,
    out: float,
    color: int,
    role: int,
  ) -> None:
    q = plane(p, d, u, y, out)
    boxes.append(
      rounded(q) + [w, h, depth, round(math.atan2(-d[1], d[0]), 6), color, role]
    )

  def panel(points: list, color: int, role: int) -> None:
    points = [rounded(p) for p in points]
    shapes.append({"color": color, "role": role, "triangles": triangles_for([points])})

  def arch(
    p: list,
    d: np.ndarray,
    u: float,
    low: float,
    spring: float,
    radius: float,
    out: float,
    role: int,
    horseshoe: bool = False,
  ) -> None:
    # Recessed dark pane with raised, double-ring masonry surround.
    angles = np.linspace(
      -0.17 if horseshoe else 0, math.pi + (0.17 if horseshoe else 0), 21
    )
    head = [[u + radius * math.cos(t), spring + radius * math.sin(t)] for t in angles]
    xy = [[head[0][0], low], *head, [head[-1][0], low]]
    panel([plane(p, d, a, b, out) for a, b in xy], 0x354446, role)
    for extra, thickness, c in [(0.10, 0.11, PALE), (0.30, 0.07, 0x776A57)]:
      r = radius + extra
      pts = [
        plane(p, d, u + r * math.cos(t), spring + r * math.sin(t), out + 0.13)
        for t in angles
      ]
      path(pts, thickness, c, role)
      for sign in [-1, 1]:
        rod(
          plane(p, d, u + sign * r, low, out + 0.13),
          plane(p, d, u + sign * r, spring, out + 0.13),
          thickness,
          c,
          role,
        )
    for i, t in enumerate(np.linspace(0, math.pi, 17)):
      r = radius + 0.24
      c = PALE if i % 2 else 0x8C795D
      rod(
        plane(p, d, u + r * math.cos(t), spring + r * math.sin(t), out + 0.17),
        plane(
          p,
          d,
          u + (r + 0.16) * math.cos(t),
          spring + (r + 0.16) * math.sin(t),
          out + 0.17,
        ),
        0.075,
        c,
        role,
      )

  # Three present-day portal/window axes on the exact recessed central wall.
  front_p = A + D * 8.561 + N * -4.371
  front_d = D
  width = 11.345
  for i in range(3):
    u = width * (i + 0.5) / 3
    arch(front_p, front_d, u, 5.25, 8.0, 1.36, 0.07, 1, True)
    for du in [-0.69, 0, 0.69]:
      box(front_p, D, u + du, 6.48, 0.62, 2.40, 0.10, 0.13, 0x39413D, 1)
      box(front_p, D, u + du + 0.22, 6.42, 0.035, 0.48, 0.15, 0.23, GOLD, 1)
    arch(front_p, D, u, 13.1, 20.65, 1.38, 0.075, 2)
    # Six narrow round-headed lights per main window; actual broad grouping.
    for level, base in enumerate([13.35, 16.98]):
      for j in range(3):
        q = u + (j - 1) * 0.82
        arch(front_p, D, q, base, base + 2.65, 0.34, 0.16, 3)
        for y in [base + 0.85, base + 1.75]:
          box(front_p, D, q, y, 0.66, 0.045, 0.11, 0.29, 0xA99B7D, 3)
    for j, r in [(-1, 0.28), (0, 0.45), (1, 0.28)]:
      pts = [
        plane(
          front_p,
          D,
          u + j * 0.77 + r * math.cos(t),
          21.07 + r * 0.6 * math.sin(t),
          0.24,
        )
        for t in np.linspace(0, 2 * math.pi, 17)
      ]
      path(pts, 0.07, PALE, 3)
    for y in [13.2, 16.93]:
      box(front_p, D, u, y, 3.10, 0.18, 0.38, 0.24, PALE, 4)
  # Pier shafts, layered entablature, masonry bands and projecting dentils.
  for u in [0, width / 3, width * 2 / 3, width]:
    for offset in [-0.11, 0.11]:
      box(front_p, D, u + offset, 18.5, 0.14, 10.25, 0.20, 0.19, PALE, 4)
    for y in [12.75, 22.8, 23.2]:
      box(front_p, D, u, y, 0.72, 0.22, 0.34, 0.24, PALE, 4)
  for y, h, c in [
    (10.02, 0.12, PALE),
    (11.76, 0.14, PALE),
    (12.3, 0.5, 0x786952),
    (12.72, 0.13, PALE),
    (23.40, 0.20, PALE),
    (23.73, 0.25, 0x7A6B53),
    (24.1, 0.20, PALE),
  ]:
    box(front_p, D, width / 2, y, width + 0.5, h, 0.28, 0.20, c, 4)
  # Small terracotta rosette fields; no reproduced inscription or font.
  for row in range(3):
    for col in range(22):
      u = 0.25 + col * 0.515
      y = 10.32 + row * 0.45
      box(front_p, D, u, y, 0.46, 0.39, 0.10, 0.13, 0x887657, 5)
      for du, dy in [(0, 0.10), (0.10, 0), (0, -0.10), (-0.10, 0)]:
        box(front_p, D, u + du, y + dy, 0.065, 0.065, 0.13, 0.22, PALE, 5)
  for u in np.arange(0.13, width, 0.29):
    box(front_p, D, float(u), 23.94, 0.105, 0.32, 0.28, 0.24, PALE, 4)
  # The golden historic inscription exists; use its empty framed band, not fake text.
  box(front_p, D, width / 2, 12.30, width - 0.2, 0.37, 0.14, 0.36, 0x514C37, 5)
  for y in [12.12, 12.49]:
    box(front_p, D, width / 2, y, width - 0.1, 0.045, 0.18, 0.45, GOLD, 5)

  # Each measured lower projecting tower face and the adjoining broad piers.
  for lo, hi, out in [
    (0, 4.939, 0),
    (6.115, 8.563, -3.605),
    (19.911, 22.562, -3.738),
    (23.822, 28.973, 0),
  ]:
    w = hi - lo
    for y in np.arange(5.6, 23.35, 0.48):
      box(A, D, (lo + hi) / 2, float(y), w - 0.10, 0.037, 0.08, out + 0.06, 0x75674F, 6)
    for y in [9.8, 12.65, 22.3, 23.0]:
      box(A, D, (lo + hi) / 2, y, w, 0.18, 0.18, out + 0.15, PALE, 4)
    for u in [lo + 0.2, hi - 0.2]:
      box(A, D, u, 15.0, 0.26, 17.7, 0.23, out + 0.18, PALE, 4)
    if w > 4:
      arch(A, D, (lo + hi) / 2, 14.0, 18.7, 1.16, out + 0.08, 2)
      for du in [-0.45, 0.45]:
        arch(A, D, (lo + hi) / 2 + du, 14.2, 18.15, 0.32, out + 0.16, 3)
      arch(A, D, (lo + hi) / 2, 6.1, 8.65, 0.60, out + 0.08, 1)

  # Restored right upper octagon uses its exact official plan. It is explicitly
  # separate from the retained low survey part, which is never stretched.
  tower_specs = []
  for part_id in [LEFT, RIGHT]:
    part = next(p for p in parts if p["id"] == part_id)
    ring = part["polygons"][0]["ring"]
    center = np.array(Polygon(ring).centroid.coords[0])
    tower_specs.append((part_id, ring, center))
    for i, a in enumerate(ring):
      b = ring[(i + 1) % len(ring)]
      a, b = np.array(a), np.array(b)
      d = (b - a) / np.linalg.norm(b - a)
      length = float(np.linalg.norm(b - a))
      # Derive outward normal independently of GML winding.
      n = np.array([-d[1], d[0]])
      if np.dot((a + b) / 2 - center, n) < 0:
        a, b = b, a
        d = -d
      if part_id == RIGHT:
        panel(
          [
            [a[0], 24.5, a[1]],
            [b[0], 24.5, b[1]],
            [b[0], 38.14, b[1]],
            [a[0], 38.14, a[1]],
          ],
          BRICK,
          7,
        )
      arch(a, d, length / 2, 26.0, 32.4, 0.48, 0.06, 8)
      box(a, d, length / 2, 29.05, 0.065, 6.0, 0.13, 0.2, PALE, 8)
      for y in [25.6, 33.15, 34.0, 35.1, 35.7]:
        box(a, d, length / 2, y, length + 0.08, 0.20, 0.24, 0.10, PALE, 9)
      for y in np.arange(25.3, 35.7, 0.42):
        box(a, d, length / 2, float(y), length, 0.034, 0.055, 0.035, 0x7E6E53, 6)
      for u in [0.05, length - 0.05]:
        box(a, d, u, 30.75, 0.17, 10.05, 0.21, 0.16, PALE, 9)
      for u in np.linspace(0.18, length - 0.18, 4):
        arch(a, d, float(u), 33.6, 34.12, 0.14, 0.11, 9)

  # Twelve-sided high drum: narrow blind arcade and layered cornice.
  center = np.array([1558.769, -635.551])
  main_part = next(p for p in parts if p["id"] == MAIN)
  ring = main_part["polygons"][0]["ring"]
  for i, a in enumerate(ring):
    b = ring[(i + 1) % len(ring)]
    a, b = np.array(a), np.array(b)
    length = float(np.linalg.norm(b - a))
    if length < 1:
      continue
    d = (b - a) / length
    n = np.array([-d[1], d[0]])
    if np.dot((a + b) / 2 - center, n) < 0:
      a, b = b, a
      d = -d
    for j in range(3):
      u = length * (j + 0.5) / 3
      arch(a, d, u, 30.9, 34.55, 0.29, 0.08, 10)
    for y in [35.2, 35.65, 36.25, 37.10, 37.60]:
      box(a, d, length / 2, y, length + 0.06, 0.19, 0.22, 0.11, PALE, 10)
    for u in [0.10, length - 0.10]:
      box(a, d, u, 33.2, 0.21, 7.6, 0.26, 0.12, PALE, 10)

  def dome(
    center: np.ndarray, profile: list, role: int, ribs: int, finial_top: float
  ) -> None:
    # Piecewise radius profile encloses the original coarse crown. It remains
    # a labelled authored estimate, never a substituted surveyed measurement.
    def radius(y: float) -> float:
      return float(np.interp(y, [p[0] for p in profile], [p[1] for p in profile]))

    def point(theta: float, y: float, out: float = 0) -> list:
      r = radius(y) + out
      return [center[0] + r * math.cos(theta), y, center[1] + r * math.sin(theta)]

    triangles = []
    steps = 72 if role == 11 else 40
    for (y0, r0), (y1, r1) in zip(profile, profile[1:]):
      for i in range(steps):
        a = 2 * math.pi * i / steps
        b = 2 * math.pi * (i + 1) / steps
        q = [point(a, y0), point(b, y0), point(b, y1), point(a, y1)]
        triangles.extend(
          [
            [rounded(q[0]), rounded(q[1]), rounded(q[2])],
            [rounded(q[0]), rounded(q[2]), rounded(q[3])],
          ]
        )
    shapes.append({"color": 0x566163, "role": role, "triangles": triangles})
    bottom, top = profile[0][0], profile[-1][0]
    height = top - bottom
    for i in range(ribs):
      a = 2 * math.pi * i / ribs
      path(
        [point(a, y, 0.075) for y, _ in profile],
        0.067 if role == 11 else 0.042,
        GOLD,
        role,
      )
      # Long pointed-arch gilt fields; little waist roundels above each arch.
      if role == 11:
        for sign in [-1, 1]:
          pts = [
            point(
              a + sign * math.pi / ribs * (1 - t**2), bottom + height * 0.63 * t, 0.10
            )
            for t in np.linspace(0, 1, 13)
          ]
          path(pts, 0.080, GOLD, role)
        yc = bottom + height * 0.735
        pts = [
          point(a + 0.096 * math.cos(t), yc + 0.70 * math.sin(t), 0.1)
          for t in np.linspace(0, 2 * math.pi, 21)
        ]
        path(pts, 0.070, GOLD, role)
      else:
        for sign in [-1, 1]:
          path(
            [
              point(
                a + sign * 0.16 * math.sin(math.pi * t),
                bottom + height * 0.42 * t,
                0.07,
              )
              for t in np.linspace(0, 1, 9)
            ],
            0.037,
            GOLD,
            role,
          )
    for y in [bottom + 0.06, bottom + 0.23, top - 0.15]:
      path(
        [point(t, y, 0.10) for t in np.linspace(0, 2 * math.pi, steps + 1)],
        0.075 if role == 11 else 0.05,
        GOLD,
        role,
      )
    # Small ball is a revolved geometric estimate; star is independent six-line wire.
    ball_y = top + 0.60
    ball_r = 0.46 if role == 11 else 0.24
    for meridian in range(8):
      a = 2 * math.pi * meridian / 8
      path(
        [
          [
            center[0] + ball_r * math.sin(t) * math.cos(a),
            ball_y + ball_r * math.cos(t),
            center[1] + ball_r * math.sin(t) * math.sin(a),
          ]
          for t in np.linspace(0, math.pi, 9)
        ],
        0.09 if role == 11 else 0.05,
        GOLD,
        13,
      )
    rod(
      [center[0], top, center[1]],
      [center[0], finial_top - 0.6, center[1]],
      0.065,
      GOLD,
      13,
    )
    star_r = 0.72 if role == 11 else 0.37
    yc = finial_top - star_r
    for flip in [0, math.pi]:
      pts = [
        plane(
          center,
          D,
          star_r * math.cos(math.pi / 2 + flip + k * 2 * math.pi / 3),
          yc + star_r * math.sin(math.pi / 2 + flip + k * 2 * math.pi / 3),
          0,
        )
        for k in [0, 1, 2, 0]
      ]
      path(pts, 0.047 if role == 11 else 0.034, GOLD, 13)
    domes.append(
      {
        "center": rounded(center),
        "profile": profile,
        "role": role,
        "ribs": ribs,
        "finialTopY": finial_top,
        "estimated": True,
      }
    )

  dome(
    center,
    [
      [37.8, 8.25],
      [39, 8.65],
      [40.5, 8.9],
      [42, 8.85],
      [43.5, 8.65],
      [45, 8.36],
      [46, 7.65],
      [47.5, 6.3],
      [49, 4.4],
      [50, 2.05],
      [50.4, 0.47],
    ],
    11,
    24,
    55.2,
  )
  for _, _, center in tower_specs:
    dome(
      center,
      [
        [35.7, 2.3],
        [36.5, 2.55],
        [37.5, 2.55],
        [38.2, 2.40],
        [39.0, 1.87],
        [39.7, 0.65],
        [39.85, 0.18],
      ],
      12,
      16,
      42.1,
    )
  return {
    "facadeBoxes": boxes,
    "detailRods": rods,
    "authoredSurfaces": shapes,
    "domes": domes,
    "roleNames": {
      "1": "three horseshoe portals and tower doors",
      "2": "broad arched window groups",
      "3": "paired triple lancet lights and roundels",
      "4": "masonry piers cornices and dentils",
      "5": "terracotta rosettes and empty inscription frame",
      "6": "horizontal brick bands",
      "7": "right upper tower restoration",
      "8": "twin upper tower glazing",
      "9": "octagonal tower cornice arcades",
      "10": "twelve-sided drum windows",
      "11": "main dark dome with gilded pointed arches and roundels",
      "12": "twin small crown ribs and palmette cues",
      "13": "three ball and Star of David finials",
    },
  }


def native_blocks(surfaces: list[dict], details: dict) -> list[list]:
  """One independent orthogonal source skin with separate crown/facade cells."""
  cells = {}

  def put(p: list, color: int, size: float) -> None:
    key = (size, *(math.floor(float(v) / size) for v in p))
    cells[key] = [round((v + 0.5) * size, 3) for v in key[1:]] + [color, size]

  def triangle(t: list, color: int, size: float) -> None:
    a, b, c = map(np.array, t)
    steps = max(
      1,
      math.ceil(
        max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
        / (size * 0.62)
      ),
    )
    for i in range(steps + 1):
      for j in range(steps + 1 - i):
        put(a + (b - a) * i / steps + (c - a) * j / steps, color, size)

  for s in surfaces:
    for t in s["triangles"]:
      triangle(t, s["color"], 1.0)
  for s in details["authoredSurfaces"]:
    for t in s["triangles"]:
      triangle(t, s["color"], 1.0 if s["role"] >= 7 else 0.5)
  # Orthogonal facade cubes stand just beyond the block skin, preserving detail.
  for x, y, z, w, h, depth, yaw, color, role in details["facadeBoxes"]:
    if role in [5, 6] or min(w, h) < 0.10:
      continue
    for u in np.arange(-w / 2 + 0.1, w / 2, 0.43):
      for v in np.arange(-h / 2 + 0.06, h / 2, 0.43):
        put(
          [
            x + math.cos(yaw) * u + math.sin(yaw) * 0.65,
            y + v,
            z - math.sin(yaw) * u + math.cos(yaw) * 0.65,
          ],
          color,
          0.5,
        )
  for r in details["detailRods"]:
    a, b = np.array(r[:3]), np.array(r[3:6])
    role = r[8]
    if role not in [1, 2, 3, 8, 10, 11, 12, 13]:
      continue
    size = 0.5
    steps = max(1, math.ceil(np.linalg.norm(b - a) / 0.23))
    for t in np.linspace(0, 1, steps + 1):
      p = a + (b - a) * t
      if role < 11:
        p += np.array([N[0] * 0.6, 0, N[1] * 0.6])
      put(p, r[7], size)
  return list(cells.values())


def make_payload() -> dict:
  parts, surfaces, archive = official_source()
  details = hero_detail(parts)
  osm = gpd.read_file(
    RAW / "candidate.gpkg", layer="multipolygons", where="osm_way_id = '24054915'"
  ).to_crs(25833)
  osm_foot = world(osm.iloc[0].geometry)
  feet = unary_union(
    [Polygon(p["ring"], p["holes"]) for part in parts for p in part["polygons"]]
  )
  prism_path = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  if not prism_path.exists():
    matches = list((ROOT / "src/app/public").rglob("*prism*.json"))
    prism_path = next(p for p in matches if "buildings" in p.name)
  data = json.loads(prism_path.read_text())
  rows = data.get("buildings", data.get("prisms", []))
  if not rows:
    raise ValueError(f"No prism rows in {prism_path}")
  legacy = [p for p in rows if str(p["id"]) == "24054915"]
  assert len(legacy) == 1
  with (RAW / "berlin-260929.osm.pbf").open("rb") as stream:
    osm_hash = hashlib.file_digest(stream, "sha256").hexdigest()
  return {
    "schemaVersion": 1,
    "parents": [
      {
        "id": PARENT,
        "name": "Neue Synagoge — preserved present building",
        "tile": TILE,
        "groundNHN": DATUM,
        "groundY": GROUND,
        "outer": False,
      }
    ],
    "parts": parts,
    "surfaces": surfaces,
    **details,
    "nativeBlocks": native_blocks(surfaces, details),
    "legacyPrisms": legacy,
    "sourceArchives": [archive],
    "osmEvidence": [
      {
        "id": "OSM-way-24054915",
        "tags": tags_for(osm.iloc[0]),
        "geometry": mapping(osm_foot),
      }
    ],
    "osmSourceUrl": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    "osmSourceSha256": osm_hash,
    "licences": {"buildings": "dl-de/zero-2-0", "map": "ODbL-1.0"},
    "sourceConflicts": {
      "officialFootprintAreaM2": round(feet.area, 6),
      "osmFootprintAreaM2": round(osm_foot.area, 6),
      "osmOnlyAreaM2": round(osm_foot.difference(feet).area, 6),
      "officialOnlyAreaM2": round(feet.difference(osm_foot).area, 6),
      "mainSourceHeightM": 44.469,
      "mainAuthoredOverallHeightM": 50.0,
      "leftSourceHeightM": 32.923,
      "rightSourceHeightM": 3.143,
      "resolution": "Retain all measured polygons; add current twin upper crowns and gilded dome as explicitly estimated hero geometry. Primary Jewish community describes approximately 50 m overall. Source footprint is unchanged; demolished rear prayer hall is not reconstructed.",
    },
    "sourcePolicy": "All four official parts and 127 original boundaries retained. Fine ornament, missing right upper tower and enclosing dome crown are additive display estimates backed by primary heritage descriptions and inspected free references. No destroyed rear hall, photo, pixel texture or invented inscription.",
  }


def main() -> None:
  payload = make_payload()
  DEST.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
  native = {}
  for x, y, z, color, size in payload["nativeBlocks"]:
    for ix in range(math.floor((x - size / 2) / 0.5), math.ceil((x + size / 2) / 0.5)):
      for iz in range(
        math.floor((z - size / 2) / 0.5), math.ceil((z + size / 2) / 0.5)
      ):
        native[(ix, iz)] = max(native.get((ix, iz), -100), y + size / 2)
  nav = {k: payload[k] for k in ["parents", "parts", "legacyPrisms", "domes"]}
  nav["roofTriangles"] = [
    t for s in payload["surfaces"] if s["kind"] == "RoofSurface" for t in s["triangles"]
  ]
  nav["nativeRoofCells"] = [[x, z, y] for (x, z), y in native.items()]
  DEST.with_name("neueSynagogeV167Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  print(
    {
      k: len(payload[k])
      for k in [
        "parts",
        "surfaces",
        "facadeBoxes",
        "detailRods",
        "authoredSurfaces",
        "nativeBlocks",
      ]
    }
  )


if __name__ == "__main__":
  main()
