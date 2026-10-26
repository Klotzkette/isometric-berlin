"""Small orthographic geometry inspection; no browser, textures or photograph assets."""

from __future__ import annotations

import gzip
import json
from pathlib import Path

import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection

from scripts.build_opera_theatres_v274 import GEO

CORNERS = (
  np.array(
    [
      [-1, -1, -1],
      [1, -1, -1],
      [1, 1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ],
    float,
  )
  / 2
)
FACES = [
  [0, 1, 2, 3],
  [4, 7, 6, 5],
  [0, 4, 5, 1],
  [3, 2, 6, 7],
  [1, 5, 6, 2],
  [0, 3, 7, 4],
]


def box_faces(row):
  p = CORNERS * np.array(row[3:6])
  angle = row[6]
  m = np.array(
    [[np.cos(angle), 0, np.sin(angle)], [0, 1, 0], [-np.sin(angle), 0, np.cos(angle)]]
  )
  p = p @ m.T + np.array(row[:3])
  return [p[face] for face in FACES]


def main():
  data = json.loads(
    gzip.decompress((GEO / "opera-theatres-v274-source.json.gz").read_bytes())
  )
  fig, axes = plt.subplots(2, 2, figsize=(13, 10), facecolor="#edf0ea")
  for j, (name, ids, target, view) in enumerate(
    [
      (
        "Schillertheater",
        [p["parentId"] for p in data["parents"] if p["name"] == "Schillertheater"],
        [-3615, 16, 745],
        [70, 65, -125],
      ),
      (
        "Deutsche Oper",
        [p["parentId"] for p in data["parents"] if p["name"] == "Deutsche Oper Berlin"],
        [-4290, 17, 603],
        [120, 95, 150],
      ),
    ]
  ):
    for i, native in enumerate([False, True]):
      ax = axes[i, j]
      polygons = []
      tones = []
      if not native:
        for s in data["surfaces"]:
          if s["parentId"] in ids:
            for triangle in s["triangles"]:
              polygons.append(np.asarray(triangle))
              tones.append(s["color"])
      rows = (
        (data["nativeBlocks"] + data["nativeDetails"])
        if native
        else data["facadeBoxes"]
      )
      for row in rows:
        if not (-3700 < row[0] < -3500 if j == 0 else -4400 < row[0] < -4200):
          continue
        for face in box_faces(row):
          polygons.append(face)
          tones.append(row[7])
      direction = np.asarray(view, float)
      direction /= np.linalg.norm(direction)
      right = np.cross([0, 1, 0], direction)
      right /= np.linalg.norm(right)
      up = np.cross(direction, right)
      projected = []
      depth = []
      colors = []
      light = np.array([0.4, 0.85, 0.35])
      light /= np.linalg.norm(light)
      for poly, tone in zip(polygons, tones, strict=True):
        rel = poly - target
        projected.append(np.column_stack([rel @ right, rel @ up]))
        depth.append(np.mean(rel @ direction))
        normal = np.cross(poly[1] - poly[0], poly[2] - poly[0])
        length = np.linalg.norm(normal)
        shade = 0.72 + 0.28 * (abs(np.dot(normal / length, light)) if length else 1)
        colors.append([((int(tone) >> k) & 255) / 255 * shade for k in [16, 8, 0]])
      order = np.argsort(depth)
      ax.add_collection(
        PolyCollection(
          [projected[k] for k in order],
          facecolors=[colors[k] for k in order],
          edgecolors="none",
          rasterized=True,
        )
      )
      points = np.concatenate(projected)
      lo = points.min(axis=0)
      hi = points.max(axis=0)
      pad = (hi - lo) * 0.08
      ax.set_xlim(lo[0] - pad[0], hi[0] + pad[0])
      ax.set_ylim(lo[1] - pad[1], hi[1] + pad[1])
      ax.set_aspect("equal")
      ax.axis("off")
      ax.set_facecolor("#edf0ea")
      ax.set_title(
        f"{name} · {'independent native cells' if native else 'measured roofs + facade details'}",
        fontsize=12,
      )
  fig.suptitle(
    "v274 geometry inspection — complete source buildings, full details in both modes",
    fontsize=15,
  )
  fig.text(
    0.5,
    0.025,
    "Offline projection of retained surface triangles and actual construction boxes. Lettering and earlier v182 roof ink omitted.",
    ha="center",
    fontsize=9,
  )
  fig.tight_layout(rect=[0, 0.05, 1, 0.96])
  out = Path.home() / ".cache/codex-berlin-v274/opera-theatres-models.png"
  fig.savefig(out, dpi=140)
  print(out)


if __name__ == "__main__":
  main()
