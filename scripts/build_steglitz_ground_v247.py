"""Small walking-floor index derived only from actual v247 rendered surfaces."""

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
OUT = DATA / "steglitzGroundV247.json"
ASPHALT = 0x686D6C


def f32(value):
  """Match the actual submitted vertex/instance buffers, including thin seams."""
  return struct.unpack("f", struct.pack("f", value))[0]


def build():
  files = [
    DATA / "hermannEhlersV247Details.json",
    DATA / "schlossstrasseV247Details.json",
  ]
  plaza, road = [json.loads(p.read_text()) for p in files]
  drawn, native = [], []
  for source, top, color in [(plaza, 3.025, None), (road, 3.09, ASPHALT)]:
    polygons = []
    for surface in source.get("surfaces", []):
      if color is not None and surface["color"] != color:
        continue
      for triangle in surface["triangles"]:
        assert all(abs(p[1] - top) < 1e-7 for p in triangle)
        polygon = Polygon([(f32(p[0]), f32(p[2])) for p in triangle])
        if polygon.area > 0:
          polygons.append(polygon)
    for x, y, z, width, height, depth, yaw, tone in source.get("boxes", []):
      if color is not None and tone != color:
        continue
      assert abs(y + height / 2 - top) < 1e-7
      c, s = math.cos(yaw), math.sin(yaw)
      xx, xz, zx, zz = f32(c * width), f32(-s * width), f32(s * depth), f32(c * depth)
      polygons.append(
        Polygon(
          [
            (f32(x) + u * xx + v * zx, f32(z) + u * xz + v * zz)
            for u, v in [(-0.5, -0.5), (0.5, -0.5), (0.5, 0.5), (-0.5, 0.5)]
          ]
        )
      )
    union = unary_union(polygons)
    for polygon in [union] if union.geom_type == "Polygon" else union.geoms:
      drawn.append(
        {
          "topY": top,
          "ring": list(polygon.exterior.coords),
          "holes": [list(r.coords) for r in polygon.interiors],
        }
      )
    for x, y, z, width, height, depth, tone in source["nativeRows"]:
      if color is not None and tone != color:
        continue
      assert abs(y + height / 2 - top) < 1e-7
      native.append(
        [
          f32(x) - f32(width) / 2,
          f32(z) - f32(depth) / 2,
          f32(x) + f32(width) / 2,
          f32(z) + f32(depth) / 2,
          top,
        ]
      )
  bounds = unary_union([Polygon(p["ring"], p["holes"]) for p in drawn]).bounds
  return {
    "version": 247,
    "bounds": bounds,
    "drawn": drawn,
    "native": native,
    "sourceSha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in files},
    "policy": "Only actual new paving/asphalt tops. No paint, kerb, hole fill or solid obstacle. Native keeps the rendered boundary fringe; existing higher ground wins.",
  }


if __name__ == "__main__":
  OUT.write_text(json.dumps(build(), separators=(",", ":")) + "\n")
  print(f"{OUT.name}: {OUT.stat().st_size} bytes")
