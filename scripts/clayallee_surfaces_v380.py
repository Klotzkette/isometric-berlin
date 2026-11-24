"""Fit the official Clayallee material fields and curb lines to each existing terrain mode."""

import base64
import gzip
import json
import math
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

import numpy as np
import shapely as sh
from shapely.geometry import Point, Polygon, box, shape

from scripts.build_windowless_buildings_v377 import encoded_mesh, packet

SOURCE = (
  Path(__file__).resolve().parents[1]
  / "geo_data/regierungsviertel/clayallee-strassenbefahrung-v380.json.gz"
)
# Berlin's material classes distinguish mosaics, paving, large slabs and mineral surfaces.
WALK = {
  "03": 0xA79F93,
  "04": 0xAAA99F,
  "07": 0xC1BBB1,
  "08": 0xB7AD9E,
  "09": 0xBAB7AC,
  "10": 0xB7B3A8,
  "13": 0xA89B85,
  "15": 0xA3A589,
}
CYCLE = {"07": 0xAC8277, "08": 0xAD8B7D, "02": 0x898785, "03": 0xA79B89}
PALETTE = {
  "ch_radweg": 0xAA9284,
  "bn_baumscheibe": 0x938674,
  "ce_gruenflaeche": 0x859367,
  "bd_bordstein": 0xBDB8AA,
  "bw_aufmerksamkeitsfeld": 0xD6D1C3,
}
LIFT = {
  "ce_gruenflaeche": 0.16,
  "cl_gehweg": 0.23,
  "ch_radweg": 0.25,
  "bn_baumscheibe": 0.27,
  "bd_bordstein": 0.31,
  "bw_aufmerksamkeitsfeld": 0.33,
}


class Terrain:
  def __init__(self, key, mode):
    data = packet("outer187-" + key, mode)
    footprints = []
    planes = []
    for m in data["meshes"]:
      if m["kind"] != "city":
        continue
      pos, idx = encoded_mesh(m)
      colors = np.frombuffer(base64.b64decode(m["colors"]), "u1").reshape(-1, 3)
      q = (
        pos[idx[(colors[idx[:, 0]] == [125, 131, 103]).all(axis=1)]].astype(float)
        * 0.01
        + data["origin"]
      )
      normals = np.cross(q[:, 1] - q[:, 0], q[:, 2] - q[:, 0])
      for tri, n in zip(q, normals):
        if abs(n[1]) < 0.02:
          continue
        footprints.append(Polygon(tri[:, [0, 2]]))
        planes.append((tri[0], n))
    self.tree = sh.STRtree(footprints)
    self.planes = planes
    self.base = data["nav"]["groundY"]

  @lru_cache(maxsize=36000)
  def y(self, x, z):
    ids = self.tree.query(Point(x, z), predicate="intersects")
    heights = [self.base]
    for i in ids:
      (u, h, v), n = self.planes[i]
      heights.append(h - ((x - u) * n[0] + (z - v) * n[2]) / n[1])
    return max(heights)


def add_clayallee(meshes, bounds):
  src = json.loads(gzip.decompress(SOURCE.read_bytes()))
  by_tile = defaultdict(list)
  for f in src["survey"]:
    kind = f["id"].split(".")[0]
    if kind not in LIFT:
      continue
    g = shape(f["geometry"])
    if kind == "bd_bordstein":
      g = g.buffer(
        0.105 if f["kerb"] == 1 else 0.078, cap_style="flat", join_style="mitre"
      )
    if g.is_empty:
      continue
    color = (
      WALK.get(f["material"], 0xB6AFA1)
      if kind == "cl_gehweg"
      else CYCLE.get(f["material"], PALETTE["ch_radweg"])
      if kind == "ch_radweg"
      else PALETTE[kind]
    )
    x0, z0, x1, z1 = g.bounds
    for ix in range(math.floor(x0 / 512), math.floor(x1 / 512) + 1):
      for iz in range(math.floor(z0 / 512), math.floor(z1 / 512) + 1):
        clipped = g.intersection(
          box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
        )
        for poly in sh.get_parts(clipped):
          if poly.geom_type == "Polygon" and poly.area > 0.015:
            by_tile[f"{ix}_{iz}"].append((poly, kind, color))
  for key, rows in by_tile.items():
    terrains = {
      mode: Terrain(key, family)
      for mode, family in [("drawn", "drawn"), ("native", "minecraft")]
    }
    for poly, kind, color in rows:
      x0, z0, x1, z1 = poly.bounds
      bounds[key].extend([(x0, z0), (x1, z1)])
      # Subdivide long faces before projecting them onto the existing relief.
      for ix in range(math.floor(x0 / 24), math.floor(x1 / 24) + 1):
        for iz in range(math.floor(z0 / 24), math.floor(z1 / 24) + 1):
          cut = poly.intersection(box(ix * 24, iz * 24, (ix + 1) * 24, (iz + 1) * 24))
          for tri in sh.get_parts(sh.constrained_delaunay_triangles(cut)):
            if tri.area < 0.003:
              continue
            pts = list(tri.exterior.coords)[:3]
            for mode, terrain in terrains.items():
              meshes[key, mode].face(
                [
                  (x, terrain.y(round(x, 3), round(z, 3)) + LIFT[kind], z)
                  for x, z in pts
                ],
                color,
              )
    for terrain in terrains.values():
      terrain.y.cache_clear()
