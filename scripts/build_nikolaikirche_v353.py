"""A finite, photograph-informed successor for the two Nikolaikirche source parts.

The old generalized LoD2 remains immutable. Only its exact church recipe is
superseded. Outline/elevation anchors are source data; facade/profile proportions
are explicit photographic display estimates, not an architectural survey.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import subprocess
from collections import Counter
from pathlib import Path

import numpy as np
from alt_mitte_v169_packets import append_ink, empty_packet, pack_detail
from build_alt_mitte_v169 import APPEARANCE, model, triangulate
from build_karl_marx_allee_v161 import Detail, native_detail
from build_nikolaiviertel_v239 import (
  CHURCH,
  SOURCE,
  architectural_details,
  footprint,
  read,
)
from build_scheunenviertel_v168 import merge_native_faces
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
KIND = "nikolaikirche-v353"
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
BOUNDS = [2048, 0, 2560, 512]
BRICK = (141, 79, 61)
STONE = (111, 113, 103)
MORTAR = (151, 147, 130)
TERRA = (173, 127, 97)
COPPER = (108, 150, 137)
GLASS = (48, 66, 69)
CREAM = (210, 204, 181)
TRACERY = (112, 80, 61)
GOLD = (188, 155, 81)
CENTERS = [(2410.587, 281.107), (2410.700, 291.266)]
BASE = 3.0
EAVE = 41.11
TOP = 87.4


def write(path, value):
  raw = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def church_source():
  source = read(SOURCE)
  church = next(b for b in source["buildings"] if b["id"] == CHURCH)
  return source, church


def color_delta(color, amount):
  return tuple(max(0, min(255, n + amount)) for n in color)


class Facade:
  """Source plane in Drawn; independently cardinal plane and pixels in Native."""

  columns = {}

  def __init__(self, detail, a, b, normal, native):
    self.detail, self.native = detail, native
    self.a, self.n = np.array(a, float), np.array(normal, float)
    d = np.array(b, float) - self.a
    self.length = float(np.linalg.norm(d))
    self.d = d / self.length
    self.source_a, self.source_d = self.a.copy(), self.d.copy()
    if native:
      axis = int(abs(self.n[1]) > abs(self.n[0]))
      self.n = np.array([0.0, 0.0])
      self.n[axis] = math.copysign(1, normal[axis])
      self.d = np.array([0.0, 0.0])
      self.d[1 - axis] = math.copysign(1, d[1 - axis])
      self.a[axis] = (
        math.ceil(self.a[axis]) if self.n[axis] > 0 else math.floor(self.a[axis])
      )

  def point(self, u, y, offset=0.06):
    p = self.a + self.d * u + self.n * offset
    return [float(p[0]), float(y), float(p[1])]

  def polygon(self, points, color, role, offset=0.06):
    self.detail.polygon([self.point(u, y, offset) for u, y in points], color, role)

  def rect(self, u, low, w, h, color, role, offset=0.08):
    if self.native:
      # Bind each cardinal strip to an actually exposed column of this church.
      # One rounded plane would float where the measured wall crosses a cell.
      axis = int(abs(self.n[1]) > 0.5)
      tangent = 1 - axis
      ends = sorted(
        self.source_a[tangent] + self.d[tangent] * v for v in [u - w / 2, u + w / 2]
      )
      breaks = [
        ends[0],
        *[
          float(v)
          for v in range(math.floor(ends[0]) + 1, math.ceil(ends[1]))
          if ends[0] < v < ends[1]
        ],
        ends[1],
      ]
      for lo, hi in zip(breaks, breaks[1:]):
        at = (lo + hi) / 2
        cell_t = math.floor(at)
        source_u = (at - self.source_a[tangent]) / self.source_d[tangent]
        source_axis = float((self.source_a + self.source_d * source_u)[axis])
        candidates = []
        direction = 1 if self.n[axis] > 0 else -1
        for c in range(math.floor(source_axis) - 2, math.ceil(source_axis) + 2):
          key = (c, cell_t) if axis == 0 else (cell_t, c)
          neighbour = (c + direction, cell_t) if axis == 0 else (cell_t, c + direction)
          body = self.columns.get(key)
          if not body or body[1] < low + h - 0.001:
            continue
          if self.columns.get(neighbour, (BASE, BASE))[1] > low + 0.001:
            continue
          boundary = c + (1 if direction > 0 else 0)
          if abs(boundary - source_axis) <= 2.1:
            candidates.append((abs(boundary - source_axis), boundary))
        if not candidates:
          continue
        boundary = min(candidates)[1] + direction * offset

        def pt(t, y):
          return [boundary, y, t] if axis == 0 else [t, y, boundary]

        self.detail.polygon(
          [pt(lo, low), pt(hi, low), pt(hi, low + h), pt(lo, low + h)], color, role
        )
      return
    self.polygon(
      [(u - w / 2, low), (u + w / 2, low), (u + w / 2, low + h), (u - w / 2, low + h)],
      color,
      role,
      offset,
    )

  def arch(self, u, low, width, height, color, role, offset=0.1):
    # Two tangent circular arcs form a pointed arch. Native uses its own
    # cardinal row intervals; it never snaps a Drawn vertex or triangle.
    r = width / 2
    spring = low + height - 0.8660254 * width

    def half(y):
      return (
        r
        if y <= spring
        else max(0, math.sqrt(max(0, width * width - (y - spring) ** 2)) - r)
      )

    if self.native:
      step = 0.25
      for y in np.arange(low, low + height - 0.001, step):
        w = math.floor(half(min(y + step / 2, low + height)) * 2 / step) * step
        if w > 0:
          self.rect(u, y, w, min(step, low + height - y), color, role, offset)
    else:
      points = [(u - r, low), (u + r, low), (u + r, spring)]
      points += [(u + half(y), y) for y in np.linspace(spring, low + height, 9)[1:]]
      points += [(u - half(y), y) for y in np.linspace(low + height, spring, 9)[1:]]
      self.polygon(points, color, role, offset)

  def circle(self, u, y, radius, color, role, offset=0.12):
    if self.native:
      step = 0.2
      for dy in np.arange(-radius, radius, step):
        half = math.sqrt(max(0, radius**2 - (dy + step / 2) ** 2))
        self.rect(
          u,
          y + dy,
          max(step, math.floor(half * 2 / step) * step),
          step,
          color,
          role,
          offset,
        )
    else:
      self.polygon(
        [
          (u + radius * math.cos(t), y + radius * math.sin(t))
          for t in np.linspace(0, 2 * math.pi, 32, endpoint=False)
        ],
        color,
        role,
        offset,
      )


def wall_planes(poly, detail, native):
  for a, b in zip(poly.exterior.coords, list(poly.exterior.coords)[1:]):
    d = np.subtract(b, a)
    length = float(np.linalg.norm(d))
    if length < 0.04:
      continue
    n = np.array([-d[1], d[0]]) / length
    if poly.covers(Point((np.array(a) + b) / 2 + n * 0.1)):
      n = -n
    yield Facade(detail, a, b, n, native)


def pointed_window(f, u, low, width, height, role, pale=False):
  f.arch(u, low - 0.16, width + 0.35, height + 0.34, TRACERY, role + " reveal", 0.08)
  f.arch(u, low, width, height, CREAM if pale else GLASS, role, 0.11)
  for d in [0] if pale else [-width / 6, width / 6]:
    f.rect(u + d, low, 0.10, height - width * 0.75, TRACERY, role + " mullion", 0.14)
  f.rect(u, low + height * 0.47, width * 0.94, 0.11, TRACERY, role + " transom", 0.15)


def clock(f, u, y):
  f.circle(u, y, 0.93, TRACERY, "clock rim", 0.16)
  f.circle(u, y, 0.78, CREAM, "clock dial", 0.18)
  for i in range(12):
    angle = i * math.pi / 6
    f.rect(
      u + math.sin(angle) * 0.62,
      y + math.cos(angle) * 0.62 - 0.07,
      0.09,
      0.14,
      GLASS,
      "clock index",
      0.20,
    )
  f.rect(u, y - 0.06, 0.10, 0.57, GLASS, "clock hand", 0.22)
  f.rect(u + 0.19, y - 0.05, 0.42, 0.10, GLASS, "clock hand", 0.22)


def tower_facades(detail, tower, native):
  # The source west plane is split at an almost-collinear 2 cm seam. Use its
  # measured full-width rectangle for the two photographed facade groups.
  for f in wall_planes(tower.minimum_rotated_rectangle, detail, native):
    if f.length < 3:
      continue
    # Fieldstone relief and joints: deliberately irregular, deterministic
    # material interpretation, no claim to reproduce individual stones.
    if not native:
      for row, y in enumerate(np.arange(BASE, 20.3, 0.57)):
        for col, u in enumerate(np.arange(-0.6 if row % 2 else 0, f.length, 1.0)):
          lo, hi = max(0, u + 0.035), min(f.length, u + 0.96)
          if hi > lo:
            value = ((row * 13 + col * 29) % 17) - 8
            f.rect(
              (lo + hi) / 2,
              y + 0.025,
              hi - lo,
              0.51,
              color_delta(STONE, value),
              "fieldstone blocks",
              0.025,
            )
    for y in [12.7, 20.3]:
      f.rect(
        f.length / 2,
        y,
        f.length,
        0.23,
        color_delta(STONE, 13),
        "stone string course",
        0.13,
      )
    for y in [40.20, 40.60, 40.94]:
      f.rect(
        f.length / 2,
        y,
        f.length + 0.10,
        0.14,
        color_delta(BRICK, -12),
        "brick cornice",
        0.18,
      )
    # A side face carries one belfry triplet; west/east carry two triplets.
    number = 2 if abs(f.n[0]) > 0.8 and f.length > 15 else 1
    centers = [f.length * (i + 0.5) / number for i in range(number)]
    for u in centers:
      if f.length < 7:
        continue
      pointed_window(f, u, 15.7, 1.5, 3.8, "stone lancet")
      pointed_window(f, u, 20.8, 1.8, 4.1, "lower belfry lancet")
      pointed_window(f, u, 26.4, 2.5, 12.7, "grouped belfry glazing")
      clock(f, u, 37.9)
      for du in [-3.05, 3.05]:
        if not 0.8 < u + du < f.length - 0.8:
          continue
        pointed_window(f, u + du, 26.4, 1.55, 12.7, "pale blind tracery", True)
        f.circle(u + du, 32.9, 0.37, TRACERY, "blind quatrefoil rim", 0.16)
        f.circle(u + du, 32.9, 0.24, CREAM, "blind quatrefoil", 0.18)
        f.circle(u + du, 23.0, 0.38, TRACERY, "lower roundel", 0.16)
    if f.n[0] < -0.8 and f.length > 15:
      for u in centers:
        f.circle(u, 8.0, 1.1, MORTAR, "west oculus rim", 0.14)
        f.circle(u, 8.0, 0.84, GLASS, "west oculus", 0.17)
      pointed_window(f, f.length / 2, BASE, 2.4, 3.9, "mapped west portal")


def hall_parts(church):
  full = footprint(church["parts"][1])
  chapel = full.intersection(box(2408, 295.9, 2426.0, 310))
  sacristy = full.intersection(box(2452.7, 260, 2463.0, 272.0))
  main = full.difference(unary_union([chapel, sacristy]))
  groups = [
    (main, 20.3, "hall"),
    (chapel, 13.6, "chapel"),
    (sacristy, 13.3, "sacristy"),
  ]
  return full, [
    (p, e, r)
    for g, e, r in groups
    for p in (g.geoms if hasattr(g, "geoms") else [g])
    if p.area > 1e-8
  ]


def roof_triangles(poly, eave, role):
  # The inherited two-plane diagonal hall gable crossed the whole apse and
  # both low annexes. The primary views establish a lengthwise nave ridge,
  # polygonal choir end and separate lower chapel/sacristy roofs.
  if role == "hall":

    def ridge(p):
      x = min(2462.4, max(2415.1, p[0]))
      return [x, 35.97, 285.9 - (x - 2415.1) * 0.027]
  else:
    x0, z0, x1, z1 = poly.bounds
    high = 21.2 if role == "chapel" else 18.4

    def ridge(p):
      return [(x0 + x1) / 2, high, max(z0, min(z1, p[1]))]

  triangles = []
  for a, b in zip(poly.exterior.coords, list(poly.exterior.coords)[1:]):
    points = [[a[0], eave, a[1]], [b[0], eave, b[1]], ridge(b), ridge(a)]
    for i in [1, 2]:
      tri = [points[0], points[i], points[i + 1]]
      if (
        np.linalg.norm(
          np.cross(np.subtract(tri[1], tri[0]), np.subtract(tri[2], tri[0]))
        )
        > 1e-7
      ):
        triangles.append(tri)
  clipped = []
  for tri in triangles:
    projected = Polygon([(p[0], p[2]) for p in tri])
    if projected.area < 1e-9:
      continue
    intersection = projected.intersection(poly)
    plane = np.linalg.solve(
      np.array([[p[0], p[2], 1] for p in tri]), np.array([p[1] for p in tri])
    )
    for piece in (
      intersection.geoms if hasattr(intersection, "geoms") else [intersection]
    ):
      if piece.geom_type != "Polygon" or piece.area < 1e-9:
        continue
      rings = [
        [[x, float(plane.dot([x, z, 1])), z] for x, z in list(r.coords)[:-1]]
        for r in [piece.exterior, *piece.interiors]
      ]
      clipped.extend(triangulate(rings))
  return clipped


def drawn_body(church):
  detail = Detail()
  tower = footprint(church["parts"][0])
  roofs = []
  for f in wall_planes(tower, detail, False):
    f.rect(f.length / 2, BASE, f.length, 20.3 - BASE, MORTAR, "fieldstone westwork", 0)
    f.rect(f.length / 2, 20.3, f.length, EAVE - 20.3, BRICK, "brick belfry", 0)
  for tri in triangulate([[[x, EAVE, z] for x, z in list(tower.exterior.coords)[:-1]]]):
    detail.polygon(tri, BRICK, "tower cornice cap")
    roofs.append(tri)
  tower_facades(detail, tower, False)
  _, parts = hall_parts(church)
  for poly, eave, role in parts:
    for f in wall_planes(poly, detail, False):
      f.rect(f.length / 2, BASE, f.length, eave - BASE, BRICK, "brick " + role, 0)
      f.rect(
        f.length / 2,
        eave - 0.22,
        f.length,
        0.22,
        color_delta(BRICK, -12),
        "hall eave",
        0.10,
      )
      if f.length > 2.8 and (role != "hall" or abs(f.n[0]) < 0.7 or f.a[0] > 2462):
        count = max(1, round(f.length / 6.4))
        for i in range(count):
          width = min(2.6, f.length / count - 0.8)
          if width > 1:
            pointed_window(
              f,
              f.length * (i + 0.5) / count,
              5.4 if role == "hall" else 4.4,
              width,
              11.0 if role == "hall" else 6.8,
              "Gothic " + role + " bay",
            )
    triangles = roof_triangles(poly, eave, role)
    roofs.extend(triangles)
    for i, tri in enumerate(triangles):
      detail.polygon(tri, color_delta(TERRA, (i % 3 - 1) * 3), role + " tile roof")
  # The Liebfrauenkapelle's stepped south gable is visible in the primary
  # west/south view, on the actual source annex. Five paired blind bays.
  f = Facade(detail, [2411.4, 306.05], [2424.1, 305.8], [0.02, 1], False)
  for i in range(9):
    h = 2.0 + (4 - abs(i - 4)) * 1.45
    u = (i + 0.5) * f.length / 9
    f.rect(u, 13.4, f.length / 9, h, BRICK, "chapel stepped gable", 0.12)
    if i % 2 == 0:
      pointed_window(f, u, 13.75, 0.75, max(1.3, h - 0.5), "chapel blind arch", True)
  return detail, roofs


def spire_radius(y):
  profile = [(EAVE, 5.0), (EAVE + 1.3, 4.2), (EAVE + 5.8, 3.05), (TOP - 1.5, 0.08)]
  for (a, r), (b, s) in zip(profile, profile[1:]):
    if y <= b:
      return r + (s - r) * (y - a) / (b - a)
  return 0.06


def drawn_spires():
  detail = Detail()
  for x, z in CENTERS:
    levels = [EAVE, EAVE + 1.3, EAVE + 5.8, TOP - 1.5]
    for lo, hi in zip(levels, levels[1:]):
      for i in range(8):
        a, b = math.pi / 8 + i * math.pi / 4, math.pi / 8 + (i + 1) * math.pi / 4
        detail.polygon(
          [
            [x + spire_radius(y) * math.cos(t), y, z + spire_radius(y) * math.sin(t)]
            for y, t in [(lo, a), (lo, b), (hi, b), (hi, a)]
          ],
          color_delta(COPPER, (i % 3 - 1) * 6),
          "individual copper helmet",
        )
    # Subtle standing seams are bounded by the analytic copper profile.
    for i in range(16):
      angle = math.pi / 8 + i * math.pi / 8
      for lo, hi in zip(levels, levels[1:]):
        detail.polygon(
          [
            [
              x + (spire_radius(y) + 0.025) * math.cos(t),
              y,
              z + (spire_radius(y) + 0.025) * math.sin(t),
            ]
            for y, t in [
              (lo, angle - 0.003),
              (lo, angle + 0.003),
              (hi, angle + 0.003),
              (hi, angle - 0.003),
            ]
          ],
          color_delta(COPPER, -25),
          "copper standing seam",
        )
    detail.lathe(
      x,
      z,
      [
        (TOP - 1.55, 0.06),
        (TOP - 1.30, 0.28),
        (TOP - 1.05, 0.30),
        (TOP - 0.8, 0.05),
        (TOP, 0.035),
      ],
      GOLD,
      "gold terminal",
      8,
    )
    detail.polygon(
      [
        [x + 0.035 * math.cos(t), TOP, z + 0.035 * math.sin(t)]
        for t in np.linspace(0, 2 * math.pi, 8, endpoint=False)
      ],
      GOLD,
      "gold terminal cap",
    )
  return detail


def native_columns(columns, colors, role):
  """Independently constructed cardinal columns, exposed faces only."""
  detail = Detail()
  for (x, z), (low, top) in sorted(columns.items()):
    detail.polygon(
      [[x, top, z], [x + 1, top, z], [x + 1, top, z + 1], [x, top, z + 1]],
      colors(x, top, z, True),
      role + " top",
    )
    for dx, dz in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
      other = columns.get((x + dx, z + dz), (low, low))[1]
      bottom = max(low, other)
      if bottom >= top:
        continue
      # One-metre material bands merge later without changing cells.
      for y in range(bottom, top):
        if dx:
          xx = x + (1 if dx > 0 else 0)
          q = [[xx, y, z], [xx, y, z + 1], [xx, y + 1, z + 1], [xx, y + 1, z]]
        else:
          zz = z + (1 if dz > 0 else 0)
          q = [[x, y, zz], [x + 1, y, zz], [x + 1, y + 1, zz], [x, y + 1, zz]]
        detail.polygon(q, colors(x, y, z, False), role + " cardinal wall")
  return detail


def native_body(church):
  tower = footprint(church["parts"][0])
  _, parts = hall_parts(church)
  columns = {}
  kinds = {}
  for poly, eave, role in [(tower, EAVE, "tower"), *parts]:
    x0, z0, x1, z1 = poly.bounds
    for x in range(math.floor(x0), math.ceil(x1)):
      for z in range(math.floor(z0), math.ceil(z1)):
        if (
          not poly.intersects(box(x, z, x + 1, z + 1))
          or poly.intersection(box(x, z, x + 1, z + 1)).area < 0.15
        ):
          continue
        if role == "tower":
          high = 41
        elif role == "hall":
          centre = 285.9 - (min(x + 0.5, 2462.4) - 2415.1) * 0.027
          distance = math.hypot(max(0, x + 0.5 - 2462.4), z + 0.5 - centre)
          high = math.floor(max(eave, 35.97 - distance * 1.075))
        else:
          peak = 21.2 if role == "chapel" else 18.4
          high = math.floor(
            max(
              eave,
              peak - abs(x + 0.5 - (x0 + x1) / 2) * (peak - eave) / ((x1 - x0) / 2),
            )
          )
        if high > columns.get((x, z), (3, 0))[1]:
          columns[x, z] = (3, high)
          kinds[x, z] = role

  def colors(x, y, z, top):
    if kinds[x, z] == "tower":
      return (
        BRICK if y >= 20 else color_delta(STONE, ((x * 13 + z * 7 + y * 3) % 9) - 4)
      )
    return TERRA if top or y >= 20 else BRICK

  detail = merge_native_faces(native_columns(columns, colors, "independent church"))
  Facade.columns = columns
  tower_facades(detail, tower, True)
  for poly, eave, role in parts:
    for f in wall_planes(poly, detail, True):
      if f.length > 2.8 and (role != "hall" or abs(f.n[0]) < 0.7 or f.a[0] > 2462):
        count = max(1, round(f.length / 6.4))
        for i in range(count):
          width = min(2.6, f.length / count - 0.8)
          if width > 1:
            pointed_window(
              f,
              f.length * (i + 0.5) / count,
              5.4 if role == "hall" else 4.4,
              width,
              11 if role == "hall" else 6.8,
              "independent Gothic " + role + " bay",
            )
  Facade.columns = {}
  return detail, columns


def native_spires():
  columns = {}
  for cx, cz in CENTERS:
    for x in range(math.floor(cx - 5), math.ceil(cx + 5)):
      for z in range(math.floor(cz - 5), math.ceil(cz + 5)):
        dx, dz = abs(x + 0.5 - cx), abs(z + 0.5 - cz)
        radius = max(dx, dz, (dx + dz) / math.sqrt(2))
        heights = [y for y in range(41, 87) if radius <= spire_radius(y)]
        if heights:
          columns[x, z] = (41, max(heights) + 1)
    # The source centre always intersects its own cell, even when that cell's
    # centre is outside the final narrow needle. Keep the connected tip.
    columns[math.floor(cx), math.floor(cz)] = (41, 86)
  detail = merge_native_faces(
    native_columns(
      columns,
      lambda x, y, z, t: color_delta(COPPER, ((x + z) % 3 - 1) * 4),
      "independent copper helmets",
    )
  )
  for x, z in CENTERS:
    detail.box(
      [math.floor(x) + 0.5, 86.6, math.floor(z) + 0.5],
      [0.4, 1.6, 0.4],
      GOLD,
      "independent gold terminal",
    )
  return detail, columns


def old_details(source, church, native):
  occupied = unary_union([footprint(b) for b in source["buildings"]])
  shells, fronts, _, _ = model(church, occupied)
  detail = Detail()
  detail.triangles = shells.triangles + fronts.triangles
  if native:
    detail = merge_native_faces(native_detail(detail))
  own = {**source, "buildings": [church]}
  fittings, _ = architectural_details(own, native)
  return detail, fittings


def mesh_xyz(mesh, origin):
  p = (
    np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
    .reshape(-1, 3)
    .astype(float)
    / 100
    + origin
  )
  ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return p[ix]


def geometry_key(tri):
  return tuple(
    sorted(tuple(int(v) for v in row) for row in np.rint(np.asarray(tri) * 100))
  )


def select_exact(packet, expected, kind):
  # Quantize through the original compiler in the original local origin. A
  # world-coordinate round at .005 differs at IEEE tie boundaries.
  encoded = pack_detail(expected, BOUNDS)
  counts = Counter(
    geometry_key(t) for m in encoded for t in mesh_xyz(m, packet["origin"])
  )
  expected_count = sum(counts.values())
  retire = []
  for mi, m in enumerate(packet["meshes"]):
    if m["kind"] != kind:
      continue
    selected = []
    for ti, tri in enumerate(mesh_xyz(m, packet["origin"])):
      key = geometry_key(tri)
      if counts[key]:
        selected.append(ti)
        counts[key] -= 1
    if selected:
      retire.append({"mesh": mi, "triangles": selected})
  missing = sum(counts.values())
  assert missing == 0, (kind, expected_count, missing)
  return retire


def build_models(output):
  source, church = church_source()
  assert not any(p["id"] in APPEARANCE for p in church["parts"])
  body, roofs = drawn_body(church)
  spires = drawn_spires()
  ink_detail = Detail()
  ink_detail.triangles = [t for t in body.triangles if t[2] == "hall eave"]
  body.triangles = [t for t in body.triangles if t[2] != "hall eave"]
  mesh = pack_detail(ink_detail, BOUNDS)[0]
  mesh["kind"] = KIND
  write(output / "drawn-ink-mesh.json.gz", mesh)
  native, columns = native_body(church)
  # Merge only exactly coplanar, same-colour Native coverage after the supported
  # facade strips are constructed; no sampling, omission or grid coarsening.
  native = merge_native_faces(native)
  native_spire, spire_columns = native_spires()
  for mode, a, b in [("drawn", body, spires), ("minecraft", native, native_spire)]:
    old, oldfit = old_details(source, church, mode == "minecraft")
    for label, detail in [
      ("body", a),
      ("spires", b),
      ("old-body", old),
      ("old-fittings", oldfit),
    ]:
      write(output / f"{mode}-{label}.json.gz", detail.triangles)
    for label, detail in [("body", a), ("spires", b)]:
      meshes = pack_detail(detail, BOUNDS)
      assert len(meshes) == 1
      meshes[0]["kind"] = KIND
      write(output / f"{mode}-{label}-mesh.json.gz", meshes[0])
    print(
      mode,
      len(a.triangles),
      len(b.triangles),
      "old",
      len(old.triangles),
      len(oldfit.triangles),
      flush=True,
    )
  write(output / "church-source.json.gz", church)
  write(
    output / "drawn-roofs.json.gz",
    roofs + [t for t, _, r in spires.triangles if r != "copper standing seam"],
  )
  for point, value in spire_columns.items():
    if point in columns:
      columns[point] = (BASE, max(value[1], columns[point][1]))
  write(
    output / "native-columns.json.gz", [[x, z, *v] for (x, z), v in columns.items()]
  )


def finish_plans(output):
  source, church = church_source()
  packets = {}
  reports = []
  all_roofs = read(output / "drawn-roofs.json.gz")
  columns = read(output / "native-columns.json.gz")
  for mode in ["drawn", "minecraft"]:
    hosts = [
      ("4_0", "old-body", "alt-mitte-v169"),
      ("nikolai239-4_0", "old-fittings", "nikolaiviertel-v239"),
    ]
    if mode == "drawn":
      hosts.append(("4_0-alt-mitte-v169-1", "ink", ""))
    for host, label, kind in hosts:
      capture = read(output / f"{mode}-{host}.json.gz")
      raw, prepared, plan = capture["raw"], capture["prepared"], capture["plan"]
      old = Detail()
      if label != "ink":
        old.triangles = read(output / f"{mode}-{label}.json.gz")
      retire = select_exact(prepared, old, kind) if label != "ink" else []
      retire_lines = []
      retire_nav = []
      append_nav = []
      if host == "4_0":
        retire_nav = [
          b for b in prepared["nav"]["buildings"] if b.get("sourceId") == CHURCH
        ]
        assert len(retire_nav) == 2
        if mode == "drawn":
          for part, oldnav in zip(church["parts"], retire_nav, strict=True):
            # Bind by footprint instead of relying on array order.
            p = footprint(part)
            oldnav = next(b for b in retire_nav if b.get("partId") == part["id"])
            roofs = [
              t
              for t in all_roofs
              if p.intersection(Polygon([(v[0], v[2]) for v in t])).area > 1e-6
            ]
            append_nav.append(
              {
                **oldnav,
                "sourceId": KIND + ":" + part["id"],
                "height": TOP - BASE if part == church["parts"][0] else 35.97 - BASE,
                "heightSource": "retained LoD2 outline; photo-estimated corrected roof profile",
                "roofTriangles": [
                  [
                    [round(x - 2048, 2), round(y - BASE, 2), round(z, 2)]
                    for x, y, z in t
                  ]
                  for t in roofs
                ],
              }
            )
        else:
          union = unary_union([box(x, z, x + 1, z + 1) for x, z, _, _ in columns])
          assert union.geom_type == "Polygon"
          append_nav = [
            dict(
              ring=[[x - 2048, z] for x, z in list(union.exterior.coords)[:-1]],
              holes=[
                [[x - 2048, z] for x, z in list(r.coords)[:-1]] for r in union.interiors
              ],
              sourceId=KIND + ":independent-cardinal",
              height=TOP - BASE,
              minHeight=0,
              heightSource="independent one-metre source-footprint roof columns",
              nativeRoofCaps=[
                [x - 2048, z, x + 1 - 2048, z + 1, high - BASE]
                for x, z, _, high in columns
              ]
              + [
                [
                  math.floor(x) + 0.3 - 2048,
                  math.floor(z) + 0.3,
                  math.floor(x) + 0.7 - 2048,
                  math.floor(z) + 0.7,
                  TOP - BASE,
                ]
                for x, z in CENTERS
              ],
            )
          ]
      if label == "ink":
        if raw.get("lines"):
          edges = [
            (a, b)
            for p in church["parts"]
            for s in p["surfaces"]
            if s["kind"] in ["WallSurface", "RoofSurface", "ClosureSurface"]
            for r in s["rings"]
            for a, b in zip(r, r[1:] + r[:1])
          ]
          own = [empty_packet(host, BOUNDS)]
          append_ink(own, edges, host, BOUNDS)
          expected = {
            tuple(sorted(tuple(v) for v in row))
            for row in np.frombuffer(
              base64.b64decode(own[-1]["lines"]["positions"]), "<u2"
            ).reshape(-1, 2, 3)
          }
          actual = np.frombuffer(
            base64.b64decode(prepared["lines"]["positions"]), "<u2"
          ).reshape(-1, 2, 3)
          found = set()
          for i, row in enumerate(actual):
            key = tuple(sorted(tuple(v) for v in row))
            if key in expected:
              retire_lines.append(i)
              found.add(key)
          assert expected == found, (
            mode,
            "missing exact source ink",
            len(expected - found),
          )
          # Corrected measured-plan eaves and a longitudinal nave ridge. Real
          # thin eave-capping geometry is admitted in this same old ink host.
          new_edges = []
          _, parts = hall_parts(church)
          for p, eave, _ in parts:
            new_edges += [
              ([a[0], eave, a[1]], [b[0], eave, b[1]])
              for a, b in zip(p.exterior.coords, list(p.exterior.coords)[1:])
            ]
          new_edges.append(([2415.1, 35.97, 285.9], [2462.4, 35.97, 284.6229]))
          added = [empty_packet(host, BOUNDS)]
          append_ink(added, new_edges, host, BOUNDS)
          plan["appendLines"] = added[-1]["lines"]
      plan.update(
        retire=retire,
        retireLines=retire_lines,
        retireNav=retire_nav,
        appendNav=append_nav,
        owners=[CHURCH],
      )
      key = f"{mode}:{host}"
      packets[key] = plan
      reports.append(
        dict(
          key=key,
          retiredTriangles=sum(len(r["triangles"]) for r in retire),
          retiredLines=len(retire_lines),
          retiredNavigation=len(retire_nav),
          appendedNavigation=len(append_nav),
          appendedTriangles=len(base64.b64decode(plan["append"]["indices"])) // 12,
          declinedPredecessors=capture["declined"],
        )
      )
  value = dict(schemaVersion=1, keys=list(packets), packets=packets)
  runtime = DATA / "nikolaikircheV353Packets.json.gz"
  write(runtime, value)
  write(
    DATA / "nikolaikircheV353Index.json",
    dict(
      decodedBytes=len(gzip.decompress(runtime.read_bytes())),
      compressedBytes=runtime.stat().st_size,
      sha256=hashlib.sha256(runtime.read_bytes()).hexdigest(),
    ),
  )
  write(
    GEO / "nikolaikirche-v353-source.json.gz",
    dict(
      schemaVersion=1,
      originalChurch=church,
      originalSourceSha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
      references=[
        "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011267",
        "https://www.rao-berlin.de/projekt/denkmalrestauration-der-nikolaikirche-berlin/",
        "https://www.berlin.museum/museum/nikolaikirche",
      ],
      estimates="Source footprint and ground unchanged. Brick/fieldstone boundary, grouped Gothic openings, clocks, separate hall/chapel/sacristy roofs and flared copper profile interpreted from primary exterior photos. No individual-stone or measured-facade claim; no interior.",
      reports=reports,
    ),
  )
  print(json.dumps(reports))


def main():
  p = argparse.ArgumentParser()
  p.add_argument("output", type=Path)
  p.add_argument("--plans", action="store_true")
  p.add_argument(
    "--capture",
    action="store_true",
    help="Capture current predecessors and write the five final plans",
  )
  args = p.parse_args()
  args.output.mkdir(parents=True, exist_ok=True)
  if args.capture:
    rows = [
      dict(
        id=host,
        mode=mode,
        path=str(
          ROOT / f"src/app/public/mesh/surrounding-berlin-v159/{host}.{mode}.json.gz"
        ),
      )
      for mode, hosts in [
        ("drawn", ["4_0", "nikolai239-4_0", "4_0-alt-mitte-v169-1"]),
        ("minecraft", ["4_0", "nikolai239-4_0"]),
      ]
      for host in hosts
    ]
    subprocess.run(
      ["bun", "scripts/capture-nikolaikirche-v353.ts", str(args.output.resolve())],
      cwd=ROOT / "src/app",
      input=json.dumps(rows),
      text=True,
      check=True,
    )
    finish_plans(args.output)
  elif args.plans:
    finish_plans(args.output)
  else:
    build_models(args.output)


if __name__ == "__main__":
  main()
