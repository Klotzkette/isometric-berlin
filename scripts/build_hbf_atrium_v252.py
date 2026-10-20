"""Remove only raster ground that falsely closes the existing Hbf atrium."""

from __future__ import annotations

import base64
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from shapely.affinity import affine_transform
from shapely.geometry import box, mapping
from shapely.ops import unary_union

from scripts.build_drawn_water_boundary import encoded
from scripts.build_hbf_north_approach import terrain_complement

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"


def atrium_footprint():
  """Match retained gallery edges, foyer, bridges and service-pavilion landing."""
  arms = unary_union([box(-9.5, 20, 9.5, 82), box(-9.5, -82, 9.5, -20)])
  supports = unary_union(
    [
      box(-9.9, 46.9, 9.9, 52.1),
      box(-9.9, -52.1, 9.9, -46.9),
      box(-4.8, 29.9, 4.8, 44.1),
    ]
  )
  angle = math.radians(21.82)
  c, s = math.cos(angle), math.sin(angle)
  return affine_transform(arms.difference(supports), [c, s, -s, c, -119.936, -683.307])


def decode(data: dict, field: str, dtype: str) -> np.ndarray:
  """Read existing compact numeric records without changing their values."""
  return np.frombuffer(base64.b64decode(data[field]), dtype=dtype)


def main() -> None:
  """Combine with the old north-cut table so one existing material pair suffices."""
  ground_path = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
  ground_bytes = ground_path.read_bytes()
  north_bytes = (DATA / "hbfNorthRailTerrainBoundary.json").read_bytes()
  north = json.loads(north_bytes)
  footprint = atrium_footprint()
  receipt = {
    "purpose": "Exact already-rendered Hbf ground-floor daylight-slot ownership",
    "anchorWorld": [-119.936, 4.575, -683.307],
    "rotationDegrees": 21.82,
    "localArms": [[-9.5, 20, 9.5, 82], [-9.5, -82, 9.5, -20]],
    "retainedLocalSupports": [
      [-9.9, 46.9, 9.9, 52.1],
      [-9.9, -52.1, 9.9, -46.9],
      [-4.8, 29.9, 4.8, 44.1],
    ],
    "footprint": mapping(footprint),
    "source": "ArchitecturalLandmarks.addStationInterior and HauptbahnhofAccessProfile; authored display dimensions, not a new survey",
    "originalGroundSha256": hashlib.sha256(ground_bytes).hexdigest(),
    "originalNorthCutSha256": hashlib.sha256(north_bytes).hexdigest(),
    "identifiedOccluder": {
      "mesh": "Drawn ground slabs",
      "instance": 68954,
      "faceIndex": 4,
      "hitWorld": [-144.093787275, 5.200000048, -751.383340055],
      "rayFromLocal": [0, 7, -68],
      "rayToLocal": [9.5, -14.055, -81.8],
    },
    "policy": "Drawn-only exact raster complement. Preserve every outside fragment and original top/bottom/paint; retain all slabs, stair carriers, native ground and navigation.",
  }
  receipt_bytes = json.dumps(receipt, separators=(",", ":")).encode()
  receipt_sha = hashlib.sha256(receipt_bytes).hexdigest()
  source = {
    "cut": [
      {
        "ring": list(p.exterior.coords),
        "holes": [list(r.coords) for r in p.interiors],
      }
      for p in footprint.geoms
    ]
  }
  atrium = terrain_complement(
    json.loads(ground_bytes),
    source,
    hashlib.sha256(ground_bytes).hexdigest(),
    receipt_sha,
  )
  before = decode(north, "cells_u32", "<u4").reshape(-1, 6)
  extra = decode(atrium, "cells_u32", "<u4").reshape(-1, 6).copy()
  assert not set(map(tuple, before[:, :2])).intersection(map(tuple, extra[:, :2]))
  assert atrium["affected_cells"] < 250
  extra[:, 2] += len(decode(north, "triangles_f32", "<f4")) // 2
  extra[:, 4] += len(decode(north, "edges_f32", "<f4")) // 2
  output = {
    **north,
    "purpose": "existing-hbf-north-cuts-and-drawn-atrium-v252",
    "source_sha256": receipt_sha,
    "original_north_sha256": receipt["originalNorthCutSha256"],
    "atrium_affected_cells": atrium["affected_cells"],
    "atrium_removed_area_m2": atrium["removed_cut_area_m2"],
    "atrium_preserved_area_m2": atrium["preserved_land_area_m2"],
    "affected_cells": north["affected_cells"] + atrium["affected_cells"],
    "removed_cut_area_m2": north["removed_cut_area_m2"] + atrium["removed_cut_area_m2"],
    "preserved_land_area_m2": north["preserved_land_area_m2"]
    + atrium["preserved_land_area_m2"],
    "cells_u32": encoded(np.concatenate([before, extra]).flatten().tolist(), "<u4"),
  }
  for field in ["triangles_f32", "edges_f32"]:
    output[field] = encoded(
      np.concatenate(
        [decode(north, field, "<f4"), decode(atrium, field, "<f4")]
      ).tolist(),
      "<f4",
    )
  (ROOT / "geo_data/regierungsviertel/hbf-atrium-v252-receipt.json").write_bytes(
    receipt_bytes
  )
  target = DATA / "hbfDrawnTerrainBoundaryV252.json"
  target.write_text(json.dumps(output, separators=(",", ":")) + "\n")
  print(
    json.dumps(
      {
        "cells": atrium["affected_cells"],
        "removedM2": atrium["removed_cut_area_m2"],
        "preservedM2": atrium["preserved_land_area_m2"],
        "runtimeBytes": target.stat().st_size,
      }
    )
  )


if __name__ == "__main__":
  main()
