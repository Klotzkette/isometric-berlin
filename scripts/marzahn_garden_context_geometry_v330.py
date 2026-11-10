"""Georeferenced trees and footbridges between the authored garden ensembles."""

from __future__ import annotations

import hashlib
import math

import shapely
from shapely.geometry import LineString, Point, box, shape

from scripts.build_surrounding_outlines import (
  line_parts,
  native_polygon,
  polygons_from_geometry,
)

BRIDGES = {
  "way/26692558": (4.0, 1.3, (141, 83, 57)),
  "way/440671075": (2.5, 1.25, (92, 100, 98)),
  "way/1042056188": (3.0, 1.15, (118, 94, 69)),
}


def quad(triangles, a, b, c, d, color):
  triangles.append(([a, b, c], color))
  triangles.append(([a, c, d], color))


def box_faces(triangles, x, z, a, b, radius, color):
  points = (
    (x - radius, z - radius),
    (x + radius, z - radius),
    (x + radius, z + radius),
    (x - radius, z + radius),
  )
  low = [(px, a, pz) for px, pz in points]
  high = [(px, b, pz) for px, pz in points]
  quad(triangles, *high, color)
  for i in range(4):
    j = (i + 1) % 4
    quad(triangles, low[i], low[j], high[j], high[i], color)


def measured(value):
  try:
    result = float(str(value).removesuffix(" m"))
    return result if 0 < result < 50 else None
  except ValueError:
    return None


def draw_trees(records, ground, native, exclusion):
  triangles, solids = [], []
  for identity, point, tags in records:
    x, z = point.x, point.y
    if native:
      x, z = round(2 * x) / 2, round(2 * z) / 2
    y = ground(x, z)
    if y is None or exclusion.covers(Point(x, z)):
      continue
    seed = hashlib.sha256(identity.encode()).digest()
    conifer = tags.get("leaf_type") == "needleleaved"
    height = measured(tags.get("height")) or (
      6.0 + seed[0] / 255 * (5.0 if conifer else 7.0)
    )
    radius = (
      measured(tags.get("diameter_crown")) or height * (0.38 if conifer else 0.64)
    ) / 2
    trunk = (98, 77, 58)
    leaf = (67 + seed[1] % 21, 113 + seed[2] % 32, 53 + seed[3] % 24)
    if native:
      height = round(height * 2) / 2
      radius = max(0.5, round(radius * 2) / 2)
      box_faces(triangles, x, z, y, y + height * 0.52, 0.25, trunk)
      box_faces(triangles, x, z, y + height * 0.43, y + height * 0.76, radius, leaf)
      box_faces(
        triangles, x, z, y + height * 0.76, y + height, max(0.5, radius - 0.5), leaf
      )
    else:
      box_faces(triangles, x, z, y, y + height * 0.53, 0.16, trunk)
      angles = [math.tau * k / 7 + seed[4] / 255 for k in range(7)]
      lower = [
        (
          x + 0.82 * radius * math.cos(a),
          y + height * 0.53,
          z + 0.82 * radius * math.sin(a),
        )
        for a in angles
      ]
      upper = [
        (
          x + radius * math.cos(a) * (0.55 if conifer else 1),
          y + height * 0.76,
          z + radius * math.sin(a) * (0.55 if conifer else 1),
        )
        for a in angles
      ]
      for k in range(7):
        j = (k + 1) % 7
        tint = tuple(max(0, c - k % 3 * 5) for c in leaf)
        quad(triangles, lower[k], lower[j], upper[j], upper[k], tint)
        triangles.append(([upper[k], upper[j], (x + 0.18, y + height, z - 0.13)], tint))
        triangles.append(([lower[j], lower[k], (x, y + height * 0.44, z)], tint))
    solids.append(
      (identity, box(x - 0.18, z - 0.18, x + 0.18, z + 0.18), y, height * 0.5)
    )
  return triangles, solids


def bridge_fittings(records, terrain_height, native):
  triangles, floors, barriers = [], [], []
  for record in records:
    identity = record["id"]
    if identity not in BRIDGES:
      continue
    width, rail_height, rail = BRIDGES[identity]
    for line in line_parts(shape(record["geometry"])):
      length = line.length
      if length < 2:
        continue
      a, b = line.coords[0], line.coords[-1]
      low, high = terrain_height(*a), terrain_height(*b)
      if low is None or high is None:
        raise ValueError(f"Missing measured approaches for {identity}")
      distances = sorted(
        {
          0.0,
          length,
          *[line.project(Point(x, z)) for x, z in line.coords],
          *[
            length * i / math.ceil(length / 2) for i in range(1, math.ceil(length / 2))
          ],
        }
      )
      for start, end in zip(distances, distances[1:]):
        if end - start < 0.02:
          continue
        p, q = line.interpolate(start), line.interpolate(end)
        nx, nz = (
          -(q.y - p.y) / (end - start) * width / 2,
          (q.x - p.x) / (end - start) * width / 2,
        )
        py = low + (high - low) * start / length + 0.10
        qy = low + (high - low) * end / length + 0.10
        left = (p.x + nx, py, p.y + nz)
        right = (p.x - nx, py, p.y - nz)
        far_left = (q.x + nx, qy, q.y + nz)
        far_right = (q.x - nx, qy, q.y - nz)
        floor = LineString([(p.x, p.y), (q.x, q.y)]).buffer(width / 2, cap_style="flat")
        level = round((py + qy) * 50) / 100
        if native:
          # A separate cardinal deck with small stepped level changes.
          floor = native_polygon(floor.buffer(0.20))
          if floor.is_empty:
            continue
          for poly in polygons_from_geometry(floor):
            for face in shapely.constrained_delaunay_triangles(poly).geoms:
              triangles.append(
                (
                  [(x, level, z) for x, z in list(face.exterior.coords)[:3]],
                  (156, 146, 132),
                )
              )
        else:
          quad(triangles, left, right, far_right, far_left, (156, 146, 132))
          for start_point, end_point in ((left, far_left), (right, far_right)):
            lx, ly, lz = start_point
            rx, ry, rz = end_point
            quad(
              triangles,
              start_point,
              end_point,
              (rx, ry + rail_height, rz),
              (lx, ly + rail_height, lz),
              rail,
            )
            barrier = LineString([(lx, lz), (rx, rz)]).buffer(0.055, cap_style="flat")
            barriers.append((barrier, min(py, qy), max(py, qy) + rail_height))
        floors.append((floor, level))
  return triangles, floors, barriers
