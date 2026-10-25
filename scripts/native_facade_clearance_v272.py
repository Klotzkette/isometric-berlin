"""Place v272 orthogonal fittings outside the actual native surface-cell envelope."""

from __future__ import annotations

import math

import numpy as np


class NativeFacadeClearance:
  """Conservative local support projection, never a global arbitrary x/z push."""

  def __init__(self, cells: list):
    self.cells = np.asarray([r[:6] for r in cells], dtype=float)
    self.cache = {}

  def position(self, f, u, y, w, h, depth, out=0.1, span_u=None, half_normal=None):
    """Return xz for one axis-aligned fitting outside overlapping source cells."""
    d, n, a = np.asarray(f["d"]), np.asarray(f["n"]), np.asarray(f["a"])
    key = (*a, *d, *n)
    if key not in self.cache:
      rel = self.cells[:, [0, 2]] - a
      self.cache[key] = (rel @ d, rel @ n)
    du, dn = self.cache[key]
    support_d = abs(d).sum()  # source cubes are exactly 2m
    support_n = abs(n).sum()
    fitting_d = (abs(d[0]) * w + abs(d[1]) * depth) / 2
    fitting_n = (abs(n[0]) * w + abs(n[1]) * depth) / 2
    if span_u is not None:
      fitting_d = span_u
    if half_normal is not None:
      fitting_n = half_normal
    relevant = (
      (np.abs(du - u) <= support_d + fitting_d + 0.01)
      & (np.abs(self.cells[:, 1] - y) <= 1 + h / 2 + 0.01)
      & (np.abs(dn) <= 2 * support_n + 0.02)
    )
    boundary = (
      max(0.0, float(np.max(dn[relevant] + support_n))) if relevant.any() else 0.0
    )
    position = a + d * u + n * (boundary + fitting_n + out)
    # At concave/return-wall corners another source cube may protrude beyond
    # this sheet. Move by the shortest free interval along the source normal
    # or along this same facade; never use an arbitrary world-axis shove.
    mask = np.abs(self.cells[:, 1] - y) < 1 + h / 2
    centers = self.cells[mask][:, [0, 2]]
    half = np.array([1 + w / 2, 1 + depth / 2]) + 0.02
    if len(centers) and np.any(np.all(np.abs(centers - position) < half, axis=1)):
      candidates = []
      for direction, side in [(n, 0), (d, 1), (-d, -1)]:
        lo = np.full(len(centers), -np.inf)
        hi = np.full(len(centers), np.inf)
        for axis in range(2):
          if abs(direction[axis]) < 1e-10:
            misses = np.abs(centers[:, axis] - position[axis]) >= half[axis]
            lo[misses] = np.inf
            hi[misses] = -np.inf
          else:
            e1 = (centers[:, axis] - half[axis] - position[axis]) / direction[axis]
            e2 = (centers[:, axis] + half[axis] - position[axis]) / direction[axis]
            lo = np.maximum(lo, np.minimum(e1, e2))
            hi = np.minimum(hi, np.maximum(e1, e2))
        intervals = sorted(
          (float(left), float(right))
          for left, right in zip(lo, hi, strict=True)
          if left <= right and right >= 0
        )
        escape = 0.0
        for left, right in intervals:
          if left > escape + 0.0001:
            break
          escape = max(escape, right + 0.02)
        if side and not 0 <= u + side * escape <= f.get("length", float("inf")):
          continue
        candidate = position + direction * escape
        if not np.any(np.all(np.abs(centers - candidate) < half, axis=1)):
          candidates.append((escape, candidate))
      if candidates:
        position = min(candidates, key=lambda x: x[0])[1]
    return position

  def segment(self, f, u, y, v, yy, width, tone, role, out=0.10):
    """Independently emitted orthogonal cells following a face-bound line."""
    a = f["a"] + f["d"] * u
    b = f["a"] + f["d"] * v
    dx, dz = b - a
    dy = yy - y
    count = max(1, math.ceil(math.sqrt(dx * dx + dy * dy + dz * dz) / 0.48))
    w, h, depth = (
      max(width, abs(dx) / count),
      max(width, abs(dy) / count),
      max(width, abs(dz) / count),
    )
    rows = []
    for i in range(count):
      t = (i + 0.5) / count
      cy = y + dy * t + 0.18
      x, z = self.position(f, u + (v - u) * t, cy, w, h, depth, out)
      rows.append(
        [float(x), float(cy), float(z), float(w), float(h), float(depth), 0, tone, role]
      )
    return rows
