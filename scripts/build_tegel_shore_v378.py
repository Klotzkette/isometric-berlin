"""Reshape the v194 shore only inside the matched, surveyed Tegel beach polygons."""

import base64
import gzip
import json
import math
from pathlib import Path

import numpy as np
from shapely import constrained_delaunay_triangles, from_wkb
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
WATER = -1.15


def polygons(g):
  if g.is_empty:
    return
  if g.geom_type == "Polygon":
    yield g
  elif hasattr(g, "geoms"):
    for item in g.geoms:
      yield from polygons(item)


class Shore:
  def __init__(self, source, native=False):
    mode = "native" if native else "drawn"
    old = json.loads((DATA / "westLakesV194Navigation.json").read_bytes())[mode]
    rings = next(item for item in old if item["key"] == "tegel-water")["polygons"]
    self.water = unary_union([Polygon(r[0], r[1:]) for r in rings])
    self.beaches = []
    for site in ["tegel", "reiherwerder"]:
      for _, k, _, wkb in source["survey"][site]:
        if k != "sand":
          continue
        polygon = from_wkb(wkb)
        # Inland and lateral boundaries meet the old dry terrain at its
        # original height; the water-facing boundary meets the real lake.
        sides = polygon.boundary.difference(self.water.buffer(2.0))
        self.beaches.append((polygon, polygon.buffer(0.11), sides))
    self.area = unary_union([r[0] for r in self.beaches])
    self.coast = self.area.buffer(0.12)

  def height(self, x, z, dry):
    p = Point(x, z)
    for poly, covered, sides in self.beaches:
      if not covered.covers(p):
        continue
      distance = self.water.distance(p)
      alpha = max(
        min(1.0, distance / 22.0),
        max(0.0, 1.0 - sides.distance(p) / 4.0) if not sides.is_empty else 0.0,
      )
      return WATER + (dry - WATER) * alpha
    return dry


def main():
  source = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/tegel-landscape-source-v378.json.gz"
      ).read_bytes()
    )
  )
  plans = {}
  for native in (False, True):
    mode = "native" if native else "drawn"
    sc = Shore(source, native)
    f = "westLakesV194Native" if native else "westLakesV194"
    site = next(
      s
      for s in json.loads((DATA / (f + ".json")).read_bytes())["sites"]
      if s["key"] == "tegel-water"
    )
    pos = np.asarray(site["positions"]).reshape(-1, 3)
    idx = np.asarray(site["indices"]).reshape(-1, 3)
    drop = []
    vert = {}
    tri = []

    def add(points, c):
      for x, y, z in points:
        key = (round((x + 8192) * 100), round(y * 100), round((z + 7168) * 100), c)
        tri.append(vert.setdefault(key, len(vert)))

    for i, ids in enumerate(idx):
      p = pos[ids]
      color = site["colors"][ids[0]]
      xz = p[:, [0, 2]]
      if np.max(p[:, 1]) < 2.9:
        continue  # Every water-surface index remains.
      if np.ptp(p[:, 1]) < 0.03:
        shape = Polygon(xz)
        if shape.area < 1e-7 or not shape.intersects(sc.area):
          continue
        overlap = shape.intersection(sc.area)
        if overlap.area < 0.002:
          continue
        drop.append(i)
        for poly in polygons(shape.difference(overlap)):
          for t in constrained_delaunay_triangles(poly).geoms:
            add([(x, 3.01, z) for x, z in list(t.exterior.coords)[:3]], color)
        for poly in polygons(overlap):
          x0, z0, x1, z1 = poly.bounds
          for ix in range(math.floor(x0 / 8), math.ceil(x1 / 8)):
            for iz in range(math.floor(z0 / 8), math.ceil(z1 / 8)):
              for face in polygons(
                poly.intersection(box(ix * 8, iz * 8, ix * 8 + 8, iz * 8 + 8))
              ):
                if face.area < 0.0003:
                  continue
                for t in constrained_delaunay_triangles(face).geoms:
                  add(
                    [
                      (x, sc.height(x, z, 3.01) - 0.055, z)
                      for x, z in list(t.exterior.coords)[:3]
                    ],
                    0xC7B284,
                  )
        continue
      # Parameterize a vertical original bank triangle by distance and
      # height. Split only the part touching the beach, including both
      # original triangle halves, so the adjacent bank stays closed.
      ia, ib = max(
        [(a, b) for a in range(3) for b in range(a + 1, 3)],
        key=lambda ab: np.linalg.norm(xz[ab[1]] - xz[ab[0]]),
      )
      a, b = xz[ia], xz[ib]
      length = np.linalg.norm(b - a)
      if length < 0.01:
        continue
      axis = (b - a) / length
      line = LineString([a, b])
      if line.distance(sc.area) > 0.10:
        continue
      cut = line.intersection(sc.coast)
      intervals = []
      for part in [cut] if cut.geom_type == "LineString" else getattr(cut, "geoms", []):
        if part.geom_type == "LineString" and part.length > 0.015:
          edges = [line.project(Point(v)) for v in [part.coords[0], part.coords[-1]]]
          intervals.append(sorted(edges))
      if not intervals:
        continue
      uv = Polygon([(float((v - a) @ axis), h) for v, h in zip(xz, p[:, 1])])
      if uv.area < 0.001:
        continue
      drop.append(i)
      cuts = sorted(
        {0.0, float(length), *[round(v, 8) for pair in intervals for v in pair]}
      )
      for start, end in zip(cuts, cuts[1:]):
        if end - start < 0.005:
          continue
        covered = any(lo <= (start + end) / 2 <= hi for lo, hi in intervals)
        clip = uv.intersection(box(start, -8, end, 8))
        for poly in polygons(clip):
          for t in constrained_delaunay_triangles(poly).geoms:
            xyz = []
            for u, y in list(t.exterior.coords)[:3]:
              x, z = a + u * axis
              hy = (
                WATER + (y - WATER) * (sc.height(x, z, 3.0) - WATER) / (3.0 - WATER)
                if covered
                else y
              )
              xyz.append((x, hy, z))
            add(xyz, 0xC7B284 if covered else color)
    assert max(tri) < 65536
    v = list(vert)
    palette = sorted(set(p[3] for p in v))

    def enc(values, dtype):
      return base64.b64encode(np.asarray(values, dtype=dtype).tobytes()).decode()

    plans[mode] = {
      "drop": enc(drop, "<u4"),
      "points": enc([p[:3] for p in v], "<i4"),
      "tint": enc([palette.index(p[3]) for p in v], "u1"),
      "palette": palette,
      "indices": enc(tri, "<u2"),
    }
    print(mode, len(drop), len(v), len(tri) // 3)
  (DATA / "tegelLandscapeShoreV378.json").write_text(
    json.dumps(plans, separators=(",", ":")) + "\n"
  )


if __name__ == "__main__":
  main()
