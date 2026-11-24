"""Raster the public Berlin survey onto a monument's existing 2 m cardinal footprint."""

import math
from collections import defaultdict
from functools import lru_cache

import build_surveyed_building_shells_v377 as shell
import numpy as np
from shapely import STRtree, union_all
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import nearest_points

from scripts.build_windowless_buildings_v377 import bodies, entity


@lru_cache(maxsize=4096)
def display_colour(colour, shade):
  unit = np.array(colour) / 255
  return tuple(
    np.rint(((unit + 0.055) / 1.055) ** 2.4 * 255 * shade).astype(int).tolist()
  )


def create_native(owner, surfaces, colours, domains, observed_walls, *, default_wall=(211, 208, 195)):
  roof, planes, roof_colour = [], [], []
  for kind, _, __, polygon, rings in surfaces:
    if kind != "RoofSurface":
      continue
    for triangle in shell.triangulate(rings):
      points = np.array(triangle)
      support = Polygon(points[:, [0, 2]])
      if support.area < 0.001:
        continue
      coefficients = np.linalg.solve(
        np.column_stack((points[:, 0], points[:, 2], np.ones(3))), points[:, 1]
      )
      roof.append(support)
      planes.append(coefficients)
      roof_colour.append(tuple(colours.get(polygon, (144, 149, 149))))
  roofs = STRtree(roof)
  wall_lines = [LineString([w["a"], w["b"]]) for w in observed_walls]
  wall_tree = STRtree(wall_lines)
  cells, origins = {}, {}
  for tile in domains:
    rows, origin = bodies(tile, "minecraft")
    origins[tile] = origin
    area = union_all([p for b, p, _, __ in rows if entity(b) == owner])
    x0, z0, x1, z1 = area.bounds
    for x in range(math.floor(x0 / 2) * 2, math.ceil(x1 / 2) * 2, 2):
      for z in range(math.floor(z0 / 2) * 2, math.ceil(z1 / 2) * 2, 2):
        point = Point(x + 1, z + 1)
        if not area.contains(point):
          continue
        if (x, z) in cells:
          raise ValueError(f"Overlapping native packets at {(x, z)}")
        indices = roofs.query(point, predicate="intersects")
        if not len(indices):
          nearest = roofs.nearest(point)
          point = nearest_points(roof[nearest], point)[0]
          indices = [nearest]
        heights = [(float(planes[i] @ [point.x, point.y, 1]), i) for i in indices]
        elevation, best = max(heights)
        cells[x, z] = (
          max(5, 3 + 2 * round((elevation - 3) / 2)),
          roof_colour[best],
          tile,
        )

  meshes = {t: {"vertices": {}, "sides": [], "roofs": []} for t in domains}
  segments = []
  strips = defaultdict(list)

  def quad(tile, layer, points, rgb):
    mesh = meshes[tile]
    origin = origins[tile]
    corners = []
    for p in points:
      xyz = tuple(round(100 * (p[i] - origin[i])) for i in range(3))
      if min(xyz) < 0 or max(xyz) > 65535:
        raise ValueError(f"Native landmark coordinate outside the packet at {tile}")
      key = (*xyz, *rgb)
      corners.append(mesh["vertices"].setdefault(key, len(mesh["vertices"])))
    mesh[layer].extend(corners[i] for i in (0, 1, 2, 0, 2, 3))

  for (x, z), (height, colour, tile) in cells.items():
    strips[tile, z, height, colour].append(x)
    for dx, dz, a, b in [
      (0, -2, (x, z), (x + 2, z)),
      (2, 0, (x + 2, z), (x + 2, z + 2)),
      (0, 2, (x + 2, z + 2), (x, z + 2)),
      (-2, 0, (x, z + 2), (x, z)),
    ]:
      neighbour = cells.get((x + dx, z + dz))
      low = neighbour[0] if neighbour else 3
      if low >= height:
        continue
      ax, az = a
      bx, bz = b
      nx, nz = dx // 2, dz // 2
      material = colour
      if not neighbour:
        candidates = wall_tree.query(Point((ax + bx) / 2, (az + bz) / 2).buffer(3))
        candidates = [
          int(i)
          for i in candidates
          if sum(v * w for v, w in zip(observed_walls[i]["normal"], (nx, nz))) > 0.4
        ]
        if candidates:
          nearby = min(
            candidates,
            key=lambda i: wall_lines[i].distance(Point((ax + bx) / 2, (az + bz) / 2)),
          )
          material = tuple(
            colours.get(observed_walls[nearby]["wallId"], default_wall)
          )
        else:
          material = default_wall
      rgb = display_colour(material, 0.90 if dx else 0.98)
      quad(
        tile,
        "sides",
        [(ax, low, az), (ax, height, az), (bx, height, bz), (bx, low, bz)],
        rgb,
      )
      segments.append(
        {
          "tile": tile,
          "family": "minecraft",
          "owner": owner,
          "a": a,
          "b": b,
          "normal": [nx, nz],
          "low": low,
          "high": height,
        }
      )
  for (tile, z, height, colour), xs in strips.items():
    xs.sort()
    start = previous = xs[0]
    for end in [*xs[1:], xs[-1] + 4]:
      if end != previous + 2:
        high = previous + 2
        quad(
          tile,
          "roofs",
          [
            (start, height, z),
            (start, height, z + 2),
            (high, height, z + 2),
            (high, height, z),
          ],
          display_colour(colour, 1),
        )
        start = end
      previous = end
  return {t: shell.finish(owner, m) for t, m in meshes.items()}, segments, len(cells)
