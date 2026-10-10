"""Cut only the mapped Orankesee from the obsolete artificial presentation band."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from shapely import constrained_delaunay_triangles
from shapely.geometry import LineString, Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/orankesee-v209-source.json"
OUTPUT = ROOT / "src/app/src/data/orankeseeMarginV209.json"


def box_triangles(
  cx: float, cy: float, cz: float, sx: float, sy: float, sz: float, bottom: bool = False
) -> list:
  """Replay the existing five-face drawn box, or all six native box faces."""

  def p(u: int, y: int, v: int) -> list:
    return [
      float(np.float32(q)) for q in [cx + u * sx / 2, cy + y * sy / 2, cz + v * sz / 2]
    ]

  quads = [
    [p(-1, 1, -1), p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1)],
    [p(-1, -1, -1), p(-1, 1, -1), p(-1, 1, 1), p(-1, -1, 1)],
    [p(1, -1, -1), p(1, -1, 1), p(1, 1, 1), p(1, 1, -1)],
    [p(-1, -1, -1), p(1, -1, -1), p(1, 1, -1), p(-1, 1, -1)],
    [p(-1, -1, 1), p(-1, 1, 1), p(1, 1, 1), p(1, -1, 1)],
  ]
  if bottom:
    quads.append([p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1)])
  return [[a, b, c] for a, b, c, _ in quads] + [[a, c, d] for a, _, c, d in quads]


def parts(geometry):
  """Extract only non-empty polygon or line leaves."""
  if geometry.is_empty:
    return []
  return (
    [geometry]
    if isinstance(geometry, (Polygon, LineString))
    else [p for g in geometry.geoms for p in parts(g)]
  )


def clip_triangle(triangle: list, lake) -> list:
  """Subtract the exact lake's vertical prism without adding invented bank walls."""
  points = np.asarray(triangle)
  normal = np.cross(points[1] - points[0], points[2] - points[0])
  axis = int(np.argmax(np.abs(normal)))
  axes = [i for i in range(3) if i != axis]
  original = Polygon(points[:, axes])
  if axis == 1:
    cut = lake
  else:
    horizontal = next(a for a in axes if a != 1)
    low, high = lake.bounds[horizontal // 2], lake.bounds[2 + horizontal // 2]
    constant = points[0, axis]
    line = (
      LineString([(constant, low - 1), (constant, high + 1)])
      if axis == 0
      else LineString([(low - 1, constant), (high + 1, constant)])
    )
    ranges = [
      g.bounds for g in parts(line.intersection(lake)) if isinstance(g, LineString)
    ]
    # axes are [y,z] on an X face and [x,y] on a Z face.
    cut = unary_union(
      [
        box(-100, b[1], 100, b[3]) if axis == 0 else box(b[0], -100, b[2], 100)
        for b in ranges
      ]
    )
  kept = original.difference(cut)
  if original.symmetric_difference(kept).area < 1e-8:
    return [triangle]
  result = []
  for poly in parts(kept):
    for tri in constrained_delaunay_triangles(poly).geoms:
      out = []
      for a, b in list(tri.exterior.coords)[:3]:
        p = [0.0] * 3
        p[axis], p[axes[0]], p[axes[1]] = points[0, axis], a, b
        out.append(p)
      n = np.cross(np.subtract(out[1], out[0]), np.subtract(out[2], out[0]))
      if np.dot(n, normal) < 0:
        out[1], out[2] = out[2], out[1]
      result.append(out)
  return result


def build() -> dict:
  """Keep exact source water and every presentation fragment outside its polygon."""
  lake = shape(json.loads(SOURCE.read_text())["fullWater"])
  drawn = []
  for tri in box_triangles(7235, 0.5, 0, 790, 2.6, 8760):
    clipped = clip_triangle(tri, lake)
    if clipped != [tri]:
      drawn.append(dict(source=tri, triangles=clipped))
  native = []
  for row in range(110):
    z0 = -4380 + row * 80
    d = min(80, 4380 - z0)
    for column in range(10):
      x0 = 6840 + column * 80
      w = min(80, 7630 - x0)
      if box(x0, z0, x0 + w, z0 + d).intersection(lake).area <= 0:
        continue
      center = [x0 + w / 2, 0.8, z0 + d / 2]
      size = [w, 2.6, d]
      # Native instance matrices are Float32, then scale the unit box on GPU.
      center, size = [[float(np.float32(v)) for v in a] for a in [center, size]]
      triangles = [
        t
        for old in box_triangles(*center, *size, bottom=True)
        for t in clip_triangle(old, lake)
      ]
      native.append(
        dict(
          center=center,
          size=size,
          color=0x74B043 if (column + row + 3) % 2 == 0 else 0x91BD59,
          triangles=triangles,
        )
      )
  packet_dir = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
  packets = [
    {
      "path": f"{tile}.{mode}.json.gz",
      "sha256": hashlib.sha256(
        (packet_dir / f"{tile}.{mode}.json.gz").read_bytes()
      ).hexdigest(),
    }
    for mode in ["drawn", "minecraft"]
    for tile in ["east200-14_-7", "east200-14_-6", "east200-15_-7"]
  ]
  return dict(
    waterOwner="way/4788724",
    sourceReceipt=SOURCE.name,
    sourceSha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    sourceVertexCount=len(max(lake.geoms, key=lambda p: p.area).exterior.coords),
    cutAreaM2=lake.intersection(box(6840, -4380, 7630, 4380)).area,
    waterDatumY=-1.15,
    artificialBandRightX=7630,
    drawnSourceColor=0xEBF0E6,
    drawn=drawn,
    native=native,
    unchangedWaterPackets=packets,
  )


def main() -> None:
  OUTPUT.write_text(json.dumps(build(), separators=(",", ":")) + "\n")


if __name__ == "__main__":
  main()
