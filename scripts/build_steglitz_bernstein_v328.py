"""Finite photo-aligned fittings on the retained Südendstraße 2 wall."""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import build_steglitz_post_v328 as post
from build_steglitz_school_stores_v327 import Front
from shapely.geometry import LineString, Point

OWNER = "DEBE06YYB0000waY"
ROSE = 0xC6A69A
BOSSAGE = 0xAA8778
SOCKEL = 0x68777A
BAND = 0x986B60
SAND = 0xE0CBB2
SAND_SHADOW = 0xBCAB91
GLASS = 0x405966
WOOD = 0x29393A
TOP = 0x9B7061


def front_for(raw, native):
  """Resolve each actual original street edge independently of the other mode."""
  owner = [b for b in raw["nav"]["buildings"] if b["sourceId"] == OWNER]
  assert len(owner) == 1 and owner[0]["minHeight"] == 0
  ox, _, oz = raw["origin"]
  ring = [(x + ox, z + oz) for x, z in owner[0]["ring"]]
  segments = [
    LineString((a, b))
    for a, b in zip(ring, ring[1:])
    if min(a[1], b[1]) < 6869.1
    and max(a[1], b[1]) <= 6869.07
    and abs(b[0] - a[0]) > 0.2
  ]
  assert segments
  ends = [pt for s in segments for pt in s.coords]
  a, b = min(ends), max(ends)
  front = Front(a, b)
  line = LineString((a, b))
  assert all(line.distance(Point(pt)) < 1e-8 for s in segments for pt in s.coords)
  assert abs(sum(s.length for s in segments) - front.length) < 0.02
  assert (front.nx, front.nz) == (0, -1) if native else front.nz < -0.998
  return front, owner[0]["height"] + raw["nav"]["groundY"]


def geometry(front, top, native):
  rows, triangles = [], []
  length = front.length

  # Fractions read left to right in the north-side reference photograph. That
  # reading order is east to west in the city frame.
  def at(fraction):
    return (1 - fraction) * length

  def plate(u, y, w, h, color, depth=0.075, offset=0.056):
    if w <= 0 or h <= 0 or u - w / 2 < 0.008 or u + w / 2 > length - 0.008:
      raise ValueError(f"Facade piece leaves the wall: {u} {w}")
    rows.append(front.row(u, y, w, h, depth, color, offset))

  def band(y, h, color, depth=0.11, offset=0.075):
    plate(length / 2, y, length - 0.09, h, color, depth, offset)

  def field(u, low, high, w, color, offset=0.10):
    plate(u, (low + high) / 2, w, high - low, color, 0.09, offset)

  def sash(u, y, w, h, offset):
    plate(u, y, w + 0.24, h + 0.22, SAND, 0.095, offset)
    plate(u, y, w, h, GLASS, 0.064, offset + 0.066)
    plate(u, y, 0.081, h, WOOD, 0.07, offset + 0.11)
    plate(u, y + h * 0.21, w, 0.075, WOOD, 0.07, offset + 0.11)
    plate(u, y - h / 2 - 0.08, w + 0.39, 0.12, SAND, 0.24, offset + 0.102)

  def shell_ornament(uv, rgb, offset):
    xyz = [[*front.point(u, offset), y] for u, y in uv]
    for i in range(1, len(xyz) - 1):
      corners = [xyz[0], xyz[i], xyz[i + 1]]
      triangles.append([rgb, *[n for x, z, y in corners for n in (x, y, z)]])

  # Painted wall planes. The earlier body and roof stay in place.
  band(3.64, 1.22, SOCKEL, 0.08)
  band(4.63, 0.67, BAND, 0.08)
  band(6.45, 3.04, BOSSAGE, 0.08)
  cornice = min(20.37, top - 3.95)
  band((7.97 + cornice) / 2, cornice - 7.97, ROSE, 0.08)
  band(4.93, 0.12, SAND_SHADOW, 0.11, 0.094)
  for y in (5.26, 5.75, 6.24, 6.73, 7.22, 7.71):
    band(y, 0.045, 0x8C6D63, 0.085, 0.078)
  band(7.99, 0.19, SAND_SHADOW, 0.17, 0.131)
  band(cornice - 0.17, 0.14, SAND_SHADOW, 0.21, 0.168)
  band(cornice + 0.015, 0.16, SAND, 0.26, 0.185)

  # Real paired oriels on the middle floors and outer offset balconies.
  for fraction in (0.247, 0.632):
    u = at(fraction)
    width = length * 0.143
    field(u, 8.05, 16.35, width, SAND_SHADOW, 0.36)
    field(u, 8.17, 16.3, width - 0.26, SAND, 0.60)
    for side in (-1, 1):
      for y in (9.53, 13.63):
        plate(u + side * (width / 2 - 0.12), y, 0.21, 2.79, SAND, 0.40, 0.47)
      plate(u + side * 0.78, 8.27, 0.30, 0.50, SAND_SHADOW, 0.48, 0.27)
    for y in (8.14, 11.48, 12.14, 15.60, 16.29):
      plate(u, y, width + 0.15, 0.15, SAND, 0.75, 0.38)
    if native:
      plate(u, 16.43, width * 0.63, 0.21, SAND, 0.72, 0.39)
    else:
      shell_ornament(
        [
          (u - width / 2, 16.26),
          (u + width / 2, 16.26),
          (u + 0.83, 16.62),
          (u - 0.83, 16.62),
        ],
        SAND,
        0.767,
      )

  axes = (0.070, 0.210, 0.283, 0.397, 0.466, 0.593, 0.672, 0.815, 0.926)
  projecting = {1, 2, 5, 6}
  door = at(0.633)
  for i, fraction in enumerate(axes):
    u = at(fraction)
    if i not in (5, 6):
      sash(u, 6.64, 1.03, 2.24, 0.122)
    for y in (9.72, 13.76):
      sash(u, y, 1.03, 2.30, 0.667 if i in projecting else 0.117)
    sash(u, 18.25, 1.03, 1.94, 0.114)

  for fraction in (0.067, 0.805):
    u = at(fraction)
    width = length * (0.104 if fraction < 0.5 else 0.154)
    for bottom in (8.10, 12.18):
      plate(u, bottom, width, 0.20, SAND, 0.91, 0.45)
      plate(u, bottom + 0.66, width, 0.13, SAND, 0.16, 0.90)
      plate(u, bottom + 0.16, width, 0.10, SAND_SHADOW, 0.16, 0.90)
      for i in range(1, round(width / 0.18)):
        j = i / round(width / 0.18) - 0.5
        plate(u + width * j, bottom + 0.39, 0.088, 0.50, SAND, 0.125, 0.90)

  # Actual dark doorway, radial fanlight and secondary low service door.
  field(door, 3.04, 6.58, 2.12, SAND, 0.155)
  field(door, 3.07, 6.40, 1.68, 0x283632, 0.239)
  plate(door, 4.73, 0.052, 3.21, SAND_SHADOW, 0.06, 0.30)
  plate(door, 6.45, 2.32, 0.15, SAND, 0.25, 0.216)
  if native:
    for i, (width, low) in enumerate(
      ((1.62, 6.58), (1.36, 6.76), (1.06, 6.94), (0.72, 7.12))
    ):
      plate(door, low + 0.09, width, 0.18, WOOD if i < 3 else GLASS, 0.12, 0.138)
  else:
    radius = 0.91
    uv = [(door - radius, 6.55), (door + radius, 6.55)] + [
      (door + radius * math.cos(a), 6.55 + radius * 0.86 * math.sin(a))
      for a in [math.pi * i / 8 for i in range(1, 8)]
    ]
    shell_ornament(uv, WOOD, 0.218)
    plate(door, 6.91, 0.065, 0.68, SAND_SHADOW, 0.09, 0.233)
  field(at(0.815), 3.05, 4.86, 1.55, WOOD, 0.144)

  # The cream-edged upper gable remains on the original flat outline plane.
  gable = at(0.452)
  y0, y1 = cornice + 0.06, min(top - 0.14, 24.4)
  if native:
    for i, width in enumerate((5.9, 5.1, 3.9, 3.2, 2.55, 1.65)):
      step = (y1 - y0) / 6
      plate(gable, y0 + (i + 0.5) * step, width, step, ROSE, 0.12, 0.085)
      plate(gable, y0 + (i + 1) * step - 0.023, width, 0.046, SAND, 0.09, 0.154)
  else:
    uv = [
      (gable - 3.03, y0),
      (gable + 3.03, y0),
      (gable + 2.58, y0 + 0.43),
      (gable + 2.15, y0 + 1.02),
      (gable + 1.70, y1 - 0.64),
      (gable + 1.20, y1 - 0.32),
      (gable + 0.44, y1),
      (gable - 0.44, y1),
      (gable - 1.2, y1 - 0.32),
      (gable - 1.7, y1 - 0.64),
      (gable - 2.15, y0 + 1.02),
      (gable - 2.58, y0 + 0.43),
    ]
    shell_ornament(uv, TOP, 0.09)
    plate(gable, y1 - 0.15, 1.48, 0.18, SAND, 0.14, 0.145)
  sash(gable, (y0 + y1) / 2, 0.90, min(1.52, (y1 - y0) * 0.58), 0.144)

  # The two tight plaque photographs prove a silver plate on the lower
  # moulded strip, not its lateral offset. The horizontal placement is an estimate.
  plaque = at(0.525)
  plate(plaque, 4.60, 0.56, 0.32, 0xC1C5C4, 0.036, 0.115)
  x, z = front.point(plaque, 0.138)
  label = [x, 4.60, z, front.dx, front.dz, front.nx, front.nz, 0.053]
  return {
    "rows": rows,
    "triangles": triangles,
    "plaque": label,
    "front": [*front.a, *front.b],
    "retainedTop": top,
  }


def compact(value):
  if isinstance(value, float):
    return round(value, 5) or 0
  if isinstance(value, list):
    return [compact(v) for v in value]
  if isinstance(value, dict):
    return {k: compact(v) for k, v in value.items()}
  return value


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--output",
    type=Path,
    default=post.previous.APP / "src/data/steglitzBernsteinV328.json",
  )
  output = parser.parse_args().output
  if output.resolve().is_relative_to(post.previous.PUBLIC.resolve()):
    raise ValueError("The original packet directory is read-only")
  source = {"schemaVersion": 1, "owner": OWNER, "families": {}}
  for mode, sha in post.SHAS.items():
    packet_path = post.previous.PUBLIC / f"{post.PACKET}.{mode}.json.gz"
    assert post.previous.sha(packet_path) == sha
    raw = post.read(packet_path)
    front, top = front_for(raw, mode == "minecraft")
    source["families"][mode] = geometry(front, top, mode == "minecraft")
  post.write(output, compact(source))
  print(
    output.name,
    [(m, len(d["rows"]), len(d["triangles"])) for m, d in source["families"].items()],
  )


if __name__ == "__main__":
  main()
