"""Two photograph-referenced memorials on exact mapped grave anchors.

Dimensions and orientation relative to mapped adjacent paths are estimates.
The contemporary Fontane double steles supersede the rejected 2005 photo,
not any source geometry. No photographic pixels or decorative artwork copied.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

from shapely.affinity import rotate, translate
from shapely.geometry import Point, box

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_karl_marx_allee_v161 import Detail
from build_sacred_places_v347 import APP, GEO, RAW, read, sha, write
from build_surrounding_outlines import PackedMesh

KIND = "named-graves-v347"
SITES = [
  dict(
    key="fontane",
    id="node/274785461",
    host="0_-5",
    name="Theodor und Emilie Fontane",
    yaw=-0.758,
    width=2.5,
    depth=2.8,
  ),
  dict(
    key="hoffmann",
    id="node/4893458668",
    host="2_5",
    name="E. T. A. Hoffmann",
    yaw=0.048,
    width=1.0,
    depth=2.2,
  ),
]


class Grave:
  def __init__(self, site, point, y, native):
    self.site, self.point, self.y, self.native = site, point, y, native
    self.detail, self.solids = Detail(), []
    self.c, self.s = math.cos(site["yaw"]), math.sin(site["yaw"])

  def xyz(self, u, y, v):
    return [
      self.point[0] + self.c * u - self.s * v,
      self.y + y,
      self.point[1] + self.s * u + self.c * v,
    ]

  def cuboid(self, u, y, v, w, h, d, color, solid=False):
    center = self.xyz(u, y, v)
    if self.native:
      poly = translate(
        rotate(box(-w / 2, -d / 2, w / 2, d / 2), math.degrees(self.site["yaw"])),
        center[0],
        center[2],
      )
      step = 0.07 if max(w, d) > 0.35 else 0.035
      x0, z0, x1, z1 = poly.bounds
      cells = []
      for zi in range(math.floor(z0 / step), math.ceil(z1 / step)):
        run = None
        for xi in range(math.floor(x0 / step), math.ceil(x1 / step) + 1):
          inside = poly.covers(Point((xi + 0.5) * step, (zi + 0.5) * step))
          if inside and run is None:
            run = xi
          if not inside and run is not None:
            self.detail.box(
              [(run + xi) * step / 2, center[1], (zi + 0.5) * step],
              [(xi - run) * step, h, step],
              color,
              "native-cell-run",
            )
            cell = box(run * step, zi * step, xi * step, (zi + 1) * step)
            cells.append(cell)
            if solid:
              self.solids.append((cell, self.y + y - h / 2, self.y + y + h / 2))
            run = None
      if not cells:
        self.detail.box(center, [0.035, h, 0.035], color, "native-fine-member")
        if solid:
          self.solids.append(
            (
              box(
                center[0] - 0.0175,
                center[2] - 0.0175,
                center[0] + 0.0175,
                center[2] + 0.0175,
              ),
              self.y + y - h / 2,
              self.y + y + h / 2,
            )
          )
    else:
      temp = Detail()
      temp.box([u, y, v], [w, h, d], color, "member")
      for tri, c, role in temp.triangles:
        self.detail.triangles.append(([self.xyz(*p) for p in tri], c, role))
    if solid and not self.native:
      poly = translate(
        rotate(box(-w / 2, -d / 2, w / 2, d / 2), math.degrees(self.site["yaw"])),
        center[0],
        center[2],
      )
      self.solids.append((poly, self.y + y - h / 2, self.y + y + h / 2))

  def beam(self, a, b, width, color):
    length = math.dist(a, b)
    n = max(1, math.ceil(length / (0.035 if self.native else 0.05)))
    for i in range(n):
      p = [a[j] + (b[j] - a[j]) * (i + 0.5) / n for j in range(3)]
      self.cuboid(*p, width, width, width, color)

  def stone(self, u, v, w, h, d, color):
    # Segment the shallow arch only; vertical sides and the original anchor stay.
    shoulder = h - 0.16
    self.cuboid(u, shoulder / 2, v, w, shoulder, d, color, True)
    for i in range(10):
      a = (i + 0.5) / 10
      width = w * math.sqrt(max(0, 1 - a * a))
      self.cuboid(u, shoulder + 0.16 * a, v, width, 0.0165, d, color, True)

  def build(self):
    w, d = self.site["width"], self.site["depth"]
    green = (69, 96, 64)
    stone = (143, 139, 128)
    dark = (34, 39, 43)
    self.cuboid(0, 0.055, 0, w, 0.11, d, (86, 104, 67))
    # Sparse foliage geometry inside the photographed ivy-covered grave plot.
    for j in range(10):
      for i in range(7):
        u = -w * 0.43 + i * w * 0.86 / 6
        v = -d * 0.43 + j * d * 0.86 / 9
        self.cuboid(u, 0.12 + 0.02 * ((i + j) % 3), v, 0.12, 0.055, 0.13, green)
    if self.site["key"] == "hoffmann":
      self.stone(0, -d / 2 + 0.12, 0.78, 1.72, 0.13, stone)
    else:
      for u in [-0.56, 0.56]:
        self.stone(u, -d / 2 + 0.2, 0.93, 1.35, 0.13, (30, 33, 32))
      posts = [
        (-w / 2, -d / 2),
        (0, -d / 2),
        (w / 2, -d / 2),
        (-w / 2, 0),
        (w / 2, 0),
        (-w / 2, d / 2),
        (0, d / 2),
        (w / 2, d / 2),
      ]
      for u, v in posts:
        self.cuboid(u, 0.43, v, 0.095, 0.86, 0.095, dark, True)
        for y, width, height in [
          (0.08, 0.20, 0.10),
          (0.28, 0.15, 0.12),
          (0.65, 0.15, 0.12),
          (0.84, 0.19, 0.06),
          (0.91, 0.12, 0.07),
        ]:
          self.cuboid(u, y, v, width, height, width, dark)
      # The two original chain courses sag between the evidenced perimeter posts.
      for a, b in [
        (posts[0], posts[1]),
        (posts[1], posts[2]),
        (posts[2], posts[4]),
        (posts[4], posts[7]),
        (posts[7], posts[6]),
        (posts[6], posts[5]),
        (posts[5], posts[3]),
        (posts[3], posts[0]),
      ]:
        for base in [0.38, 0.69]:
          for k in range(10):
            points = []
            for t in [k / 10, (k + 1) / 10]:
              points.append(
                [
                  a[0] + (b[0] - a[0]) * t,
                  base - 0.12 * math.sin(math.pi * t),
                  a[1] + (b[1] - a[1]) * t,
                ]
              )
            self.beam(*points, 0.028, dark)
    return self


def extract():
  inventory = read(GEO / "sacred-places-v347-inventory.json.gz")
  sites = []
  for site in SITES:
    record = next(r for r in inventory["details"] if r["id"] == site["id"])
    sites.append(dict(**site, anchor=record["geometry"]["coordinates"], record=record))
  return dict(
    schemaVersion=1,
    baseline="84d3c452",
    retrieved="2026-11-15",
    sites=sites,
    sources=[
      dict(
        file="hoffmann.jpg",
        sha256=sha(RAW / "hoffmann.jpg"),
        page="https://commons.wikimedia.org/wiki/File:Grab_E._T._A._Hoffmann.jpg",
        author="Harvey Kneeslapper",
        date="2023-05-05",
        license="CC BY-SA 4.0",
        use="External visual reference only; no source pixels distributed",
      ),
      dict(
        file="fontane-current.webp",
        sha256=sha(RAW / "fontane-current.webp"),
        page="https://www.visitberlin.de/de/event/dauerausstellung-am-theodor-fontane-grab",
        author="visitBerlin / Nele Niederstadt",
        license="Reference only; no redistribution licence asserted",
        use="Two contemporary black granite steles and chained ornate perimeter; photograph not distributed",
      ),
    ],
    rejectedHistoricalReference="2005 single shared Fontane stone is not the current arrangement",
    estimates=[
      "width/depth/height",
      "orientation inferred from nearby mapped path, not a survey",
      "ivy coverage and exact chain ornament simplified",
      "no copied letterforms or photography",
    ],
  )


def compile_models(source):
  sites, reports = [], []
  for site in source["sites"]:
    models = {}
    for mode in ["drawn", "minecraft"]:
      model = Grave(site, [0, 0], 0, mode == "minecraft").build()
      mesh = PackedMesh(-4, -4)
      for tri, color, _ in model.detail.triangles:
        mesh.triangle(tri, color)
      solids = []
      for polygon, lo, hi in model.solids:
        ring = [
          [round(x, 2), round(z, 2)] for x, z in list(polygon.exterior.coords)[:-1]
        ]
        solids.append(dict(ring=ring, low=round(lo, 2), high=round(hi, 2)))
      payload = mesh.payload(KIND)
      assert len(mesh.vertices) < 30000 and len(mesh.indices) < 120000
      vertices = list(mesh.vertices)
      bounds = [
        round(min(p[0] for p in vertices) * 0.01 - 4, 2),
        round(min(p[2] for p in vertices) * 0.01 - 4, 2),
        round(max(p[0] for p in vertices) * 0.01 - 4, 2),
        round(max(p[2] for p in vertices) * 0.01 - 4, 2),
      ]
      models[mode] = dict(mesh=payload, solids=solids, bounds=bounds)
      reports.append(
        dict(
          site=site["key"],
          mode=mode,
          anchor=site["anchor"],
          vertices=len(mesh.vertices),
          triangles=len(mesh.indices) // 3,
          solids=len(solids),
        )
      )
    sites.append(
      dict(
        key=site["key"],
        id=site["id"],
        name=site["name"],
        anchor=site["anchor"],
        models=models,
      )
    )
  return dict(schemaVersion=1, origin=[-4, -10, -4], sites=sites), dict(
    schemaVersion=1,
    models=reports,
    sources=source["sources"],
    estimates=source["estimates"],
    rejectedHistoricalReference=source["rejectedHistoricalReference"],
    groundPolicy="Source-bound visible Core ground is sampled at anchor and every plot rim/corner before display; no invented static altitude. Missing, wet, obstructed or inconsistent support rejects the whole site. Geometry and exact admitted solids share one bounded lazy lifetime.",
  )


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  sourcepath = GEO / "named-graves-v347-source.json.gz"
  if args.extract:
    write(sourcepath, extract())
  data, evidence = compile_models(read(sourcepath))
  for path, value in [
    (APP / "namedGravesV347.json", data),
    (GEO / "named-graves-v347-evidence.json", evidence),
  ]:
    if args.check:
      if read(path) != json.loads(json.dumps(value)):
        raise ValueError("Non-reproducible derivative: " + str(path))
    else:
      write(path, value)
  print(json.dumps(evidence["models"]))


if __name__ == "__main__":
  main()
