"""Join each surveyed plaza to the original core slabs and the surrounding district."""

import math
from collections import defaultdict

import numpy as np
import shapely as s
from build_prenzlauer_streets_v380 import parts
from shapely.affinity import scale
from shapely.geometry import Polygon, box


def winterfeld_road_extension(survey, smooth_roads):
  # A short tip of the old smooth asphalt reaches beyond the raster coverage
  # at the surveyed Winterfeldtstraße junction. Both outlines are in the archive.
  footprint = next(
    s.from_wkb(w)
    for key, _, w in survey["layers"]["cm_fahrbahn"]
    if key == "cm_fahrbahn.41925"
  )
  clip = scale(footprint, 10, 10, origin=(0, 0))
  xmin, ymin, xmax, ymax = clip.bounds
  intersections = []
  for road in smooth_roads:
    if road["kind"] != "asphalt":
      continue
    ring = np.asarray(road["ring"])
    if (
      ring[:, 0].max() < xmin
      or ring[:, 0].min() > xmax
      or ring[:, 1].max() < ymin
      or ring[:, 1].min() > ymax
    ):
      continue
    legacy = s.make_valid(Polygon(ring, road["holes"]))
    intersections.append(legacy.intersection(clip))
  # The drawn cartographic kerb line lies on the polygon limit. Keep a small
  # margin so its display width and the centimetre quantization clear the join.
  return scale(s.union_all(intersections), 0.1, 0.1, origin=(0, 0)).buffer(0.4)


class PlazaGround:
  """Piecewise linear rise only where the core actually owns emitted slab runs.

  Both city styles share these source runs. The district beyond their boundary
  has its own lower ground. A 20 m transition on that side covers the old seam
  without introducing new steps or lifting the rest of Winterfeldtplatz.
  """

  def __init__(self, scope, core, district_y, road_extension=None):
    self.cell = core["cell_m"]
    self.x0 = core["grid"]["min_x_idx"] * self.cell
    self.z0 = core["grid"]["min_z_idx"] * self.cell
    self.base = district_y
    height = core["ground_height"]
    stride = height["stride_cells"]
    levels = np.asarray(height["y_dm"]).reshape(height["rows"], height["cols"])
    xmin, zmin, xmax, zmax = scope.buffer(32).bounds
    left, top = self.grid(xmin, zmin)
    right, bottom = self.grid(xmax, zmax)
    # The original ground renderer samples the middle of each emitted row run.
    by_level = defaultdict(list)
    for j in range(top, bottom + 1):
      z = self.z0 + j * self.cell
      for start, count, kind in core["ground_rows"][j]:
        if start > right or start + count <= left:
          continue
        if core["classes"][kind] not in {
          "grass",
          "asphalt",
          "plazaBrick",
          "concrete",
          "glass",
        }:
          continue
        x = self.x0 + max(left, start) * self.cell
        end = self.x0 + min(right + 1, start + count) * self.cell
        y = levels[j // stride, int((start + count / 2) // stride)] / 10
        # Allow clearance for the retained roads and their surface finishes.
        by_level[y + 0.14].append(box(x, z, end, z + self.cell))
    if road_extension is not None:
      x, z, X, Z = road_extension.bounds
      i0, j0 = self.grid(x, z)
      i1, j1 = self.grid(X, Z)
      for j in range(j0, j1 + 1):
        for i in range(i0, i1 + 1):
          a, b = self.x0 + i * self.cell, self.z0 + j * self.cell
          cell = box(a, b, a + self.cell, b + self.cell)
          if cell.intersects(road_extension):
            road_y = levels[j // stride, i // stride] / 10
            by_level[road_y + 0.14].append(cell)
    covered = [(y, s.union_all(rows)) for y, rows in by_level.items()]
    points = [(i, j) for i in range(left, right + 2) for j in range(top, bottom + 2)]
    xz = np.array(
      [(self.x0 + i * self.cell, self.z0 + j * self.cell) for i, j in points]
    )
    nodes = np.full(len(points), district_y, dtype=np.float64)
    for y, footprint in covered:
      influence = np.maximum(0, 1 - s.distance(s.points(xz), footprint) / 20)
      nodes = np.maximum(nodes, district_y + (y - district_y) * influence)
    self.nodes = dict(zip(points, nodes))
    flat = defaultdict(list)
    regions = []
    for i in range(left, right + 1):
      for j in range(top, bottom + 1):
        x, z = self.x0 + i * self.cell, self.z0 + j * self.cell
        X, Z = x + self.cell, z + self.cell
        heights = [
          self.nodes[i + dx, j + dz] for dx, dz in ((0, 0), (1, 0), (1, 1), (0, 1))
        ]
        if max(heights) - min(heights) < 1e-8:
          flat[heights[0]].append(box(x, z, X, Z))
        else:
          regions += [
            Polygon([(x, z), (X, z), (X, Z)]),
            Polygon([(x, z), (X, Z), (x, Z)]),
          ]
    # Leave unchanged regions as single domains; subdivide only the narrow join.
    self.regions = regions + [
      region
      for group in flat.values()
      for region in parts(s.union_all(group), "Polygon")
    ]
    self.index = s.STRtree(self.regions)

  def grid(self, x, z):
    return math.floor((x - self.x0) / self.cell), math.floor((z - self.z0) / self.cell)

  def at(self, x, z):
    px, pz = (x - self.x0) / self.cell, (z - self.z0) / self.cell
    i, j = math.floor(px), math.floor(pz)
    u, v = px - i, pz - j
    a, c = self.nodes[i, j], self.nodes[i + 1, j + 1]
    if u >= v:
      return a * (1 - u) + self.nodes[i + 1, j] * (u - v) + c * v
    return a * (1 - v) + self.nodes[i, j + 1] * (v - u) + c * u

  def cut(self, shape, kind):
    candidates = self.index.query(shape, predicate="intersects")
    if len(candidates) == 1:
      yield shape
      return
    for i in candidates:
      yield from parts(shape.intersection(self.regions[i]), kind)
