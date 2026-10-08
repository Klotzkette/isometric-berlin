"""Step 10: measured Fritz-Schloss-Park hill, additive to the exact v182 terrain."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import build_park_relief_v182 as terrain

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data/parkReliefV183.json"
SOURCE = ROOT / "geo_data/regierungsviertel/park-relief-v183.json"
AUDIT = ROOT / "geo_data/regierungsviertel/park-relief-v183-audit.json"
OBJECT_AUDIT = ROOT / "geo_data/regierungsviertel/park-relief-v183-object-audit.json"


def configure() -> None:
  """Reuse the verified algorithm with separate, explicitly versioned inputs."""
  terrain.BASE = "v1.0.82"
  terrain.NAMES = ("Fritz-Schloß-Park",)
  terrain.DATA = DATA
  terrain.SOURCE = SOURCE
  terrain.RAW = ROOT / "geo_data/regierungsviertel/raw/dgm/parks-v183"


def add_original_ground(payload: dict) -> None:
  """Retain local old samples so splitting a long backing run cannot move its ends."""
  path = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
  source = terrain.original(path)
  old = json.loads(source)
  grid, field, cell = old["grid"], old["ground_height"], old["cell_m"]
  stride = field["stride_cells"]
  west, north, east, south = payload["profiles"][0]["support"]
  c0 = math.floor((west / cell - grid["min_x_idx"]) / stride) - 2
  r0 = math.floor((north / cell - grid["min_z_idx"]) / stride) - 2
  c1 = math.ceil((east / cell - grid["min_x_idx"]) / stride) + 2
  r1 = math.ceil((south / cell - grid["min_z_idx"]) / stride) + 2
  payload["originalGround"] = {
    "baseline": "v1.0.82",
    "sha256": hashlib.sha256(source).hexdigest(),
    "origin": [
      (grid["min_x_idx"] + c0 * stride) * cell,
      (grid["min_z_idx"] + r0 * stride) * cell,
    ],
    "stepM": cell * stride,
    "yDm": [
      field["y_dm"][r * field["cols"] + c0 : r * field["cols"] + c1]
      for r in range(r0, r1)
    ],
  }
  DATA.write_bytes(terrain.encode(payload))


def main() -> None:
  """Publish a bounded hill correction with reversible altitude receipts."""
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--samples", action="store_true")
  parser.add_argument("--packets", action="store_true")
  parser.add_argument("--objects", action="store_true")
  args = parser.parse_args()
  configure()
  payload = terrain.build_profiles() if args.samples else json.loads(DATA.read_bytes())
  if args.samples:
    add_original_ground(payload)
    source = json.loads(SOURCE.read_bytes())
    source["osmBoundary"] = {
      "id": "way/15803725",
      "name": "Fritz-Schloß-Park",
      "source": "Retained Geofabrik Berlin 2026-09-29",
      "license": "ODbL-1.0",
    }
    SOURCE.write_bytes(terrain.encode(source))
  if args.packets:
    # The whole bounded hill/apron is inside the detailed core: no old outer
    # packet is regenerated, reserialized or moved by this local correction.
    from shapely.geometry import Polygon, box
    from shapely.ops import unary_union

    manifest = json.loads(
      (ROOT / "src/app/public/mesh/surrounding-berlin-v159/manifest.json").read_bytes()
    )
    outer = unary_union([Polygon(p["ring"], p["holes"]) for p in manifest["footprint"]])
    assert outer.intersection(box(*payload["profiles"][0]["support"])).area == 0
    AUDIT.write_bytes(
      terrain.encode(
        {
          "baseline": terrain.BASE,
          "core": terrain.patch_core(payload["profiles"]),
          "outer": [],
          "unchangedPreviousTerrainSha256": hashlib.sha256(
            (ROOT / "src/app/src/data/parkReliefV182.json").read_bytes()
          ).hexdigest(),
        }
      )
    )
  if args.objects:
    report = terrain.patch_core_objects(payload["profiles"], OBJECT_AUDIT)
    report.pop("bunkerConflict")
    report["policy"] = (
      "Every prior XYZ plan coordinate, inventory identity and whole-building height is preserved; only rigid parent altitude / terrain-following object Y changes."
    )
    OBJECT_AUDIT.write_bytes(terrain.encode(report))
    print(
      json.dumps(
        {key: value for key, value in report.items() if key != "buildingChanges"}
      )
    )


if __name__ == "__main__":
  main()
