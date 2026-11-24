"""Drape the cadastral paths and park features on the surveyed 1 m DGM."""

import base64
import gzip
import json
import math
from pathlib import Path

import numpy as np
import shapely as sh
from build_prenzlauer_streets_v380 import parts
from shapely.geometry import LineString, Point, Polygon, shape
from wasserturm_mesh_v381 import Model, main_tower, shade

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
SOURCE = ROOT / "geo_data/regierungsviertel/wasserturm-park-v381.json.gz"
BASE = 54.594  # DHHN2016 ground at the existing tower's source envelope
X, Z, NX, NZ, STEP = 3106, -1674, 91, 99, 2
COLORS = {
  "park": 0x82946C,
  "grass": 0x8B9C72,
  "scrub": 0x73866C,
  "path": 0xCBBDA5,
  "setts": 0xB9AC9A,
  "sand": 0xD2BC99,
  "tartan": 0xAA795E,
  "soil": 0xA99A7C,
  "landing": 0xB5ACA0,
}


def inside_parts(g):
  return list(parts(g, "Polygon"))


class Site:
  def __init__(self):
    self.source = json.loads(gzip.decompress(SOURCE.read_bytes()))
    self.park = Polygon(self.source["park"])
    self.ways = {i: (tags, pts) for i, tags, pts in self.source["ways"]}
    self.alkis = {
      i: (kind, label, shape(geo)) for i, kind, label, geo in self.source["alkis"]
    }
    self.stairs = []
    self.solids = {False: [], True: []}
    self.roofs = {False: [], True: []}
    dem = self.source["dgm"]
    cells = np.frombuffer(
      gzip.decompress(base64.b64decode(dem["centimeters"])), "<i2"
    ).reshape(dem["nz"], dem["nx"])

    def sample(x, z):
      u = x - dem["x"]
      v = z - dem["z"]
      ix = math.floor(u)
      iz = math.floor(v)
      a = u - ix
      b = v - iz
      # Grid extends beyond the parcel by a full terrain cell.
      ix = min(max(ix, 0), dem["nx"] - 2)
      iz = min(max(iz, 0), dem["nz"] - 2)
      p = cells[iz : iz + 2, ix : ix + 2] * 0.01
      return (
        dem["datum"]
        + p[0, 0] * (1 - a) * (1 - b)
        + p[0, 1] * a * (1 - b)
        + p[1, 0] * (1 - a) * b
        + p[1, 1] * a * b
      )

    elev = []
    for j in range(NZ):
      row = []
      for i in range(NX):
        x = X + i * STEP
        z = Z + j * STEP
        # Match the existing flat street datum at the park border.
        pt = Point(x, z)
        blend = (
          min(1, self.park.boundary.distance(pt) / 2.5) if self.park.covers(pt) else 0
        )
        row.append(round(324 + max(0, sample(x, z) - BASE) * 100 * blend))
      elev.append(row)
    self.grid = np.array(elev, dtype="<u2")
    stair_polys = [g for _, (_, name, g) in self.alkis.items() if name == "Treppe"]
    for i, (t, pts) in self.ways.items():
      if t.get("highway") != "steps" or not t.get("step_count"):
        continue
      line = LineString(pts)
      if line.length < 0.3:
        continue
      matched = [
        p
        for p in stair_polys
        if line.intersection(p.buffer(0.55)).length > min(0.7, line.length * 0.4)
      ]
      width = (
        max(1.3, min(5.8, sum(g.area for g in matched) / line.length))
        if matched
        else 1.7
      )
      surface = line.buffer(
        width / 2, cap_style="flat", join_style="round"
      ).intersection(self.park)
      if surface.area < 0.2:
        continue
      self.stairs.append(
        dict(
          id=i,
          points=pts,
          count=int(t["step_count"]),
          width=round(width, 2),
          material=t.get("surface", "stone"),
          rail=t.get("handrail") == "yes",
          poly=surface,
        )
      )
    # One straddling pad is the public monument base. The surrounding paths are cadastral.
    self.surfaces = self.materials()

  def ground(self, x, z, native=False):
    u = (x - X) / STEP
    v = (z - Z) / STEP
    i = min(NX - 2, max(0, math.floor(u)))
    j = min(NZ - 2, max(0, math.floor(v)))
    a = u - i
    b = v - j
    nw, ne = self.grid[j, i : i + 2] * 0.01
    sw, se = self.grid[j + 1, i : i + 2] * 0.01
    if native:
      return ((int(self.grid[j, i]) + int(self.grid[j + 1, i + 1]) + 25) // 50) / 4
    return (
      nw * (1 - a) + ne * (a - b) + se * b
      if a >= b
      else nw * (1 - b) + sw * (b - a) + se * a
    )

  def materials(self):
    areas = []
    reserved = sh.union_all([s["poly"] for s in self.stairs])

    def paint(kind, geom):
      nonlocal reserved
      geom = sh.make_valid(geom).intersection(self.park).difference(reserved)
      if geom.area > 0.005:
        areas.append((kind, geom))
        reserved = reserved.union(geom)

    official = sh.union_all(
      [g for _, (kind, _, g) in self.alkis.items() if kind == "AX_WegPfadSteig"]
    )
    for _, (t, pts) in self.ways.items():
      if t.get("leisure") == "pitch":
        paint("tartan", Polygon(pts))
      if t.get("amenity") == "fountain":
        paint("landing", Polygon(pts).buffer(0.5))
    sett = sh.union_all(
      [
        LineString(pts).buffer(1.6, cap_style="flat")
        for t, pts in self.ways.values()
        if t.get("highway") == "footway" and t.get("surface") == "sett"
      ]
    )
    paint("setts", official.intersection(sett))
    paint("path", official)
    # Paths missing from the cadastral collection retain the actual OSM axes.
    for _, (t, pts) in self.ways.items():
      if t.get("highway") != "footway":
        continue
      line = LineString(pts)
      extra = line.difference(official.buffer(0.7))
      if extra.length > 0.8:
        paint(
          "setts" if t.get("surface") == "sett" else "path",
          extra.buffer(0.92, join_style="round"),
        )
    for name, kind in [("scrub", "scrub"), ("playground", "sand"), ("grass", "grass")]:
      objects = [
        Polygon(pts)
        for t, pts in self.ways.values()
        if name in (t.get("natural"), t.get("leisure"), t.get("landuse"))
        and len(pts) > 3
        and pts[0] == pts[-1]
      ]
      if objects:
        paint(kind, sh.union_all(objects))
    paint("grass", self.park)
    return [(kind, p) for kind, g in areas for p in inside_parts(g) if p.area > 0.003]

  def terrain(self, m, native):
    polygons = [p for _, p in self.surfaces]
    index = sh.STRtree(polygons)
    for j in range(NZ - 1):
      for i in range(NX - 1):
        x = X + i * STEP
        z = Z + j * STEP
        points = [(x, z), (x + 2, z), (x + 2, z + 2), (x, z + 2)]
        types = (
          [Polygon(points)]
          if native
          else [Polygon([points[s] for s in seq]) for seq in [(0, 1, 2), (0, 2, 3)]]
        )
        y = self.ground(x + 1, z + 1, True)
        for tri in types:
          for hit in index.query(tri, predicate="intersects"):
            mat = self.surfaces[hit][0]
            g = polygons[hit].intersection(tri)
            for p in inside_parts(g):
              if p.area < 0.0002:
                continue
              for t in sh.constrained_delaunay_triangles(p).geoms:
                xyz = [
                  (a, y if native else self.ground(a, b), b)
                  for a, b in list(
                    sh.orient_polygons(t, exterior_cw=True).exterior.coords
                  )[:3]
                ]
                # Model broad diffuse terrain light into the ground sheets so the hill reads at noon.
                vector = np.cross(
                  np.subtract(xyz[1], xyz[0]), np.subtract(xyz[2], xyz[0])
                )
                norm = np.linalg.norm(vector)
                gradient = (
                  1
                  if native or norm < 0.0001
                  else 1 - 0.17 * vector[0] / norm + 0.11 * vector[2] / norm
                )
                color = shade(COLORS[mat], round(gradient * 28) / 28)
                m.facet(xyz, color, 0.16 if mat == "setts" else 0)
        if not native or not self.park.intersects(types[0]):
          continue
        for a, b, adj in [
          (points[1], points[2], (x + 3, z + 1)),
          (points[2], points[3], (x + 1, z + 3)),
        ]:
          other = self.ground(*adj, True)
          if abs(y - other) < 0.02:
            continue
          for line in parts(LineString([a, b]).intersection(self.park), "LineString"):
            c, d = line.coords[0], line.coords[-1]
            m.quad(
              (c[0], y, c[1]),
              (d[0], y, d[1]),
              (d[0], other, d[1]),
              (c[0], other, c[1]),
              0x778568,
            )

  def steps(self, m, native):
    floors = []
    for stair in self.stairs:
      line = LineString(stair["points"])
      count = stair["count"]
      profile = []
      for j in range(count + 1):
        p = line.interpolate(j / count, normalized=True)
        profile.append(self.ground(p.x, p.y, native))
      for j in range(count):
        a = line.interpolate(j / count, normalized=True)
        b = line.interpolate((j + 1) / count, normalized=True)
        dx, dz = b.x - a.x, b.y - a.y
        length = math.hypot(dx, dz)
        if length < 0.015:
          continue
        yaw = math.atan2(dz, dx)
        y = (profile[j] + profile[j + 1]) * 0.5 + 0.055
        width = stair["width"]
        thickness = max(0.15, abs(profile[j + 1] - profile[j]) + 0.1)
        m.box(
          (a.x + b.x) / 2,
          y - thickness / 2,
          (a.y + b.y) / 2,
          length + 0.015,
          thickness,
          width,
          yaw,
          0xAC9276 if stair["material"] == "wood" else 0xC2B8A6,
        )
        floors.append(
          [
            round(a.x, 2),
            round(a.y, 2),
            round(b.x, 2),
            round(b.y, 2),
            width,
            round(y, 2),
          ]
        )
        if stair["rail"]:
          for side in [-1, 1]:
            xx = (a.x + b.x) / 2 - side * dz / length * width * 0.46
            zz = (a.y + b.y) / 2 + side * dx / length * width * 0.46
            m.box(xx, y + 0.87, zz, length + 0.07, 0.06, 0.06, yaw, 0x66685B)
            if j % 5 == 0 or j + 1 == count:
              m.box(xx, y + 0.46, zz, 0.06, 0.88, 0.06, yaw, 0x565E56)
      # Side cheeks join stair runs to the adjacent height field.
    return floors

  def boundaries(self, m, native):
    doors = sh.union_all(
      [Point(xz).buffer(1.35) for _, t, xz in self.source["nodes"] if "entrance" in t]
    )
    for _, (t, pts) in self.ways.items():
      kind = t.get("barrier")
      if kind not in ["retaining_wall", "wall", "fence"]:
        continue
      wall = LineString(pts).intersection(self.park.buffer(0.25)).difference(doors)
      wood = t.get("material") == "wood"
      fence = kind == "fence"
      for line in parts(wall, "LineString"):
        route = sh.segmentize(line, 2.8)
        for a, b in zip(route.coords, list(route.coords)[1:]):
          dx, dz = b[0] - a[0], b[1] - a[1]
          segment_length = math.hypot(dx, dz)
          if segment_length < 0.08:
            continue
          angle = math.atan2(dz, dx)
          x = (a[0] + b[0]) / 2
          z = (a[1] + b[1]) / 2
          y = self.ground(x, z, native)
          w = 0.22 if wood else 0.33
          if fence:
            self.solids[native].append([*a, *b, 0.045, y, y + 0.9])
            for level in [0.37, 0.85]:
              m.box(
                x, y + level, z, segment_length + 0.01, 0.045, 0.04, angle, 0x586654
              )
            m.box(
              a[0],
              self.ground(*a, native) + 0.48,
              a[1],
              0.07,
              0.96,
              0.07,
              angle,
              0x53624F,
            )
          else:
            n = (-dz / segment_length, dx / segment_length)
            side = [
              self.ground(x + s * n[0] * 0.85, z + s * n[1] * 0.85, native)
              for s in (-1, 1)
            ]
            high = max(y, max(side)) + (
              0.17 if wood else 0.33 if kind == "retaining_wall" else 0.92
            )
            low = min(y, min(side)) - 0.14
            self.solids[native].append([*a, *b, w, low, high + 0.09])
            tone = 0x8D7961 if wood else 0xA17860
            m.box(
              x, (low + high) / 2, z, segment_length + 0.015, high - low, w, angle, tone
            )
            m.box(
              x,
              high + 0.045,
              z,
              segment_length + 0.03,
              0.09,
              w + 0.08,
              angle,
              0x91856E if wood else 0xB59D80,
            )

  def benches(self, m, native):
    paths = sh.union_all(
      [g for _, (k, _, g) in self.alkis.items() if k == "AX_WegPfadSteig"]
    )
    for oid, t, (x, z) in self.source["nodes"]:
      if t.get("amenity") == "bench":
        y = self.ground(x, z, native)
        direction = t.get("direction", "")
        try:
          angle = math.radians(float(direction))
        except ValueError:
          p = Point(x, z)
          a, b = sh.shortest_line(p, paths.boundary).coords
          angle = math.atan2(b[1] - a[1], b[0] - a[0]) + math.pi / 2
        for k in [-1, 0, 1]:
          m.box(
            x - math.sin(angle) * k * 0.14,
            y + 0.43,
            z + math.cos(angle) * k * 0.14,
            1.63,
            0.085,
            0.116,
            angle,
            0x997F60,
          )
        for k in [-0.61, 0.61]:
          m.box(
            x + math.cos(angle) * k,
            y + 0.23,
            z + math.sin(angle) * k,
            0.13,
            0.4,
            0.38,
            angle,
            0x63665C,
          )
        if t.get("backrest") == "yes":
          for h in [0.67, 0.83]:
            m.box(
              x + math.sin(angle) * 0.25,
              y + h,
              z - math.cos(angle) * 0.25,
              1.64,
              0.11,
              0.065,
              angle,
              0x9C8262,
            )
      elif t.get("playground") == "trampoline":
        m.ring(
          x,
          z,
          self.ground(x, z, native) + 0.01,
          self.ground(x, z, native) + 0.06,
          1.03,
          1.03,
          16,
          0x827B66,
          True,
        )
        m.ring(
          x,
          z,
          self.ground(x, z, native) + 0.07,
          self.ground(x, z, native) + 0.08,
          0.83,
          0.83,
          16,
          0x575C58,
          True,
        )
      elif t.get("historic") == "memorial":
        y = self.ground(x, z, native)
        m.box(x, y + 1.13, z, 0.64, 0.84, 0.10, -0.84, 0x7A6D59)
      elif t.get("playground") == "roundabout":
        y = self.ground(x, z, native)
        m.ring(x, z, y + 0.10, y + 0.22, 1.08, 1.08, 12, 0xAF9A6D, True)

  def entrances(self, m, native):
    walls = [
      LineString(pts)
      for t, pts in self.ways.values()
      if t.get("barrier") in ("wall", "retaining_wall")
    ]
    for oid, t, (x, z) in self.source["nodes"]:
      if "entrance" not in t:
        continue
      p = Point(x, z)
      wall = min(walls, key=lambda edge: edge.distance(p))
      u = wall.project(p)
      a = wall.interpolate(max(0, u - 0.9))
      b = wall.interpolate(min(wall.length, u + 0.9))
      angle = math.atan2(b.y - a.y, b.x - a.x)
      cx, cz = math.cos(angle), math.sin(angle)
      nx, nz = -cz, cx
      if self.ground(x + nx * 2, z + nz * 2, native) > self.ground(
        x - nx * 2, z - nz * 2, native
      ):
        nx, nz = -nx, -nz
      floor = self.ground(x + nx * 1.8, z + nz * 1.8, native)

      def wallbox(tangent, h, w, high, d, out, tone):
        m.box(
          x + cx * tangent + nx * out,
          floor + h,
          z + cz * tangent + nz * out,
          w,
          high,
          d,
          angle,
          tone,
        )

      for sign in [-1, 1]:
        wallbox(sign * 1.39, 1.45, 0.54, 2.9, 0.55, -0.10, 0x98735B)
        wallbox(sign * 1.39, 2.72, 0.67, 0.20, 0.63, -0.06, 0xB09471)
      self.solids[native].append(
        [
          x - cx * 1.60,
          z - cz * 1.60,
          x + cx * 1.60,
          z + cz * 1.60,
          0.32,
          floor,
          floor + 3.0,
        ]
      )
      # Closed exterior doors appear on the three mapped entrances.
      wallbox(0, 1.18, 2.26, 2.36, 0.19, 0, 0x514F43)
      wallbox(0, 1.14, 0.035, 2.24, 0.05, 0.15, 0x827A65)
      wallbox(0, 2.51, 2.32, 0.28, 0.26, 0.02, 0x5B574A)
      for i in range(12):
        lo = i * math.pi / 12
        hi = (i + 1) * math.pi / 12

        def pt(a, r):
          return (
            x + cx * math.cos(a) * r + nx * 0.16,
            floor + 2.35 + math.sin(a) * r * 0.53,
            z + cz * math.cos(a) * r + nz * 0.16,
          )

        m.quad(
          pt(lo, 1.16),
          pt(hi, 1.16),
          pt(hi, 1.56),
          pt(lo, 1.56),
          shade(0xA87E60, 0.94 + 0.025 * (i % 3)),
        )
    for oid, (tags, pts) in self.ways.items():
      if tags.get("amenity") != "fountain":
        continue
      p = Polygon(pts)
      outer = p.minimum_rotated_rectangle
      coords = list(outer.exterior.coords)
      center = p.centroid
      y = self.ground(center.x, center.y, native) + 0.06
      # The long rectangular trough is aligned to the actual mapped fountain.
      for a, b in zip(coords, coords[1:]):
        dx, dz = b[0] - a[0], b[1] - a[1]
        m.box(
          (a[0] + b[0]) / 2,
          y + 0.19,
          (a[1] + b[1]) / 2,
          math.hypot(dx, dz) + 0.10,
          0.38,
          0.18,
          math.atan2(dz, dx),
          0xB1A48C,
        )
      for tri in sh.constrained_delaunay_triangles(p.buffer(-0.1)).geoms:
        m.facet([(x, y + 0.21, z) for x, z in list(tri.exterior.coords)[:3]], 0x748A85)

  def towers(self, m, native):
    # Service pavilion at the centre of the high terrace. The footprint and
    # bDOM give diameter and roof ridge; use the public exterior for the brick bays.
    for i in [40926070, 137353388, 321793371]:
      footprint = Polygon(self.ways[i][1])
      x, z = footprint.centroid.coords[0]
      if i == 321793371:
        # The original tower stood on a locally flattened datum. Its
        # upper courses use the full measured source-ground separation.
        base = 60.777 - BASE + 3
        if native:
          m.box(x, base + 16.25, z, 5.12, 32.50, 5.12, 0, 0xB9AB85)
          m.box(x, base + 32.71, z, 5.48, 0.66, 5.48, 0, 0xB3A181)
        else:
          for kind, rings in self.source["buildings"][str(i)][0]["surfaces"]:
            if kind not in ("RoofSurface", "WallSurface"):
              continue
            for ring in rings[:1]:
              pts = [
                (x + (px - x) * 1.025, py - BASE + 3, z + (pz - z) * 1.025)
                for px, py, pz in ring
              ]
              for j in range(1, len(pts) - 1):
                m.facet(
                  [pts[0], pts[j], pts[j + 1]],
                  0xB9AA86 if kind == "WallSurface" else 0x96856E,
                )
        for j in range(4):
          a = j * math.pi / 2 + 0.15 if not native else j * math.pi / 2
          for y in [11.8, 19.4, 26.3, 30.3]:
            xx = x + math.cos(a) * 2.65
            zz = z + math.sin(a) * 2.65
            m.box(xx, base + y, zz, 0.52, 1.30, 0.09, a + math.pi / 2, 0x626866)
          for y in [2.2, 9.9, 18.1, 25.8, 31.6]:
            m.box(
              x + math.cos(a) * 2.63,
              base + y,
              z + math.sin(a) * 2.63,
              5.04,
              0.18,
              0.21,
              a + math.pi / 2,
              0xA19171,
            )
      else:
        center = self.ground(x, z, native)
        radius = math.sqrt(footprint.area / math.pi)
        count = 8 if i == 40926070 else 4
        h = self.source["roofHeightQuantiles"][str(i)][2]
        phase = 0.23 if count == 8 else 0.6
        m.ring(
          x, z, center, center + h - 0.85, radius, radius, count, 0xA16F59, True, phase
        )
        m.ring(
          x,
          z,
          center + h - 0.85,
          center + h,
          radius * 1.11,
          0.36,
          count,
          0x786962,
          True,
          phase,
        )
        m.ring(
          x, z, center + h, center + h + 0.40, 0.30, 0.34, 8, 0x916D56, True, phase
        )
        for j in range(count):
          a = phase + (j + 0.5) * 2 * math.pi / count
          r = radius * math.cos(math.pi / count)
          m.box(
            x + math.cos(a) * (r + 0.04),
            center + h * 0.52,
            z + math.sin(a) * (r + 0.04),
            radius * 0.47,
            h * 0.57,
            0.08,
            a + math.pi / 2,
            0x5C6059,
          )
          m.box(
            x + math.cos(a) * (r + 0.14),
            center + h * 0.83,
            z + math.sin(a) * (r + 0.14),
            radius * 0.65,
            0.18,
            0.17,
            a + math.pi / 2,
            0xC39070,
          )
    # The small round structure in the circular path lies almost flush with the bDOM.
    f = Polygon(self.ways[321793368][1])
    x, z = f.centroid.coords[0]
    y = self.ground(x, z, native)
    r = math.sqrt(f.area / math.pi)
    m.ring(x, z, y + 0.035, y + 0.21, r, r, 32, 0xA39B8C, True)

  def trees(self, m, native):
    genus = {"Aesculus": 0, "Crataegus": 1, "Platanus": 2, "Tilia": 3, "Acer": 4}
    for i, (_, x, z, g, h, w, cm) in enumerate(self.source["treeRegister"]):
      y = self.ground(x, z, native)
      m.trees.append([x, z, round(y, 2), h, w, cm, genus.get(g, 5), i])
      self.solids[native].append([x, z, x, z, cm / 100 / math.pi, y, y + h * 0.63])


def main():
  s = Site()
  stairs = {}
  for native in [False, True]:
    style = "native" if native else "drawn"
    land = Model()
    s.terrain(land, native)
    s.trees(land, native)
    land.save(DATA / f"wasserturmParkTerrainV381-{style}.json")
    props = Model()
    stairs[style] = s.steps(props, native)
    s.boundaries(props, native)
    s.benches(props, native)
    s.towers(props, native)
    s.entrances(props, native)
    props.save(DATA / f"wasserturmParkObjectsV381-{style}.json")
    c = main_tower(s.source, native, ROOT)
    c.save(DATA / f"wasserturmMainV381-{style}.json")
    print(
      style,
      "land",
      len(land.xyz),
      len(land.indices) // 3,
      "objects",
      len(props.xyz),
      len(props.indices) // 3,
      "crown",
      len(c.xyz),
      flush=True,
    )
  # Stable obstacle words are inflated only while this optional local host is resident.
  collider = {}
  for native in [False, True]:
    style = "native" if native else "drawn"
    arr = np.rint(np.array(s.solids[native]) * 100).astype("int32")
    arr[:, [0, 2]] -= X * 100
    arr[:, [1, 3]] -= Z * 100
    collider[style] = base64.b64encode(
      gzip.compress(arr.astype("<i2").tobytes(), mtime=0)
    ).decode()
  rooftops = []
  for i in [321793371, 40926070, 137353388]:
    f = Polygon(s.ways[i][1])
    x, z = f.centroid.coords[0]
    r = math.sqrt(f.area / math.pi)
    vals = []
    for native in [False, True]:
      if i == 321793371:
        if native:
          vals.append([60.777 - BASE + 3, 60.777 - BASE + 3 + 33.04])
          continue
        vals.append([60.777 - BASE + 3, 93.84 - BASE + 3])
      else:
        y = s.ground(x, z, native)
        vals.append([y, y + s.source["roofHeightQuantiles"][str(i)][2] + 0.4])
    rooftops.append(
      dict(
        x=round(x, 2),
        z=round(z, 2),
        radius=round(r, 2),
        shape=8 if i == 40926070 else 4,
        phase=0.23 if i == 40926070 else 0.6,
        standpipe=i == 321793371,
        levels=[[round(y, 2) for y in pair] for pair in vals],
        ring=s.ways[i][1],
      )
    )
  profile = dict(
    solids=collider,
    roofs=rooftops,
    x=X,
    z=Z,
    nx=NX,
    nz=NZ,
    step=STEP,
    ring=s.source["park"],
    steps=stairs,
    cm=base64.b64encode(gzip.compress(s.grid.tobytes(), mtime=0)).decode(),
  )
  (DATA / "wasserturmParkWalkV381.json").write_text(
    json.dumps(profile, separators=(",", ":")) + "\n"
  )


if __name__ == "__main__":
  main()
