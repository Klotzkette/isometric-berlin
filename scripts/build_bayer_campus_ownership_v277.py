"""Exact retirement of one flattened Bayer administration prism.

This writes no building source or replacement geometry. The separately evidenced
model owns the complete site; these receipts keep its obsolete presentation
prisms and exclusive native column tuples independently verifiable.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from shapely.geometry import Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "src/app/public/mesh/regierungsviertel"
OUTPUT = ROOT / "src/app/src/data/bayerCampusV277Ownership.json"
FULL_IDS = ("DEBE01YYK0004qx3",)


def polygon(part: dict) -> Polygon:
  """Decode only the retained source's decimetre presentation coordinates."""
  return Polygon(
    [(x / 10, z / 10) for x, z in part["ring"]],
    [[(x / 10, z / 10) for x, z in ring] for ring in part.get("holes", [])],
  )


def build() -> dict:
  """Bind exact prisms and complete voxel tuples, never a spatial erase mask."""
  inputs = [BASE / "lod2-prisms.json", BASE / "minecraft-voxels.json"]
  prism_payload, voxel = [json.loads(path.read_bytes()) for path in inputs]
  prisms = prism_payload["buildings"]
  ids = [identifier[-8:] for identifier in FULL_IDS]
  assert len(set(ids)) == 1
  assert all(
    identifier == "DEBE01YY" + short
    for identifier, short in zip(FULL_IDS, ids, strict=True)
  )
  previous = []
  for identifier in ids:
    matches = [p for p in prisms if p["id"] == identifier]
    assert len(matches) == 1, f"Missing or ambiguous source owner: {identifier}"
    previous.append(matches[0])
  selected = unary_union([polygon(p) for p in previous])
  assert selected.is_valid
  cell, grid = voxel["cell_m"], voxel["grid"]
  assert cell == 4 and voxel["schema_version"] == 2
  bounds = list(selected.bounds)
  nearby = selected.envelope.buffer(cell * 2)
  neighbours = [
    p for p in prisms if p["id"] not in ids and polygon(p).envelope.intersects(nearby)
  ]
  occupied = unary_union([polygon(p) for p in neighbours])
  columns, shared = [], []
  for zi, runs in enumerate(voxel["building_rows"]):
    iz = grid["min_z_idx"] + zi
    if not bounds[1] - cell <= iz * cell <= bounds[3]:
      continue
    for offset, count, low, high, kind in runs:
      assert voxel["classes"][kind] in {"concrete", "glass"}
      for ix in range(grid["min_x_idx"] + offset, grid["min_x_idx"] + offset + count):
        if not bounds[0] - cell <= ix * cell <= bounds[2]:
          continue
        square = box(ix * cell, iz * cell, (ix + 1) * cell, (iz + 1) * cell)
        if selected.intersection(square).area <= 0.001:
          continue
        row = [ix, iz, low, high, kind]
        (shared if occupied.intersection(square).area > 0.001 else columns).append(row)
  assert columns and len({tuple(c) for c in columns}) == len(columns)
  return {
    "schemaVersion": 1,
    "site": "Bayer administration, Müllerstraße 178",
    "osmSite": "way/420830351",
    "sourceIds": list(FULL_IDS),
    "cellM": cell,
    "bounds": bounds,
    "previousPrisms": previous,
    "neighbours": neighbours,
    "columns": columns,
    "retainedSharedColumns": shared,
    "inputs": [
      {
        "path": str(path.relative_to(ROOT)),
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      }
      for path in inputs
    ],
    "policy": "All source files remain unchanged. Only exact original administration prism and exclusive complete native column tuples yield after the complete required replacement is constructed. Changed, missing or duplicated owners and new or changed overlapping neighbours fail closed; ground, trees, water and shared columns never yield.",
  }


if __name__ == "__main__":
  payload = build()
  OUTPUT.write_text(
    json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  print(
    json.dumps(
      {
        "prisms": len(payload["previousPrisms"]),
        "columns": len(payload["columns"]),
        "shared": len(payload["retainedSharedColumns"]),
        "neighbours": len(payload["neighbours"]),
        "bytes": OUTPUT.stat().st_size,
      }
    )
  )
