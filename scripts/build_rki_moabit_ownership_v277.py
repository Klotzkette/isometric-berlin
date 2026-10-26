"""Exact retirement receipts for the seventeen obsolete RKI and Moabit power-station core owners.

This writes no building source or replacement geometry. The separately evidenced
model owns the complete site; these receipts keep its obsolete presentation
prisms and exclusive native column tuples independently verifiable.
"""

from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path

from shapely.geometry import Polygon, box, mapping
from shapely.ops import unary_union

from scripts.build_rki_moabit_v277 import OLD_IDS

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "src/app/public/mesh/regierungsviertel"
OUTPUT = ROOT / "src/app/src/data/rkiMoabitV277Ownership.json"
FULL_IDS = OLD_IDS


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
  assert len(set(ids)) == 17
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
    "site": "Robert Koch-Institut Nordufer and Heizkraftwerk Moabit",
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
    "policy": "All source files remain unchanged. Only exact seventeen original prism records and exclusive complete native column tuples yield after the complete required replacement is constructed. Changed, missing or duplicated owners and new or changed overlapping neighbours fail closed; ground, trees, water and shared columns never yield.",
  }


def reconciliation() -> dict:
  """Expose old/new RKI and plant contour conflicts, without calling them empty."""
  geo = ROOT / "geo_data/regierungsviertel"
  source = json.loads(
    gzip.decompress((geo / "rki-moabit-v277-source.json.gz").read_bytes())
  )
  old = [
    p
    for p in json.loads(OUTPUT.read_bytes())["previousPrisms"]
    if p["id"] in OLD_IDS[:12]
  ]
  new = unary_union(
    [
      Polygon(p["ring"], p["holes"])
      for parent in source["parents"]
      if parent["site"] != "decks"
      for p in parent["parts"]
    ]
  )
  previous = unary_union([polygon(p) for p in old])
  difference = previous.difference(new)
  return {
    "source": "Complete official source sheets versus exact twelve coarse OSM presentation prisms; differences are preserved as evidence, never used as a spatial erasure mask. Current recognition replacement uses full official bodies, including setbacks and separated connecting parts.",
    "oldUnionM2": previous.area,
    "newUnionM2": new.area,
    "oldOnlyM2": difference.area,
    "newOnlyM2": new.difference(previous).area,
    "oldOnlyGeometry": mapping(difference),
    "rows": [
      {
        "oldId": p["id"],
        "oldAreaM2": polygon(p).area,
        "intersectionM2": polygon(p).intersection(new).area,
        "oldOnlyM2": polygon(p).difference(new).area,
        "oldOnlyGeometry": mapping(polygon(p).difference(new)),
      }
      for p in old
    ],
    "bdomSpotChecks": json.loads(
      (geo / "rki-moabit-v277-footprint-bdom.json").read_bytes()
    ),
    "limits": "Old and official outlines disagree. Narrow-edge bDOM samples are ambiguous and do not establish an empty surface or demolition. No unrecorded whole-structure removal is asserted. All complete selected LoD2 parents remain preserved and rendered, except false wall curtains of explicit open canopies.",
  }


if __name__ == "__main__":
  payload = build()
  OUTPUT.write_text(
    json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  (
    ROOT / "geo_data/regierungsviertel/rki-moabit-v277-footprint-reconciliation.json"
  ).write_text(json.dumps(reconciliation(), separators=(",", ":")) + "\n")
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
