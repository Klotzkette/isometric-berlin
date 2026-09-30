"""Preserve exact terrain outside James-Simon's represented building and stairs."""

from __future__ import annotations

import base64
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import shapely
from shapely.geometry import Polygon, box
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from scripts.build_drawn_water_boundary import clip_cell, encoded

ROOT = Path(__file__).resolve().parents[1]
OPEN_PART_IDS = frozenset(
  {
    "DEBE3DRgYzniuE8d",
    "DEBE3DLE2UZsuGcF",
    "DEBE3DdiH2RPygTn",
    "DEBE3DyalNkqmhtt",
  }
)
EXCLUDED_CLASSES = frozenset({"water", "basin", "pond", "bridge"})
MAX_AFFECTED_CELLS = 400


def stair_footprint() -> Polygon:
  """Match only the authored u=28..78, v=.35..5.55 stair foundation."""
  length = math.hypot(0.636, 0.772)
  c, s = 0.636 / length, 0.772 / length
  return Polygon(
    [
      (1696.788 + c * u - s * v, -110.054 + s * u + c * v)
      for u, v in [(28, 0.35), (78, 0.35), (78, 5.55), (28, 5.55)]
    ]
  )


def building_footprint(source: dict[str, Any]) -> BaseGeometry:
  """Retain source holes and exclude all four open lower-colonnade parts."""
  return unary_union(
    [
      shapely.make_valid(Polygon(part["ring"], part.get("holes", [])))
      for part in source["parts"]
      if part["id"] not in OPEN_PART_IDS
    ]
  )


def existing_land_cells(
  boundary: dict[str, Any],
) -> dict[tuple[int, int], BaseGeometry]:
  """Decode the already clipped Float32 land, preserving its exact shoreline."""
  cells = np.frombuffer(base64.b64decode(boundary["cells_u32"]), dtype="<u4").reshape(
    -1, 6
  )
  points = np.frombuffer(
    base64.b64decode(boundary["triangles_f32"]), dtype="<f4"
  ).reshape(-1, 2)
  return {
    (int(x), int(z)): unary_union(
      [Polygon(t) for t in points[start : start + count].reshape(-1, 3, 2)]
    )
    for x, z, start, count, _, _ in cells
  }


def build_payload(
  ground: dict[str, Any],
  source: dict[str, Any],
  shoreline: dict[str, Any],
  source_sha: str,
  ground_sha: str,
  shoreline_sha: str,
) -> dict[str, Any]:
  """Encode bounded terrain complements for the existing runtime slab helper."""
  if ground["cell_m"] != 4 or ground["grid"] != shoreline["grid"]:
    raise ValueError("James-Simon terrain requires the shared four-metre grid")
  if shoreline["cell_m"] != ground["cell_m"]:
    raise ValueError("Shoreline and ground cells differ")
  if shoreline["ground_sha256"] != ground_sha:
    raise ValueError("Shoreline does not describe the retained ground payload")
  body, stairs = building_footprint(source), stair_footprint()
  footprint = body.union(stairs)
  shore_land = existing_land_cells(shoreline)
  cell_m, grid = ground["cell_m"], ground["grid"]
  min_x, min_z = grid["min_x_idx"], grid["min_z_idx"]
  min_wx, min_wz, max_wx, max_wz = footprint.bounds
  cells: list[int] = []
  triangles: list[float] = []
  edges: list[float] = []
  by_class: dict[str, dict[str, int | float]] = {}
  available_area = removed_area = preserved_area = 0.0
  shore_cells = fully_removed = 0
  for z_offset, row in enumerate(ground["ground_rows"]):
    z = (min_z + z_offset) * cell_m
    if z + cell_m <= min_wz or z >= max_wz:
      continue
    for x_start, length, class_id in row:
      kind = ground["classes"][class_id]
      if kind in EXCLUDED_CLASSES:
        continue
      low = max(x_start, math.floor(min_wx / cell_m) - min_x)
      high = min(x_start + length, math.ceil(max_wx / cell_m) - min_x)
      for x_offset in range(low, high):
        x = (min_x + x_offset) * cell_m
        tile = box(x, z, x + cell_m, z + cell_m)
        if tile.intersection(footprint).area <= 0:
          continue
        key = (x_offset, z_offset)
        land = shore_land.get(key, tile)
        retained_triangles, retained_edges, removed = clip_cell(land, footprint)
        cells.extend(
          [
            x_offset,
            z_offset,
            len(triangles) // 2,
            len(retained_triangles) // 2,
            len(edges) // 2,
            len(retained_edges) // 2,
          ]
        )
        triangles.extend(retained_triangles)
        edges.extend(retained_edges)
        available_area += land.area
        removed_area += removed
        preserved_area += land.area - removed
        shore_cells += key in shore_land
        fully_removed += not retained_triangles
        values = by_class.setdefault(
          kind, {"cells": 0, "removed_m2": 0.0, "preserved_m2": 0.0}
        )
        values["cells"] += 1
        values["removed_m2"] += removed
        values["preserved_m2"] += land.area - removed
  count = len(cells) // 6
  if count > MAX_AFFECTED_CELLS:
    raise ValueError(f"James-Simon terrain exceeds its {MAX_AFFECTED_CELLS}-cell scope")
  return {
    "format": "exact-drawn-water-boundary",
    "version": 1,
    "purpose": "james-simon-building-and-stair-terrain-complement",
    "source_sha256": source_sha,
    "source_lod2_sha256": source["source_sha256"],
    "ground_sha256": ground_sha,
    "water_boundary_sha256": shoreline_sha,
    "water_source_sha256": shoreline["source_sha256"],
    "cell_m": cell_m,
    "grid": grid,
    "ownership": {
      "parent_id": source["parent_id"],
      "closed_part_ids": [
        p["id"] for p in source["parts"] if p["id"] not in OPEN_PART_IDS
      ],
      "excluded_open_part_ids": sorted(OPEN_PART_IDS),
      "stair_local_bounds": {"u": [28, 78], "v": [0.35, 5.55]},
      "source_building_area_m2": body.area,
      "authored_stair_area_m2": stairs.area,
      "combined_footprint_area_m2": footprint.area,
      "bounds_world_xz_m": list(footprint.bounds),
      "excluded_ground_classes": sorted(EXCLUDED_CLASSES),
    },
    "affected_cells": count,
    "existing_shoreline_cells": shore_cells,
    "fully_removed_cells": fully_removed,
    "available_land_before_cut_m2": available_area,
    "removed_building_intrusion_m2": removed_area,
    "preserved_land_m2": preserved_area,
    "preserved_water_exclusion_m2": count * cell_m * cell_m - available_area,
    "by_class": by_class,
    "cells_u32": encoded(cells, "<u4"),
    "triangles_f32": encoded(triangles, "<f4"),
    "edges_f32": encoded(edges, "<f4"),
  }


def main() -> None:
  """Regenerate only the bounded table from committed exact source records."""
  ground_path = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
  source_path = ROOT / "src/app/src/jamesSimonSource.json"
  water_path = ROOT / "src/app/src/data/drawnWaterBoundary.json"
  ground_bytes, source_bytes, water_bytes = (
    p.read_bytes() for p in (ground_path, source_path, water_path)
  )
  output = build_payload(
    json.loads(ground_bytes),
    json.loads(source_bytes),
    json.loads(water_bytes),
    hashlib.sha256(source_bytes).hexdigest(),
    hashlib.sha256(ground_bytes).hexdigest(),
    hashlib.sha256(water_bytes).hexdigest(),
  )
  target = ROOT / "src/app/src/data/jamesSimonTerrainBoundary.json"
  target.write_text(json.dumps(output, separators=(",", ":")) + "\n")
  print(
    json.dumps(
      {k: v for k, v in output.items() if not k.endswith(("_u32", "_f32"))}, indent=2
    )
  )
  print(f"Wrote {target.stat().st_size:,} bytes")


if __name__ == "__main__":
  main()
