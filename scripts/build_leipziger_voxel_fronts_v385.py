"""Extract the visible street face of the four-metre core building columns."""

import argparse
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/app/src/data/leipzigerVoxelFrontsV385.json"
EDGES = {
  "square": ([385.909, 984.756], [404.669, 962.634], 1, 5.2, 33.45),
  "ebert": ([353.874, 955.829], [357.474, 932.798], -1, 5.0, 31.54),
  "mall": ([530.479, 992.085], [532.9, 1022.642], 1, 5.2, 23.24),
  "mallUpper": ([532.474, 991.061], [534.811, 1020.355], 1, 23.23, 40.86),
}


def profile(data, edge):
  a, b, side, base, top = edge
  length = math.dist(a, b)
  tx, tz = ((b[i] - a[i]) / length for i in range(2))
  nx, nz = -side * tz, side * tx
  cell = data["cell_m"]
  grid = data["grid"]
  x0, z0 = grid["min_x_idx"], grid["min_z_idx"]
  xmin, xmax = min(a[0], b[0]) - 12, max(a[0], b[0]) + 12
  zmin, zmax = min(a[1], b[1]) - 12, max(a[1], b[1]) + 12
  cells = []
  for j in range(math.floor(zmin / cell), math.ceil(zmax / cell)):
    for start, count, low, high, _ in data["building_rows"][j - z0]:
      for i in range(
        max(start + x0, math.floor(xmin / cell)),
        min(start + count + x0, math.ceil(xmax / cell)),
      ):
        ring = []
        for dx, dz in ((0, 0), (0, 1), (1, 1), (1, 0)):
          x, z = (i + dx) * cell - a[0], (j + dz) * cell - a[1]
          ring.append((x * tx + z * tz, x * nx + z * nz))
        if min(p[0] for p in ring) >= length or max(p[0] for p in ring) <= 0:
          continue
        if min(p[1] for p in ring) > 3.3 or max(p[1] for p in ring) < -7:
          continue
        cells.append((low / 10, high / 10, ring))
  # Near ground the retained voxel floors differ by decimetres. Continue the
  # first occupied street profile to the local base to avoid false thin cuts.
  levels = sorted({base, top, *(high for _, high, _ in cells if base < high < top)})
  result = []
  for low, high in zip(levels, levels[1:]):
    y = max(base + 1, (low + high) / 2)
    sides = []
    for floor, roof, ring in cells:
      if not floor <= y <= roof:
        continue
      for p, q in zip(ring, ring[1:] + ring[:1]):
        if p[0] > q[0]:
          p, q = q, p
        if q[0] > 0 and p[0] < length and q[0] > p[0] + 1e-8:
          sides.append((p[0], q[0], (q[1] - p[1]) / (q[0] - p[0]), p[1]))
    limits = sorted(
      {0.0, length, *(u for side in sides for u in side[:2] if 0 < u < length)}
    )
    spans = []
    for u0, u1 in zip(limits, limits[1:]):
      middle = (u0 + u1) / 2
      hits = [
        (d + (middle - start) * m, m)
        for start, end, m, d in sides
        if start < middle < end
      ]
      if not hits:
        continue
      distance, slope = max(hits)
      if distance > 4.3 or distance < -7:
        continue
      d0, d1 = distance + (u0 - middle) * slope, distance + (u1 - middle) * slope
      if (
        spans
        and abs(spans[-1][1] - u0) < 1e-7
        and abs(spans[-1][3] - d0) < 1e-7
        and abs(spans[-1][4] - slope) < 1e-7
      ):
        spans[-1][1], spans[-1][3] = u1, d1
      else:
        spans.append([u0, u1, d0, d1, slope])
    rounded = [[round(v, 3) for v in s[:4]] for s in spans if s[1] - s[0] > 0.002]
    if result and result[-1][1] == rounded:
      result[-1][0] = high
    else:
      result.append([high, rounded])
  return result


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  data = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json").read_bytes()
  )
  result = {name: profile(data, edge) for name, edge in EDGES.items()}
  contents = json.dumps(result, separators=(",", ":")) + "\n"
  if args.check:
    return int(OUTPUT.read_text() != contents)
  OUTPUT.write_text(contents)
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
