"""Bake the two Kreuzberg squares from the reviewed, metre-registered survey excerpts."""

import base64
import gzip
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
import shapely as sh
from shapely.affinity import rotate
from shapely.geometry import LineString, Point, Polygon, box, shape

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/kreuzberg-plaetze-v380.json.gz"
TARGET = ROOT / "src/app/src/data/kreuzbergPlaetzeV380"
COLORS = {
  "cm_fahrbahn": (103, 101, 99),
  "ck_parkflaeche": (117, 115, 111),
  "cl_gehweg": (189, 185, 173),
  "by_gehwegueberfahrt": (169, 161, 149),
  "cf_trennstreifen": (173, 167, 152),
  "ch_radweg": (166, 118, 106),
  "bw_aufmerksamkeitsfeld": (220, 216, 201),
  "bn_baumscheibe": (134, 126, 98),
}
METAL = (76, 86, 89)
PAINT = (222, 219, 202)


def polygons(g):
  if g.geom_type == "Polygon" and g.area > 0.001:
    yield g
  elif hasattr(g, "geoms"):
    for part in g.geoms:
      yield from polygons(part)


def lines(g):
  if g.geom_type == "LineString" and g.length > 0.03:
    yield g
  elif hasattr(g, "geoms"):
    for part in g.geoms:
      yield from lines(part)


class Mesh:
  def __init__(self, origin):
    self.origin = np.array(origin)
    self.points = {}
    self.triangles = []
    self.palette = {}

  def face(self, vertices, color):
    color = tuple(int(min(255, max(0, round(k)))) for k in color)
    ci = self.palette.setdefault(color, len(self.palette))
    ids = []
    for p in vertices:
      pos = tuple(round(v * 100) for v in np.array(p) - self.origin)
      ids.append(self.points.setdefault((*pos, ci), len(self.points)))
    for i in range(1, len(ids) - 1):
      if len({ids[0], ids[i], ids[i + 1]}) == 3:
        self.triangles.append((ids[0], ids[i], ids[i + 1]))

  def polygon(self, geom, color, project):
    for p in polygons(geom):
      for tri in sh.get_parts(sh.constrained_delaunay_triangles(p)):
        self.face([project(u, v) for u, v in list(tri.exterior.coords)[:3]], color)

  def ground(self, geom, height, color):
    self.polygon(geom, color, lambda x, z: (x, height, z))

  def rod(self, a, b, rad, color, sides=4):
    a, b = np.array(a, dtype=float), np.array(b, dtype=float)
    axis = b - a
    if np.linalg.norm(axis) < 0.02:
      return
    axis /= np.linalg.norm(axis)
    ref = np.array([1.0, 0, 0]) if abs(axis[0]) < 0.8 else np.array([0.0, 0, 1])
    side = np.cross(axis, ref)
    side /= np.linalg.norm(side)
    up = np.cross(axis, side)
    vec = [
      rad
      * (
        math.cos(t * 2 * math.pi / sides) * side
        + math.sin(t * 2 * math.pi / sides) * up
      )
      for t in range(sides)
    ]
    for i, d in enumerate(vec):
      e = vec[(i + 1) % sides]
      self.face([a + d, b + d, b + e, a + e], np.array(color) * (1 - 0.028 * (i % 4)))

  def finish(self):
    xyz = np.array(list(self.points), dtype=np.int64)
    if len(xyz) > 65535 or np.max(abs(xyz[:, :3])) > 32767 or len(self.palette) > 65535:
      raise ValueError("Packet exceeds its encoding")
    idx = np.array(self.triangles).ravel()

    def compress(raw):
      return base64.b64encode(gzip.compress(raw, 9, mtime=0)).decode("ascii")

    def deltas(arr):
      data = np.diff(arr, prepend=0).astype("<u2")
      return bytes((data & 255).astype("u1")) + bytes((data >> 8).astype("u1"))

    pos = xyz[:, :3].T.flatten()
    return dict(
      origin=self.origin.tolist(),
      n=len(xyz),
      f=len(self.triangles),
      p=compress(deltas(pos)),
      c=compress(
        deltas(xyz[:, 3])
        if len(self.palette) > 256
        else xyz[:, 3].astype("u1").tobytes()
      ),
      i=compress(deltas(idx)),
      palette=list(self.palette),
    )


def strip(mesh, line, width, height, color):
  mesh.ground(
    line.buffer(width / 2, cap_style="flat", join_style="round", quad_segs=2),
    height,
    color,
  )


def rail(mesh, a, b, y, color=METAL):
  dx, dz = np.subtract(b, a)
  length = math.hypot(dx, dz)
  for t in np.linspace(0, 1, max(2, math.ceil(length / 1.65) + 1)):
    x, z = np.add(a, np.multiply((dx, dz), t))
    mesh.rod((x, y, z), (x, y + 1.02, z), 0.047, color)
  for h in (0.47, 0.99):
    mesh.rod((a[0], y + h, a[1]), (b[0], y + h, b[1]), 0.055, color)


def oriented(g):
  coords = list(g.minimum_rotated_rectangle.exterior.coords)[:4]
  if math.dist(coords[0], coords[1]) < math.dist(coords[1], coords[2]):
    coords = coords[1:] + coords[:1]
  return np.array(coords)


def entrance(mesh, g, markers, closed):
  pts = oriented(g)
  a, b, c, d = pts
  end0 = (a + d) / 2
  end1 = (b + c) / 2
  # Source entrance node is at the streetward end of the flight.
  if min((math.dist(p, end0) for _, p in markers), default=0) > min(
    (math.dist(p, end1) for _, p in markers), default=0
  ):
    a, b, c, d = b, a, d, c
  if any(Point(p).distance(g) < 2 for _, p in closed):
    mesh.ground(g, 3.52, (117, 117, 109))
    for start, end in zip(pts, np.roll(pts, -1, axis=0)):
      rail(mesh, start, end, 3.53)
    return
  mesh.ground(g, 3.52, (65, 65, 61))
  for f in np.arange(0.04, 0.87, 0.105):
    p = a + (b - a) * f
    q = d + (c - d) * f
    strip(
      mesh, LineString([p, q]), 0.12, 3.53, (175 - 70 * f, 170 - 70 * f, 155 - 65 * f)
    )
  rail(mesh, a, b, 3.53)
  rail(mesh, d, c, 3.53)
  rail(mesh, b, c, 3.53)
  # The blue U appears at the surface end only on geo-referenced entrances.
  if not any(Point(p).distance(g) < 2 for _, p in markers):
    return
  axis = (d - a) / np.linalg.norm(d - a)
  center = a + 0.25 * axis

  def sign(u, v):
    return [center[0] + axis[0] * u, v, center[1] + axis[1] * u]

  mesh.rod(sign(0, 3.51), sign(0, 6.8), 0.065, METAL)
  mesh.face(
    [sign(-0.53, 6.08), sign(0.53, 6.08), sign(0.53, 7.06), sign(-0.53, 7.06)],
    (34, 83, 147),
  )
  for x0, y0, x1, y1 in [
    (-0.24, 6.39, -0.13, 6.85),
    (0.13, 6.39, 0.24, 6.85),
    (-0.23, 6.33, 0.23, 6.44),
  ]:
    pts = [sign(x0, y0), sign(x1, y0), sign(x1, y1), sign(x0, y1)]
    for offset in (-0.015, 0.015):
      mesh.face(
        [[x - axis[1] * offset, y, z + axis[0] * offset] for x, y, z in pts],
        (238, 238, 224),
      )


def trees(mesh, records, block):
  for x, z, h, diam, circ, tree_id, genus in records:
    r = diam / 2
    low = max(2, min(h * 0.5, h - 0.92 * diam))
    top = 3.5 + h
    bottom = 3.5 + low
    mesh.rod(
      (x, 3.33, z),
      (x, bottom + (top - bottom) * 0.25, z),
      max(0.08, (circ or 55) / 630),
      (98, 83, 65),
      5,
    )
    phase = sum(map(ord, tree_id)) * 0.61
    c = np.array(
      (95, 125, 79) if genus in ("Tilia", "Acer") else (94, 117, 79)
    ) + round(3 * math.sin(phase))
    for i in range(3):
      angle = phase + i * 2.1
      mesh.rod(
        (x, bottom - 0.75, z),
        (
          x + 0.53 * r * math.cos(angle),
          bottom + 0.25 * (top - bottom),
          z + 0.53 * r * math.sin(angle),
        ),
        max(0.05, (circ or 55) / 1120),
        (99, 85, 68),
        4,
      )
    if block:
      # Three nested open-sided levels give a stepped crown at the measured diameter.
      bands = [
        (bottom, 0.52),
        (bottom + 0.22 * (top - bottom), 0.9),
        (bottom + 0.62 * (top - bottom), 0.7),
        (top, 0.30),
      ]
      sides = 4
      angle = math.pi / 4
      r *= 1.4142
    else:
      bands = [
        (bottom, 0.31),
        (bottom + 0.19 * (top - bottom), 0.83),
        (bottom + 0.49 * (top - bottom), 1),
        (bottom + 0.77 * (top - bottom), 0.75),
        (top, 0.20),
      ]
      sides = 9
      angle = phase
    previous = None
    for j, (y, rad) in enumerate(bands):
      ring = []
      for i in range(sides):
        theta = angle + 2 * math.pi * i / sides
        rho = r * rad * (1 if block else 0.94 + 0.06 * math.cos(3 * theta + j * 0.39))
        rise = (
          0
          if block or j in (0, len(bands) - 1)
          else 0.033 * h * math.sin(2 * theta + 0.8 * j)
        )
        ring.append((x + rho * math.cos(theta), y + rise, z + rho * math.sin(theta)))
      if previous is not None:
        for i in range(sides):
          n = (i + 1) % sides
          if block:
            lower = [(p[0], previous[0][1], p[2]) for p in ring]
            mesh.face([previous[i], previous[n], lower[n], lower[i]], c * 0.81)
            mesh.face(
              [lower[i], lower[n], ring[n], ring[i]],
              c * (0.83 + 0.045 * j + 0.018 * (i % 3)),
            )
          else:
            mesh.face(
              [previous[i], previous[n], ring[n], ring[i]],
              c * (0.79 + 0.06 * j + 0.035 * math.cos(i)),
            )
      else:
        mesh.face(ring, c * 0.72)
      previous = ring
    mesh.face(previous, c * 1.09)


def scene_ground(mesh, site, source):
  layers = defaultdict(list)
  for row in source["features"]:
    layers[row["layer"]].append((shape(row["g"]), row))
  # Nav IDs and physical kerb lines come from separate survey layers. Survey
  # tree basins and access shafts must remain open in the pavement polygons.
  floors = []
  for i, (layer, base) in enumerate(COLORS.items()):
    y = 3.32 if layer in ("cm_fahrbahn", "ck_parkflaeche") else 3.48
    if layer in ("ch_radweg", "bw_aufmerksamkeitsfeld", "bn_baumscheibe"):
      y += 0.025
    for geom, row in layers[layer]:
      variation = (
        (int(str(row.get("material") or "0")) % 5 - 2) * 2
        if str(row.get("material") or "").isdigit()
        else 0
      )
      materials = {
        "03": (168, 165, 157),
        "04": (167, 163, 155),
        "05": (178, 175, 166),
        "07": (204, 200, 188),
        "09": (192, 183, 168),
      }
      tone = (
        materials.get(row.get("material"), base)
        if layer in ("cl_gehweg", "by_gehwegueberfahrt", "cf_trennstreifen")
        else np.array(base) + variation
      )
      mesh.ground(geom, y + i * 0.002, tone)
      if layer == "cl_gehweg" and row.get("material") == "09":
        for slab in polygons(geom):
          corners = oriented(slab)
          a, b = corners[:2]
          axis = (b - a) / np.linalg.norm(b - a)
          n = np.array([-axis[1], axis[0]])
          if slab.centroid.distance(Point(source["center"])) > 75:
            continue
          c = np.array(slab.centroid.coords[0])
          extent = np.dot(np.array(slab.exterior.coords) - c, axis)
          for dist in np.arange(extent.min() + 0.8, extent.max(), 1.4):
            center = c + dist * axis
            seam = (
              LineString([center - n * 25, center + n * 25])
              .buffer(0.025, cap_style="flat")
              .intersection(slab)
            )
            mesh.ground(seam, y + i * 0.002 + 0.012, (166, 159, 147))
    joined = sh.union_all([g for g, _ in layers[layer]]) if layers[layer] else Polygon()
    for p in polygons(joined.simplify(0.07)):
      floors.append(
        dict(
          ring=np.round(p.exterior.coords, 2).tolist()[:-1],
          holes=[np.round(h.coords, 2).tolist()[:-1] for h in p.interiors],
          y=round(y + i * 0.002, 3),
        )
      )
  for g, _ in layers["bd_bordstein"]:
    for line in lines(g):
      strip(mesh, line, 0.19, 3.51, (203, 199, 185))
      for a, b in zip(line.coords, list(line.coords)[1:]):
        mesh.face(
          [
            [a[0], 3.31, a[1]],
            [b[0], 3.31, b[1]],
            [b[0], 3.51, b[1]],
            [a[0], 3.51, a[1]],
          ],
          (149, 146, 137),
        )
  for g, _ in layers["bm_zugangsbauwerk"]:
    for p in polygons(g):
      if 6 < p.area < 50:
        entrance(mesh, p, source["entrances"], source.get("closedEntrances", []))
  for g, attributes in layers["at_mast_lsa"]:
    for p in sh.get_parts(g):
      h = float(attributes.get("height") or 360) / 100
      mesh.rod((p.x, 3.47, p.y), (p.x, 3.47 + h, p.y), 0.07, (91, 100, 99), 6)
      mesh.rod((p.x, 3.5 + h - 0.63, p.y), (p.x, 3.5 + h, p.y), 0.15, (53, 57, 54))
  for g, row in layers["bq_fahrradstaender"]:
    for poly in polygons(g):
      a, b, c, d = oriented(poly)
      count = int(row.get("stands") or 1)
      for f in np.linspace(0.14, 0.86, count) if count > 1 else [0.5]:
        p = a + (b - a) * f
        q = d + (c - d) * f
        mid = (p + q) / 2
        dv = q - p
        dv /= max(np.linalg.norm(dv), 1.0)
        p = mid - dv * 0.42
        q = mid + dv * 0.42
        for u in [p, q]:
          mesh.rod((u[0], 3.48, u[1]), (u[0], 4.21, u[1]), 0.04, METAL)
        mesh.rod((p[0], 4.21, p[1]), (q[0], 4.21, q[1]), 0.048, METAL)
  if site == "moritz":
    # Four red cycle crossings traced on Berlin's 2026 orthophoto. In this
    # 550-pixel crop the scale is 12.8/55 m per pixel in both axes.
    def pixel(x, y):
      return (2566 + x * 12.8 / 55, 1694 + y * 12.8 / 55)

    for pts in [
      [(134, 256), (135, 238), (141, 215), (153, 196), (179, 171)],
      [(276, 137), (297, 143), (321, 153), (345, 166), (365, 179)],
      [(395, 278), (391, 298), (381, 319), (369, 338), (354, 352)],
      [(233, 391), (213, 385), (194, 378), (178, 371), (161, 361)],
    ]:
      strip(mesh, LineString([pixel(*p) for p in pts]), 2.02, 3.352, (173, 103, 92))
  if site == "rio":
    # Two stop bars and the central broken turn guides on the 2026 aerial.
    # Coordinates are pixel readings on the 164-m square resampled to 600 px.
    def survey_pixel(p):
      return (3375 + p[0] * 164 / 600, 2070 + p[1] * 164 / 600)

    for a, b in [
      ((278, 276), (305, 287)),
      ((283, 311), (307, 321)),
      ((304, 285), (297, 302)),
      ((285, 294), (279, 308)),
      ((288, 278), (283, 290)),
      ((243, 255), (253, 259)),
      ((325, 307), (335, 311)),
    ]:
      strip(mesh, LineString([survey_pixel(a), survey_pixel(b)]), 0.17, 3.36, PAINT)
  for marking in source["markings"]:
    g = shape(marking["g"])
    pat = marking["pattern"]
    if pat == "grass":
      mesh.ground(g, 3.505, (143, 148, 105))

      # The small square of planting in the middle and the western raised bed
      # were traced independently on the November 2026 survey image.
      def overview(coords):
        return Polygon([(2508 + u * 0.48, 1636 + v * 0.48) for u, v in coords])

      bed = overview([(246, 240), (260, 247), (253, 261), (239, 254)])
      mesh.ground(bed, 3.55, (128, 114, 89))
      strip(mesh, bed.exterior, 0.17, 3.6, (157, 149, 129))
      west = overview(
        [(207, 234), (215, 234), (220, 242), (216, 250), (205, 249), (203, 242)]
      )
      mesh.ground(west, 3.55, (120, 112, 95))
      strip(mesh, west.exterior, 0.24, 3.63, (170, 161, 142))
      continue
    if pat == "sharks_teeth":
      for line in lines(g):
        p, q = np.array(line.coords[0]), np.array(line.coords[-1])
        axis = (q - p) / max(0.01, np.linalg.norm(q - p))
        n = np.array([-axis[1], axis[0]])
        for v in np.arange(0.35, line.length - 0.25, 0.83):
          mid = p + axis * v
          mesh.ground(
            Polygon([mid - axis * 0.22, mid + axis * 0.22, mid + n * 0.41]), 3.36, PAINT
          )
      continue
    if pat not in ("x", "stripes") or g.geom_type != "Polygon":
      continue
    strip(mesh, g.exterior, 0.12, 3.36, PAINT)
    if pat == "x":
      a, b, c, d = oriented(g)
      stripes = [LineString([a, c]), LineString([b, d])]
    else:
      a, b, c, d = g.bounds
      ang = float(marking.get("angle") or 45)
      center = (g.centroid.x, g.centroid.y)
      radius = math.hypot(c - a, d - b) + 2
      stripes = [
        rotate(
          LineString(
            [(center[0] + t, center[1] - radius), (center[0] + t, center[1] + radius)]
          ),
          ang,
          origin=center,
        )
        for t in np.arange(-radius, radius, 1.1)
      ]
    for ln in stripes:
      mesh.ground(ln.buffer(0.095, cap_style="flat").intersection(g), 3.364, PAINT)
  for triangle in source.get("islandRelief", []):
    mesh.face(triangle["vertices"], triangle["color"])
  return floors


def frontage(mesh, row, block):
  a = np.array(row["a"])
  b = np.array(row["b"])
  n = np.array(row["normal"])
  w = np.linalg.norm(b - a)
  d = (b - a) / w
  lo = row["low"]
  height = row["high"] - lo
  wall = np.array(row["wall"])
  observed = [
    box(u * w, lo + v * height, s * w, lo + t * height) for u, v, s, t in row["windows"]
  ]
  if not observed:
    return
  bottom = min(g.bounds[1] for g in observed) - 0.65
  top = max(g.bounds[3] for g in observed) + 0.68
  for plane in row["block"] if block else [{"g": g} for g in row["solid"]]:
    region = shape(plane["g"]).intersection(box(0, bottom, w, top))
    if region.is_empty:
      continue

    def draw(g, color, depth):
      def project(u, y):
        p = a + d * u
        if block:
          k = plane["axis"] // 2
          p = p + n * ((plane["value"] - p[k]) / n[k])
          p[k] += plane["sign"] * depth
        else:
          p = p + n * depth
        return (p[0], y, p[1])

      mesh.polygon(g.intersection(region), color, project)

    # The 2015 generic relief projects 17 cm. Cover only the registered
    # storeys, on the source plane, so street-level doors and eaves survive.
    depth = 0.205 if not block else 0.05
    modern = row.get("modern", False)
    draw(region, wall, depth)
    if modern:
      for glass in observed:
        u0, y0, u1, y1 = glass.bounds
        if y0 > lo + 2:
          draw(box(u0, y0 - 0.64, u1, y0 - 0.06), (99, 100, 97), depth + 0.018)
    for g in observed:
      if not g.intersects(region):
        continue
      x0, y0, x1, y1 = g.bounds
      draw(box(x0 - 0.1, y0 - 0.1, x1 + 0.1, y1 + 0.1), wall * 0.71, depth + 0.022)
      draw(g, (90, 108, 116) if modern else (69, 79, 85), depth + 0.042)
      draw(
        box(x0 - 0.12, y0 - 0.13, x1 + 0.12, y0 - 0.035),
        np.minimum(241, wall + 11),
        depth + 0.085,
      )
      if modern:
        for u in np.linspace(x0, x1, max(2, round((x1 - x0) / 1.5) + 1))[1:-1]:
          draw(box(u - 0.045, y0, u + 0.045, y1), (190, 191, 180), depth + 0.065)
      elif x1 - x0 > 1.05:
        draw(
          box((x0 + x1) / 2 - 0.035, y0, (x0 + x1) / 2 + 0.035, y1),
          wall * 0.72,
          depth + 0.065,
        )


def main():
  archive = json.loads(gzip.decompress(SOURCE.read_bytes()))
  TARGET.mkdir(exist_ok=True)
  for name, site in archive.items():
    x, z = site["center"]
    anchor = (x, 0, z)
    ground = Mesh(anchor)
    floors = scene_ground(ground, name, site)
    common = ground.finish()
    data = {"ground": {"mesh": common, "floors": floors}}
    for native, key in [(False, "drawn"), (True, "native")]:
      mesh = Mesh(anchor)
      trees(mesh, site["trees"], native)
      for front in site["fronts"]:
        frontage(mesh, front, native)
      data[key] = mesh.finish()
    for key, part in data.items():
      output = TARGET / (name + "_" + key + ".json")
      output.write_text(json.dumps(part, separators=(",", ":")) + "\n")


if __name__ == "__main__":
  main()
