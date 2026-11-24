"""Fit photographic street elevations to the two existing drawn and block owners."""

import gzip
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILDINGS = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
FRONTS = {
  "4_-4": ("DEBE03YY600006wS", (2508.48, -1906.45), (2502.90, -1898.19), "kino"),
  "5_-5": ("DEBE03YY600008Vb", (2711.56, -2252.66), (2730.13, -2281.98), "prater"),
}
LETTERS = dict(
  L="100/100/100/100/111",
  I="111/010/010/010/111",
  C="111/100/100/100/111",
  H="101/101/111/101/101",
  T="111/010/010/010/010",
  B="110/101/110/101/110",
  K="101/110/100/110/101",
  N="101/111/111/111/101",
  O="111/101/101/101/111",
  P="110/101/110/100/100",
  R="110/101/110/101/101",
  A="010/101/111/101/101",
  E="111/100/110/100/111",
)


def add_fronts(packet, tile, native):
  if tile not in FRONTS:
    return
  owner, start, end, site = FRONTS[tile]
  family = "minecraft" if native else "drawn"
  with gzip.open(BUILDINGS / f"{tile}.{family}.json.gz") as handle:
    source = json.load(handle)
  building = next(b for b in source["nav"]["buildings"] if b["sourceId"] == owner)
  ground = source["nav"]["groundY"] + building.get("groundOffset", 0)
  height = building["height"]
  ox, _, oz = source["origin"]
  ring = [(ox + x, oz + z) for x, z in building["ring"]]
  length = math.dist(start, end)
  ux, uz = (end[0] - start[0]) / length, (end[1] - start[1]) / length
  nx, nz = -uz, ux  # public side when viewing the elevation left to right
  # Left-to-right as seen by a person standing on the street means its
  # outward normal in world X/Z is (-dz,dx).
  center = ((start[0] + end[0]) / 2, (start[1] + end[1]) / 2)
  from shapely import Point, Polygon

  shell = Polygon(ring)
  if shell.contains(Point(center[0] + nx * 4, center[1] + nz * 4)):
    nx, nz = -nx, -nz

  def frame(pt):
    dx, dz = pt[0] - start[0], pt[1] - start[1]
    return dx * ux + dz * uz, dx * nx + dz * nz

  walls = []
  for a, b in zip(ring, ring[1:] + ring[:1]):
    ua, da = frame(a)
    ub, db = frame(b)
    if max(abs(da), abs(db)) > (2.35 if native else 1.18) or abs(ub - ua) < 0.03:
      continue
    if max(ua, ub) < -0.01 or min(ua, ub) > length + 0.01:
      continue
    vx, vz = b[0] - a[0], b[1] - a[1]
    width = math.hypot(vx, vz)
    if width < 0.04:
      continue
    wx, wz = -vz / width, vx / width
    if wx * nx + wz * nz < 0:
      wx, wz = -wx, -wz
    if shell.contains(
      Point((a[0] + b[0]) / 2 + wx * 0.08, (a[1] + b[1]) / 2 + wz * 0.08)
    ):
      continue
    walls.append((a, b, ua, ub, wx, wz))

  def strip(left, right, low1, low2, top1, top2, tone, depth):
    for a, b, ua, ub, wx, wz in walls:
      lo = max(left, min(ua, ub))
      hi = min(right, max(ua, ub))
      if hi - lo < 0.014:
        continue

      def vertex(u, y1, y2):
        k = (u - ua) / (ub - ua)
        return (
          a[0] + (b[0] - a[0]) * k + wx * depth,
          ground + y1 + (y2 - y1) * (u - left) / (right - left),
          a[1] + (b[1] - a[1]) * k + wz * depth,
        )

      p, q, r, s = (
        vertex(lo, low1, low2),
        vertex(hi, low1, low2),
        vertex(hi, top1, top2),
        vertex(lo, top1, top2),
      )
      packet.facet([p, q, r], tone)
      packet.facet([p, r, s], tone)

  def rect(left, r, y, h, color, depth):
    strip(
      left * length,
      r * length,
      y * height,
      y * height,
      (y + h) * height,
      (y + h) * height,
      color,
      depth,
    )

  def arch(left, r, y, h, color, depth, curve=0.28):
    for i in range(12):
      a, b = i / 12, (i + 1) / 12

      def top(u):
        return (
          y + h * (1 - curve + curve * math.sqrt(max(0, 1 - (2 * u - 1) ** 2)))
        ) * height

      strip(
        (left + (r - left) * a) * length,
        (left + (r - left) * b) * length,
        y * height,
        y * height,
        top(a),
        top(b),
        color,
        depth,
      )

  def letters(text, left, r, y, h, color, depth):
    cell = (r - left) / (len(text) * 4 - 1)
    for i, ch in enumerate(text):
      for j, line in enumerate(LETTERS.get(ch, "").split("/")):
        for k, bit in enumerate(line):
          if bit == "1":
            x = left + cell * (4 * i + k)
            rect(x, x + cell, y + (4 - j) * h / 5, h / 5, color, depth)

  if site == "kino":
    olive, stone, red, glass = 0xA9AC8D, 0xC3C1A5, 0x7A4940, 0x526367
    rect(0.002, 0.998, 0.01, 0.974, olive, 0.105)
    for y, h in [
      (0.031, 0.034),
      (0.13, 0.018),
      (0.46, 0.018),
      (0.855, 0.019),
      (0.923, 0.025),
      (0.965, 0.026),
    ]:
      rect(0.002, 0.998, y, h, stone, 0.18)
    for u in [0.17, 0.40, 0.64, 0.87]:
      rect(u - 0.063, u + 0.063, 0.585, 0.232, stone, 0.15)
      rect(u - 0.052, u + 0.052, 0.595, 0.213, red, 0.21)
      rect(u - 0.044, u + 0.044, 0.605, 0.193, glass, 0.23)
      rect(u - 0.004, u + 0.004, 0.603, 0.197, red, 0.25)
      rect(u - 0.046, u + 0.046, 0.734, 0.010, red, 0.25)
      rect(u - 0.065, u + 0.065, 0.578, 0.012, 0x727664, 0.26)
    for left, r in [(0.075, 0.254), (0.535, 0.665)]:
      rect(left, r, 0.104, 0.302, red, 0.22)
      rect(left + 0.009, r - 0.009, 0.115, 0.278, 0x426064, 0.25)
      for col in range(2):
        for row in range(2):
          x = left + 0.018 + col * (r - left) * 0.43
          rect(
            x,
            x + (r - left) * 0.34,
            0.133 + row * 0.119,
            0.102,
            [0xAE6857, 0xB7AFA0, 0x739390, 0xA79270][row * 2 + col],
            0.29,
          )
    rect(0.322, 0.500, 0.032, 0.374, stone, 0.19)
    rect(0.341, 0.479, 0.056, 0.336, 0x574D43, 0.24)
    rect(0.353, 0.468, 0.069, 0.260, 0x526566, 0.28)
    rect(0.409, 0.416, 0.060, 0.29, red, 0.30)
    for j in range(3):
      rect(
        0.315 - j * 0.009,
        0.497 + j * 0.009,
        0.012 + j * 0.016,
        0.014,
        0x8D8980,
        0.4 - j * 0.06,
      )
    rect(0.053, 0.548, 0.423, 0.049, 0xC4BD9F, 0.24)
    letters("LICHTBLICK KINO", 0.072, 0.536, 0.430, 0.033, 0x394848, 0.32)
    arch(0.74, 0.987, 0.019, 0.393, 0x46443C, 0.21, 0.23)
    rect(0.763, 0.971, 0.020, 0.22, 0x514F45, 0.24)
  else:
    wall, cream, glass, red = 0xCFC6B4, 0xE0D8C5, 0x626969, 0x794D3D
    rect(0.002, 0.998, 0.006, 0.978, wall, 0.13)
    for y, h in [(0.055, 0.033), (0.508, 0.027), (0.916, 0.033), (0.962, 0.029)]:
      rect(0.002, 0.998, y, h, cream, 0.22)
    for i in range(9):
      u = 0.043 + i * 0.107
      rect(u - 0.029, u + 0.029, 0.618, 0.222, cream, 0.20)
      rect(u - 0.023, u + 0.023, 0.626, 0.201, glass, 0.24)
      rect(u - 0.003, u + 0.003, 0.624, 0.206, 0xA4A397, 0.27)
      rect(u - 0.025, u + 0.025, 0.761, 0.012, cream, 0.28)
    for i in range(7):
      u = 0.047 + i * 0.111
      arch(u - 0.036, u + 0.036, 0.073, 0.256, cream, 0.23)
      arch(u - 0.030, u + 0.030, 0.079, 0.235, red, 0.26)
      arch(u - 0.025, u + 0.025, 0.087, 0.215, glass, 0.28)
      rect(u - 0.003, u + 0.003, 0.089, 0.21, cream, 0.3)
      rect(u - 0.026, u + 0.026, 0.218, 0.008, cream, 0.3)
    arch(0.791, 0.987, 0.012, 0.447, cream, 0.24, 0.38)
    arch(0.807, 0.976, 0.013, 0.421, 0x5E594D, 0.27, 0.36)
    arch(0.823, 0.958, 0.014, 0.389, 0x474941, 0.29, 0.34)
    letters("PRATER", 0.065, 0.439, 0.343, 0.085, 0x575A56, 0.32)
