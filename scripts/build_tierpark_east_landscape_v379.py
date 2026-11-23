"""Compile DGM relief, canopy maxima and mapped timber decks into local stream packets."""

from __future__ import annotations

import gzip
import json
import math
from collections import defaultdict
from functools import lru_cache

import numpy as np
from shapely.geometry import LineString, Point, box, shape

from scripts.build_tierpark_east_v379 import (
  DATA,
  GEO,
  SOURCE,
  Mesh,
  encoded,
  grids,
  tile_of,
  triangles,
  write,
)

CANOPY = "Tierpark Friedrichsfelde · vermessene Baumkronen"
DECK = "Tierpark Friedrichsfelde · Giraffenpfad und Holzstege"
HILLS = "Tierpark Friedrichsfelde · Geländerelief der Tieranlagen"
FOLDER = DATA / "tierparkEastV379Landscape"
TIMBER = (150, 125, 93)
OAK = (98, 83, 64)
ROPE = (92, 95, 88)


def generate():
  source = json.load(gzip.open(SOURCE))
  habitats = json.loads((DATA / "zooAnimalsV282.json").read_text())["habitats"]
  moving = {h["sourceId"] for h in habitats if h["siteId"] == "tierpark"}
  layers = {}
  floors = defaultdict(list)
  solids = defaultdict(list)
  hills = []
  height_at = []
  bridges = []

  def layer(tile, native, name):
    key = (tile, native, name)
    if key not in layers:
      mesh = Mesh(tile)
      # Give the crown and roof rims of seam trees a local signed margin.
      mesh.origin += np.array([-10, 0, -10])
      layers[key] = mesh
    return layers[key]

  for row in source["hills"]:
    values = np.array(row["samples"])
    lo = float(np.percentile(values[:, 2], 4.0))
    if np.ptp(values[:, 2]) < 2.6 or row["id"] in moving:
      continue
    geom = shape(row["land"])
    grid = {(int(x), int(z)): (h, r, g, b) for x, z, h, r, g, b in values}

    def surface_for(poly, points, datum):
      @lru_cache(maxsize=45000)
      def surface(x, z):
        p = Point(x, z)
        gx = 4 * math.floor(x / 4)
        gz = 4 * math.floor(z / 4)
        tx = (x - gx) / 4
        tz = (z - gz) / 4
        weights = [
          (p, w)
          for p, w in [
            ((gx, gz), (1 - tx) * (1 - tz)),
            ((gx + 4, gz), tx * (1 - tz)),
            ((gx, gz + 4), (1 - tx) * tz),
            ((gx + 4, gz + 4), tx * tz),
          ]
          if p in points
        ]
        if not weights:
          return 3.08
        nhn = sum(points[q][0] * w for q, w in weights) / max(
          0.0001, sum(w for _, w in weights)
        )
        # Blend to the historic park's flat path datum at the enclosure
        # edge. Interior gradients remain those measured in the DGM.
        taper = min(1.0, poly.boundary.distance(p) / 6.0)
        return round(3.09 + max(0, nhn - datum) * taper, 2)

      return surface

    height = surface_for(geom, grid, lo)
    height_at.append((geom, height))
    hills.append(
      {
        "id": row["id"],
        "name": row["name"],
        "areaM2": round(geom.area),
        "rangeNHN": [float(values[:, 2].min()), float(values[:, 2].max())],
      }
    )
    for x, z in grids(geom, 4):
      piece = geom.intersection(box(x, z, x + 4, z + 4))
      if piece.is_empty or piece.area < 0.05:
        continue
      tx, tz = x + 2, z + 2
      # Diffuse hillside tone follows the measured slope under northwest
      # daylight. The source is leaf-off photography; tree shadows are
      # not areas of bare brown soil.
      sx = (height(tx + 2, tz) - height(tx - 2, tz)) / 4
      sz = (height(tx, tz + 2) - height(tx, tz - 2)) / 4
      light = max(0.76, min(1.13, 1.0 + 0.16 * sx + 0.12 * sz))
      paint = tuple(round(v * light) for v in (119, 139, 92))
      m = layer(tile_of(tx, tz), False, HILLS)
      for tri in triangles(piece):
        m.tri(*[(a, height(round(a, 2), round(b, 2)), b) for a, b in tri], paint)
      if not geom.covers(Point(tx, tz)):
        continue
      # Native tiles use their own cardinal top and visible risers.
      up = 3.09 + round((height(tx, tz) - 3.09) * 2) / 2
      m = layer(tile_of(tx, tz), True, HILLS)
      m.quad((x, up, z), (x + 4, up, z), (x + 4, up, z + 4), (x, up, z + 4), paint)
      for dx, dz, a, b in [
        (-4, 0, (x, z), (x, z + 4)),
        (4, 0, (x + 4, z + 4), (x + 4, z)),
        (0, -4, (x + 4, z), (x, z)),
        (0, 4, (x, z + 4), (x + 4, z + 4)),
      ]:
        below = (
          3.09 + round((height(tx + dx, tz + dz) - 3.09) * 2) / 2
          if geom.covers(Point(tx + dx, tz + dz))
          else 3.0
        )
        if below < up:
          m.quad(
            (a[0], up, a[1]),
            (b[0], up, b[1]),
            (b[0], below, b[1]),
            (a[0], below, a[1]),
            paint,
          )

  for i, (x, z, h, r) in enumerate(source["trees"]):
    y = next(
      (height(x, z) for geom, height in height_at if geom.covers(Point(x, z))), 3.0
    )
    for native in (True, False):
      m = layer(tile_of(x, z), native, CANOPY)
      bark = (100, 84, 64)
      m.box(x, y + h * 0.33, z, 0.25 + h * 0.011, h * 0.66, 0.25 + h * 0.011, bark)
      for j in range(3):
        angle = i * 2.4 + j * 2.094
        cx = x + (math.cos(angle) * r * 0.49 if j else 0)
        cz = z + (math.sin(angle) * r * 0.49 if j else 0)
        radius = r * (0.74 if j else 0.8)
        cy = y + h * (0.68 if j else 0.77)
        ry = h * (0.20 if j else 0.23)
        col = [(94, 124, 75), (77, 106, 66), (111, 132, 83)][(i + j) % 3]
        if native:
          m.box(cx, cy, cz, radius * 1.66, ry * 1.55, radius * 1.66, col)
          continue
        ring = [
          (
            cx + radius * math.cos(a * math.pi / 3),
            cy - 0.08 * ry,
            cz + radius * math.sin(a * math.pi / 3),
          )
          for a in range(6)
        ]
        small = [
          (cx + (p[0] - cx) * 0.72, cy + ry * 0.65, cz + (p[2] - cz) * 0.72)
          for p in ring
        ]
        for k in range(6):
          n = (k + 1) % 6
          m.tri((cx, cy - ry, cz), ring[n], ring[k], col)
          m.quad(ring[k], ring[n], small[n], small[k], col)
          m.tri(small[k], small[n], (cx, cy + ry, cz), col)

  for feature in source["features"]:
    line = shape(feature["geometry"])
    if not isinstance(line, LineString):
      continue
    suspension = feature["id"] == "way/1307063504"
    giraffe = feature["id"] in {"way/21780020", "way/1307063504"}
    if not giraffe and feature["id"] != "way/1127998058":
      continue
    feature["id"] == "way/21780020"
    lengths = [0.0]
    coords = np.asarray(line.coords)
    for p, q in zip(coords, coords[1:]):
      lengths.append(lengths[-1] + np.linalg.norm(q - p))
    width = 1.3 if suspension else 2.15
    if not giraffe:
      width = 1.55

    def elevation(s):
      if suspension:
        return 7.04 - 0.36 * math.sin(s / line.length * math.pi)
      if giraffe:
        return 3.16 + 3.88 * min(1.0, s / 30.0, (line.length - s) / 38.0)
      return 3.15 + 0.49 * min(1.0, s / 3.0, (line.length - s) / 3.0)

    count = 0
    for si, (aa, bb) in enumerate(zip(coords, coords[1:])):
      v = bb - aa
      L = np.linalg.norm(v)
      n = math.ceil(L / 1.4)
      normal = np.array([-v[1], v[0]]) / L * width * 0.5
      for j in range(n):
        p = aa + v * j / n
        q = aa + v * (j + 1) / n
        s = lengths[si] + L * j / n
        t = lengths[si] + L * (j + 1) / n
        a, b = round(elevation(s), 2), round(elevation(t), 2)
        middle = (p + q) / 2
        tile = tile_of(*middle)
        p1, p2, q1, q2 = p - normal, p + normal, q - normal, q + normal
        for native in (False, True):
          m = layer(tile, native, DECK)
          u = round((a + b) * 2) / 4 if native else a
          w = u if native else b

          def pt(v, h):
            return (v[0], h, v[1])

          col = tuple(c + ((si + j) % 3) * 4 for c in TIMBER)
          if native:
            m.box(
              middle[0],
              u - 0.10,
              middle[1],
              max(abs(q[0] - p[0]), abs(normal[0]) * 2),
              0.20,
              max(abs(q[1] - p[1]), abs(normal[1]) * 2),
              col,
            )
          else:
            m.quad(pt(p1, u), pt(q1, w), pt(q2, w), pt(p2, u), col)
          for side in [-1, 1]:
            c, d = p + normal * side, q + normal * side
            m.beam(
              pt(c, u + 1.05),
              pt(d, w + 1.05),
              0.075,
              ROPE if suspension else OAK,
              native=native,
            )
            m.beam(pt(c, u + 0.52), pt(d, w + 0.52), 0.06, ROPE, native=native)
            if j % 3 == 0:
              m.beam(pt(c, u), pt(c, u + 1.10), 0.105, OAK, native=native)
            if count % 5 == 0 and not suspension and u > 3.45:
              m.beam(pt(c, 3.0), pt(c, u), 0.24, OAK, native=native)
          origin = np.array(
            [math.floor(middle[0] / 512) * 512, math.floor(middle[1] / 512) * 512]
          )
          ring = [np.round(k - origin, 3).tolist() for k in (p1, q1, q2, p2, p1)]
          floors[tile, native].append(
            dict(ring=ring, holes=[], y=round((u + w) / 2, 3))
          )
        count += 1
    bridges.append([feature["id"], round(line.length, 2), count])
  FOLDER.mkdir(parents=True, exist_ok=True)
  index = set()
  for tile, native, name in layers:
    index.add(tile)
  for tile in sorted(index):
    for native in (False, True):
      parts = []
      for name in [DECK, HILLS, CANOPY]:
        m = layers.get((tile, native, name))
        if not m or not m.indices:
          continue
        assert len(m.positions) < 65535
        parts.append(
          dict(
            name=name,
            origin=m.origin.tolist(),
            positions=encoded(m.positions, "<u2"),
            colors=encoded(m.colors, "u1"),
            indices=encoded(m.indices, "<u2"),
          )
        )
      origin = Mesh(tile).origin.tolist()
      write(
        FOLDER / (("minecraft_" if native else "drawn_") + tile + ".json"),
        dict(
          origin=origin,
          parts=parts,
          floors=floors[tile, native],
          solids=solids[tile, native],
        ),
      )
  write(DATA / "tierparkEastV379LandscapeIndex.json", sorted(index))
  write(
    GEO / "tierpark-east-v379-landscape.json",
    dict(terrain=hills, trees=len(source["trees"]), boardwalks=bridges),
  )
  print("Terrain", hills, "trees", len(source["trees"]), "decks", bridges, flush=True)


if __name__ == "__main__":
  generate()
