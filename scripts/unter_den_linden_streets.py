"""Bounded native avenue tops and exact source-bound station-mouth exclusions."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import shapely
from shapely.geometry import box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = (389500, 5820000)


def entrance_regions_world() -> list[list[float]]:
  """4m-cell aligned paving patches; exact apertures are cut by the stair model."""
  source = json.loads(
    (ROOT / "src/app/src/unterDenLindenEntranceSource.json").read_text()
  )
  regions = []
  for item in [*source["stairs"], *source["escalators"]]:
    ax, az = item["top"]
    bx, bz = item["bottom"]
    length = math.hypot(bx - ax, bz - az)
    nx, nz = -(bz - az) / length, (bx - ax) / length
    corners = [
      (x + s * nx * item["width"] / 2, z + s * nz * item["width"] / 2)
      for x, z in [(ax, az), (bx, bz)]
      for s in [-1, 1]
    ]
    regions.append(
      [
        math.floor((min(p[0] for p in corners) - 0.5) / 4) * 4,
        math.floor((min(p[1] for p in corners) - 0.5) / 4) * 4,
        math.ceil((max(p[0] for p in corners) + 0.5) / 4) * 4,
        math.ceil((max(p[1] for p in corners) + 0.5) / 4) * 4,
      ]
    )
  merged = []
  items = [*source["stairs"], *source["escalators"]]
  for ref in ("A", "B", "C", "D", "E"):
    selected = [r for item, r in zip(items, regions) if item["ref"] == ref]
    merged.append(
      [
        min(r[0] for r in selected),
        min(r[1] for r in selected),
        max(r[2] for r in selected),
        max(r[3] for r in selected),
      ]
    )
  return merged


def entrance_regions_metric():
  """The same patches in authoritative EPSG:25833."""
  return unary_union(
    [
      box(ORIGIN[0] + x0, ORIGIN[1] - z1, ORIGIN[0] + x1, ORIGIN[1] - z0)
      for x0, z0, x1, z1 in entrance_regions_world()
    ]
  )


def avenue_block_payload(approach: dict[str, Any]) -> dict[str, Any]:
  """Exposed 1m block tops, run-encoded with no hidden solid infill."""
  exclusion = entrance_regions_metric().buffer(math.sqrt(0.5))
  geometries = [
    approach[k].difference(exclusion) for k in ("asphalt", "paving", "gravel", "grass")
  ]
  geometries.append(
    approach["curbs"].buffer(0.5).intersection(approach["scope"]).difference(exclusion)
  )
  x0, y0, x1, y1 = approach["scope"].bounds
  xs = np.arange(math.floor(x0), math.ceil(x1)) + 0.5
  ys = np.arange(math.floor(y0), math.ceil(y1)) + 0.5
  xx, yy = np.meshgrid(xs, ys)
  points = shapely.points(xx, yy)
  classes = np.full(xx.shape, -1, dtype=np.int8)
  for kind, geometry in enumerate(geometries):
    classes[shapely.covers(geometry, points)] = kind
  runs = []
  for row, y in zip(classes, ys):
    start = 0
    for end in range(1, len(row) + 1):
      if end < len(row) and row[start] == row[end]:
        continue
      if row[start] >= 0:
        runs.append(
          [
            int(xs[start] - 0.5 - ORIGIN[0]),
            int(ORIGIN[1] - y - 0.5),
            end - start,
            int(row[start]),
          ]
        )
      start = end
  return {
    "schema_version": 1,
    "license": "ODbL-1.0",
    "cell_m": 1,
    "classes": ["asphalt", "paving", "gravel", "grass", "kerb"],
    "osm_sha256": approach["source"]["osm_sha256"],
    "runs": runs,
    "cell_count": sum(r[2] for r in runs),
    "policy": "Exact retained public-space partition sampled as native exposed block tops; all station mouths remain with their source-bound models.",
  }
