"""Compile retained OSM geometry and Berlin DGM1 samples into bounded metre-space meshes."""

from __future__ import annotations

import base64
import gzip
import json
import math
from functools import lru_cache
from pathlib import Path

import numpy as np
from build_tegel_castle_v378 import triangulate
from build_tegel_shore_v378 import Shore
from shapely import constrained_delaunay_triangles, from_wkb
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/tegel-landscape-source-v378.json.gz"
DATA = ROOT / "src/app/src/data"
CITY = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
ROUTES = {"footway": 1.8, "path": 1.4, "steps": 2.2, "pedestrian": 3, "service": 3.5}
TILE = 512


def parts(shape, kind):
  if shape.is_empty:
    return
  if shape.geom_type == kind:
    yield shape
  elif hasattr(shape, "geoms"):
    for item in shape.geoms:
      yield from parts(item, kind)


def encoded(values, dtype):
  return base64.b64encode(np.asarray(values, dtype=dtype).tobytes()).decode("ascii")


def surveyed_width(tags, fallback):
  try:
    return max(0.35, min(12, float(tags.get("width", fallback))))
  except ValueError:
    return fallback


class Tile:
  def __init__(self, key):
    self.key = key
    self.cx = key[0] * TILE + TILE // 2
    self.cz = key[1] * TILE + TILE // 2
    self.vertices = {}
    self.indices = []
    self.walk = []
    self.floors = []
    self.owners = set()
    self.crowns = []
    self.houses = []

  def triangle(self, corners, material, owner, walk=False):
    if walk:
      self.walk.append(len(self.indices) // 3)
    self.owners.add(owner)
    for x, y, z, native_y in corners:
      v = (
        round((x - self.cx) * 100),
        round(y * 100),
        round((z - self.cz) * 100),
        round((native_y - y) * 100),
        material,
      )
      self.indices.append(self.vertices.setdefault(v, len(self.vertices)))

  def payload(self):
    vertices = list(self.vertices)
    assert (
      len(vertices) < 65536 and max(abs(v) for p in vertices for v in p[:4]) <= 32767
    )
    rings = []
    ground = unary_union(self.floors)
    for p in parts(ground, "Polygon"):
      if p.area < 0.02:
        continue

      def ring(r):
        return [[round(x - self.cx, 2), round(z - self.cz, 2)] for x, z in r.coords]

      rings.append([ring(p.exterior), *[ring(h) for h in p.interiors]])
    return {
      "origin": [self.cx, self.cz],
      "crowns": self.crowns,
      "houses": self.houses,
      "points": encoded([v[:3] for v in vertices], "<i2"),
      "nativeDy": encoded([v[3] for v in vertices], "<i2")
      if any(v[3] for v in vertices)
      else "",
      "materials": encoded([v[4] for v in vertices], "u1"),
      "triangles": encoded(self.indices, "<u2"),
      "walk": encoded(self.walk, "<u2"),
      "ground": rings,
      "owners": sorted(self.owners),
    }


@lru_cache(None)
def forst_grid(tx, tz, native):
  mode = "minecraft" if native else "drawn"
  p = CITY / f"tegeler-forst-{tx}_{tz}.{mode}.json.gz"
  if not p.exists():
    return None
  source = json.loads(gzip.decompress(p.read_bytes()))
  side = 128 if native else 129
  return np.frombuffer(
    base64.b64decode(source["gardenTerrainV330"]), dtype="<i2"
  ).reshape(side, side)


def forest_height(x, z, native):
  tx, tz = math.floor(x / TILE), math.floor(z / TILE)
  g = forst_grid(tx, tz, native)
  if g is None:
    return 3.0
  u, v = (x - tx * TILE) / 4, (z - tz * TILE) / 4
  col, row = math.floor(u), math.floor(v)
  if native:
    return g[row, col] / 100
  a, b = u - col, v - row
  edge = g[row, col + 1] if a >= b else g[row + 1, col]
  return (
    g[row, col] * (1 - max(a, b)) + edge * abs(a - b) + g[row + 1, col + 1] * min(a, b)
  ) / 100


def dgm(grid, x, z):
  ox, oz = grid["xz"]
  nx, nz = grid["shape"]
  step = grid["step"]
  u = np.clip((x - ox) / step, 0, nx - 1)
  v = np.clip((z - oz) / step, 0, nz - 1)
  i, j = min(nx - 2, int(u)), min(nz - 2, int(v))
  a, b = u - i, v - j
  c = grid["cm"]
  return (
    (1 - b) * ((1 - a) * c[j * nx + i] + a * c[j * nx + i + 1])
    + b * ((1 - a) * c[(j + 1) * nx + i] + a * c[(j + 1) * nx + i + 1])
  ) / 100


@lru_cache(None)
def open_fliess_water():
  mapped = []
  for path in sorted(CITY.glob("tegeler-fliess-*.json.gz")):
    packet = json.loads(gzip.decompress(path.read_bytes()))
    ox, _, oz = packet["origin"]
    for r in packet["nav"]["water"]:
      rings = [[(x + ox, z + oz) for x, z in ring] for ring in [r["ring"], *r["holes"]]]
      mapped.append(Polygon(rings[0], rings[1:]))
  return unary_union(mapped)


class Site:
  def __init__(self, name, grid):
    self.name, self.grid = name, grid
    self.shore = None
    self.tiles = {}
    self.bounds = None

  def y(self, x, z, native=False):
    if self.name == "fliess":
      return 3.0
    if self.name == "forst":
      return forest_height(x, z, native)
    # Retain the adjacent lake model's dry 3.01 m shoreline datum. DGM1
    # supplies the inland relief; the lake surface stays at its existing level.
    h = dgm(self.grid, x, z)
    if self.name in ("tegel", "reiherwerder"):
      dry = max(3.055, h - 31.45 + 3.055)
      return self.shore[native].height(x, z, dry) if self.shore else dry
    if self.name == "wannsee":
      return max(3.055, h - 29.42 + 3.055)
    if self.name == "schloss":
      return max(3.055, h - 35.84 + 3.055)
    return h - 33.9 + 3

  def tile(self, x, z):
    key = (math.floor(x / TILE), math.floor(z / TILE))
    if key not in self.tiles:
      self.tiles[key] = Tile(key)
    return self.tiles[key]

  def ground(self, g, material, owner, offset=0.04, walk=True, flat=None, spacing=12):
    if self.name == "fliess" and flat is None:
      g = g.difference(open_fliess_water())
    if g.is_empty:
      return
    for p in parts(g, "Polygon"):
      x0, z0, x1, z1 = p.bounds
      for i in range(math.floor(x0 / spacing), math.ceil(x1 / spacing)):
        for j in range(math.floor(z0 / spacing), math.ceil(z1 / spacing)):
          part = p.intersection(
            box(i * spacing, j * spacing, (i + 1) * spacing, (j + 1) * spacing)
          )
          for face in parts(part, "Polygon"):
            if face.area < 0.015:
              continue
            c = face.representative_point()
            tile = self.tile(c.x, c.y)
            if walk:
              tile.floors.append(face)
            for tri in constrained_delaunay_triangles(face).geoms:
              points = []
              for x, z in list(tri.exterior.coords)[:3]:
                y = flat if flat is not None else self.y(x, z)
                yn = flat if flat is not None else self.y(x, z, True)
                points.append((x, y + offset, z, yn + offset))
              tile.triangle(points, material, owner, walk)

  def prism(self, g, base, top, material, owner):
    for p in parts(g, "Polygon"):
      if p.area < 0.001:
        continue
      c = p.representative_point()
      tile = self.tile(c.x, c.y)
      for tri in constrained_delaunay_triangles(p).geoms:
        tile.triangle(
          [(x, top[0], z, top[1]) for x, z in list(tri.exterior.coords)[:3]],
          material,
          owner,
        )
      for ring in [p.exterior, *p.interiors]:
        for (x, z), (u, v) in zip(ring.coords, list(ring.coords)[1:]):
          a, b = (x, base[0], z, base[1]), (u, base[0], v, base[1])
          c, d = (u, top[0], v, top[1]), (x, top[0], z, top[1])
          tile.triangle([a, b, c], material, owner)
          tile.triangle([a, c, d], material, owner)

  def post(self, x, z, rise, width, owner, material=8, low=0):
    yd, yn = self.y(x, z), self.y(x, z, True)
    self.prism(
      box(x - width / 2, z - width / 2, x + width / 2, z + width / 2),
      (yd + low, yn + low),
      (yd + rise, yn + rise),
      material,
      owner,
    )


def surfaces(site, records):
  gates = unary_union([g.buffer(1.5) for _, k, _, g in records if k == "gate"])
  green = unary_union([g for _, k, _, g in records if k == "green"])
  paths = unary_union([g for _, k, _, g in records if k in ("way", "planks", "bridge")])
  for owner, kind, t, g in records:
    if kind in ("festival", "green", "sand", "sandcourt", "marshfloor", "gardenfloor"):
      mat = {
        "festival": 12,
        "green": 5,
        "sand": 0,
        "sandcourt": 1,
        "marshfloor": 16,
        "gardenfloor": 5,
      }[kind]
      site.ground(
        g.difference(green) if kind == "festival" else g,
        mat,
        owner,
        0.08 if kind == "sandcourt" else 0.035,
        spacing=4 if kind == "sand" and site.shore else 16,
      )
    elif kind == "forestfloor":
      # This surveyed grove fills only terrain omitted by both earlier meshes.
      # Four-metre cells preserve the neighbouring DGM terrain and walking height.
      site.ground(g, 18, owner, 0, spacing=4)
    elif kind == "way":
      surface = t.get("surface", "")
      mat = (
        3
        if surface == "asphalt"
        else 4
        if surface in ("concrete", "paving_stones") or t.get("highway") == "steps"
        else 14
        if surface == "cobblestone"
        else 2
      )
      width = surveyed_width(t, ROUTES.get(t["highway"], 2))
      site.ground(
        g.buffer(width / 2, cap_style="flat", join_style="round"),
        mat,
        owner,
        0.12,
        t.get("access") != "private",
        spacing=8,
      )
    elif kind in ("pier", "pier_area", "bridge"):
      deck = 3.25 if kind == "bridge" else -0.15
      area = (
        g
        if kind == "pier_area"
        else g.buffer(
          surveyed_width(t, 2 if kind == "bridge" else 1.35) / 2,
          cap_style="flat",
          join_style="round",
        )
      )
      site.prism(
        area,
        (deck - 0.23, deck - 0.23),
        (deck, deck),
        4 if kind == "bridge" else 7,
        owner,
      )
      # The deck's exact footprint owns the elevated walking surface.
      site.ground(area, 4 if kind == "bridge" else 7, owner, 0.012, flat=deck)
      if t.get("handrail") == "yes":
        for line in parts(g, "LineString"):
          for d in (-0.9, 0.9):
            edge = line.offset_curve(d)
            site.prism(
              edge.buffer(0.045, cap_style="flat"),
              (deck + 0.91,) * 2,
              (deck + 0.99,) * 2,
              8,
              owner,
            )
            for dist in np.arange(0, edge.length + 0.1, 2.5):
              p = edge.interpolate(dist)
              site.prism(
                box(p.x - 0.05, p.y - 0.05, p.x + 0.05, p.y + 0.05),
                (deck,) * 2,
                (deck + 0.98,) * 2,
                8,
                owner,
              )
    elif kind == "planks":
      for line in parts(g, "LineString"):
        for dist in np.arange(0.5, line.length, 0.78):
          a, b = line.interpolate(dist - 0.03), line.interpolate(dist + 0.03)
          dx, dz = b.x - a.x, b.y - a.y
          length = math.hypot(dx, dz)
          if length < 1e-6:
            continue
          p = line.interpolate(dist)
          dx, dz = dx / length * 0.81, dz / length * 0.81
          strip = LineString([(p.x - dz, p.y + dx), (p.x + dz, p.y - dx)]).buffer(
            0.026, cap_style="flat"
          )
          site.ground(strip, 6, owner, 0.018, False, 3.25)
    elif kind == "reed":
      # Locations of individual stems are an interpretation of mapped reedbeds.
      for poly in parts(
        g.difference(paths.buffer(2.5)).difference(open_fliess_water()), "Polygon"
      ):
        x0, z0, x1, z1 = poly.bounds
        for x in range(math.ceil(x0 / 6) * 6, math.ceil(x1), 6):
          for z in range(math.ceil(z0 / 6) * 6, math.ceil(z1), 6):
            p = Point(x + math.sin(z) * 1.3, z + math.cos(x) * 1.2)
            if not poly.contains(p):
              continue
            tile = site.tile(p.x, p.y)
            for j in range(4):
              a = (x * 17 + z * 3 + j * 2.4) % 6.28
              u, v = math.cos(a), math.sin(a)
              h = 0.7 + 0.45 * abs(u)
              tile.triangle(
                [
                  (p.x - 0.15 * v, 3, p.y + 0.15 * u, 3),
                  (p.x + 0.15 * v, 3, p.y - 0.15 * u, 3),
                  (p.x + 0.4 * u, 3 + h, p.y + 0.4 * v, 3 + h),
                ],
                10 if j % 2 else 11,
                owner,
              )
    elif kind == "fence":
      for line in parts(g.difference(gates), "LineString"):
        for dist in np.arange(0, line.length, 3):
          p = line.interpolate(dist)
          b = line.interpolate(min(line.length, dist + 3))
          yd, yn = site.y(p.x, p.y), site.y(p.x, p.y, True)
          site.post(p.x, p.y, 1.3, 0.09, owner)
          rail = LineString([p, b]).buffer(0.038, cap_style="flat")
          site.prism(rail, (yd + 0.88, yn + 0.88), (yd + 0.97, yn + 0.97), 8, owner)
    elif g.geom_type == "Point":
      x, z = g.x, g.y
      yd, yn = site.y(x, z), site.y(x, z, True)
      if kind == "bench":
        direction = t.get("direction", "")
        try:
          a = math.radians(float(direction))
        except ValueError:
          if not paths.is_empty:
            from shapely.ops import nearest_points

            near = nearest_points(g, paths)[1]
            a = math.atan2(near.x - x, -(near.y - z))
          else:
            a = 0
        dx, dz = 0.82 * math.cos(a), 0.82 * math.sin(a)
        seat = LineString([(x - dx, z - dz), (x + dx, z + dz)]).buffer(
          0.22, cap_style="flat"
        )
        site.prism(seat, (yd + 0.38, yn + 0.38), (yd + 0.49, yn + 0.49), 7, owner)
        for k in [-0.62, 0.62]:
          site.post(x + dx * k, z + dz * k, 0.42, 0.14, owner)
      elif kind == "board":
        site.post(x, z, 1.52, 0.12, owner, 6)
        site.prism(
          box(x - 0.48, z - 0.065, x + 0.48, z + 0.065),
          (yd + 0.94, yn + 0.94),
          (yd + 1.64, yn + 1.64),
          9,
          owner,
        )
      elif kind == "gate":
        # Flank the mapped opening, leaving its centre open.
        for d in (-1.25, 1.25):
          site.post(x + d, z, 1.12, 0.15, owner)
      elif kind in ("pole", "lamp"):
        site.post(x, z, 5 if kind == "pole" else 4, 0.15, owner)
      elif kind == "tree":
        site.post(x, z, 4, 0.32, owner, 6)
        site.prism(
          Point(x, z).buffer(2.0, quad_segs=2),
          (yd + 2.8, yn + 2.8),
          (yd + 6.4, yn + 6.4),
          15,
          owner,
        )


def beach_buildings(site, records):
  for row in records:
    ground = unary_union(
      [
        Polygon(
          [(x, z) for x, y, z in rr[0]], [[(x, z) for x, y, z in r] for r in rr[1:]]
        )
        for k, rr in row["parts"]
        if k == "GroundSurface"
      ]
    )
    ptr = ground.representative_point()
    tile = site.tile(ptr.x, ptr.y)
    ref = min(y for k, rings in row["parts"] for ring in rings for x, y, z in ring)
    datum = site.y(ptr.x, ptr.y)
    roof = []
    high = 0
    for kind, rings in row["parts"]:
      if kind == "GroundSurface":
        continue
      for t in triangulate(rings):
        points = [(x, y - ref + datum, z, y - ref + datum) for x, y, z in t]
        tile.triangle(points, 14 if kind == "RoofSurface" else 13, row["id"])
        if kind == "RoofSurface":
          high = max(high, max(y - ref for x, y, z in t))
          roof.append(
            [
              [round(x - tile.cx, 2), round(y - ref, 2), round(z - tile.cz, 2)]
              for x, y, z in t
            ]
          )
    for polygon in parts(ground, "Polygon"):
      rings = [
        [[round(x - tile.cx, 2), round(z - tile.cz, 2)] for x, z in r.coords]
        for r in [polygon.exterior, *polygon.interiors]
      ]
      tile.houses.append(
        dict(
          id=row["id"],
          base=round(datum, 2),
          height=round(high, 2),
          rings=rings,
          roof=roof,
        )
      )


def main():
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  index = []
  summary = {}
  for name, rows in source["survey"].items():
    site = Site(name, source["grids"].get(name))
    records = [(i, k, t, from_wkb(g)) for i, k, t, g in rows]
    if name in ("tegel", "reiherwerder"):
      site.shore = [Shore(source), Shore(source, True)]
    surfaces(site, records)
    bank = {}
    count = 0
    if name == "tegel":
      beach_buildings(site, source["beachBuildings"])
    if name == "forst":
      for x, z, h, r in source["forestCrownPeaks"]:
        tile = site.tile(x, z)
        tile.crowns.append(
          [
            round(x - tile.cx, 2),
            round(z - tile.cz, 2),
            h,
            r,
            round(forest_height(x, z, False), 2),
            round(forest_height(x, z, True), 2),
          ]
        )
        tile.owners.add("Berlin-bDOM/DGM1-382_5828")
    for (i, j), tile in sorted(site.tiles.items()):
      key = f"tegel-landscape-{name}-{i}_{j}"
      p = tile.payload()
      bank[key] = p
      count += len(tile.indices) // 3
      a = np.array(list(tile.vertices))
      canopy = tile.crowns
      bounds = [
        float(tile.cx + a[:, 0].min() / 100),
        float(tile.cz + a[:, 2].min() / 100),
        float(tile.cx + a[:, 0].max() / 100),
        float(tile.cz + a[:, 2].max() / 100),
      ]
      if canopy:
        bounds = [
          min(bounds[0], min(tile.cx + x - r for x, z, h, r, yd, yn in canopy)),
          min(bounds[1], min(tile.cz + z - r for x, z, h, r, yd, yn in canopy)),
          max(bounds[2], max(tile.cx + x + r for x, z, h, r, yd, yn in canopy)),
          max(bounds[3], max(tile.cz + z + r for x, z, h, r, yd, yn in canopy)),
        ]
      index.append({"id": key, "bounds": bounds, "bank": name})
    (DATA / f"tegelLandscapeV378-{name}.json").write_text(
      json.dumps(bank, separators=(",", ":")) + "\n"
    )
    summary[name] = [len(records), len(bank), count]
  (DATA / "tegelLandscapeHostsV378.json").write_text(
    json.dumps(index, separators=(",", ":")) + "\n"
  )
  print(summary)


if __name__ == "__main__":
  main()
