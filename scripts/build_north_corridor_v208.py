"""Step 10: bounded northern Linden street-facing architecture, source retained."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from shapely import constrained_delaunay_triangles
from shapely.geometry import Point, Polygon, box, mapping
from shapely.ops import unary_union

from scripts.build_breitscheid_towers_v161 import normal_of, triangles_for

ROOT = Path(__file__).resolve().parents[1]
PARENTS = [
  "DEBE01YYK00001vQ",
  "DEBE01YYK00009j0",
  "DEBE01YYK00002Es",
  "DEBE01YYK00004tt",
  "DEBE01YYK00002Lh",
]
NAMES = [
  "Hungarian Embassy",
  "ARD Hauptstadtstudio",
  "Dussmann KulturKaufhaus",
  "Helene-Weber-Haus",
  "Neustaedtische Kirchstrasse 15",
]
PALE, GREEN, GLASS, FRAME = 0xDBD4BB, 0x567E65, 0x70949C, 0xAAB6AB


def polys(g: object) -> list[Polygon]:
  """Preserve disconnected source plane pieces."""
  if isinstance(g, Polygon):
    return [g] if g.area > 0.00001 else []
  return [p for q in getattr(g, "geoms", []) for p in polys(q)]


def build(root: Path = ROOT) -> tuple[dict, dict]:
  """Generate shallow facade members and independently cleared native members."""
  source_path = (
    root / "geo_data/regierungsviertel/alt-mitte-v169/source-390_5819-00.json.gz"
  )
  records = json.loads(gzip.decompress(source_path.read_bytes()))["buildings"]
  by_id = {r["id"]: r for r in records}
  selected = [by_id[p] for p in PARENTS]
  shapes = [
    unary_union([Polygon(p["ring"], p["holes"]) for p in r["footprintPolygons"]])
    for r in selected
  ]
  owners = [
    dict(id=r["id"], name=name, anchor=list(p.centroid.coords)[0], groundY=r["groundY"])
    for r, p, name in zip(selected, shapes, NAMES, strict=True)
  ]
  boxes, surfaces, faces, native_seed = [], [], [], []
  # Complete official Hungarian envelope replaces only the six explicitly
  # identified coarse legacy prisms. No other source owner is substituted.
  for part in selected[0]["parts"]:
    for sheet in part["surfaces"]:
      if sheet["kind"] == "GroundSurface":
        continue
      surfaces.append(
        dict(
          owner=0,
          face=-1,
          sourcePolygonId=sheet["sourcePolygonId"],
          color=0x8B9688 if sheet["kind"] == "RoofSurface" else PALE,
          triangles=triangles_for(sheet["rings"]),
        )
      )

  def face(a: list, b: list, normal: list, oi: int, rings: list, sid: str) -> dict:
    a, b, n = np.array(a), np.array(b), np.array(normal)
    d = (b - a) / np.linalg.norm(b - a)
    planar = [
      [[float((np.array([x, z]) - a) @ d), y] for x, y, z in ring] for ring in rings
    ]
    g = Polygon(planar[0], planar[1:]).buffer(0)
    f = dict(
      owner=oi,
      a=a.tolist(),
      direction=d.tolist(),
      normal=n.tolist(),
      length=float(np.linalg.norm(b - a)),
      sourcePolygonId=sid,
      rings=rings,
      polygons=[mapping(p) for p in polys(g)],
    )
    faces.append(f)
    return f

  def emit(
    f: dict,
    u: float,
    y: float,
    w: float,
    h: float,
    color: int,
    role: int,
    out: float = 0.45,
    depth: float = 0.10,
    drawn: bool = True,
  ) -> None:
    fi = faces.index(f)
    a = np.array(f["a"])
    d = np.array(f["direction"])
    n = np.array(f["normal"])
    q = a + d * u + n * out
    r = [
      *[
        round(float(v), 5)
        for v in [q[0], y, q[1], w, h, depth, math.atan2(-d[1], d[0])]
      ],
      color,
      role,
      f["owner"],
      fi,
    ]
    if drawn:
      boxes.append(r)
    native_seed.append(r)

  # Hungarian official polygons are highly fragmented, including the real
  # roof profile. Clip each fitting to the union of coplanar source pieces.
  for oi, r in enumerate(selected):
    allowed = []
    if oi == 0:
      allowed = [(-1, 0), (0, 1)]
    elif oi == 3:
      allowed = [(0, 1)]
    elif oi == 4:
      allowed = [(1, 0)]
    if not allowed:
      continue
    groups = {}
    for p in r["parts"]:
      for s in p["surfaces"]:
        if s["kind"] != "WallSurface":
          continue
        pts = np.array(s["rings"][0])
        n = np.array(normal_of(pts.tolist()))[[0, 2]]
        if np.linalg.norm(n) < 0.98:
          continue
        aa, bb = max(
          ((a, b) for a in pts for b in pts),
          key=lambda t: np.linalg.norm((t[1] - t[0])[[0, 2]]),
        )
        a, b = aa[[0, 2]], bb[[0, 2]]
        if np.linalg.norm(b - a) < 0.3:
          continue
        if shapes[oi].contains(Point(*((a + b) / 2 + n * 0.1))):
          n = -n
        if not any(float(n @ np.array(v)) > 0.95 for v in allowed):
          continue
        middle = (a + b) / 2
        if shapes[oi].contains(Point(*(middle + n * 0.65))):
          continue
        # Party walls or inner return walls are outside the street supplement.
        if oi == 0 and not (middle[1] > 249 or (middle[0] < 633 and middle[1] > 220)):
          continue
        if oi == 3 and middle[1] < 63:
          continue
        if oi == 4 and middle[0] < 938:
          continue
        key = (
          (int(abs(n[1]) > abs(n[0])),)
          if oi == 0
          else (round(n[0], 2), round(n[1], 2), round(float(a @ n), 1))
        )
        groups.setdefault(key, []).append((p, s, n))
    for entries in groups.values():
      n = entries[0][2]
      d = np.array([n[1], -n[0]])
      pts = np.array([q for _, s, _ in entries for ring in s["rings"] for q in ring])
      xz = pts[:, [0, 2]]
      low, high = min(xz @ d), max(xz @ d)
      plane = float(xz[0] @ n)
      a = d * low + n * plane
      b = d * high + n * plane
      locals_ = []
      for _, s, _ in entries:
        pp = [
          [[float((np.array([x, z]) - a) @ d), y] for x, y, z in ring]
          for ring in s["rings"]
        ]
        locals_.append(Polygon(pp[0], pp[1:]).buffer(0))
      g = unary_union(locals_)
      length = high - low
      if length < 1:
        continue
      fi = len(faces)
      f = dict(
        owner=oi,
        a=a.tolist(),
        direction=d.tolist(),
        normal=n.tolist(),
        length=length,
        sourcePolygonIds=[s["sourcePolygonId"] for _, s, _ in entries],
        sourceRings=[s["rings"] for _, s, _ in entries],
        polygons=[mapping(p) for p in polys(g)],
      )
      faces.append(f)
      tint = PALE if oi == 0 else 0xD5C9B1 if oi == 3 else 0xDDD4C4
      triangles = []
      for p in polys(g):
        for t in constrained_delaunay_triangles(p).geoms:
          triangles.append(
            [
              [
                *[round(v, 5) for v in (a + d * u + n * 0.36)[:1]],
                round(y, 5),
                round((a + d * u + n * 0.36)[1], 5),
              ]
              for u, y in list(t.exterior.coords)[:3]
            ]
          )
      surfaces.append(dict(owner=oi, face=fi, color=tint, triangles=triangles))
      base = r["groundY"]
      top = max(pts[:, 1])
      # Fit openings by shared world facade coordinates, not per split polygon.
      pitch = 3.9 if oi == 0 else 3.4
      ys = (
        [base + 2.1, base + 6.2, base + 10.2, base + 14.2, base + 18.2]
        if oi == 0
        else [base + 2.3 + i * 4.2 for i in range(5)]
      )
      for u in np.arange(pitch * 0.5, length, pitch):
        for level, y in enumerate(ys):
          ww = 2.05 if oi == 0 else 1.65
          hh = 2.35 if level else 3.1
          if not g.buffer(-0.025).covers(
            box(
              u - ww / 2 - 0.15, y - hh / 2 - 0.2, u + ww / 2 + 0.15, y + hh / 2 + 0.2
            )
          ):
            continue
          emit(f, u, y, ww + 0.16, hh + 0.16, 0x495B58, 2, 0.46, 0.14)
          emit(f, u, y, ww, hh, GLASS, 1, 0.56, 0.10)
          emit(f, u, y, 0.075, hh, FRAME, 3, 0.65, 0.07)
          emit(f, u, y - hh / 2 - 0.12, ww + 0.26, 0.18, tint, 4, 0.62, 0.24)
          if oi == 0:
            for sign in [-1, 1]:
              emit(
                f, u + sign * (ww / 2 + 0.10), y, 0.10, hh + 0.18, GREEN, 5, 0.65, 0.1
              )
          else:
            emit(f, u, y + hh / 2 + 0.16, ww + 0.30, 0.19, 0xE4DCCB, 4, 0.63, 0.22)
      # Fine cladding joints do not cross any glass opening.
      for y in np.arange(base + 0.6, min(top, base + 22), 0.78):
        for p in polys(g.intersection(box(0, y - 0.012, length, y + 0.012))):
          lo, _, hi, _ = p.bounds
          # Only continuous sill/spandrel strips, not rows through the panes.
          if min(abs(y - c) for c in ys) < 1.45:
            continue
          emit(f, (lo + hi) / 2, y, hi - lo, 0.024, 0xB5B1A0, 6, 0.405, 0.03)
      # Keep horizontal cornices shallow and clipped to measured walls.
      for y in [base + 0.30, base + 7.65, base + 22.0]:
        for p in polys(g.intersection(box(0, y - 0.11, length, y + 0.11))):
          lo, _, hi, _ = p.bounds
          if hi - lo > 0.25:
            emit(
              f,
              (lo + hi) / 2,
              y,
              hi - lo,
              0.20,
              GREEN if oi == 0 else tint,
              4,
              0.58,
              0.28,
            )
      # Native backing is split into short pieces before resolving retained
      # voxel/shell clearance; it never becomes one large planar wall box.
      for p in polys(g):
        lo, y0, hi, y1 = p.bounds
        for u in np.arange(lo + 0.5, hi, 1):
          if g.covers(box(u - 0.49, y0 + 0.1, u + 0.49, y1 - 0.1)):
            emit(f, u, (y0 + y1) / 2, 0.98, y1 - y0 - 0.2, tint, 0, 0.36, 0.12, False)
      if oi == 0:
        # The photograph has a dense upper window band below the metal roof,
        # separate from the five broader lower rows.
        y = base + 23.5
        for u in np.arange(0.6, length, 1.18):
          if g.covers(box(u - 0.35, y - 1.25, u + 0.35, y + 1.25)):
            emit(f, u, y, 0.70, 2.50, 0x617A76, 1, 0.54, 0.10)
            emit(f, u - 0.43, y, 0.11, 2.66, PALE, 3, 0.68, 0.13)
        # Open glass entrance canopies: surface only, no enclosed podium.
        for u in np.arange(4, length - 2, 5.4):
          if g.covers(box(u - 1.9, base + 6.45, u + 1.9, base + 6.65)):
            emit(f, u, base + 6.55, 3.8, 0.10, 0x91AAA1, 9, 1.15, 1.35)
            emit(f, u, base + 6.65, 3.9, 0.08, 0x647B70, 3, 1.84, 0.10)
        # Both street wings meet at a narrow full-height glazed corner.
        corner_u = float((np.array([632.392, 252.444]) - a) @ d)
        for u in [corner_u - 1.0, corner_u + 1.0]:
          if not g.covers(
            box(u - 0.85, base + 0.4, u + 0.85, min(top, base + 22) - 0.3)
          ):
            continue
          emit(f, u, base + 10.9, 1.7, 21.0, GLASS, 7, 0.72, 0.12)
          for y in ys:
            emit(f, u, y - 1.4, 1.7, 0.09, FRAME, 3, 0.81, 0.08)

  # ARD: preserve all existing six-storey relief, add thin blue glass highlights
  # and construction joints at the SAME measured legacy bay axes.
  ard = by_id[PARENTS[1]]
  p = next(p for p in ard["legacyPrisms"] if p["id"] == "G5qBz21a")
  ring = np.array(p["ring"]) / 10
  area = sum(
    ring[(i + 1) % len(ring), 0] * ring[i, 1]
    - ring[(i + 1) % len(ring), 1] * ring[i, 0]
    for i in range(len(ring))
  )
  for index in [0, 1, 2, 3, 4, 14, 15]:
    a, b = ring[index], ring[(index + 1) % len(ring)]
    d = (b - a) / np.linalg.norm(b - a)
    n = np.array([d[1], -d[0]]) * (-1 if area > 0 else 1)
    if shapes[1].contains(Point(*((a + b) / 2 + n * 0.1))):
      n = -n
    length = float(np.linalg.norm(b - a))
    base = p["y0_dm"] / 10
    rr = [
      [
        [a[0], base, a[1]],
        [b[0], base, b[1]],
        [b[0], base + 23.1, b[1]],
        [a[0], base + 23.1, a[1]],
      ]
    ]
    f = face(a.tolist(), b.tolist(), n.tolist(), 1, rr, "legacy-G5qBz21a-" + str(index))
    modules = max(1, round(length / 2.75))
    pitch = length / modules
    if index < 5:
      for floor in range(6):
        y = base + 3.6 * (floor + 0.5)
        hh = 2.72 if floor == 0 else 2.28
        for j in range(modules):
          u = (j + 0.5) * pitch - 0.31 * 0.12
          ww = min(1.74, max(0.72, pitch - 0.78))
          emit(
            f,
            u,
            y,
            ww - 0.06,
            hh - 0.08,
            0x739FAA if (j + floor) % 3 else 0x648D9C,
            1,
            0.26,
            0.045,
          )
          emit(f, u - ww * 0.27, y, 0.055, hh - 0.17, 0xB0C5C1, 3, 0.30, 0.035)
          emit(f, u + ww * 0.32, y - 0.30, 0.045, hh - 0.75, 0x536C6B, 3, 0.30, 0.035)
        emit(
          f,
          length / 2,
          base + 3.6 * (floor + 1) - 0.30,
          length - 0.10,
          0.036,
          0x744D44,
          6,
          0.21,
          0.03,
        )
    # Block-native supplements use the actual source streetfront, not smooth
    # copied primitives, with a source-clearance projection below.
    for u in np.arange(0.75, length, 1.5):
      emit(f, u, base + 11.5, 1.48, 22.8, 0xA45F50, 0, 0.20, 0.12, False)
    if index >= 14:
      for j in range(max(1, round(length / 3.1))):
        for floor in range(6):
          u = (j + 0.5) * length / max(1, round(length / 3.1))
          emit(
            f, u, base + 1.8 + 3.6 * floor, 1.6, 2.25, 0x739FAA, 1, 0.26, 0.08, False
          )

  # Dussmann's older 'eastFacade' faced the Hotel Splendid party wall.
  # The retained OSM street lies WEST of the source envelope: use its actual
  # measured western street course, preserve the source and former fine layer.
  a = np.array([1166.545, 54.59])
  b = np.array([1170.911, 111.551])
  d = (b - a) / np.linalg.norm(b - a)
  n = np.array([-d[1], d[0]])
  length = float(np.linalg.norm(b - a))
  base = 5.2
  f = face(
    a.tolist(),
    b.tolist(),
    n.tolist(),
    2,
    [
      [
        [a[0], base, a[1]],
        [b[0], base, b[1]],
        [b[0], base + 22.3, b[1]],
        [a[0], base + 22.3, a[1]],
      ]
    ],
    "measured-Dussmann-west-Friedrichstrasse-course",
  )
  pitch = length / 10
  emit(f, length / 2, base + 11.15, length, 22.3, 0xD8D0BE, 10, 0.36, 0.10)
  emit(f, length / 2, base + 3.65, length, 7.3, 0x3E514F, 10, 0.47, 0.10)
  for j in range(10):
    u = (j + 0.5) * pitch
    for floor in range(4):
      y = base + 9 + floor * 3.6
      red = (floor == 0 and j > 4) or (floor == 1 and j < 4)
      emit(f, u, y, pitch * 0.77, 2.78, 0xA63834 if red else 0x718C91, 1, 0.56, 0.10)
      for t in [-0.27, 0, 0.27]:
        emit(f, u + t * pitch, y, 0.075, 2.8, 0xC6C9BD, 3, 0.68, 0.07)
      emit(f, u, y - 1.64, pitch, 0.40, 0xE3DDCB, 4, 0.66, 0.22)
    emit(f, u, base + 2.5, pitch * 0.76, 4.6, 0x698786, 1, 0.62, 0.10)
    for t in [-0.25, 0, 0.25]:
      emit(f, u + t * pitch, base + 2.5, 0.085, 4.7, 0xBBC5BD, 3, 0.76, 0.10)
    emit(f, u, base + 4.75, pitch * 0.76, 0.12, 0xBEC3B6, 3, 0.76, 0.10)
  for j in range(11):
    u = j * pitch
    emit(f, u, base + 3.65, 0.72, 7.3, 0xE4DECE, 4, 0.94, 0.85)
    emit(f, u, base + 14.8, 0.40, 14.8, 0xD9D3C3, 4, 0.73, 0.30)
  emit(f, length / 2, base + 7.3, length, 0.52, 0xE3DDCE, 4, 0.98, 0.80)
  # A compact procedural vertical wordmark, no photographic or font texture.
  glyphs = {
    "D": ["110", "101", "101", "101", "110"],
    "U": ["101", "101", "101", "101", "111"],
    "S": ["111", "100", "111", "001", "111"],
    "M": ["10001", "11011", "10101", "10001", "10001"],
    "A": ["010", "101", "111", "101", "101"],
    "N": ["1001", "1101", "1011", "1001", "1001"],
  }
  u = length * 0.67
  emit(f, u, base + 15, 1.45, 14.0, 0xE5DBC3, 10, 1.18, 0.27)
  for li, letter in enumerate("DUSSMANN"):
    glyph = glyphs[letter]
    pixel = 0.17
    gw = len(glyph[0]) * pixel
    for row, line in enumerate(glyph):
      for col, on in enumerate(line):
        if on == "1":
          emit(
            f,
            u - gw / 2 + (col + 0.5) * pixel,
            base + 20.8 - li * 1.55 - row * pixel,
            pixel * 0.88,
            pixel * 0.88,
            0xA12E31,
            11,
            1.38,
            0.08,
          )

  # Hungarian pole and tricolour replace the gated old identity assembly.
  boxes.extend(
    [
      [646.5, 33.3, 250, 0.16, 6.2, 0.16, 0, 0x59615D, 8, 0, -1],
      [647.3, 34.4, 250, 1.65, 0.43, 0.08, 0, 0xB23E40, 8, 0, -1],
      [647.3, 33.97, 250, 1.65, 0.43, 0.08, 0, 0xEEEBDD, 8, 0, -1],
      [647.3, 33.54, 250, 1.65, 0.43, 0.08, 0, GREEN, 8, 0, -1],
    ]
  )

  # Independent all-source exterior clearance, including 4 m raster columns
  # and v169 1 m navigation spans of the 2 m native shell.
  voxel_path = root / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
  voxel = json.loads(voxel_path.read_text())
  cell = voxel["cell_m"]
  grid = voxel["grid"]
  occupied = {}
  owned = [set() for _ in shapes]
  receipts = []

  def absorb(ix: int, iz: int, high: float) -> None:
    occupied[ix, iz] = max(occupied.get((ix, iz), -100), high)

  region = unary_union([p.buffer(7) for p in shapes])
  for iz, row in enumerate(voxel["building_rows"]):
    z = (grid["min_z_idx"] + iz + 0.5) * cell
    if not -10 < z < 270:
      continue
    for start, count, lo, hi, _ in row:
      for ix in range(start, start + count):
        x = (grid["min_x_idx"] + ix + 0.5) * cell
        if not region.intersects(box(x - 2, z - 2, x + 2, z + 2)):
          continue
        for xx in range(round(x - 2), round(x + 2)):
          for zz in range(round(z - 2), round(z + 2)):
            absorb(xx, zz, hi / 10)
            for oi, p in enumerate(shapes):
              if p.intersects(box(x - 2, z - 2, x + 2, z + 2)):
                owned[oi].add((xx, zz))
  for packet in [6, 7]:
    path = root / f"src/app/src/data/altMitteV169Navigation/packet-{packet:03}.json"
    for index, span in enumerate(json.loads(path.read_text())):
      x0, z0, x1, z1, high = span
      if not region.intersects(box(x0, z0, x1, z1)):
        continue
      receipts.append(dict(packet=packet, index=index, span=span))
      for xx in range(x0, x1):
        for zz in range(z0, z1):
          absorb(xx, zz, high)
          for oi, p in enumerate(shapes):
            if p.buffer(1.45).intersects(box(xx, zz, xx + 1, zz + 1)):
              owned[oi].add((xx, zz))
  # Backing first, all detailed features later; Z depth is separated as well.
  seeds = sorted(native_seed, key=lambda r: 0 if r[8] in [0, 10] else 1)
  blocks = []
  max_shift = 0
  for r in seeds:
    x, y, z, w, h, depth, yaw, tint, role, oi, fi = r
    f = faces[fi]
    n = np.array(f["normal"])
    axis = int(abs(n[1]) > abs(n[0]))
    sign = 1 if n[axis] > 0 else -1
    tangent = 1 - axis
    d = np.array(f["direction"])
    centre = np.array([x, z])
    steps = max(1, math.ceil(w / 1.8))
    span = w / steps
    for k in range(steps):
      q = centre + d * ((k + 0.5) * span - w / 2)
      # Exact projected rectangle tangent extent, with small native joint gap.
      tangent_width = max(0.07, abs(d[tangent]) * span - 0.025)
      low = q[tangent] - tangent_width / 2
      high = q[tangent] + tangent_width / 2
      boundary = q[axis]
      for t in range(math.floor(low), math.ceil(high)):
        for cross in range(math.floor(q[axis] - 6), math.ceil(q[axis] + 6)):
          key = (cross, t) if axis == 0 else (t, cross)
          top = occupied.get(key, -100)
          if key not in owned[oi]:
            continue
          if top < y - h / 2:
            continue
          edge = cross + (1 if sign > 0 else 0)
          if (edge - q[axis]) * sign > 0:
            boundary = max(boundary, edge) if sign > 0 else min(boundary, edge)
      shift = (boundary - q[axis]) * sign
      if shift > 6.1:
        continue
      max_shift = max(max_shift, shift)
      out = 0.16 if role in [0, 10] else 0.36 if role in [1, 2] else 0.48
      q[axis] = boundary + sign * (out + depth / 2)
      size = [tangent_width, h, tangent_width]
      size[axis * 2] = depth
      # Do not add a fitting hidden by a retained adjacent source building.
      # No earlier geometry is removed by this clipping of new attachments.
      if any(
        occupied.get((xx, zz), -100) > y - h / 2
        for xx in range(math.floor(q[0] - size[0] / 2), math.ceil(q[0] + size[0] / 2))
        for zz in range(math.floor(q[1] - size[2] / 2), math.ceil(q[1] + size[2] / 2))
      ):
        continue
      # The native layer never fills ground, courts or building interiors.
      blocks.append(
        [
          round(q[0], 5),
          round(y, 5),
          round(q[1], 5),
          round(size[0], 5),
          round(h, 5),
          round(size[2], 5),
          tint,
          role,
          oi,
          fi,
        ]
      )
  for r in boxes[-4:]:
    blocks.append([*r[:6], r[7], r[8], r[9], -1])
  payload = dict(
    schemaVersion=1,
    owners=owners,
    surfaces=surfaces,
    boxes=boxes,
    blocks=blocks,
    nightBoxes=[
      r for i, r in enumerate(boxes) if r[8] == 1 and (r[9] == 1 or i % 11 == 0)
    ],
    nightBlocks=[
      r for i, r in enumerate(blocks) if r[7] == 1 and (r[8] == 1 or i % 11 == 0)
    ],
  )
  evidence = dict(
    schemaVersion=1,
    sourceRecords=selected,
    faces=faces,
    nativeSpans=receipts,
    nativeMaximumShiftM=max_shift,
    nativeOccupied=[[x, z, top] for (x, z), top in sorted(occupied.items())],
    retainedInputs={
      str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
      for p in [source_path, voxel_path]
    },
    estimates="Facade colours, pane subdivisions, joints, flag dimensions and member thickness are explicit source-guided display estimates; measured shells and all source sheets remain unchanged.",
    counts=dict(
      drawnBoxes=len(boxes),
      nativeBlocks=len(blocks),
      paintTriangles=sum(len(s["triangles"]) for s in surfaces),
    ),
  )
  return payload, evidence


if __name__ == "__main__":
  payload, evidence = build()
  for name, data in [
    ("northCorridorV208", payload),
    ("northCorridorV208Evidence", evidence),
  ]:
    path = ROOT / f"src/app/src/data/{name}.json"
    path.write_text(json.dumps(data, separators=(",", ":")) + "\n")
  print(json.dumps(evidence["counts"]))
