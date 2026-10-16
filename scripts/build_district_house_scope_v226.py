"""Step 10: reuse the exact selector compiler for two retained ALKIS Ortsteile."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

from shapely.affinity import affine_transform
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/district-facades-v188-boundaries.geojson"
OUTPUT = ROOT / "src/app/src/data/districtHouseScopeV226.json"
NAMES = ("Kreuzberg", "Friedrichshain")
SPEC = importlib.util.spec_from_file_location(
  "house_scope_v225", ROOT / "scripts/build_district_house_scope_v225.py"
)
assert SPEC and SPEC.loader
COMPILER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(COMPILER)


def source_regions() -> dict:
  """Exact retained source rings; no coverage, road or building regeneration."""
  features = json.loads(SOURCE.read_text())["features"]
  return {
    name: affine_transform(
      shape(next(f for f in features if f["properties"]["nam"] == name)["geometry"]),
      [1, 0, 0, -1, -389500, 5820000],
    )
    for name in NAMES
  }


def build() -> dict:
  return COMPILER.build(source_regions())


if __name__ == "__main__":
  OUTPUT.write_text(json.dumps(build(), separators=(",", ":")) + "\n")
