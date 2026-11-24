"""Reconstruct the photographed Hofbeamtenhaus street elevation and Zietenplatz details."""

import json
import math
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, box

from scripts.build_kollwitzplatz_v381 import Frame
from scripts.build_kreuzberg_plaetze_v380 import Mesh

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/arbeitsministerium-quartier-v383.json"
DATA = ROOT / "src/app/src/data/arbeitsministeriumQuartierV383"
STONE, PALE, SHADE = (207, 199, 176), (222, 215, 193), (169, 159, 136)
BRONZE, BRASS, GRANITE = (62, 75, 65), (128, 127, 93), (152, 110, 96)


def hofbeamtenhaus(mesh, source, native):
  front = source["entrance"]
  a, b = np.array(front["a"]), np.array(front["b"])
  length = np.linalg.norm(b - a)
  axis = (b - a) / length
  normal = np.array([-axis[1], axis[0]])
  walls = []
  if native:
    for start, end in source["nativeWesterlyWalls"]:
      start, end = np.array(start), np.array(end)
      u, v = (start - a) @ axis, (end - a) @ axis
      if v < u:
        u, v, start, end = v, u, end, start
      outward = normal * (np.abs(start - end) < 0.001)
      outward /= np.linalg.norm(outward)
      walls.append((u, v, start, end, outward))
  else:
    walls = [(0.0, length, a, b, normal)]

  def panel(geom, offset, color):
    for u, v, start, end, n in walls:
      if geom.bounds[2] <= u or geom.bounds[0] >= v:
        continue
      clipped = geom.intersection(box(max(0, u), 5.2, min(length, v), 30.03))

      def project(along, height):
        x, z = start + (end - start) * ((along - u) / (v - u)) + n * offset
        return (x, height, z)

      mesh.polygon(clipped, color, project)

  def panel_box(u, y, w, h, depth, tone):
    panel(box(u, y, u + w, y + h), depth, tone)

  def arch(center, width, sill, spring):
    radius = width / 2
    curve = [
      (
        center + radius * math.cos(t * math.pi / 24),
        spring + radius * math.sin(t * math.pi / 24),
      )
      for t in range(25)
    ]
    return Polygon([(center - radius, sill), (center + radius, sill), *curve])

  panel_box(0, 5.2, length, 24.82, 0.17, STONE)
  # Broken ashlar courses, two paired upper window rows, blind northern
  # arcades and the three deep, visibly open southern arches.
  for row, base in enumerate(np.arange(5.3, 30, 1.42)):
    panel_box(0, base, length, 0.037, 0.19, (187, 179, 158))
    for coord in np.arange(1.4 if row % 2 else 3.5, length, 3.6):
      panel_box(coord, base, 0.033, 1.42, 0.20, (188, 181, 162))
  for index in range(6):
    u = length * (index + 0.5) / 6
    outer = arch(u, 3.80, 5.24, 11.26)
    inner = arch(u, 3.48, 5.24, 11.24)
    panel(outer, 0.24, SHADE)
    panel(inner, 0.25, (183, 175, 154) if index < 3 else (65, 68, 63))
    if index < 3:
      panel(arch(u, 3.22, 5.24, 11.17), 0.27, (192, 185, 165))
      for y in np.arange(6.04, 12.3, 1.4):
        panel(inner.intersection(box(u - 2, y, u + 2, y + 0.035)), 0.29, SHADE)
    else:
      recess = arch(u + 0.19, 2.92, 5.24, 11.21)
      panel(recess, 0.28, (49, 53, 52))
      panel_box(u - 1.15, 5.24, 1.04, 4.25, 0.30, (39, 45, 43))
    for bottom, high in [(15.02, 4.02), (22.03, 3.45)]:
      panel_box(u - 1.39, bottom - 0.09, 2.78, high + 0.22, 0.24, SHADE)
      panel_box(u - 1.27, bottom, 2.54, high, 0.27, PALE)
      for off in [-1.09, 0.115]:
        panel_box(u + off, bottom + 0.12, 1.0, high - 0.26, 0.31, (72, 83, 85))
        panel_box(u + off, bottom + 0.12, 0.085, high - 0.26, 0.33, (140, 142, 128))
      panel_box(u - 1.48, bottom - 0.15, 2.96, 0.15, 0.36, (155, 149, 130))
  for base, height, depth, color in [
    (27.62, 0.40, 0.27, SHADE),
    (28.03, 0.43, 0.46, PALE),
    (29.76, 0.25, 0.28, (168, 165, 153)),
  ]:
    panel_box(0, base, length, height, depth, color)


def lathe(mesh, x, z, base, profile, palette, sides=16, yaw=0):
  prev = None
  for y, rx, rz, ci in profile:
    ring = [
      (
        x + rx * math.cos(yaw + 2 * math.pi * j / sides),
        base + y,
        z + rz * math.sin(yaw + 2 * math.pi * j / sides),
      )
      for j in range(sides)
    ]
    if prev:
      for j in range(sides):
        mesh.face(
          [prev[j], prev[(j + 1) % sides], ring[(j + 1) % sides], ring[j]],
          np.array(palette[ci])
          * (0.91 + 0.09 * math.cos(2 * math.pi * j / sides + 0.5)),
        )
    prev = ring
  mesh.face(prev, palette[profile[-1][-1]])


def plaza(mesh, source, native):
  floor = source["figureDatum"]
  for index, (_, ring) in enumerate(source["beds"]):
    bed = Polygon(ring)
    mesh.ground(bed, floor + 0.035, (112, 110, 76))
    inner = bed.buffer(-0.25)
    mesh.ground(inner, floor + 0.12, (100, 121, 74))
    # The district describes ornamental flower beds. Groups express low
    # seasonal planting in the mapped beds without assuming a cultivar.
    for i in range(45):
      x = bed.bounds[0] + (i * 0.61803398875 % 1) * (bed.bounds[2] - bed.bounds[0])
      z = bed.bounds[1] + (i * 0.41421356237 % 1) * (bed.bounds[3] - bed.bounds[1])
      if inner.contains(Point(x, z)):
        mesh.ground(
          Point(x, z).buffer(0.32 + 0.13 * (i % 3), quad_segs=2),
          floor + 0.16,
          [(147, 144, 91), (125, 143, 84), (154, 124, 105)][(i + index) % 3],
        )
  for _, x, z, bearing in source["benches"]:
    angle = math.radians(bearing)
    f = Frame(mesh, [x, z], [math.sin(angle), -math.cos(angle)])
    y = floor - 3.20
    for j in range(4):
      f.cuboid(0, y + 0.48, -0.18 + j * 0.11, 1.72, 0.055, 0.093, (133, 115, 85))
    for j in range(3):
      f.cuboid(0, y + 0.67 + j * 0.10, -0.24, 1.72, 0.082, 0.055, (140, 121, 90))
    for u in [-0.63, 0.63]:
      f.cuboid(u, y + 0.27, 0, 0.07, 0.52, 0.42, (80, 86, 82))
      f.cuboid(u, y + 0.61, -0.24, 0.06, 0.51, 0.06, (78, 85, 83))
  _, x, z = source["board"]
  f = Frame(mesh, [x, z], [0.28, 0.96])
  by = floor - 3.20
  for u in [-0.59, 0.59]:
    f.cuboid(u, by + 1.06, 0, 0.065, 2.12, 0.065, (99, 104, 104))
  f.cuboid(0, by + 1.26, 0, 1.22, 1.61, 0.075, (52, 83, 116))
  f.cuboid(-0.12, by + 1.93, 0.045, 0.77, 0.085, 0.024, (222, 225, 216))
  for j in range(9):
    f.cuboid(-0.23, by + 1.73 - j * 0.10, 0.045, 0.50, 0.026, 0.015, (167, 184, 192))
  for j in range(3):
    f.cuboid(0.31, by + 1.52 - j * 0.24, 0.046, 0.36, 0.19, 0.015, (125, 145, 155))
  for _, name, _, x, z, _ in source["figures"]:
    f = Frame(
      mesh,
      [x, z],
      [0.956, -0.293] if name in ("zieten", "keith", "seydlitz") else [-0.956, 0.293],
    )
    for bottom, w, h, color in [
      (0, 2.18, 0.18, (172, 154, 137)),
      (0.18, 1.84, 0.29, GRANITE),
      (0.47, 1.62, 0.20, (135, 102, 89)),
      (0.67, 1.42, 1.88, GRANITE),
      (2.55, 1.67, 0.17, (160, 118, 101)),
      (2.72, 1.60, 0.13, (105, 99, 84)),
    ]:
      f.cuboid(0, by + bottom + h / 2, 0, w, h, w, color)
    # Each plinth has an inset dark bronze identification tablet.
    f.cuboid(0, by + 1.64, 0.722, 0.76, 0.68, 0.035, (79, 81, 68))
    for i, width in enumerate([0.48, 0.55, 0.35, 0.42]):
      f.cuboid(0, by + 1.82 - i * 0.125, 0.745, width, 0.024, 0.012, (163, 149, 114))
    if name == "zieten":
      for end in [-1, 1]:
        for side in [-1, 1]:
          f.rod(
            (end * 1.7, by + 0.04, side * 1.7),
            (end * 1.7, by + 0.66, side * 1.7),
            0.035,
            BRONZE,
            5,
          )
        for u1, u2, y1, y2 in [(-1.7, 0, 0.57, 0.35), (0, 1.7, 0.35, 0.57)]:
          f.rod((u1, by + y1, end * 1.7), (u2, by + y2, end * 1.7), 0.018, BRONZE, 4)
          f.rod((end * 1.7, by + y1, u1), (end * 1.7, by + y2, u2), 0.018, BRONZE, 4)
    bt = by + 2.84
    for u, dz in [(-0.17, 0.10), (0.20, -0.08)]:
      f.cuboid(u, bt + 0.09, dz + 0.10, 0.23, 0.18, 0.43, BRONZE)
      f.rod((u, bt + 0.13, dz), (u * 0.78, bt + 1.04, dz * 0.75), 0.125, BRONZE, 5)
    lathe(
      mesh,
      x,
      z,
      floor + 2.84,
      [
        (0.87, 0.44, 0.29, 0),
        (1.12, 0.36, 0.24, 0),
        (1.42, 0.28, 0.19, 0),
        (1.67, 0.36, 0.22, 0),
        (1.83, 0.41, 0.25, 0),
        (1.90, 0.19, 0.15, 0),
      ],
      [BRONZE],
      6 if native else 10,
    )
    lathe(
      mesh,
      x,
      z,
      floor + 2.84,
      [
        (1.82, 0.105, 0.10, 0),
        (1.99, 0.15, 0.15, 0),
        (2.18, 0.16, 0.145, 0),
        (2.29, 0.11, 0.10, 0),
      ],
      [(89, 91, 73)],
      6 if native else 10,
    )
    if name == "zieten":
      f.cuboid(0, bt + 2.35, 0, 0.32, 0.35, 0.29, BRONZE)
      f.rod((-0.16, bt + 2.42, 0.0), (-0.22, bt + 2.72, 0.06), 0.073, BRONZE, 5)
    else:
      f.face(
        [(-0.29, bt + 2.26, -0.11), (0.28, bt + 2.26, -0.11), (0, bt + 2.35, 0.27)],
        BRONZE,
      )
    poses = {
      "schwerin": [(0.52, 1.94), (-0.40, 1.22)],
      "keith": [(0.39, 1.16), (-0.12, 1.49)],
      "seydlitz": [(0.18, 1.44), (-0.47, 1.13)],
      "winterfeldt": [(0.46, 1.18), (-0.05, 1.39)],
      "zieten": [(0.09, 1.48), (-0.09, 1.57)],
    }
    for sign, (hand, hy) in zip([1, -1], poses[name]):
      elbow = (sign * 0.43, bt + 1.41, 0.10)
      f.rod((sign * 0.30, bt + 1.79, 0), elbow, 0.111, BRONZE, 5)
      f.rod(elbow, (hand, bt + hy, 0.29), 0.086, BRONZE, 5)
    if name == "schwerin":
      f.rod((-0.16, bt + 0.17, 0.21), (1.08, bt + 3.26, 0.28), 0.033, BRONZE, 5)
      f.face(
        [(1.06, bt + 3.23, 0.27), (1.64, bt + 2.84, 0.22), (0.82, bt + 2.56, 0.29)],
        (93, 100, 82),
      )


def main():
  source = json.loads(SOURCE.read_bytes())
  DATA.mkdir(exist_ok=True)
  for native in (False, True):
    mesh = Mesh([900, 0, 780])
    hofbeamtenhaus(mesh, source, native)
    plaza(mesh, source, native)
    packet = mesh.finish()
    (DATA / (("native" if native else "drawn") + ".json")).write_text(
      json.dumps(packet, separators=(",", ":")) + "\n"
    )
    print("native" if native else "drawn", packet["n"], packet["f"])


if __name__ == "__main__":
  main()
