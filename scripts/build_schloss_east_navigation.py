"""Step 10: compact exact footprint support for the already drawn eastern lobe."""

from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/app/src/data/schlossEastNavigation.json"


def footprint(surface: dict):
  """Decode only the committed surface triangles; never buffer their bounds."""
  points = np.frombuffer(base64.b64decode(surface["positions_cm_b64"]), "<i4")
  points = points.reshape(-1, 2) / 100
  indices = np.frombuffer(base64.b64decode(surface["indices_b64"]), "<u4")
  return unary_union(shapely.polygons(points[indices.reshape(-1, 3)]))


def polygon_records(geometry) -> list[dict]:
  """Keep exact polygon rings, holes and metric bounding boxes."""
  if isinstance(geometry, Polygon):
    if geometry.is_empty or geometry.area < 1e-8:
      return []
    return [
      {
        "bounds": list(geometry.bounds),
        "ring": [list(point) for point in geometry.exterior.coords],
        "holes": [[list(point) for point in r.coords] for r in geometry.interiors],
      }
    ]
  return [p for g in getattr(geometry, "geoms", []) for p in polygon_records(g)]


def build(root: Path = ROOT) -> dict:
  """Prepare the rendered footprint beyond the original terrain grid only."""
  folder = root / "src/app/src/data"
  street_path = folder / "schlossEastStreets.json"
  native_path = folder / "schlossEastBlockStreets.json"
  ground_path = root / "src/app/public/mesh/regierungsviertel/ground-context.json"
  streets = json.loads(street_path.read_text())
  native = json.loads(native_path.read_text())
  ground = json.loads(ground_path.read_text())
  grid, heights = ground["grid"], ground["ground_height"]
  grid_east = (grid["min_x_idx"] + grid["cols"]) * ground["cell_m"]
  # Both current street renderers clamp beyond the grid to this constant east
  # edge. This is presentation fallback, not a surveyed eastern elevation.
  edge = heights["y_dm"][heights["cols"] - 1 :: heights["cols"]]
  assert set(edge) == {52}, (
    "Regenerate an interpolated height profile if the edge changes"
  )
  blank = footprint(streets["blank_extension"])
  scope = blank.intersection(box(grid_east, -10000, 10000, 10000))
  surfaces = []
  for surface in streets["surfaces"]:
    surfaces.append(
      {
        "kind": surface["kind"],
        "polygons": polygon_records(footprint(surface).intersection(scope)),
      }
    )
  # Preserve the actual native top courses; no extra grid generation is needed.
  runs = []
  for x, z, length, kind in native["runs"]:
    if kind != 0 or x + length <= grid_east:
      continue
    start = max(x, grid_east)
    runs.append([start, z, x + length - start])
  return {
    "schema_version": 1,
    "ground_y_m": 5.2,
    "height_policy": "Existing renderer's clamped east-edge display fallback; not surveyed terrain.",
    "original_grid_east_m": grid_east,
    "bounds": list(scope.bounds),
    "footprint": polygon_records(scope),
    "surfaces": surfaces,
    "native_runs": runs,
    "source_sha256": {
      p.name: hashlib.sha256(p.read_bytes()).hexdigest()
      for p in [street_path, native_path, ground_path]
    },
  }


if __name__ == "__main__":
  result = build()
  OUTPUT.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  print(f"{OUTPUT.name}: {OUTPUT.stat().st_size} bytes")
