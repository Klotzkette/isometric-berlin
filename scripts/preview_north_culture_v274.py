"""Project the actual constructor matrices exported by the companion Bun script."""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np


def main():
  cache = Path.home() / ".cache/codex-berlin-v274"
  scenes = json.loads((cache / "north-culture-actual-matrices.json").read_text())
  fig, axes = plt.subplots(2, 4, figsize=(20, 11), facecolor="#edf0ea")
  light = np.array([0.4, 0.85, 0.35])
  light /= np.linalg.norm(light)
  for ax, scene in zip(axes.flat, scenes, strict=True):
    direction = np.array(scene["view"], dtype=float)
    direction /= np.linalg.norm(direction)
    right = np.cross([0, 1, 0], direction)
    right /= np.linalg.norm(right)
    up = np.cross(direction, right)
    polys = [np.array(p, dtype=float) for p in scene["polys"]]
    origin = np.concatenate(polys).mean(axis=0)
    projected, depth, colors = [], [], []
    for p, c in zip(polys, scene["colors"], strict=True):
      normal = np.cross(p[1] - p[0], p[2] - p[0])
      length = np.linalg.norm(normal)
      if length < 1e-10:
        continue
      normal /= length
      # Source sheets have mixed winding; keep both sides, then painter sort.
      shade = 0.72 + 0.28 * abs(normal @ light)
      rel = p - origin
      projected.append(np.column_stack([rel @ right, rel @ up]))
      depth.append((rel @ direction).mean())
      colors.append(np.array(c) * shade)
    points = np.concatenate(projected)
    lo, hi = points.min(axis=0), points.max(axis=0)
    pad = (hi - lo) * 0.08
    lo -= pad
    hi += pad
    size = 900
    scale = min(size / (hi - lo))
    offset = (size - (hi - lo) * scale) / 2
    image = np.full((size, size, 3), [237, 240, 234], dtype=np.uint8)
    zbuffer = np.full((size, size), -np.inf)
    # Rasterize actual faces; painter sorting can hide an attached window
    # behind the centre of a much larger backing facade.
    for poly, projected_poly, color in zip(
      polys,
      [np.column_stack([(p - origin) @ right, (p - origin) @ up]) for p in polys],
      scene["colors"],
      strict=True,
    ):
      normal = np.cross(poly[1] - poly[0], poly[2] - poly[0])
      length = np.linalg.norm(normal)
      if length < 1e-10:
        continue
      shade = 0.72 + 0.28 * abs(normal / length @ light)
      rgb = np.clip(np.array(color) * shade * 255, 0, 255).astype(np.uint8)
      vertices = (projected_poly - lo) * scale + offset
      depths = (poly - origin) @ direction
      for k in range(1, len(poly) - 1):
        ids = [0, k, k + 1]
        tri = vertices[ids]
        zz = depths[ids]
        xmin = max(0, int(np.floor(tri[:, 0].min())))
        xmax = min(size - 1, int(np.ceil(tri[:, 0].max())))
        ymin = max(0, int(np.floor(tri[:, 1].min())))
        ymax = min(size - 1, int(np.ceil(tri[:, 1].max())))
        if xmax < xmin or ymax < ymin:
          continue
        a, b, c = tri
        det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(det) < 1e-9:
          continue
        xx, yy = np.meshgrid(
          np.arange(xmin, xmax + 1) + 0.5, np.arange(ymin, ymax + 1) + 0.5
        )
        u = ((b[1] - c[1]) * (xx - c[0]) + (c[0] - b[0]) * (yy - c[1])) / det
        v = ((c[1] - a[1]) * (xx - c[0]) + (a[0] - c[0]) * (yy - c[1])) / det
        w = 1 - u - v
        depth = u * zz[0] + v * zz[1] + w * zz[2]
        old = zbuffer[ymin : ymax + 1, xmin : xmax + 1]
        keep = (u >= -1e-8) & (v >= -1e-8) & (w >= -1e-8) & (depth > old)
        old[keep] = depth[keep]
        image[ymin : ymax + 1, xmin : xmax + 1][keep] = rgb
    ax.imshow(image, origin="lower")
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_facecolor("#edf0ea")
    ax.set_title(
      f"{scene['name']}\n{'Orthogonal native' if scene['native'] else 'Drawn'}",
      fontsize=12,
    )
  fig.suptitle(
    "v274 · actual model matrices and retained source buildings", fontsize=17
  )
  fig.text(
    0.5,
    0.02,
    "Offline geometry inspection, no browser. Suhrkamp shows the two corrected west faces only; scene lighting and surrounding city omitted.",
    ha="center",
    fontsize=10,
  )
  fig.tight_layout(rect=[0, 0.04, 1, 0.95])
  out = cache / "north-culture-v274-models.png"
  fig.savefig(out, dpi=140)
  print(out)


if __name__ == "__main__":
  main()
