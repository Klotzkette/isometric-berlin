"""Bounded fountain collision from submitted solid boxes and real cap planes."""

from __future__ import annotations

import hashlib
import json
import math
import struct
from pathlib import Path

from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
SOURCE = DATA / "hermannEhlersFountainV248.json"
OUT = DATA / "fountainNavigationV248.json"
NON_SOLID_COLORS = {0x698C91, 0xD0DEDA}  # Water and illustrative water jets.


def f32(value: float) -> float:
  return struct.unpack("f", struct.pack("f", value))[0]


def build() -> dict:
  source = json.loads(SOURCE.read_text())
  drawn, native = [], []
  for x, y, z, width, height, depth, angle, color in source["boxes"]:
    if color in NON_SOLID_COLORS:
      continue
    c, s = math.cos(angle), math.sin(angle)
    xx, xz, zx, zz = f32(c * width), f32(-s * width), f32(s * depth), f32(c * depth)
    ring = [
      (f32(x) + u * xx + v * zx, f32(z) + u * xz + v * zz)
      for u, v in [(-0.5, -0.5), (0.5, -0.5), (0.5, 0.5), (-0.5, 0.5)]
    ]
    drawn.append(
      {
        "ring": ring,
        "holes": [],
        "lowY": f32(y) - f32(height) / 2,
        "topY": f32(y) + f32(height) / 2,
      }
    )
  for surface in source["surfaces"]:
    if surface["color"] in NON_SOLID_COLORS:
      continue
    # These are actual horizontal cap planes. Never extrude the ring or the
    # whole source hole into an invented closed volume beneath the cap.
    heights = {f32(p[1]) for triangle in surface["triangles"] for p in triangle}
    assert len(heights) == 1
    top = heights.pop()
    polygons = [
      Polygon([(f32(p[0]), f32(p[2])) for p in triangle])
      for triangle in surface["triangles"]
    ]
    union = unary_union([p for p in polygons if p.area > 0])
    for polygon in [union] if union.geom_type == "Polygon" else union.geoms:
      drawn.append(
        {
          "ring": list(polygon.exterior.coords),
          "holes": [list(r.coords) for r in polygon.interiors],
          "lowY": top,
          "topY": top,
        }
      )
  for x, y, z, width, height, depth, color in source["nativeRows"]:
    if color in NON_SOLID_COLORS:
      continue
    native.append(
      [
        f32(x) - f32(width) / 2,
        f32(z) - f32(depth) / 2,
        f32(x) + f32(width) / 2,
        f32(z) + f32(depth) / 2,
        f32(y) - f32(height) / 2,
        f32(y) + f32(height) / 2,
      ]
    )
  bounds = unary_union([Polygon(p["ring"], p["holes"]) for p in drawn]).bounds
  assert len(drawn) < 110 and len(native) < 220
  return {
    "version": 248,
    "owner": "way/775414456",
    "bounds": bounds,
    "drawn": drawn,
    "native": native,
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "policy": "Exact solid box volumes and zero-thickness visible cap only; water/jets excluded. No fill of the complete source hole. Float32 submission boundaries retained.",
  }


if __name__ == "__main__":
  OUT.write_text(json.dumps(build(), separators=(",", ":")) + "\n")
  print(f"{OUT.name}: {OUT.stat().st_size} bytes")
