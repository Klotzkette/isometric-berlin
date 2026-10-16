"""Exact core-prism/native-column receipts for complete required townhall shells."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
PRISMS = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
VOXELS = ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
OUTPUT = ROOT / "src/app/src/data/townhallV227CorePrevious.json"
OWNERS = {
  "11048538": "DEBE01YYK0002O8g",
  "n-198259": "DEBE01YYK0003v8d",
  "n-915481": "DEBE02YY400000iL",
  "n-957286": "DEBE01YYK00040vj",
}


def polygon(row: dict[str, Any]) -> Polygon:
  """Read original decimetre rings, retaining every courtyard."""
  return Polygon(
    [(x / 10, z / 10) for x, z in row["ring"]],
    [[(x / 10, z / 10) for x, z in ring] for ring in row.get("holes", [])],
  )


def build() -> dict[str, Any]:
  """Select only uncontested columns of the independently recorded owners."""
  raw, voxel_raw = PRISMS.read_bytes(), VOXELS.read_bytes()
  prisms, voxels = json.loads(raw)["buildings"], json.loads(voxel_raw)
  selected = [row for row in prisms if row["id"] in OWNERS]
  assert len(selected) == len(OWNERS)
  polygons = [(row, polygon(row)) for row in prisms]
  cell, grid = voxels["cell_m"], voxels["grid"]
  receipts = []
  for owner in selected:
    shape = polygon(owner)
    neighbours = [
      p for row, p in polygons if row["id"] != owner["id"] and p.intersects(shape)
    ]
    columns = []
    snapped = math.ceil(owner["h_dm"] / (cell * 10)) * cell * 10
    bottom, top = owner["y0_dm"], owner["y0_dm"] + snapped
    for zi, runs in enumerate(voxels["building_rows"]):
      z = grid["min_z_idx"] + zi
      if not shape.bounds[1] <= (z + 0.5) * cell <= shape.bounds[3]:
        continue
      for xo, count, y0, y1, kind in runs:
        if kind != 3 or (y0, y1) not in {(bottom, top), (top, top + cell * 10)}:
          continue
        for xi in range(xo, xo + count):
          x = grid["min_x_idx"] + xi
          point = Point((x + 0.5) * cell, (z + 0.5) * cell)
          if shape.contains(point) and not any(p.covers(point) for p in neighbours):
            columns.append([x, z, y0, y1, kind])
    assert columns, owner["id"]
    receipts.append(
      {"prism": owner, "replacementParent": OWNERS[owner["id"]], "columns": columns}
    )
  return {
    "schema": "townhall-core-transfer-v227/1",
    "prismSource": str(PRISMS.relative_to(ROOT)),
    "prismSha256": hashlib.sha256(raw).hexdigest(),
    "voxelSource": str(VOXELS.relative_to(ROOT)),
    "voxelSha256": hashlib.sha256(voxel_raw).hexdigest(),
    "cellM": cell,
    "policy": "Exact full original prism equality; exact native row equality; only original owner centres and no unrelated owner at that centre. Required complete LoD2 shells retain every source sheet.",
    "owners": receipts,
  }


if __name__ == "__main__":
  result = build()
  OUTPUT.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  print({owner["prism"]["id"]: len(owner["columns"]) for owner in result["owners"]})
