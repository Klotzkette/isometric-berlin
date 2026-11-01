"""Give the complete five-level Hbf hall exact shared raster-ground ownership."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

from shapely.affinity import affine_transform
from shapely.geometry import Polygon, box, mapping
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from scripts.build_drawn_water_boundary import polygon_parts
from scripts.build_hbf_north_approach import terrain_complement

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
RECEIPT = ROOT / "geo_data/regierungsviertel/hbf-interior-ground-v291-receipt.json"
TARGET = DATA / "hbfInteriorTerrainBoundaryV291.json"
SOURCE_PATHS = (
  "src/app/public/mesh/regierungsviertel/ground-context.json",
  "src/app/src/data/hbfNorthApproachSources.json",
  "src/app/src/data/hbfNorthRailTerrainBoundary.json",
  "src/app/src/data/hbfDrawnTerrainBoundaryV252.json",
)


def interior_footprint() -> Polygon:
  """Match the complete represented hall/foyers, not an inferred station site."""
  angle = math.radians(21.82)
  c, s = math.cos(angle), math.sin(angle)
  return affine_transform(box(-20, -92.2, 20, 92.2), [c, s, -s, c, -119.936, -683.307])


def north_footprint(source: dict[str, Any]) -> BaseGeometry:
  """Read every original rail-cut ring and hole without simplification."""
  return unary_union([Polygon(p["ring"], p["holes"]) for p in source["cut"]])


def source_record(footprint: BaseGeometry) -> dict[str, Any]:
  """Retain the exact finite union, including every component and hole."""
  return {
    "cut": [
      {
        "ring": list(p.exterior.coords),
        "holes": [list(r.coords) for r in p.interiors],
      }
      for p in polygon_parts(footprint)
    ]
  }


def canonical_bytes(value: dict[str, Any]) -> bytes:
  """Encode deterministic small evidence and runtime tables."""
  return (json.dumps(value, separators=(",", ":")) + "\n").encode()


def build() -> tuple[dict[str, Any], dict[str, Any]]:
  """Regenerate from retained ground and the union, avoiding double-cut cells."""
  original = {path: (ROOT / path).read_bytes() for path in SOURCE_PATHS}
  ground_bytes, north_source_bytes, north_table_bytes, drawn_table_bytes = (
    original[path] for path in SOURCE_PATHS
  )
  ground = json.loads(ground_bytes)
  north_source = json.loads(north_source_bytes)
  original_north = north_footprint(north_source)
  interior = interior_footprint()
  footprint = unary_union([original_north, interior])
  receipt = {
    "schema_version": 1,
    "purpose": "Complete represented Hauptbahnhof hall and existing north rail cuts",
    "anchorWorld": [-119.936, 4.575, -683.307],
    "rotationDegrees": 21.82,
    "localInteriorBoundsM": [-20, -92.2, 20, 92.2],
    "interiorFootprint": mapping(interior),
    "combinedFootprint": mapping(footprint),
    "northInteriorOverlapAreaM2": original_north.intersection(interior).area,
    "sourceFiles": {
      path: {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
      for path, raw in original.items()
    },
    "source": "Existing main-hall/foyer authored frame, confirmed by the v291 geometry owner; dimensions are display estimates, not an interior survey",
    "policy": "Shared drawn/native exact complement. Remove only false raster terrain inside the finite union; preserve every outside fragment with the source run's actual top, bottom and paint. Keep all original tables and payloads unchanged. Station-owned floors, bridges, stairs and navigation provide the represented interior.",
  }
  receipt_sha = hashlib.sha256(canonical_bytes(receipt)).hexdigest()
  output = terrain_complement(
    ground,
    source_record(footprint),
    hashlib.sha256(ground_bytes).hexdigest(),
    receipt_sha,
  )
  output.update(
    purpose="hbf-north-cuts-and-complete-shared-interior-v291",
    original_north_sha256=hashlib.sha256(north_table_bytes).hexdigest(),
    original_drawn_v252_sha256=hashlib.sha256(drawn_table_bytes).hexdigest(),
    interior_area_m2=interior.area,
    footprint_area_m2=footprint.area,
  )
  return receipt, output


def main() -> None:
  """Write only the new bounded table and its independent source receipt."""
  receipt, output = build()
  RECEIPT.write_bytes(canonical_bytes(receipt))
  TARGET.write_bytes(canonical_bytes(output))
  print(
    json.dumps(
      {
        "cells": output["affected_cells"],
        "removedM2": output["removed_cut_area_m2"],
        "preservedM2": output["preserved_land_area_m2"],
        "runtimeBytes": TARGET.stat().st_size,
        "receiptBytes": RECEIPT.stat().st_size,
        "northInteriorOverlapM2": receipt["northInteriorOverlapAreaM2"],
      }
    )
  )


if __name__ == "__main__":
  main()
