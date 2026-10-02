"""Step 10: additive Zionskirche facades and its missing masonry spire.

The complete Alt-Mitte LoD2 owner is retained byte-for-byte. This generator
reads its existing display transform and builds only thin exterior detail and
the documented missing upper silhouette; no source shell is shipped twice.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

import numpy as np
from build_breitscheid_towers_v161 import normal_of, triangles_for

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "src/app/src/data"
SOURCE = ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-391_5821-00.json.gz"
PARENT = "DEBE01YYK0000014"
TOWER = "DEBE3Dj5UEZckkkC"
NAVE = "DEBE3DwWmZ1lKvwB"
BRICK, PALE, SHADOW, GLASS = 0xB3A07A, 0xD4C5A3, 0x5B5444, 0x414746
SPIRE, GOLD = 0xA99569, 0xCBBB91
ROLES = {
  1: "thin source-plane brick backing over generic estimated windows",
  2: "nave round-arched windows and tracery",
  3: "lower paired round-headed lights",
  4: "Lombard dwarf galleries and cornices",
  5: "brick bands buttress shafts and capitals",
  6: "tower paired belfry arches and upper triple arcades",
  7: "four clock faces with hour marks and fixed hands",
  8: "entrance portals and doors",
  9: "octagonal masonry spire and cornice",
  10: "spire ribs blind recesses and roundels",
  11: "cross and small finial crown",
}


def source_record() -> dict:
  """Read the already-published complete source and its exact vertical datum."""
  records = json.loads(gzip.decompress(SOURCE.read_bytes()))["buildings"]
  return next(r for r in records if r["id"] == PARENT)


def rounded(values: list | np.ndarray) -> list:
  return [round(float(v), 5) for v in values]


def detail(record: dict) -> dict:
  """Independent visual interpretation; small subdivisions are not surveys."""
  surfaces, boxes, rods = [], [], []
  ground = record["groundY"]
  tower = next(p for p in record["parts"] if p["id"] == TOWER)
  ring = np.asarray(tower["footprintPolygons"][0]["ring"])
  center = np.mean(ring, axis=0)

  def panel(points: list, color: int, role: int, n: list | np.ndarray) -> None:
    # triangles_for expects a list of rings, including for vertical polygons.
    triangles = triangles_for([[rounded(p) for p in points]])
    surfaces.append(
      {"color": color, "role": role, "triangles": triangles, "normal": rounded(n)}
    )

  def rod(a: list, b: list, radius: float, color: int, role: int, n: list) -> None:
    if np.linalg.norm(np.subtract(a, b)) > 0.001:
      rods.append(rounded(a) + rounded(b) + [radius, color, role, *rounded(n)])

  def path(points: list, radius: float, color: int, role: int, n: list) -> None:
    for a, b in zip(points, points[1:]):
      rod(a, b, radius, color, role, n)

  def face(origin: np.ndarray, d: np.ndarray, n: np.ndarray) -> tuple:
    def point(u: float, y: float, out: float = 0.32) -> list:
      p = origin + d * u + n * out
      return [p[0], y, p[1]]

    def box(
      u: float,
      y: float,
      w: float,
      h: float,
      color: int,
      role: int,
      depth: float = 0.12,
      out: float = 0.40,
    ) -> None:
      boxes.append(
        rounded(point(u, y, out))
        + [w, h, depth, round(math.atan2(-d[1], d[0]), 7), color, role, *rounded(n)]
      )

    def arch(
      u: float,
      low: float,
      spring: float,
      radius: float,
      role: int,
      color: int = GLASS,
      frame: float = 0.09,
      fill: bool = True,
    ) -> None:
      angles = np.linspace(0, math.pi, 17)
      head = [[u + radius * math.cos(t), spring + radius * math.sin(t)] for t in angles]
      if fill:
        panel(
          [
            point(u + radius, low),
            *[point(a, b) for a, b in head],
            point(u - radius, low),
          ],
          color,
          role,
          n,
        )
      for extra, thick, c in [(0.04, frame, PALE), (0.19, frame * 0.58, SHADOW)]:
        r = radius + extra
        path(
          [point(u + r * math.cos(t), spring + r * math.sin(t), 0.43) for t in angles],
          thick,
          c,
          role,
          n,
        )
        for sign in [-1, 1]:
          rod(
            point(u + sign * r, low, 0.43),
            point(u + sign * r, spring, 0.43),
            thick,
            c,
            role,
            n,
          )
      box(u, low - 0.08, radius * 2 + 0.36, 0.15, PALE, role, 0.22, 0.44)

    def circle(
      u: float, y: float, r: float, role: int, c: int = PALE, out: float = 0.47
    ) -> None:
      path(
        [
          point(u + r * math.cos(t), y + r * math.sin(t), out)
          for t in np.linspace(0, math.tau, 25)
        ],
        0.065,
        c,
        role,
        n,
      )

    return point, box, arch, circle

  # A thin backing covers only the earlier procedural generic window layer
  # (max 0.125 m outward); every measured surface and roof remains untouched.
  wall_frames = []
  for part in record["parts"]:
    for s in part["surfaces"]:
      if s["kind"] != "WallSurface":
        continue
      outer = np.asarray(s["rings"][0])
      n3 = normal_of(s["rings"][0])
      if abs(n3[1]) > 0.03 or not np.isfinite(n3).all():
        continue
      n = n3[[0, 2]]
      for tri in triangles_for(s["rings"]):
        panel([np.asarray(p) + n3 * 0.22 for p in tri], BRICK, 1, n)
      a, b = max(
        ((a, b) for a in outer for b in outer),
        key=lambda ab: np.linalg.norm((ab[1] - ab[0])[[0, 2]]),
      )
      d = (b - a)[[0, 2]]
      length = float(np.linalg.norm(d))
      if length < 0.45:
        continue
      d /= length
      low, high = min(outer[:, 1]), max(outer[:, 1])
      if high - low < 3:
        continue
      point, box, arch, circle = face(a[[0, 2]], d, n)
      wall_frames.append((part["id"], a[[0, 2]], d, n, length, low, high))
      if part["id"] == TOWER:
        continue
      # The source's short facets describe buttresses and the rounded apse.
      if length < 2.35:
        if length > 0.68:
          for y in [ground + 2.0, ground + 8.1, ground + 18.6, ground + 21.0]:
            if y < high - 0.3:
              box(length / 2, y, length + 0.02, 0.16, PALE, 5, 0.18, 0.34)
        continue
      for y in [ground + 1.0, ground + 8.1, ground + 18.6, ground + 21.0]:
        if y < high - 0.3:
          box(length / 2, y, length - 0.06, 0.16, PALE, 5, 0.19, 0.35)
      if length > 4.4:
        # One monumental upper window per measured nave bay. The portal
        # front is the south end (highest z), matched by its source midpoint.
        is_portal = float(np.mean(outer[:, 2])) > -1678.1
        if is_portal:
          arch(length / 2, ground + 0.15, ground + 4.1, 1.55, 8, 0x6A4834, 0.16)
          box(length / 2, ground + 2.2, 0.09, 4.1, PALE, 8, 0.18)
          for u in [-0.65, 0.65]:
            box(length / 2 + u, ground + 2.0, 0.055, 0.60, GOLD, 8, 0.23, 0.57)
          # Shallow projecting gable, kept inside the mapped front apron.
          path(
            [
              point(length / 2 - 2.05, ground + 5.0, 0.70),
              point(length / 2, ground + 7.05, 0.70),
              point(length / 2 + 2.05, ground + 5.0, 0.70),
            ],
            0.18,
            PALE,
            8,
            n,
          )
        else:
          for du in [-0.77, 0.77]:
            arch(length / 2 + du, ground + 1.35, ground + 4.0, 0.54, 3, frame=0.07)
        r = min(1.74, length / 2 - 0.52)
        arch(length / 2, ground + 8.6, ground + 16.4, r, 2, frame=0.15)
        for du in [-r * 0.48, r * 0.48]:
          arch(
            length / 2 + du,
            ground + 8.8,
            ground + 15.72,
            r * 0.44,
            2,
            frame=0.075,
            fill=False,
          )
        circle(length / 2, ground + 17.02, r * 0.37, 2)
        for k in range(4):
          theta = k * math.pi / 2
          circle(
            length / 2 + r * 0.17 * math.cos(theta),
            ground + 17.02 + r * 0.17 * math.sin(theta),
            r * 0.135,
            2,
          )
        for y in [ground + 11.15, ground + 13.8]:
          box(length / 2, y, r * 1.85, 0.055, SHADOW, 2, 0.10, 0.49)
      else:
        arch(
          length / 2,
          ground + 10.0,
          ground + 16.5,
          min(0.86, length / 2 - 0.45),
          2,
          frame=0.10,
        )
      # The characteristic dwarf arcade lies below the existing source eave.
      gallery_y = min(high - 2.55, ground + 19.7)
      bays = max(2, int(length / 0.85))
      for i in range(bays):
        arch(
          (i + 0.5) * length / bays,
          gallery_y,
          gallery_y + 0.86,
          min(0.28, length / bays * 0.32),
          4,
          SHADOW,
          0.055,
        )
      for y, h, depth in [
        (gallery_y - 0.22, 0.16, 0.30),
        (gallery_y + 1.43, 0.22, 0.42),
        (gallery_y + 1.80, 0.13, 0.31),
      ]:
        if y < high - 0.1:
          box(length / 2, y, length + 0.07, h, PALE, 4, depth, 0.43)
      # Each large plane's edge pier is a facade subdivision, not new massing.
      for u in [0.22, length - 0.22]:
        box(u, ground + 12.65, 0.25, 19.0, BRICK, 5, 0.30, 0.42)
        box(u, ground + 18.75, 0.47, 0.20, PALE, 5, 0.40, 0.46)

  # The large apse is tessellated into short official wall facets. Five window
  # groups span adjacent facets, so they use local tangents instead of treating
  # every small source polygon as a separate window. The apse shell is retained.
  apse_center = np.array([2228.55, -1718.70])
  for theta in np.linspace(math.radians(210), math.radians(310), 5):
    n = np.array([math.cos(theta), math.sin(theta)])
    d = np.array([-n[1], n[0]])
    a = apse_center + n * 10.45
    point, box, arch, circle = face(a, d, n)
    arch(0, 11.6, 19.1, 0.83, 2, frame=0.12)
    box(0, 14.75, 0.075, 6.2, PALE, 2, 0.14, 0.45)
    arch(0, 4.2, 6.5, 0.58, 3, frame=0.07)
    for u in [-0.62, 0, 0.62]:
      arch(u, 22.4, 23.2, 0.20, 4, SHADOW, 0.05)

  # Exact eight surveyed faces give tower orientation and width.
  for i, a in enumerate(ring):
    b = ring[(i + 1) % 8]
    d = b - a
    length = float(np.linalg.norm(d))
    d /= length
    n = np.array([-d[1], d[0]])
    if np.dot(n, (a + b) / 2 - center) < 0:
      n *= -1
    point, box, arch, circle = face(a, d, n)
    # The survey's coarse terminal roof is oblique (47.841–51.126 m). A thin
    # exterior upper fascia restores the photographed continuous cornice while
    # leaving that complete measured roof behind it.
    panel(
      [
        point(0, 47.70, 0.23),
        point(length, 47.70, 0.23),
        point(length, 51.25, 0.23),
        point(0, 51.25, 0.23),
      ],
      BRICK,
      1,
      n,
    )
    for y, h, depth in [
      (28.0, 0.35, 0.31),
      (34.2, 0.30, 0.36),
      (35.2, 0.18, 0.36),
      (46.1, 0.24, 0.37),
      (49.0, 0.24, 0.52),
      (50.0, 0.23, 0.62),
      (51.2, 0.33, 0.67),
    ]:
      box(length / 2, y, length + 0.15, h, PALE, 6, depth, 0.43)
    # Four clocks occupy alternate octagonal faces just above the nave eave.
    if i % 2 == 0:
      u, y, r = length / 2, 29.8, 0.94
      panel(
        [
          point(u + r * math.cos(t), y + r * math.sin(t), 0.34)
          for t in np.linspace(0, math.tau, 33)[:-1]
        ],
        0x443C32,
        7,
        n,
      )
      circle(u, y, r + 0.06, 7, PALE)
      circle(u, y, r + 0.22, 7, PALE)
      for k in range(12):
        t = k * math.tau / 12
        rod(
          point(u + 0.70 * math.sin(t), y + 0.70 * math.cos(t), 0.50),
          point(u + 0.85 * math.sin(t), y + 0.85 * math.cos(t), 0.50),
          0.043,
          PALE,
          7,
          n,
        )
      rod(point(u, y, 0.52), point(u - 0.37, y + 0.36, 0.52), 0.047, PALE, 7, n)
      rod(point(u, y, 0.52), point(u + 0.12, y + 0.67, 0.52), 0.034, PALE, 7, n)
    else:
      for du in [-0.58, 0.58]:
        arch(length / 2 + du, 28.4, 31.55, 0.45, 6, SHADOW, 0.07)
    arch(length / 2, 35.5, 43.95, 1.26, 6, 0x343735, 0.14)
    for du in [-0.60, 0.60]:
      arch(length / 2 + du, 35.75, 42.96, 0.53, 6, frame=0.10, fill=False)
    circle(length / 2, 44.25, 0.49, 6)
    for k in range(3):
      t = math.pi / 2 + k * math.tau / 3
      circle(length / 2 + 0.20 * math.cos(t), 44.25 + 0.20 * math.sin(t), 0.18, 6)
    for j in range(3):
      arch(length * (j + 1) / 4, 46.55, 48.1, 0.34, 6, SHADOW, 0.07)
    for j in range(5):
      arch(length * (j + 0.5) / 5, 49.32, 49.62, 0.18, 4, SHADOW, 0.045)
    for u in [0.05, length - 0.05]:
      box(u, 39.0, 0.18, 13.6, BRICK, 5, 0.31, 0.49)

  # Only the missing upper envelope is newly authored. Its tip follows the
  # published 67 m overall height, at the existing viewer ground of 3 m.
  spire_layers = [
    [50.88, 1.04],
    [51.55, 1.04],
    [51.75, 0.985],
    [67.90, 0.055],
    [68.20, 0.055],
    [68.32, 0.10],
    [68.52, 0.10],
  ]

  def ring_point(k: int, y: float, scale: float) -> list:
    xz = center + (ring[k % 8] - center) * scale
    return [xz[0], y, xz[1]]

  for (ya, ra), (yb, rb) in zip(spire_layers, spire_layers[1:]):
    for k in range(8):
      panel(
        [
          ring_point(k, ya, ra),
          ring_point(k + 1, ya, ra),
          ring_point(k + 1, yb, rb),
          ring_point(k, yb, rb),
        ],
        PALE if ya < 51.75 or ya > 68.19 else SPIRE,
        9,
        [0, 0],
      )
  for k in range(8):
    path(
      [ring_point(k, 51.8, 0.991), ring_point(k, 67.9, 0.067)], 0.09, PALE, 10, [0, 0]
    )
    a, b = ring[k], ring[(k + 1) % 8]
    mid = (a + b) / 2
    tangent = (b - a) / np.linalg.norm(b - a)
    normal = (mid - center) / np.linalg.norm(mid - center)

    def on_slope(u: float, y: float, out: float = 0.04) -> list:
      scale = 0.985 + (0.055 - 0.985) * (y - 51.75) / (67.9 - 51.75)
      xz = center + (mid - center) * scale + tangent * u + normal * out
      return [xz[0], y, xz[1]]

    # Long blind recesses and the small circular base panels are masonry cues.
    panel(
      [
        on_slope(-0.48, 54.0),
        on_slope(0.48, 54.0),
        on_slope(0.13, 64.55),
        on_slope(-0.13, 64.55),
      ],
      SHADOW,
      10,
      [0, 0],
    )
    for sign in [-1, 1]:
      rod(
        on_slope(sign * 0.54, 54.0, 0.08),
        on_slope(sign * 0.18, 64.6, 0.08),
        0.05,
        PALE,
        10,
        [0, 0],
      )
    path(
      [
        on_slope(0.41 * math.cos(t), 53.0 + 0.41 * math.sin(t), 0.10)
        for t in np.linspace(0, math.tau, 25)
      ],
      0.065,
      PALE,
      10,
      [0, 0],
    )

  # The historic cross has a small branching crown. Its highest solid is 70 m.
  def cp(dx: float, y: float, dz: float = 0) -> list:
    return [center[0] + dx, y, center[1] + dz]

  rod(cp(0, 68.45), cp(0, 69.92), 0.08, GOLD, 11, [0, 0])
  rod(cp(-0.52, 69.38), cp(0.52, 69.38), 0.075, GOLD, 11, [0, 0])
  for sign in [-1, 1]:
    path(
      [
        cp(sign * 0.16, 68.7),
        cp(sign * 0.43, 69.03),
        cp(sign * 0.65, 69.4),
        cp(sign * 0.55, 69.57),
      ],
      0.060,
      GOLD,
      11,
      [0, 0],
    )
  # Horizontal cap accurately terminates the silhouette at the documented top.
  boxes.append(
    [
      round(center[0], 5),
      69.96,
      round(center[1], 5),
      0.16,
      0.08,
      0.16,
      0,
      GOLD,
      11,
      0,
      0,
    ]
  )
  return {
    "surfaces": surfaces,
    "facadeBoxes": boxes,
    "detailRods": rods,
    "spire": {
      "center": rounded(center),
      "ring": ring.tolist(),
      "layers": spire_layers,
      "finialTopY": ground + 67,
    },
  }


def native_blocks(details: dict) -> list[list]:
  """An orthogonal exterior-only overlay and stepped spire, with no solid fill."""
  cells = {}

  def put(p: list | np.ndarray, color: int, size: float, role: int) -> None:
    key = (size, *(math.floor(float(v) / size) for v in p))
    cells[key] = [round((v + 0.5) * size, 4) for v in key[1:]] + [color, size, role]

  def triangle(t: list, color: int, size: float, role: int, shift: np.ndarray) -> None:
    a, b, c = [np.asarray(p) + shift for p in t]
    steps = max(
      1,
      math.ceil(
        max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
        / (size * 0.57)
      ),
    )
    for i in range(steps + 1):
      for j in range(steps + 1 - i):
        put(a + (b - a) * i / steps + (c - a) * j / steps, color, size, role)

  for s in details["surfaces"]:
    role = s["role"]
    # Old source skin uses 2m cells. New local face detail sits beyond their
    # exterior quantization while retaining the independent source beneath.
    out = 1.10 if role == 1 else 1.55
    n = s["normal"]
    shift = np.array([n[0] * out, 0, n[1] * out])
    # One lattice lets finer marks replace backing cells exactly; overlapping
    # differently sized facade cubes would have coplanar, flickering faces.
    size = 0.5
    for t in s["triangles"]:
      triangle(t, s["color"], size, role, shift)
  for x, y, z, w, h, depth, yaw, color, role, nx, nz in details["facadeBoxes"]:
    if min(w, h) < 0.11 and role != 11:
      continue
    size = 0.25 if role == 11 else 0.5
    for u in np.arange(-w / 2 + 0.06, w / 2, size * 0.6):
      for v in np.arange(-h / 2 + 0.03, h / 2, size * 0.6):
        put(
          [
            x + math.cos(yaw) * u + nx * 1.65,
            min(y + v, 69.875),
            z - math.sin(yaw) * u + nz * 1.65,
          ],
          color,
          size,
          role,
        )
  for r in details["detailRods"]:
    a, b = np.asarray(r[:3]), np.asarray(r[3:6])
    color, role, nx, nz = r[7:]
    size = 0.25 if role == 11 else 0.5
    if role in [4, 5] and np.linalg.norm(b - a) < 0.2:
      continue
    steps = max(1, math.ceil(np.linalg.norm(b - a) / (size * 0.56)))
    for t in np.linspace(0, 1, steps + 1):
      p = a + (b - a) * t + np.array([nx * 1.70, 0, nz * 1.70])
      p[1] = min(p[1], 69.875)
      put(p, color, size, role)
  # Coalesce only adjacent equal-color cells in the same vertical column.
  # The exterior is exactly the same union of cubes; no gap or hidden interior
  # is filled. All resulting faces remain on the native orthogonal lattice.
  columns = {}
  for (size, ix, iy, iz), row in cells.items():
    columns.setdefault((size, ix, iz, row[3], row[5]), []).append(iy)
  rows = []
  for (size, ix, iz, color, role), ys in sorted(columns.items()):
    ys.sort()
    start = end = ys[0]
    for y in [*ys[1:], None]:
      if y is not None and y == end + 1:
        end = y
        continue
      rows.append(
        [
          (ix + 0.5) * size,
          (start + end + 1) * size / 2,
          (iz + 0.5) * size,
          color,
          size,
          role,
          (end - start + 1) * size,
          size,
        ]
      )
      start = end = y
  return rows


def make_payloads() -> tuple[dict, dict, dict]:
  record = source_record()
  details = detail(record)
  blocks = native_blocks(details)
  evidence = {
    "schemaVersion": 1,
    "name": "Zionskirche",
    "parentId": PARENT,
    "partIds": [p["id"] for p in record["parts"]],
    "osmWayId": "27685450",
    "monumentId": "09011312",
    "groundY": record["groundY"],
    "groundNHN": record["groundNHN"],
    "verticalTransform": record["verticalTransform"],
    "sourceRecordSha256": hashlib.sha256(
      json.dumps(record, sort_keys=True).encode()
    ).hexdigest(),
    "sourceEnvelopeOwner": "Alt-Mitte v169 existing complete source shells",
    "sourceBoundaryPolygons": sum(len(p["surfaces"]) for p in record["parts"]),
    "sourceRoofBoundaryPolygons": sum(
      s["kind"] == "RoofSurface" for p in record["parts"] for s in p["surfaces"]
    ),
    "sourceTowerHeightM": 48.126,
    "publishedOverallHeightM": 67,
    "authoredHeightDifferenceM": 18.874,
    "sourceFootprintAreaM2": record["sourceFootprintAreaM2"],
    "sourceBounds": [2213.382, -1730.738, 2248.243, -1675.879],
    "sourceArchives": [
      {
        "url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5821.zip",
        "sha256": hashlib.sha256(
          (ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_391_5821.zip").read_bytes()
        ).hexdigest(),
        "license": "dl-de/zero-2-0",
      }
    ],
    "primarySources": [
      {
        "url": "https://www.elisabeth.berlin/de/kulturorte/zionskirche",
        "facts": "67 m tower; protected brick-terracotta church in Neo-Romanesque style.",
      },
      {
        "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011312",
        "facts": "Short Latin-cross plan; front tower; large semicircular apse; Lombard round-arch portal and dwarf galleries; open upper tower stages and octagonal crown.",
      },
      {
        "url": "https://www.denkmalschutz.de/denkmal/zionskirche.html",
        "facts": "Light-banded brick; galleries above round-arched tracery windows; square lower tower and octagonal belfry.",
      },
    ],
    "visualReferences": [
      {
        "url": "https://commons.wikimedia.org/wiki/File:Zionskirche,_Berlin-Mitte,_Kirchturm.jpg",
        "author": "Ansgar Koreng",
        "license": "CC BY 3.0 DE",
        "licenseUrl": "https://creativecommons.org/licenses/by/3.0/de/",
        "use": "Reference only: tall masonry octagonal spire, blind panels, ribs, roundels, upper belfry arcades and finial. No pixels bundled.",
      },
      {
        "url": "https://commons.wikimedia.org/wiki/File:Zionskirche_in_Berlin-Mitte.jpg",
        "author": "Roland Arhelger",
        "license": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
        "use": "Reference only: clocks, portal, pale masonry bands, columned paired belfry arches, dwarf gallery and lower front. No pixels bundled.",
      },
    ],
    "sourceConflicts": "LoD2 ends at 48.126 m. Retain its complete geometry; add only the missing upper crown to the published 67 m total using unsurveyed photographic proportions. Existing generic facade details remain behind thin new source-plane masonry backing. No source packet is changed.",
    "estimatedDetails": "Spire subdivision, cornice levels, window and gallery counts/proportions, fixed clock hands, decorative recesses, colors and finial branches are procedural visual interpretations, not survey measurements.",
    "roleNames": ROLES,
    "drawnCounts": {
      "surfaces": len(details["surfaces"]),
      "triangles": sum(len(s["triangles"]) for s in details["surfaces"]),
      "boxes": len(details["facadeBoxes"]),
      "rods": len(details["detailRods"]),
    },
    "nativeBlocks": len(blocks),
    "nativeRoleCounts": dict(Counter(r[5] for r in blocks)),
  }
  return details, {"blocks": blocks}, evidence


def main() -> None:
  drawn, native, evidence = make_payloads()
  for name, payload in [("Drawn", drawn), ("Native", native), ("Evidence", evidence)]:
    path = DEST / f"zionskircheV174{name}.json"
    path.write_text(json.dumps(payload, separators=(",", ":"), allow_nan=False) + "\n")
  print({**evidence["drawnCounts"], "nativeBlocks": evidence["nativeBlocks"]})


if __name__ == "__main__":
  main()
