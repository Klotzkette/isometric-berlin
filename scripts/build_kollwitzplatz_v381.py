"""Bake the individually surveyed plaza surfaces, canopies and play sites at Kollwitzplatz."""

import gzip
import json
import math
from pathlib import Path

import numpy as np
import shapely as sh
from shapely.geometry import LineString, shape

from scripts.build_kreuzberg_plaetze_v380 import Mesh, polygons, trees

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/kollwitzplatz-v381.json.gz"
DATA = ROOT / "src/app/src/data/kollwitzplatzV381"
FLOOR = 3.20
TIMBER = (148, 117, 77)
IRON = (84, 96, 88)
GREEN = (70, 114, 77)


class Frame:
  def __init__(self, mesh, center, heading):
    self.m = mesh
    self.a = np.array(center)
    self.v = np.array(heading) / np.linalg.norm(heading)
    self.u = np.array([self.v[1], -self.v[0]])

  def xyz(self, x, y, z):
    p = self.a + self.u * x + self.v * z
    return (p[0], FLOOR + y, p[1])

  def face(self, p, color):
    self.m.face([self.xyz(*t) for t in p], color)

  def cuboid(self, x, y, z, w, h, d, c):
    low = y - h / 2
    high = y + h / 2
    ring = [
      (x - w / 2, z - d / 2),
      (x + w / 2, z - d / 2),
      (x + w / 2, z + d / 2),
      (x - w / 2, z + d / 2),
    ]
    self.face([(u, high, v) for u, v in ring], c)
    for i in range(4):
      a, b = ring[i], ring[(i + 1) % 4]
      self.face(
        [(a[0], low, a[1]), (b[0], low, b[1]), (b[0], high, b[1]), (a[0], high, a[1])],
        np.array(c) * (0.88 + 0.04 * (i % 2)),
      )

  def rod(self, a, b, r, c, sides=5):
    self.m.rod(self.xyz(*a), self.xyz(*b), r, c, sides)


def playhouse(f):
  for x in (-0.71, 0.71):
    for z in (-0.71, 0.71):
      f.rod((x, 0, z), (x, 2.55, z), 0.076, GREEN, 6)
  f.cuboid(0, 0.81, 0, 1.54, 0.15, 1.54, TIMBER)
  for side in [-1, 1]:
    f.cuboid(side * 0.73, 1.22, 0, 0.085, 0.7, 1.44, (168, 139, 95))
    f.cuboid(side * 0.73, 1.72, 0, 0.085, 0.29, 0.53, (173, 146, 98))
  corners = [
    (-0.98, 2.5, -0.98),
    (0.98, 2.5, -0.98),
    (0.98, 2.5, 0.98),
    (-0.98, 2.5, 0.98),
  ]
  for i, first in enumerate(corners):
    f.face(
      [first, corners[(i + 1) % 4], (0, 2.89, 0.08)],
      np.array((138, 148, 100)) * (0.85 + 0.055 * i),
    )


def playgrounds(mesh, source):
  pos = source["play"]
  a, b = np.array(pos["centralRoofs"])
  heading = (b - a) / np.linalg.norm(b - a)
  left = Frame(mesh, a, heading)
  right = Frame(mesh, b, heading)
  playhouse(left)
  playhouse(right)
  length = np.linalg.norm(b - a)
  for t in np.linspace(0.8, length - 0.8, 14):
    left.cuboid(0, 0.81, t, 0.86, 0.09, 0.19, (162, 137, 87))
  for side in (-1, 1):
    left.rod((side * 0.48, 1.36, 0.72), (side * 0.48, 1.36, length - 0.72), 0.034, IRON)
    for z in np.linspace(0.76, length - 0.76, 8):
      left.rod((side * 0.48, 0.83, z), (side * 0.48, 1.36, z), 0.019, IRON)
  for x in (-0.31, 0.31):
    right.rod((x, 0.12, 3.05), (x, 1.01, 0.69), 0.067, (191, 164, 81))
  right.face(
    [(-0.27, 0.84, 0.71), (0.27, 0.84, 0.71), (0.27, 0.08, 3.04), (-0.27, 0.08, 3.04)],
    (175, 177, 162),
  )
  left.cuboid(0, 0.15, -1.6, 1.02, 0.11, 1.8, (168, 145, 96))
  for x in [-0.48, 0.48]:
    left.rod((x, 0.85, -0.78), (x, 0.27, -2.55), 0.047, TIMBER)
  for n, z in enumerate(np.linspace(-0.87, -2.45, 8)):
    left.cuboid(0, 0.69 - n * 0.075, z, 0.95, 0.08, 0.2, TIMBER)
  kitchen = Frame(mesh, pos["kitchen"], [0.83, 0.55])
  for x in [-0.73, 0.73]:
    kitchen.rod((x, 0, 0), (x, 1.85, 0), 0.069, GREEN)
  kitchen.cuboid(0, 0.60, 0, 1.58, 0.11, 0.59, TIMBER)
  kitchen.cuboid(0, 1.74, 0, 1.78, 0.22, 0.34, (141, 139, 81))
  for dx in [-0.28, 0.16]:
    kitchen.cuboid(dx, 0.672, 0, 0.27, 0.028, 0.23, (96, 104, 91))
  # Footprint of the elongated wooden train is legible in the north sand area.
  front, tail = np.array(pos["railwayAxis"])
  train = Frame(mesh, front, tail - front)
  for z in [0.05, 1.94, 3.77, 5.42]:
    train.cuboid(0, 0.31, z, 0.88, 0.22, 1.36, TIMBER)
    train.cuboid(0, 0.58, z + 0.25, 0.69, 0.24, 0.38, (140, 120, 81))
    for side in [-1, 1]:
      for u in (-0.37, 0.36):
        train.rod(
          (side * 0.41, 0.19, z + u), (side * 0.49, 0.19, z + u), 0.17, (90, 91, 66), 8
        )
  train.rod((0, 0.67, -0.62), (0, 0.67, 0.34), 0.31, GREEN, 8)
  train.rod((0, 0.77, -0.36), (0, 1.12, -0.36), 0.09, (94, 99, 74), 7)
  for x in [-0.34, 0.34]:
    train.rod((x, 0.65, 0.49), (x, 1.43, 0.49), 0.056, TIMBER)
  train.cuboid(0, 1.43, 0.45, 0.99, 0.11, 0.76, (98, 113, 76))
  for _, p in source["tables"]:
    tab = Frame(mesh, p, pos["tableDirection"])
    tab.cuboid(0, 0.755, 0, 1.525, 0.09, 2.74, (77, 126, 100))
    tab.cuboid(0, 0.864, 0, 1.56, 0.15, 0.038, (191, 194, 178))
    for x in [-0.745, 0.745]:
      tab.cuboid(x, 0.807, 0, 0.027, 0.012, 2.73, (208, 208, 185))
    tab.cuboid(0, 0.808, 0, 0.021, 0.012, 2.71, (197, 200, 181))
    for z in [-0.72, 0.72]:
      tab.cuboid(0, 0.36, z, 0.78, 0.72, 0.25, (142, 145, 130))
  a, b = np.asarray(pos["southernSlackline"])
  f = Frame(mesh, a, b - a)
  span = np.linalg.norm(b - a)
  for z in [0, span]:
    f.rod((0, 0, z), (0, 0.65, z), 0.092, TIMBER, 6)
  f.face(
    [
      (-0.033, 0.42, 0),
      (0.033, 0.42, 0),
      (0.033, 0.35, span / 2),
      (-0.033, 0.35, span / 2),
    ],
    (155, 109, 75),
  )
  f.face(
    [
      (-0.033, 0.35, span / 2),
      (0.033, 0.35, span / 2),
      (0.033, 0.42, span),
      (-0.033, 0.42, span),
    ],
    (155, 109, 75),
  )
  for a, b in np.array(source["middleBenches"]):
    bench = Frame(mesh, (a + b) / 2, [b[1] - a[1], a[0] - b[0]])
    w = np.linalg.norm(b - a)
    for z in [-0.17, 0, 0.17]:
      bench.cuboid(0, 0.45, z, w, 0.058, 0.13, (154, 91, 77))
    for x in [-0.35 * w, 0.35 * w]:
      bench.cuboid(x, 0.22, 0, 0.1, 0.44, 0.42, IRON)
    for y in [0.67, 0.84]:
      bench.cuboid(0, y, -0.22, w, 0.12, 0.06, (153, 91, 76))


def park_floor(mesh, source):
  region = shape(source["park"])
  # Clip both families to the same footprint outside the retained southern kiosk.
  kiosk = sh.union_all([shape(p) for p in source["sourceBuilding"].values()])
  region = region.difference(kiosk.buffer(0.03))
  rows = [(r["kind"], shape(r["g"]), r) for r in source["features"]]
  layers = []
  for kind, g, row in rows:
    if kind == "path":
      w = source["pathWidths"][row["id"]]
      g = g.buffer(w / 2, cap_style="round", join_style="round", quad_segs=5)
      tone = {
        "compacted": (186, 169, 140),
        "sett": (165, 157, 140),
        "paving_stones": (192, 185, 165),
      }[row["surface"]]
      layers.append((g, tone))
  layers.extend((shape(g), (193, 187, 174)) for _, g in source["walkEdges"])
  layers.extend((g, (194, 189, 173)) for kind, g, _ in rows if kind == "paved")
  layers.extend((g, (132, 155, 102)) for kind, g, _ in rows if kind == "grass")
  layers.extend((g, (103, 132, 85)) for kind, g, _ in rows if kind == "scrub")
  layers.extend((g, (203, 185, 145)) for kind, g, _ in rows if kind == "play")
  for g, tone in layers:
    surface = g.intersection(region)
    mesh.ground(surface, FLOOR, tone)
    region = region.difference(surface)
  mesh.ground(region, FLOOR, (169, 158, 130))
  for kind, g, row in rows:
    if kind == "paved":
      # Block-jointed paving on the plaza under the bronze, with the joint
      # orientation observed on the 2026 aerial. Lines are limited to this apron.
      from shapely.affinity import rotate

      c = g.centroid
      span = 48
      for off in np.arange(-span, span, 1.8):
        line = LineString([(c.x + off, c.y - span), (c.x + off, c.y + span)])
        band = (
          rotate(line, 30, origin=(c.x, c.y))
          .buffer(0.023, cap_style="flat")
          .intersection(g)
        )
        mesh.ground(band, FLOOR + 0.014, (181, 176, 159))
  return kiosk


def shrubs(mesh, source, native):
  for i, (owner, samples) in enumerate(source["scrubHeight"]):
    for j, (x, z, h) in enumerate(samples):
      rng = (i * 77 + j * 13) % 23
      r = 0.81 + (rng % 5) * 0.06
      f = Frame(mesh, [x, z], [0, 1])
      c = np.array([96, 121, 75]) + rng % 8
      if native:
        f.cuboid(0, 0.5 * h, 0, r * 1.75, h, r * 1.6, c)
        continue
      n = 7
      ring = [
        (
          r * math.cos(2 * math.pi * t / n + 0.17 * rng),
          0.24 * h,
          r * math.sin(2 * math.pi * t / n + 0.17 * rng),
        )
        for t in range(n)
      ]
      cap = [(u * 0.65, 0.81 * h, v * 0.65) for u, y, v in ring]
      for t in range(n):
        m = (t + 1) % n
        f.face([ring[t], ring[m], cap[m], cap[t]], c * (0.83 + 0.03 * (t % 4)))
        f.face([cap[t], cap[m], (0, h, 0)], c * (0.99 + 0.025 * (t % 3)))


def main():
  s = json.loads(gzip.decompress(SOURCE.read_bytes()))
  DATA.mkdir(exist_ok=True)

  def write(name, data):
    (DATA / (name + ".json")).write_text(json.dumps(data, separators=(",", ":")) + "\n")

  origin = (3139, 0, -1851)
  shared = Mesh(origin)
  kiosk = park_floor(shared, s)
  playgrounds(shared, s)
  walk = shape(s["park"]).difference(kiosk.buffer(0.03))

  def polygon(p):
    return {
      "ring": list(p.exterior.coords)[:-1],
      "holes": [list(h.coords)[:-1] for h in p.interiors],
    }

  write(
    "surfaces",
    {"mesh": shared.finish(), "floors": [polygon(g) for g in polygons(walk)]},
  )
  for native, name in [(False, "drawn"), (True, "native")]:
    details = Mesh(origin)
    trees(details, s["trees"], native)
    for x, z, h, width, circ, *_ in s["trees"]:
      details.rod(
        (x, FLOOR, z), (x, 3.34, z), max(0.08, (circ or 55) / 630), (98, 83, 65), 5
      )
    shrubs(details, s, native)
    write(name, details.finish())


if __name__ == "__main__":
  main()
