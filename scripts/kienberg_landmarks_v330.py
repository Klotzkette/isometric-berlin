"""Offline source-bound IGA cableway and Wolkenhain geometry in world coordinates."""

from __future__ import annotations

from math import ceil, floor, hypot, isfinite, sqrt

import shapely
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

WHITE = (233, 232, 219)
MEMBRANE = (216, 222, 214)
STEEL = (199, 204, 195)
DARK_STEEL = (102, 117, 111)
GLASS = (100, 133, 137)
ROPE = (78, 86, 80)
ROOF_GREEN = (109, 120, 79)
TIMBER = (135, 113, 82)
CONCRETE = (155, 155, 142)


def unit(v):
  length = sqrt(sum(x * x for x in v))
  if length == 0:
    raise ValueError("Zero-length IGA structure")
  return tuple(x / length for x in v)


def plus(a, b, factor=1):
  return tuple(x + factor * y for x, y in zip(a, b, strict=True))


def mix(a, b, t):
  return tuple((1 - t) * x + t * y for x, y in zip(a, b, strict=True))


def cross(a, b):
  return (
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  )


def dot(a, b):
  return sum(x * y for x, y in zip(a, b, strict=True))


def sub(a, b):
  return plus(a, b, -1)


def ground_shape(part):
  return unary_union(
    [
      Polygon(rings[0], rings[1:])
      for surface in part["surfaces"]
      if surface["kind"] == "GroundSurface"
      for rings in [[[(x, z) for x, _, z in ring] for ring in surface["rings"]]]
    ]
  )


class Structures:
  def __init__(self, ground_at, native):
    self.ground_at = ground_at
    self.native = native
    self.triangles = []
    self.solids = []

  def face(self, points, color, normal=None, *, double=False):
    for i in range(1, len(points) - 1):
      tri = [tuple(float(x) for x in p) for p in (points[0], points[i], points[i + 1])]
      n = cross(sub(tri[1], tri[0]), sub(tri[2], tri[0]))
      if dot(n, n) < 1e-12:
        continue
      if normal is not None and dot(n, normal) < 0:
        tri.reverse()
      self.triangles.append((tri, color))
      if double:
        self.triangles.append((tri[::-1], color))

  def block(self, x, y, z, w, h, d, color, heading=(1, 0), *, owner=None):
    if min(w, h, d) <= 0:
      raise ValueError("Non-positive IGA display volume")
    hx, hz = heading
    if self.native:
      hx, hz = (1, 0) if abs(hx) >= abs(hz) else (0, 1)
    kx, kz = -hz, hx
    ring = [
      (x + w / 2 * a * hx + d / 2 * b * kx, z + w / 2 * a * hz + d / 2 * b * kz)
      for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))
    ]
    bottom = [(a, y, b) for a, b in ring]
    top = [(a, y + h, b) for a, b in ring]
    self.face(top, color, (0, 1, 0))
    self.face(bottom, color, (0, -1, 0))
    for i, point in enumerate(bottom):
      j = (i + 1) % 4
      self.face(
        (point, bottom[j], top[j], top[i]),
        color,
        ((point[0] + bottom[j][0]) / 2 - x, 0, (point[2] + bottom[j][2]) / 2 - z),
      )
    if owner:
      self.solids.append((owner, Polygon(ring), y, h))

  def beam(self, a, b, thickness, color, *, native_step=1.5):
    distance = sqrt(dot(sub(b, a), sub(b, a)))
    if distance < 0.005:
      return
    if self.native:
      x0, y0, z0 = a
      x1, y1, z1 = b
      flat_distance = hypot(x1 - x0, z1 - z0)
      if flat_distance < 1e-6:
        self.block(x0, min(y0, y1), z0, thickness, abs(y1 - y0), thickness, color)
        return
      count = max(1, ceil(flat_distance / native_step))
      for i in range(count):
        p, q = mix(a, b, i / count), mix(a, b, (i + 1) / count)
        _, y, z = mix(p, q, 0.5)
        dx, dy, dz = sub(q, p)
        # Only horizontal and vertical faces. The stepped member does not
        # introduce a diagonal plate into the block-based representation.
        if abs(dx) > 1e-6:
          self.block(
            (p[0] + q[0]) / 2,
            y - thickness / 2,
            p[2],
            abs(dx) + thickness,
            thickness,
            thickness,
            color,
          )
        if abs(dz) > 1e-6:
          self.block(
            q[0], y - thickness / 2, z, thickness, thickness, abs(dz) + thickness, color
          )
        if abs(dy) > thickness / 2:
          self.block(
            q[0],
            min(y, q[1]),
            q[2],
            thickness,
            abs(q[1] - y) + thickness / 2,
            thickness,
            color,
          )
      return
    axis = unit(sub(b, a))
    up = (0, 1, 0) if abs(axis[1]) < 0.85 else (1, 0, 0)
    side = unit(cross(axis, up))
    rise = cross(side, axis)
    ends = [
      [
        plus(plus(p, side, i * thickness / 2), rise, j * thickness / 2)
        for i, j in ((-1, -1), (1, -1), (1, 1), (-1, 1))
      ]
      for p in (a, b)
    ]
    self.face(ends[0], color, axis, double=True)
    self.face(ends[1], color, axis, double=True)
    for i in range(4):
      j = (i + 1) % 4
      normal = sub(mix(ends[0][i], ends[0][j], 0.5), a)
      self.face([ends[0][i], ends[0][j], ends[1][j], ends[1][i]], color, normal)

  def measured(self, rings, color, up=False, *, double=False):
    """Triangulate retained source rings in their own nonvertical projection."""
    first = rings[0]
    normals = [
      cross(sub(first[i], first[0]), sub(first[i + 1], first[0]))
      for i in range(1, len(first) - 1)
    ]
    plane = max(normals, key=lambda n: dot(n, n), default=(0, 0, 0))
    if not any(plane):
      raise ValueError("Degenerate official source sheet")
    drop = max(range(3), key=lambda i: abs(plane[i]))
    keep = [i for i in range(3) if i != drop]
    projected = [[(p[keep[0]], p[keep[1]]) for p in ring] for ring in rings]
    lookup = {
      xy: p
      for ring, row in zip(rings, projected, strict=True)
      for xy, p in zip(row, ring, strict=True)
    }
    shape = shapely.make_valid(Polygon(projected[0], projected[1:]))
    for part in shapely.get_parts(shape):
      if not isinstance(part, Polygon):
        continue
      for tri in shapely.get_parts(shapely.constrained_delaunay_triangles(part)):
        points = []
        for a, b in list(tri.exterior.coords)[:3]:
          known = lookup.get((a, b))
          if known is None:
            known = list(first[0])
            known[keep[0]], known[keep[1]] = a, b
            known[drop] -= dot(plane, sub(known, first[0])) / plane[drop]
          points.append(known)
        self.face(points, color, (0, 1, 0) if up else plane, double=double)


def height_surfaces(part):
  result = []
  for s in part["surfaces"]:
    if s["kind"] != "RoofSurface":
      continue
    rings = s["rings"]
    plane = max(
      [
        cross(sub(rings[0][i], rings[0][0]), sub(rings[0][i + 1], rings[0][0]))
        for i in range(1, len(rings[0]) - 1)
      ],
      key=lambda v: abs(v[1]),
      default=(0, 0, 0),
    )
    if abs(plane[1]) < 1e-8:
      continue
    geometry = Polygon(
      [(x, z) for x, _, z in rings[0]],
      [[(x, z) for x, _, z in ring] for ring in rings[1:]],
    )
    result.append((geometry, rings[0][0], plane))
  return result


def raster_roof(out, part, color, *, open_under=False, step=0.8, wall_color=CONCRETE):
  """Rasterize official roofs independently into cardinal columns or thin caps."""
  support = ground_shape(part)
  roofs = height_surfaces(part)
  if not roofs or support.is_empty:
    raise ValueError("A roof is required for native IGA coverage")
  low = part["groundY"]
  x0, z0, x1, z1 = support.bounds
  columns = {}
  for i in range(floor(x0 / step), ceil(x1 / step)):
    x = (i + 0.5) * step
    for j in range(floor(z0 / step), ceil(z1 / step)):
      z = (j + 0.5) * step
      p = Point(x, z)
      if not support.covers(p):
        continue
      ys = [
        origin[1] - (plane[0] * (x - origin[0]) + plane[2] * (z - origin[2])) / plane[1]
        for g, origin, plane in roofs
        if g.covers(p)
      ]
      if not ys:
        # Gap between source sheets smaller than a cell. Keep the exact
        # footprint and assign the nearest roof's bounded local datum.
        g, origin, plane = min(roofs, key=lambda r: r[0].distance(p))
        if g.distance(p) > step * 1.5:
          continue
        ys = [origin[1]]
      y = round(max(ys) / 0.25) * 0.25
      columns[(i, j)] = (y - 0.42 if open_under else low, y)
  for (i, j), (base, y) in columns.items():
    x, z = i * step, j * step
    corners = [(x, z), (x + step, z), (x + step, z + step), (x, z + step)]
    out.face([(a, y, b) for a, b in corners], color, (0, 1, 0))
    if open_under:
      out.face([(a, base, b) for a, b in corners], WHITE, (0, -1, 0))
    for k, (di, dj) in enumerate(((0, -1), (1, 0), (0, 1), (-1, 0))):
      neighbor = columns.get((i + di, j + dj))
      if neighbor and neighbor[0] == base:
        base_edge = neighbor[1]
      else:
        base_edge = base
      if base_edge >= y:
        continue
      a, b = corners[k], corners[(k + 1) % 4]
      out.face(
        [
          (a[0], base_edge, a[1]),
          (b[0], base_edge, b[1]),
          (b[0], y, b[1]),
          (a[0], y, a[1]),
        ],
        WHITE if open_under else wall_color,
        (di, 0, dj),
      )
  return shapely.coverage_union_all(
    [box(i * step, j * step, (i + 1) * step, (j + 1) * step) for i, j in columns]
  )


def station_geometry(out, source):
  for i, station in enumerate(source["stations"]):
    open_under = i == 1
    for family in station["family"]:
      for part in family["parts"]:
        area = ground_shape(part)
        if not area.is_valid or area.is_empty:
          raise ValueError("Invalid station footprint")
        if out.native:
          solid_area = raster_roof(
            out, part, ROOF_GREEN, open_under=open_under, wall_color=GLASS
          )
        else:
          solid_area = area
          for surface in part["surfaces"]:
            kind = surface["kind"]
            if kind == "GroundSurface" or (kind == "WallSurface" and open_under):
              continue
            out.measured(
              surface["rings"],
              ROOF_GREEN
              if kind == "RoofSurface"
              else (
                GLASS
                if max(o[1] for r in surface["rings"] for o in r) > part["groundY"] + 3
                else DARK_STEEL
              ),
              kind == "RoofSurface",
              double=kind == "WallSurface",
            )
        if open_under:
          roofs = height_surfaces(part)

          def roof_at(x, z):
            _, o, n = min(roofs, key=lambda r: r[0].distance(Point(x, z)))
            return o[1] - (n[0] * (x - o[0]) + n[2] * (z - o[2])) / n[1]

          outline = [(x, roof_at(x, z) - 0.20, z) for x, z in area.exterior.coords]
          for a, b in zip(outline, outline[1:]):
            out.beam(a, b, 0.28, TIMBER)
          spacing = area.exterior.length / (7 if area.area > 40 else 4)
          for n in range(7 if area.area > 40 else 4):
            p = area.exterior.interpolate((n + 0.5) * spacing)
            ground = out.ground_at(p.x, p.y)
            low = (
              part["groundY"] if ground is None else min(part["groundY"], ground - 0.06)
            )
            level = roof_at(p.x, p.y) - 0.24
            if low < level:
              out.block(
                p.x,
                low,
                p.y,
                0.3,
                level - low,
                0.3,
                DARK_STEEL,
                owner=part["id"] + "-column",
              )
        else:
          out.solids.append(
            (part["id"], solid_area, part["groundY"], part["topY"] - part["groundY"])
          )


def straight_stairs(out, flight_start, flight_end, width, owner):
  ax, ay, az = flight_start
  bx, by, bz = flight_end
  distance = hypot(bx - ax, bz - az)
  axis = ((bx - ax) / distance, (bz - az) / distance)
  step_count = max(2, ceil(abs(by - ay) / (0.30 if out.native else 0.195)))
  thickness = 0.32 if out.native else 0.25
  for i in range(step_count):
    x, y, z = mix(flight_start, flight_end, (i + 0.5) / step_count)
    out.block(
      x,
      y - thickness,
      z,
      distance / step_count + 0.06,
      thickness,
      width,
      WHITE,
      axis,
      owner=owner,
    )
  n = (-axis[1], axis[0])
  for side in (-1, 1):
    shift = (n[0] * width / 2 * side, 0, n[1] * width / 2 * side)
    a, b = plus(flight_start, shift), plus(flight_end, shift)
    out.beam(plus(a, (0, 1.1, 0)), plus(b, (0, 1.1, 0)), 0.09, WHITE)
    for i in range(ceil(distance / 1.4) + 1):
      p = mix(a, b, min(1, i * 1.4 / distance))
      out.beam(p, plus(p, (0, 1.1, 0)), 0.065, STEEL)


def wolkenhain_geometry(out, source):
  profile = source["wolkenhain"]
  cloud, cafe = profile["lod2"]
  part, service = cloud["parts"][0], cafe["parts"][0]
  area = ground_shape(part)
  cafe_area = ground_shape(service)
  upper = [
    s
    for s in part["surfaces"]
    if s["kind"] != "GroundSurface"
    and min(p[1] for ring in s["rings"] for p in ring) >= 84
  ]
  if len(upper) != 39 or len(area.interiors) != 1:
    raise ValueError("Changed official Wolkenhain ring")
  if out.native:
    deck_area = raster_roof(out, part, WHITE, open_under=True, step=0.6)
    service_area = raster_roof(out, service, CONCRETE, step=0.6)
  else:
    deck_area, service_area = area, cafe_area
    for s in upper:
      out.measured(s["rings"], WHITE, s["kind"] == "RoofSurface", double=True)
    for s in service["surfaces"]:
      if s["kind"] != "GroundSurface":
        out.measured(
          s["rings"],
          CONCRETE if s["kind"] == "RoofSurface" else GLASS,
          s["kind"] == "RoofSurface",
          double=True,
        )
  out.solids.append(
    (
      service["id"],
      service_area,
      service["groundY"],
      service["topY"] - service["groundY"],
    )
  )
  out.solids.append((part["id"] + "-deck", deck_area, 87.52, 0.60))

  # Open faceted skin below the retained high deck. It follows both measured
  # outlines and leaves the long central opening unobstructed.
  center = area.centroid.coords[0]
  for hole, ring in enumerate([area.exterior, *area.interiors]):
    coords = list(ring.coords)
    tops, lowers = [], []
    for i, (x, z) in enumerate(coords):
      top = (x, 88.10, z)
      if out.native:
        top = (round(x / 0.3) * 0.3, 88.10, round(z / 0.3) * 0.3)
      tops.append(top)
      p = Point(x, z)
      if hole:
        shift_x, shift_z = sub((x, z), center)
      else:
        shift_x, shift_z = sub(center, (x, z))
      shift = unit((shift_x, shift_z))
      d = 0.48 if i % 3 else 1.18
      lowers.append((p.x + shift[0] * d, 84.90 + (i % 4) * 0.54, p.y + shift[1] * d))
    for i in range(len(tops) - 1):
      if out.native:
        a, b = tops[i], tops[i + 1]
        for n in range(max(1, ceil(hypot(b[0] - a[0], b[2] - a[2]) / 0.55))):
          x, y, z = mix(
            a, b, min(1, n * 0.55 / max(0.55, hypot(b[0] - a[0], b[2] - a[2])))
          )
          low = round(lowers[i][1] * 2) / 2
          out.block(x, low, z, 0.56, y - low, 0.56, MEMBRANE)
      else:
        out.face([tops[i], tops[i + 1], lowers[i]], WHITE, double=True)
        out.face([tops[i + 1], lowers[i + 1], lowers[i]], MEMBRANE, double=True)
        out.beam(tops[i], lowers[i + 1], 0.095, STEEL)
        out.beam(lowers[i], lowers[i + 1], 0.12, STEEL)

  # Distinct slim tree-like columns and branching steel, with clear spaces
  # between them. Footings follow the sampled summit terrain.
  supports = [record["point"] for record in profile["footingCheckpoints"][:7]]
  checkpoints = {
    tuple(record["point"]): record["nhn"] for record in profile["footingCheckpoints"]
  }

  def site_ground(x, z):
    value = out.ground_at(x, z)
    if value is None:
      value = checkpoints[(x, z)] - 30
    if not isfinite(value) or value >= 85:
      raise ValueError("Invalid Wolkenhain summit support")
    return value

  for i, (x, z) in enumerate(supports):
    low = site_ground(x, z)
    out.block(x, low, z, 0.48, 84.9 - low, 0.48, WHITE, owner=part["id"] + "-column")
    for j in (-1, 1):
      tx, tz = supports[(i + j) % len(supports)]
      branch = (x * 0.6 + tx * 0.4, 85.3, z * 0.6 + tz * 0.4)
      out.beam((x, 79.5 + i % 2, z), branch, 0.20, STEEL)
      out.beam((x, 75.0 + i % 2, z), (tx, 80.5, tz), 0.15, STEEL)

  lift_x, lift_z = 14259.2, -1469.5
  lift_y = site_ground(lift_x, lift_z)
  out.block(
    lift_x, lift_y, lift_z, 2.6, 89.75 - lift_y, 2.8, GLASS, owner=part["id"] + "-lift"
  )
  for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
    out.block(
      lift_x + a * 1.30, lift_y, lift_z + b * 1.40, 0.14, 89.8 - lift_y, 0.14, WHITE
    )
  out.block(lift_x, 89.72, lift_z, 2.84, 0.24, 3.04, WHITE)

  start = profile["stairFoot"][0]
  y = site_ground(*start) + 0.10
  turns = [
    (start[0], y, start[1]),
    (14268.0, 75.6, -1463.3),
    (14274.7, 79.8, -1469.9),
    (14265.4, 84.2, -1471.1),
    (14258.6, 88.1, -1475.0),
  ]
  for i, (a, b) in enumerate(zip(turns, turns[1:])):
    straight_stairs(out, a, b, 2.45, f"{part['id']}-stair-{i}")
    out.block(
      b[0],
      b[1] - 0.28,
      b[2],
      2.75,
      0.28,
      2.75,
      WHITE,
      owner=f"{part['id']}-landing-{i}",
    )


def ropeway_profiles(source):
  """Return two directional centreline profiles and a finite display gauge."""
  rope = source["ropeway"]
  gauge = rope["gaugeM"]
  profiles = []
  for section in rope["segments"]:
    anchors = section["anchors"]
    points = []
    for a, b in zip(anchors, anchors[1:]):
      p, q = (a["x"], a["ropeY"], a["z"]), (b["x"], b["ropeY"], b["z"])
      length = hypot(q[0] - p[0], q[2] - p[2])
      sections = max(1, ceil(length / 13))
      sag = min(5.8, length * length / 23000)
      for i in range(sections):
        t = i / sections
        x, y, z = mix(p, q, t)
        points.append((x, y - 4 * sag * t * (1 - t), z))
    last = anchors[-1]
    points.append((last["x"], last["ropeY"], last["z"]))
    profiles.append(points)
  return profiles, gauge


def offset_profile(points, gauge):
  result = []
  for i, p in enumerate(points):
    a, b = points[max(i - 1, 0)], points[min(i + 1, len(points) - 1)]
    dx, _, dz = sub(b, a)
    length = hypot(dx, dz)
    result.append((p[0] - dz / length * gauge, p[1], p[2] + dx / length * gauge))
  return result


def ropeway_tracks(source):
  sections, gauge = ropeway_profiles(source)
  if sections[0][-1] != sections[1][0]:
    raise ValueError("The surveyed sections do not meet at Wolkenhain station")
  centerline = sections[0] + sections[1][1:]
  return tuple(offset_profile(centerline, side * gauge / 2) for side in (-1, 1))


def cabin_poses(tracks, cabin_count):
  """Allocate the operator's full fleet evenly to the two visible lanes."""
  if cabin_count <= 0 or cabin_count % 2 or len(tracks) != 2:
    raise ValueError("Invalid bilateral cabin inventory")
  half = cabin_count // 2
  poses = []
  for side, points in enumerate(tracks):
    runs = [(a, b, hypot(b[0] - a[0], b[2] - a[2])) for a, b in zip(points, points[1:])]
    interval = sum(n for _, _, n in runs) / half
    prefix, index = 0, 0
    for i in range(half):
      target = interval * (i + (0.25 if side == 0 else 0.75))
      while target > prefix + runs[index][2]:
        prefix += runs[index][2]
        index += 1
      a, b, length = runs[index]
      dx, _, dz = sub(b, a)
      sign = 1 if side == 0 else -1
      poses.append(
        (
          mix(a, b, (target - prefix) / length),
          (dx / length * sign, dz / length * sign),
        )
      )
  return poses


def cabin(out, p, heading):
  x, y, z = p
  # Silhouette based on the glazed, rounded charcoal GD10 cabins. Roof,
  # glazing, skirt and hanger use separately coloured geometry.
  if out.native:
    out.block(x, y - 3.05, z, 2.25, 0.45, 1.90, DARK_STEEL, heading)
    out.block(x, y - 2.60, z, 2.28, 1.38, 1.96, GLASS, heading)
    out.block(x, y - 1.22, z, 2.32, 0.30, 2.0, WHITE, heading)
  else:
    hx, hz = heading
    footprint = [
      (-1, -0.67),
      (-0.72, -1),
      (0.72, -1),
      (1, -0.67),
      (1, 0.67),
      (0.72, 1),
      (-0.72, 1),
      (-1, 0.67),
    ]
    rings = [
      [
        (x + u * w * hx - v * d * hz, y + h, z + u * w * hz + v * d * hx)
        for u, v in footprint
      ]
      for w, d, h in (
        (0.89, 0.74, -3.05),
        (1.09, 0.91, -2.62),
        (1.15, 0.96, -1.31),
        (0.97, 0.81, -0.96),
      )
    ]
    for i, color in enumerate((DARK_STEEL, GLASS, WHITE)):
      for j in range(8):
        k = (j + 1) % 8
        a, b = rings[i][j], rings[i][k]
        normal = ((a[0] + b[0]) / 2 - x, 0, (a[2] + b[2]) / 2 - z)
        out.face([a, b, rings[i + 1][k], rings[i + 1][j]], color, normal)
    out.face(rings[-1], WHITE, (0, 1, 0))
    out.face(rings[0], DARK_STEEL, (0, -1, 0))
    for j in (0, 2, 4, 6):
      out.beam(rings[1][j], rings[2][j], 0.054, DARK_STEEL)
  out.beam(
    (x, y - 1.04, z),
    (x - heading[0] * 0.17, y, z - heading[1] * 0.17),
    0.11,
    DARK_STEEL,
  )


def ropeway_geometry(out, source):
  gauge = source["ropeway"]["gaugeM"]
  for anchors in source["ropeway"]["segments"]:
    for i, a in enumerate(anchors["anchors"]):
      if not a["pylon"]:
        continue
      low = out.ground_at(a["x"], a["z"])
      if low is None:
        low = a["groundNhn"] - 30
      top = a["ropeY"]
      if not isfinite(low) or top <= low:
        raise ValueError(f"Invalid IGA pylon terrain for {a['id']}")
      x, z = a["x"], a["z"]
      out.block(
        x, low, z, 1.32, min(0.66, top - low), 1.32, CONCRETE, owner=a["id"] + "-foot"
      )
      out.block(
        x,
        low,
        z,
        0.73 if a["stationApproach"] else 0.99,
        top - low - 0.30,
        0.73 if a["stationApproach"] else 0.99,
        DARK_STEEL,
        owner=a["id"],
      )
      p, q = anchors["anchors"][i - 1], anchors["anchors"][i + 1]
      heading = unit((q["x"] - p["x"], q["z"] - p["z"]))
      normal = (-heading[1], heading[0])
      for sign in (-1, 1):
        rail_x, rail_z = (
          x + sign * normal[0] * gauge / 2,
          z + sign * normal[1] * gauge / 2,
        )
        out.beam((x, top - 0.51, z), (rail_x, top - 0.18, rail_z), 0.26, DARK_STEEL)
        out.block(rail_x, top - 0.42, rail_z, 2.5, 0.35, 0.43, DARK_STEEL, heading)
        for j in (-0.9, -0.45, 0, 0.45, 0.9):
          out.block(
            rail_x + j * heading[0],
            top - 0.10,
            rail_z + j * heading[1],
            0.29,
            0.20,
            0.55,
            ROPE,
            heading,
          )
  tracks = ropeway_tracks(source)
  for rail in tracks:
    for a, b in zip(rail, rail[1:]):
      out.beam(a, b, 0.16 if out.native else 0.05, ROPE, native_step=7)
  for point, heading in cabin_poses(tracks, source["ropeway"]["cabinCount"]):
    cabin(out, point, heading)


def build_kienberg_landmarks(source, ground_at, native):
  """Return triangle/color rows and finite solid footprints for the given mode."""
  if source.get("schemaVersion") != 1 or len(source["ownedLod2Ids"]) != 11:
    raise ValueError("Unknown Kienberg landmark source")
  if sum(a["pylon"] for r in source["ropeway"]["segments"] for a in r["anchors"]) != 9:
    raise ValueError("Unexpected source pylon inventory")
  output = Structures(ground_at, native)
  station_geometry(output, source)
  wolkenhain_geometry(output, source)
  ropeway_geometry(output, source)
  return output.triangles, output.solids
