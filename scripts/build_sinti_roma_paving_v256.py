"""Prepare bounded, explicitly estimated fractured memorial paving (Step 10)."""

import json
import math
from pathlib import Path

from shapely import MultiPoint, Point, voronoi_polygons

ROOT = Path(__file__).resolve().parents[1]


def build_paving() -> dict:
  """Return 237 fitted granite shards without sampling or tracing photograph pixels."""
  count = 237
  seeds = []
  for index in range(count):
    # Equal-area sunflower seeds avoid a spoke-like paving pattern.
    radius = math.sqrt(6.27**2 + (index + 0.5) / count * (9.55**2 - 6.27**2))
    angle = index * math.pi * (3 - math.sqrt(5))
    seeds.append((radius * math.cos(angle), radius * math.sin(angle)))
  annulus = (
    Point(0, 0)
    .buffer(9.55, quad_segs=32)
    .difference(Point(0, 0).buffer(6.27, quad_segs=32))
  )
  cells = voronoi_polygons(MultiPoint(seeds), ordered=True)
  shards = []
  for index, cell in enumerate(cells.geoms):
    shard = cell.intersection(annulus).buffer(-0.045, join_style="mitre")
    assert shard.geom_type == "Polygon" and not shard.interiors
    named = (index + 1) * 69 // count > index * 69 // count
    shards.append(
      {
        "named": named,
        "ring": [[round(x, 4), round(z, 4)] for x, z in shard.exterior.coords[:-1]],
        "center": [round(shard.centroid.x, 4), round(shard.centroid.y, 4)],
      }
    )
  return {
    "schemaVersion": 1,
    "status": "Procedural visual estimates, not surveyed or photograph-traced stone outlines",
    "innerRadiusM": 6.27,
    "outerRadiusM": 9.55,
    "minimumJointM": 0.09,
    "namedCount": 69,
    "unlabelledCount": 168,
    "shards": shards,
  }


if __name__ == "__main__":
  destination = ROOT / "src/app/src/data/sintiRomaPavingV256.json"
  destination.write_text(json.dumps(build_paving(), separators=(",", ":")) + "\n")
