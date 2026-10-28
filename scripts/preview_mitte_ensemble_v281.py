"""Finite source-plane diagnostic, not a substitute for the live whole-scene check."""

import sys
from pathlib import Path

import matplotlib
import numpy as np

matplotlib.use("Agg")
import build_mitte_ensemble_v281 as m
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection


def preview(path: Path):
  source = m.read(m.SOURCE)
  fig, axes = plt.subplots(2, 3, figsize=(15, 9), facecolor="#d7d9d5")
  keys = [
    "red-court",
    "new-side",
    "ganymed-niche",
    "splendid",
    "hypothekenbank",
    "ganymed-awning-south",
  ]
  for ax, key in zip(axes.flat, keys):
    first, last, base, top = m.reference(key)
    tangent = (last - first) / np.linalg.norm(last - first)
    rows = []
    for b in source["buildings"]:
      for p in b["parts"]:
        for si, s in enumerate(p["surfaces"]):
          if m.target_key(b["id"], p["id"], si) != key:
            continue
          o, n, *_ = m.surface_plane(s)
          for tri, color, role in m.fittings(s, key).triangles:
            pts = np.array(tri)
            depth = float((pts.mean(0) - o) @ n)
            rows.append(
              (
                depth,
                np.column_stack(((pts[:, [0, 2]] - first) @ tangent, pts[:, 1])),
                np.array(color) / 255,
              )
            )
    rows.sort(key=lambda r: r[0])
    ax.add_collection(
      PolyCollection(
        [p for _, p, _ in rows], facecolors=[c for _, _, c in rows], edgecolors="none"
      )
    )
    ax.set(
      xlim=(-0.6, float(np.linalg.norm(last - first)) + 0.6),
      ylim=(base - 0.5, top + 0.5),
      title=key,
    )
    ax.set_aspect("equal")
    ax.set_facecolor("#8b9693")
    ax.set_xlabel("source facade metres")
    ax.set_ylabel("world height (m)")
  fig.suptitle(
    "v281 — measured facade planes with estimated architectural fittings\nDiagnostic elevations; original building bodies/roofs remain in the viewer",
    fontsize=13,
  )
  fig.tight_layout()
  fig.savefig(path, dpi=130)
  plt.close(fig)


if __name__ == "__main__":
  preview(Path(sys.argv[1]))
