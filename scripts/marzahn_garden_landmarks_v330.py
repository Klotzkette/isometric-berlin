"""Finite source-bound garden structures, garden surfaces and walking solids."""

from __future__ import annotations

import math
from collections import defaultdict
from collections.abc import Callable
from typing import Any

import numpy as np
import shapely
from shapely.affinity import rotate
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

from scripts.marzahn_garden_terrain_v330 import GRID_STEP

RGB = tuple[int, int, int]
XZ = tuple[float, float]
XYZ = tuple[float, float, float]
Triangle = tuple[list[XYZ], RGB]
Solid = tuple[str, Any, float, float]
SAND = (200, 176, 140)
PALE = (223, 204, 163)
LIME = (215, 200, 172)
STONE = (130, 131, 122)
WATER = (83, 133, 135)
SLATE = (66, 75, 74)
WOOD = (94, 73, 56)
DARK_WOOD = (57, 57, 49)
COPPER = (69, 118, 108)
HEDGE = (71, 111, 64)
HEDGE_TOP = (94, 134, 75)
PINK = (179, 112, 93)
BLUE = (60, 89, 118)


def polygons(geometry):
  if geometry.geom_type == "Polygon":
    return [geometry] if not geometry.is_empty else []
  return [p for g in getattr(geometry, "geoms", ()) for p in polygons(g)]


def area_union(geometries):
  return unary_union([p for g in geometries for p in polygons(g)])


def cell_indices(lo, hi, step):
  """Integer grid indices keep neighbouring decimal cell edges identical."""
  return np.arange(math.floor(lo / step + 1e-8), math.ceil(hi / step - 1e-8))


def fitted_boxes(geometry, step, cover):
  """Independent cardinal XZ sampling. Each row is merged before tessellation."""
  rows = []
  for p in polygons(geometry):
    if p.area <= 0:
      continue
    x0, z0, x1, z1 = p.bounds
    ix = cell_indices(x0, x1, step)
    shapely.prepare(p)
    for iz in cell_indices(z0, z1, step):
      z, next_z = iz * step, (iz + 1) * step
      cells = shapely.box(ix * step, z, (ix + 1) * step, next_z)
      mask = (
        shapely.covers(p, cells)
        if cover
        else shapely.covers(p, shapely.centroid(cells))
      )
      edges = np.diff(np.r_[False, mask, False].astype(np.int8))
      start, end = np.flatnonzero(edges == 1), np.flatnonzero(edges == -1)
      rows.extend(
        box(float(ix[i] * step), float(z), float((ix[j - 1] + 1) * step), float(next_z))
        for i, j in zip(start, end, strict=True)
      )
  return area_union(rows).simplify(0)


def rectangle(center, w, d, angle=0):
  x, z = center
  return rotate(
    box(x - w / 2, z - d / 2, x + w / 2, z + d / 2),
    angle,
    origin=center,
    use_radians=True,
  )


def centroid(p):
  return tuple(p.centroid.coords[0])


def shade(rgb, factor):
  return tuple(round(v * factor) for v in rgb)


class Garden:
  def __init__(self, source, ground_at, native):
    self.source = source
    self.park = shape(source["park"])
    self.ground_at = ground_at
    self.native = native
    self.triangles: list[Triangle] = []
    self.solids: list[Solid] = []
    self.tag = ""

  def g(self, x, z):
    y = float(self.ground_at(x, z))
    if not math.isfinite(y):
      raise ValueError("Garden landmark has no measured terrain datum")
    return y

  def raw(self, identity):
    return shape(self.source["osm"][f"way/{identity}"]["geometry"])

  def triangles_on(self, geometry, altitude, color):
    y = altitude if callable(altitude) else lambda _x, _z: altitude
    for p in polygons(geometry):
      for triangle in shapely.constrained_delaunay_triangles(p).geoms:
        if triangle.area < 0.00002:
          continue
        ring = list(orient(triangle, sign=-1).exterior.coords)[:3]
        self.triangles.append(([(x, y(x, z), z) for x, z in ring], color))

  def floor(self, geometry, color, delta=0.065, grid=0.5, strict=True):
    clean = geometry.intersection(self.park)
    if clean.is_empty:
      return
    if not self.native:
      # Match the measured ground mesh at interior grid posts and at its
      # NW–SE split. Long paving faces otherwise cut across local terrain.
      x0, z0, x1, z1 = clean.bounds
      step = GRID_STEP

      def level(x, z):
        return self.g(x, z) + delta

      for ix in cell_indices(x0, x1, step):
        x = float(ix * step)
        for iz in cell_indices(z0, z1, step):
          z = float(iz * step)
          nw, se = (x, z), (x + step, z + step)
          for corner in ((x + step, z), (x, z + step)):
            half = Polygon((nw, se, corner))
            self.triangles_on(clean.intersection(half), level, color)
      return
    source = fitted_boxes(clean, grid, strict)
    if source.is_empty:
      return
    # Fine cardinal details may straddle a measured platform edge. Split at
    # that edge before sampling its elevation and merging same-level surfaces.
    levels = defaultdict(list)
    for p in polygons(source):
      x0, z0, x1, z1 = p.bounds
      step = GRID_STEP
      for ix in cell_indices(x0, x1, step):
        x = float(ix * step)
        for iz in cell_indices(z0, z1, step):
          z = float(iz * step)
          piece = p.intersection(box(x, z, x + step, z + step))
          if not piece.is_empty:
            y = round(self.g(x + step / 2, z + step / 2) + delta, 2)
            levels[y].append(piece)
    for y, pieces in levels.items():
      self.triangles_on(area_union(pieces).simplify(0), y, color)

  def solid(
    self, geometry, lo, hi, color, identity=None, grid=0.25, strict=True, cap_color=None
  ):
    domain = geometry.intersection(self.park)
    if self.native:
      domain = fitted_boxes(domain, grid, strict)
    for p in polygons(domain):
      if p.area < 0.002 or hi - lo < 0.01:
        continue
      self.uncut_solid(p, lo, hi, color, cap_color)
      if identity is not None:
        self.solids.append(
          (f"{self.tag}:{identity}:{len(self.solids)}", p, lo, hi - lo)
        )

  def uncut_solid(self, p, lo, hi, color, cap_color=None):
    self.triangles_on(p, hi, cap_color or shade(color, 1.09))
    for ring in (orient(p, sign=1).exterior, *orient(p, sign=1).interiors):
      pts = list(ring.coords)
      for (ax, az), (bx, bz) in zip(pts, pts[1:]):
        a, b, c, d = (ax, lo, az), (bx, lo, bz), (bx, hi, bz), (ax, hi, az)
        self.triangles.extend((([a, c, b], color), ([a, d, c], color)))

  def wall_on(self, route, width, height, color, identity, cap=None, grid=0.25):
    """Segmented measured support keeps stepped walls and walk obstacles aligned."""
    coords = list(route.coords)
    for a, b in zip(coords, coords[1:]):
      length = math.dist(a, b)
      if length < 0.05:
        continue
      steps = max(1, math.ceil(length / 4))
      for n in range(steps):
        start = tuple(a[i] + (b[i] - a[i]) * n / steps for i in (0, 1))
        end = tuple(a[i] + (b[i] - a[i]) * (n + 1) / steps for i in (0, 1))
        corridor = LineString((start, end)).buffer(width / 2, cap_style="flat")
        base = min(self.g(*start), self.g(*end), self.g(*centroid(corridor)))
        self.solid(
          corridor,
          base - 0.04,
          base + height,
          color,
          identity,
          grid=grid,
          cap_color=cap,
        )

  def roof(self, footprint, eave, rise, color, identity, inset=None):
    domain = footprint.intersection(self.park)
    if domain.is_empty:
      return
    reach = min(math.sqrt(domain.area) * 0.38, inset if inset is not None else 2.4)
    if self.native:
      lower = eave - 0.18
      for fraction, top in ((0, 0.30), (0.30, 0.59), (0.59, 0.82), (0.82, 1.0)):
        region = domain.buffer(-reach * fraction, join_style="mitre")
        upper = eave + rise * top
        self.solid(
          region,
          lower,
          upper,
          color,
          identity,
          grid=0.25,
          strict=True,
          cap_color=shade(color, 1.07),
        )
        lower = upper
      return
    steps = (0, 0.33, 0.70, 1)
    for low, high in zip(steps, steps[1:]):
      outer = domain.buffer(-reach * low, join_style="mitre")
      inner = domain.buffer(-reach * high, join_style="mitre")
      if outer.is_empty:
        continue
      shell = outer.difference(inner)
      self.triangles_on(
        shell,
        lambda x, z: (
          eave + rise * min(1, Point(x, z).distance(domain.boundary) / reach)
        ),
        color,
      )
    top = domain.buffer(-reach, join_style="mitre")
    self.triangles_on(top, eave + rise, shade(color, 1.04))
    for p in polygons(domain):
      self.solids.append(
        (f"{self.tag}:{identity}:{len(self.solids)}", p, eave - 0.18, rise + 0.18)
      )

  def pavilion(
    self,
    footprint,
    identity,
    eaves=2.75,
    rise=1.12,
    color=SLATE,
    post_color=WOOD,
    deck=0.20,
  ):
    for p in polygons(footprint):
      base = self.g(*centroid(p))
      self.solid(
        p.buffer(-0.10),
        base - 0.03,
        base + deck,
        STONE,
        None,
        grid=0.25,
        cap_color=shade(STONE, 1.21),
      )
      support = p.buffer(-0.39, join_style="mitre")
      if not support.is_empty:
        for piece in polygons(support):
          vertices = list(piece.simplify(0.28).exterior.coords)[:-1]
          centers = vertices[:]
          for a, b in zip(vertices, vertices[1:] + vertices[:1]):
            if math.dist(a, b) > 4.2:
              centers.append(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2))
          for point in centers:
            self.solid(
              rectangle(point, 0.40, 0.40),
              base + deck - 0.015,
              base + eaves,
              post_color,
              identity + "-post",
              grid=0.20,
              strict=False,
            )
          eave_beam = piece.boundary.buffer(0.13)
          self.solid(
            eave_beam,
            base + eaves - 0.29,
            base + eaves - 0.04,
            post_color,
            None,
            grid=0.20,
            strict=False,
          )
      self.roof(p, base + eaves, rise, color, identity + "-roof")

  def sphere(self, point, radius, vertical, altitude, color, n=8):
    x, z = point
    if self.native:
      for ratio, lo, hi in (
        (0.86, -0.43, 0.20),
        (0.57, 0.20, 0.58),
        (0.28, 0.58, 0.84),
      ):
        pad = rectangle(point, radius * ratio * 2, radius * ratio * 2)
        self.solid(
          pad,
          altitude + vertical * lo,
          altitude + vertical * hi,
          color,
          None,
          grid=0.20,
          strict=False,
        )
      return
    rings = []
    for r, y in ((0.78, -0.35), (1, 0.06), (0.70, 0.47), (0.10, 0.82)):
      rings.append(
        [
          (
            x + radius * r * math.cos(math.tau * i / n),
            altitude + vertical * y,
            z + radius * r * math.sin(math.tau * i / n),
          )
          for i in range(n)
        ]
      )
    for level, (a, b) in enumerate(zip(rings, rings[1:])):
      for i in range(n):
        j = (i + 1) % n
        c = shade(color, (0.96, 1, 1.05)[level] * (0.97 + (i % 3) * 0.028))
        self.triangles.extend((([a[i], b[i], b[j]], c), ([a[i], b[j], a[j]], c)))
    self.triangles_on(
      Polygon([(x, z) for x, _, z in rings[-1]]), rings[-1][0][1], shade(color, 1.06)
    )

  def gateway(self, footprint, identity, eave=2.62, color=SLATE):
    """Open passage through a gate. Its footprint does not become a solid box."""
    for p in polygons(footprint):
      ring = list(p.minimum_rotated_rectangle.exterior.coords)[:4]
      pairs = list(zip(ring, ring[1:] + ring[:1]))
      a, b = max(pairs, key=lambda pair: math.dist(*pair))
      dx, dz = b[0] - a[0], b[1] - a[1]
      length = math.hypot(dx, dz)
      ux, uz = dx / length, dz / length
      center = centroid(p)
      base = self.g(*center)
      for sign in (-1, 1):
        x, z = (
          center[0] + sign * ux * length * 0.29,
          center[1] + sign * uz * length * 0.29,
        )
        self.solid(
          rectangle((x, z), 0.48, 0.48),
          base - 0.03,
          base + eave,
          WOOD,
          identity + "-post",
          grid=0.20,
          strict=False,
        )
      self.solid(
        p.buffer(-0.20),
        base + eave - 0.38,
        base + eave - 0.13,
        DARK_WOOD,
        None,
        grid=0.25,
      )
      self.roof(p, base + eave, 0.66, color, identity + "-roof", inset=1.12)

  def arcade(self, a, b, base, bays, color):
    length = math.dist(a, b)
    dx, dz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
    normal = (-dz, dx)
    bay = length / bays

    def at(u, d=0):
      return a[0] + dx * u + normal[0] * d, a[1] + dz * u + normal[1] * d

    for i in range(bays + 1):
      x, z = at(bay * i)
      self.solid(
        rectangle((x, z), 0.34, 0.34),
        base - 0.02,
        base + 2.37,
        BLUE,
        "arcade-column",
        grid=0.20,
        strict=False,
      )
      self.solid(
        rectangle((x, z), 0.45, 0.45),
        base + 2.19,
        base + 2.43,
        LIME,
        None,
        grid=0.20,
        strict=False,
      )
      self.solid(
        rectangle((x, z), 0.43, 0.43),
        base - 0.02,
        base + 0.19,
        LIME,
        None,
        grid=0.20,
        strict=False,
      )
    for i in range(bays):
      start = i * bay
      divisions = 7 if not self.native else 5
      for j in range(divisions):
        u1, u2 = bay * j / divisions, bay * (j + 1) / divisions
        v1, v2 = (u1 / bay - 0.5) * 2, (u2 / bay - 0.5) * 2
        h1 = 2.30 + math.sqrt(max(0, 1 - v1 * v1)) * 0.65
        h2 = 2.30 + math.sqrt(max(0, 1 - v2 * v2)) * 0.65
        if self.native:
          poly = Polygon(
            [
              at(start + u1, -0.18),
              at(start + u2, -0.18),
              at(start + u2, 0.18),
              at(start + u1, 0.18),
            ]
          )
          self.solid(
            poly, base + max(h1, h2), base + 3.20, color, None, grid=0.20, strict=False
          )
          continue
        x1, z1 = at(start + u1)
        x2, z2 = at(start + u2)
        q = [
          (x1, base + h1, z1),
          (x2, base + h2, z2),
          (x2, base + 3.20, z2),
          (x1, base + 3.20, z1),
        ]
        self.triangles.extend(
          (([q[0], q[1], q[2]], color), ([q[0], q[2], q[3]], color))
        )


def polygon_line(a, b, w):
  return LineString((a, b)).buffer(w / 2, cap_style="flat")


def measured_part_footprint(part):
  return area_union(
    [
      Polygon(
        [(p[0], p[2]) for p in row["rings"][0]],
        [[(p[0], p[2]) for p in r] for r in row["rings"][1:]],
      )
      for row in part["surfaces"]
      if row["kind"] == "GroundSurface"
    ]
  )


def ornamental_paving(g, poly, center):
  """Keep the surrounding geometry legible with a small inlaid checker frame."""
  cx, cz = center
  for i in range(-6, 6):
    for j in range(-6, 6):
      if (i + j) % 2 or not (max(abs(i + 0.5), abs(j + 0.5)) >= 4.5):
        continue
      block = box(
        cx + i * 0.47, cz + j * 0.47, cx + (i + 1) * 0.47, cz + (j + 1) * 0.47
      )
      if poly.covers(block):
        g.floor(block, BLUE, 0.105, grid=0.25, strict=False)


def oriental(g, data):
  g.tag = "oriental-v330"
  court = shape(data["court"])
  center = tuple(data["fountain"])
  base = g.g(*center)
  g.floor(court, PALE, 0.06)
  hall = shape(data["roof"])
  hall_center = tuple(data["cupola"])
  hall_ground = g.g(*hall_center)
  dome_center = Point(hall_center)
  dome_radius = data["cupolaDiameter"] / 2
  copper = hall.difference(dome_center.buffer(dome_radius - 0.12, quad_segs=8))
  g.roof(copper, hall_ground + 3.50, 0.63, COPPER, "reception-copper-roof", inset=1.45)
  entry = Point(data["entrance"])
  link = Point(data["courtGate"])
  portal_route = LineString([entry, link])
  # The official part footprints support the lower lobby envelopes and
  # annexes. The pedestrian approach keeps a real corridor through the hall.
  for part in g.source["loD2Reception"]["parts"]:
    footprint = measured_part_footprint(part).intersection(g.park)
    if footprint.is_empty:
      continue
    ring = footprint.boundary.buffer(0.30, cap_style="flat", join_style="mitre")
    shell = ring.difference(portal_route.buffer(1.42)).difference(link.buffer(1.95))
    base_y = hall_ground
    height = min(3.54, float(part["topY"]) - float(part["groundY"]))
    if shell.area > 0.02:
      g.solid(
        shell,
        base_y - 0.05,
        base_y + height,
        PINK,
        "reception-wall",
        grid=0.20,
        strict=False,
        cap_color=PALE,
      )
    flat = footprint.difference(hall).difference(portal_route.buffer(1.3))
    if flat.area > 0.25:
      g.roof(flat, base_y + height, 0.14, COPPER, "reception-annex", inset=0.46)
  g.floor(hall, LIME, 0.075)
  dome_eave = hall_ground + 4.01
  g.solid(
    dome_center.buffer(dome_radius, quad_segs=8).difference(
      dome_center.buffer(dome_radius - 0.13, quad_segs=8)
    ),
    dome_eave - 0.10,
    dome_eave + 0.10,
    LIME,
    None,
    grid=0.18,
    strict=False,
  )
  if g.native:
    for k, (ratio, y) in enumerate(
      ((0.94, 0.32), (0.77, 0.67), (0.57, 0.91), (0.33, 1.18), (0.15, 1.29))
    ):
      pad = dome_center.buffer(dome_radius * ratio, quad_segs=6)
      g.solid(
        pad,
        dome_eave + (0.0, 0.30, 0.62, 0.86, 1.13)[k],
        dome_eave + y,
        (111, 160, 174),
        "glass-dome",
        grid=0.25,
      )
  else:
    n = 32
    layers = [
      (1, 0),
      (0.94, 0.37),
      (0.77, 0.73),
      (0.52, 1.05),
      (0.26, 1.26),
      (0.02, 1.37),
    ]
    rings = [
      [
        (
          hall_center[0] + dome_radius * r * math.cos(math.tau * i / n),
          dome_eave + y,
          hall_center[1] + dome_radius * r * math.sin(math.tau * i / n),
        )
        for i in range(n)
      ]
      for r, y in layers
    ]
    for a, b in zip(rings, rings[1:]):
      for i in range(n):
        j = (i + 1) % n
        c = (122, 168, 181) if i % 4 else (191, 210, 208)
        g.triangles.extend((([a[i], b[i], b[j]], c), ([a[i], b[j], a[j]], c)))
    g.solids.append(
      (
        "oriental-v330:glass-dome",
        dome_center.buffer(dome_radius, quad_segs=8),
        dome_eave,
        1.37,
      )
    )
  outline = list(court.exterior.coords)[:-1]
  gates = unary_union(
    [Point(data["courtGate"]).buffer(1.72), Point(data["eastGate"]).buffer(1.42)]
  )
  wall = court.boundary.buffer(0.28, join_style="mitre").difference(gates)
  g.solid(
    wall,
    base - 0.04,
    base + data["wallHeight"],
    PINK,
    "courtyard-wall",
    grid=0.25,
    strict=False,
    cap_color=COPPER,
  )
  for pair, bays in (((0, 1), 15), ((2, 3), 15)):
    a, b = (outline[i] for i in pair)
    a = (a[0] + (center[0] - a[0]) * 0.058, a[1] + (center[1] - a[1]) * 0.058)
    b = (b[0] + (center[0] - b[0]) * 0.058, b[1] + (center[1] - b[1]) * 0.058)
    g.arcade(a, b, base, bays, PALE)
    g.solid(
      polygon_line(a, b, 1.68),
      base + 3.20,
      base + 3.39,
      COPPER,
      "arcade-roof",
      grid=0.25,
      strict=False,
    )
  for i, identity in enumerate(data["bedsOsm"]):
    bed = g.raw(identity).intersection(court)
    g.floor(bed, (103, 128, 78), 0.11)
    border = bed.boundary.buffer(0.11)
    g.solid(border, base + 0.06, base + 0.28, SAND, None, grid=0.20, strict=False)
    for fraction in (0.22, 0.50, 0.78):
      x0, z0, x1, z1 = bed.bounds
      p = (x0 + (x1 - x0) * fraction, (z0 + z1) / 2)
      if bed.contains(Point(p)):
        g.sphere(p, 0.65, 0.53, g.g(*p) + 0.45, shade(HEDGE_TOP, 0.96 + i * 0.035))
  pools = [g.raw(i) for i in data["poolsOsm"]] + [
    shape(p) for p in data["transversePools"]
  ]
  for basin in pools:
    g.floor(basin, WATER, 0.17, grid=0.25)
    g.solid(
      basin.boundary.buffer(0.13),
      base + 0.07,
      base + 0.28,
      SAND,
      None,
      grid=0.20,
      strict=False,
    )
  fountain = Point(center)
  pavilion = fountain.buffer(data["pavilionDiameter"] / 2, quad_segs=2)
  g.pavilion(
    pavilion,
    "courtyard-octagon",
    eaves=2.73,
    rise=0.47,
    color=(64, 101, 88),
    post_color=(147, 109, 72),
    deck=0.10,
  )
  ornamental_paving(g, court, center)
  g.solid(
    fountain.buffer(0.27, quad_segs=3),
    base + 0.10,
    base + 1.02,
    LIME,
    "fountain-stem",
    grid=0.20,
    strict=False,
  )
  g.solid(
    fountain.buffer(0.83, quad_segs=4),
    base + 0.95,
    base + 1.20,
    PALE,
    "fountain-bowl",
    grid=0.20,
    strict=False,
  )
  g.triangles_on(
    fountain.buffer(0.69, quad_segs=4), base + 1.212, WATER
  ) if not g.native else g.solid(
    fountain.buffer(0.69),
    base + 1.193,
    base + 1.213,
    WATER,
    None,
    grid=0.20,
    strict=False,
    cap_color=WATER,
  )
  wing = g.raw(data["eastWingOsm"])
  g.gateway(
    wing.intersection(Point(data["eastGate"]).buffer(3.8)),
    "eastern-gate",
    eave=3.30,
    color=COPPER,
  )
  g.solid(
    wing.difference(Point(data["eastGate"]).buffer(3.30)),
    base - 0.04,
    base + 3.55,
    PINK,
    "eastern-walls",
    grid=0.25,
    strict=False,
    cap_color=COPPER,
  )


def japanese(g, data):
  g.tag = "japanese-v330"
  site = g.raw(data["siteOsm"])
  chaya = g.raw(data["chayaOsm"])
  gate = shape(data["mainGate"])
  hut = shape(data["viewHut"])
  g.pavilion(
    chaya,
    "nyosuitei",
    eaves=2.53,
    rise=0.92,
    color=(78, 83, 77),
    post_color=DARK_WOOD,
    deck=0.21,
  )
  g.gateway(gate, "main-gate", eave=2.55, color=SLATE)
  g.pavilion(hut, "viewpoint-hut", eaves=2.05, rise=0.61, color=SLATE, deck=0.13)
  corridors = [
    LineString(r).buffer(0.78, cap_style="round") for r in data["approaches"]
  ]
  approaches = area_union(corridors).intersection(site)
  openings = unary_union([Point(p).buffer(2.15) for p in data["entries"]])
  screen = (
    site.boundary.buffer(0.54, join_style="mitre")
    .difference(openings)
    .difference(approaches)
  )
  for p in polygons(screen):
    base = g.g(*centroid(p))
    g.solid(
      p,
      base - 0.15,
      base + 1.63,
      HEDGE,
      "screen",
      grid=0.25,
      strict=False,
      cap_color=HEDGE_TOP,
    )
  gravel = shape(data["whiteGravel"]).intersection(site)
  g.floor(gravel, (213, 211, 194), 0.086, grid=0.45)
  g.floor(approaches, (177, 171, 150), 0.075, grid=0.40)
  pond = shape(data["viewPond"]).intersection(site)
  stream = (
    LineString(data["stream"])
    .buffer(0.54)
    .intersection(site)
    .difference(gravel)
    .difference(approaches)
  )
  g.floor(pond, WATER, 0.112, grid=0.25)
  g.floor(stream, (95, 142, 141), 0.113, grid=0.25)
  # Pale raking bands in the main dry gravel garden, built from geometric
  # curves instead of image-derived colour pixels.
  x0, z0, x1, z1 = gravel.bounds
  for n in range(math.ceil((z1 - z0) / 0.74)):
    z = z0 + n * 0.74
    run = LineString(
      [
        (x, z + math.sin((x - x0) * 0.42 + n * 0.036) * 0.20)
        for x in np.arange(x0, x1 + 0.28, 0.28)
      ]
    )
    g.floor(
      run.buffer(0.042 if not g.native else 0.14).intersection(gravel),
      (194, 193, 177),
      0.105,
      grid=0.25,
      strict=False,
    )
  for i, (x, z) in enumerate(data["rockFall"]):
    r = (0.47, 0.57, 0.34, 0.66, 0.46)[i % 5]
    g.sphere((x, z), r, r * 1.53, g.g(x, z) + 0.29, shade(STONE, 0.91 + i % 4 * 0.05))
    if i in (1, 3, 5, 8):
      g.sphere(
        (x + 0.57, z - 0.29),
        r * 0.56,
        r * 0.68,
        g.g(x + 0.57, z - 0.29) + 0.17,
        shade(STONE, 1.14),
      )
  for i, (x, z) in enumerate(data["stepping"]):
    slab = Point(x, z).buffer(0.37 + (i % 3) * 0.065, quad_segs=3)
    g.floor(slab, shade(STONE, 1.18 + i % 2 * 0.08), 0.128, grid=0.20, strict=False)


def korean(g, data):
  g.tag = "korean-v330"
  site = g.raw(data["siteOsm"])
  kye = g.raw(data["kyeOsm"])
  g.pavilion(
    kye,
    "kye-zeong",
    eaves=2.96,
    rise=1.19,
    color=(68, 76, 76),
    post_color=(116, 72, 53),
    deck=0.36,
  )
  for identity in data["gatesOsm"]:
    g.gateway(g.raw(identity), f"roofed-gate-{identity}", eave=2.57, color=(62, 70, 70))
  for i, area in enumerate(data["courtyards"]):
    g.floor(
      shape(area).intersection(site),
      (196 + i * 2, 179 + i * 2, 147 + i * 2),
      0.065,
      grid=0.40,
    )
  for i, points in enumerate(data["stoneWalls"]):
    course = LineString(points).intersection(site)
    for part in getattr(course, "geoms", [course]):
      if part.geom_type == "LineString" and part.length > 0.20:
        g.wall_on(
          part,
          0.50,
          (1.18, 1.56, 1.22, 1.52)[i % 4],
          (151, 135, 115),
          "court-wall",
          SLATE,
          grid=0.20,
        )
  pond = g.raw(data["pondOsm"])
  g.floor(pond, WATER, 0.080, grid=0.25)
  for points in data["rockEdges"]:
    curve = LineString(points).intersection(site)
    for run in getattr(curve, "geoms", [curve]):
      if run.geom_type != "LineString":
        continue
      for i, length in enumerate(np.arange(0.21, run.length, 1.07)):
        x, z = run.interpolate(length).coords[0]
        r = (0.47, 0.68, 0.52, 0.78, 0.57)[i % 5]
        g.sphere((x, z), r, r * 1.26, g.g(x, z) + 0.28, shade(STONE, 1 + i % 3 * 0.10))
  for i, (x, z) in enumerate(data["entryPoles"]):
    y = g.g(x, z)
    p = rectangle((x, z), 0.29, 0.31)
    g.solid(p, y - 0.02, y + 2.38, WOOD, "jansiung", grid=0.20, strict=False)
    g.sphere((x, z), 0.22, 0.32, y + 2.31, shade(WOOD, 1.13 + (i % 2) * 0.08), 6)


def maze(g, data):
  g.tag = "maze-v330"
  outline = g.raw(data["outlineOsm"])
  center = g.raw(data["centerPavingOsm"])
  paths = [g.raw(i) for i in data["pathsOsm"]]
  route = unary_union(paths)
  passage = route.buffer(data["pathWidthM"] / 2, cap_style="round", join_style="mitre")
  entry_clear = unary_union([Point(p).buffer(1.04) for p in data["entries"]])
  clear = area_union([passage, entry_clear, center]).intersection(outline)
  g.floor(clear, (179, 172, 157), 0.054, grid=0.40)
  hedge = outline.difference(clear)
  # A metre-scale cut follows the exact full corridor complement. The same
  # shapes used for visible walls become nav obstacles in each family.
  for piece in polygons(hedge):
    x0, z0, x1, z1 = piece.bounds
    for x in np.arange(math.floor(x0 / 4) * 4, x1, 4):
      for z in np.arange(math.floor(z0 / 4) * 4, z1, 4):
        segment = piece.intersection(box(x, z, x + 4, z + 4))
        for poly in polygons(segment):
          if poly.area < 0.016:
            continue
          base = g.g(*centroid(poly))
          g.solid(
            poly,
            base - 0.09,
            base + data["hedgeHeight"],
            HEDGE,
            "yew",
            grid=0.25,
            cap_color=HEDGE_TOP,
          )
  for i in data["bouldersOsm"]:
    stone = g.raw(i)
    y = g.g(*centroid(stone))
    g.solid(
      stone,
      y - 0.02,
      y + 1.25,
      (150, 145, 133),
      "entrance-granite",
      grid=0.25,
      cap_color=(165, 162, 153),
    )
  tower = tuple(data["viewpoint"])
  y = g.g(*tower)
  for dx, dz in ((-0.82, -0.83), (0.82, -0.83), (-0.82, 0.83), (0.82, 0.83)):
    g.solid(
      rectangle((tower[0] + dx, tower[1] + dz), 0.24, 0.24),
      y - 0.025,
      y + 2.55,
      WOOD,
      "viewing-tower-post",
      grid=0.20,
      strict=False,
    )
  deck = rectangle(tower, 2.16, 2.16)
  g.solid(
    deck,
    y + 2.28,
    y + 2.47,
    (130, 111, 79),
    "viewing-tower-deck",
    grid=0.25,
    strict=False,
  )
  for a, b in (((-1, 1), (1, 1)), ((1, 1), (1, -1)), ((-1, -1), (-1, 1))):
    p = polygon_line(
      (tower[0] + a[0], tower[1] + a[1]), (tower[0] + b[0], tower[1] + b[1]), 0.17
    )
    g.solid(p, y + 3.24, y + 3.38, WOOD, None, grid=0.20, strict=False)
  for j in range(11):
    tread = rectangle((tower[0], tower[1] - 1.13 - (10 - j) * 0.21), 0.87, 0.24)
    g.solid(
      tread,
      y + j * 0.212,
      y + j * 0.212 + 0.13,
      (118, 104, 79),
      None,
      grid=0.20,
      strict=False,
    )
  forecourt = g.raw(data["forecourtOsm"])
  pattern = g.raw(data["groundPatternOsm"])
  g.floor(forecourt, (170, 166, 151), 0.057, grid=0.45)
  g.floor(pattern, (204, 201, 192), 0.078, grid=0.35)
  dividers = area_union(
    [
      LineString(points).buffer(0.102, cap_style="round")
      for points in data["pavingDividers"]
    ]
  ).intersection(pattern)
  g.floor(dividers, (151, 149, 138), 0.103, grid=0.22, strict=False)
  g.floor(
    Point(data["labyrinthCenter"]).buffer(0.46, quad_segs=4),
    (137, 134, 123),
    0.107,
    grid=0.20,
    strict=False,
  )


def build_garden_landmarks(
  source: dict, ground_at: Callable[[float, float], float], native: bool
) -> tuple[list[Triangle], list[Solid]]:
  """Build the four named garden components in the existing park packet frame."""
  if source["schemaVersion"] != 1 or not isinstance(native, bool):
    raise ValueError("Unsupported garden source")
  garden = Garden(source, ground_at, native)
  oriental(garden, source["oriental"])
  japanese(garden, source["japanese"])
  korean(garden, source["korean"])
  maze(garden, source["maze"])
  if not garden.triangles or not garden.solids:
    raise ValueError("No complete garden landmarks")
  return garden.triangles, garden.solids
