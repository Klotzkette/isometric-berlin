"""Clip only raster land cells crossing the renderer's exact water boundary."""

from __future__ import annotations

import base64
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import numpy as np
import shapely
from shapely.geometry import Polygon, box
from shapely.geometry.base import BaseGeometry
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


def polygon_parts(geometry: BaseGeometry) -> list[Polygon]:
  """Keep every nonempty polygon, including tiny valid land remnants."""
  if geometry.is_empty:
    return []
  if isinstance(geometry, Polygon):
    return [geometry]
  return [
    part for item in getattr(geometry, "geoms", []) for part in polygon_parts(item)
  ]


def clip_cell(
  cell: Polygon, water: BaseGeometry
) -> tuple[list[float], list[float], float]:
  """Return exact land triangles, oriented perimeter segments and removed area."""
  land = cell.difference(water)
  triangles: list[float] = []
  edges: list[float] = []
  area = 0.0
  for part in polygon_parts(land):
    part = orient(part, sign=1)
    area += part.area
    for triangle in shapely.constrained_delaunay_triangles(part).geoms:
      coords = list(orient(triangle, sign=1).exterior.coords)[:3]
      triangles.extend(value for point in coords for value in point)
    for ring in [part.exterior, *part.interiors]:
      coords = list(ring.coords)
      for a, b in zip(coords, coords[1:]):
        edges.extend([a[0], a[1], b[0], b[1]])
  return triangles, edges, cell.area - area


def encoded(values: list[float] | list[int], dtype: str) -> str:
  """Use compact numeric buffers without startup polygon/point object graphs."""
  return base64.b64encode(np.asarray(values, dtype=dtype).tobytes()).decode("ascii")


def build_payload(
  ground: dict[str, Any], source: dict[str, Any], ground_sha: str
) -> dict[str, Any]:
  """Prepare exact per-cell complements; heights and paint remain runtime-owned."""
  parts = [shapely.make_valid(Polygon(p["ring"], p["holes"])) for p in source["water"]]
  water = unary_union(parts)
  cell_m = ground["cell_m"]
  grid = ground["grid"]
  min_x, min_z = grid["min_x_idx"], grid["min_z_idx"]
  min_wx, min_wz, max_wx, max_wz = water.bounds
  cells: list[int] = []
  triangle_positions: list[float] = []
  edge_positions: list[float] = []
  by_class: dict[str, dict[str, float | int]] = {}
  region_stats = {
    name: {"cells": 0, "removed_m2": 0.0} for name in ["hauptbahnhof", "otto_weidt"]
  }
  regions = {
    "hauptbahnhof": box(-600, -1100, 600, -100),
    "otto_weidt": box(-300, -1800, 500, -1100),
  }
  total_removed = 0.0
  fully_water = 0
  for z_offset, row in enumerate(ground["ground_rows"]):
    z = (min_z + z_offset) * cell_m
    if z + cell_m < min_wz or z > max_wz:
      continue
    for x_start, length, class_id in row:
      kind = ground["classes"][class_id]
      if kind in {"water", "basin", "pond", "bridge"}:
        continue
      x0, x1 = (min_x + x_start) * cell_m, (min_x + x_start + length) * cell_m
      if x1 < min_wx or x0 > max_wx:
        continue
      run_water = water.intersection(box(x0, z, x1, z + cell_m))
      if run_water.is_empty or run_water.area == 0:
        continue
      low, _, high, _ = run_water.bounds
      for offset in range(length):
        x = x0 + offset * cell_m
        if x + cell_m < low or x > high:
          continue
        tile = box(x, z, x + cell_m, z + cell_m)
        if not tile.intersects(run_water) or tile.intersection(run_water).area == 0:
          continue
        triangles, edges, removed = clip_cell(tile, run_water)
        if removed <= 0:
          continue
        # Record each complete affected cell even when it has no remaining land.
        cells.extend(
          [
            x_start + offset,
            z_offset,
            len(triangle_positions) // 2,
            len(triangles) // 2,
            len(edge_positions) // 2,
            len(edges) // 2,
          ]
        )
        triangle_positions.extend(triangles)
        edge_positions.extend(edges)
        total_removed += removed
        fully_water += not triangles
        values = by_class.setdefault(kind, {"cells": 0, "removed_m2": 0.0})
        values["cells"] += 1
        values["removed_m2"] += removed
        for name, region in regions.items():
          if region.covers(tile):
            region_stats[name]["cells"] += 1
            region_stats[name]["removed_m2"] += removed
  return {
    "format": "exact-drawn-water-boundary",
    "version": 1,
    "source_sha256": source["source_sha256"],
    "ground_sha256": ground_sha,
    "cell_m": cell_m,
    "grid": grid,
    "water_polygon_count": len(source["water"]),
    "water_kinds": {
      kind: sum(p["kind"] == kind for p in source["water"])
      for kind in sorted({p["kind"] for p in source["water"]})
    },
    "affected_cells": len(cells) // 6,
    "fully_water_cells": fully_water,
    "removed_raster_intrusion_m2": total_removed,
    "preserved_land_m2": len(cells) // 6 * cell_m * cell_m - total_removed,
    "by_class": by_class,
    "regions": region_stats,
    "cells_u32": encoded(cells, "<u4"),
    "triangles_f32": encoded(triangle_positions, "<f4"),
    "edges_f32": encoded(edge_positions, "<f4"),
  }


def main() -> None:
  """Regenerate the bounded derived data from unchanged canonical inputs."""
  ground_path = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
  ground_bytes = ground_path.read_bytes()
  with tempfile.TemporaryDirectory(prefix="drawn-water-boundary-") as temporary:
    prepared = Path(temporary) / "source.json"
    subprocess.run(
      ["bun", "scripts/prepare-water-boundary-source.ts", str(prepared)],
      cwd=ROOT / "src/app",
      check=True,
    )
    source = json.loads(prepared.read_text())
  payload = build_payload(
    json.loads(ground_bytes), source, hashlib.sha256(ground_bytes).hexdigest()
  )
  target = ROOT / "src/app/src/data/drawnWaterBoundary.json"
  target.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
  print(
    json.dumps(
      {
        key: value
        for key, value in payload.items()
        if not key.endswith(("_u32", "_f32"))
      },
      indent=2,
    )
  )
  print(f"Wrote {target.stat().st_size:,} bytes")


if __name__ == "__main__":
  main()
