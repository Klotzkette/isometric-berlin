"""Exact regional selection without copying or changing city geometry."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import shapely
from shapely.geometry import Polygon, box

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
  "house_scope", ROOT / "scripts/build_district_house_scope_v225.py"
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_compact_scope_is_exact_and_reproducible() -> None:
  """Full-cell and clipped-cell unions preserve the complete source selection."""
  result = MODULE.build()
  assert result == json.loads(MODULE.OUTPUT.read_text())
  for region, (name, source) in zip(result["regions"], MODULE.source_regions().items()):
    assert region["name"] == name
    grid = region["grid"]
    parts = []
    for i, code in enumerate(grid["cells"]):
      if code == "1":
        x, z = i % grid["width"] + grid["x0"], i // grid["width"] + grid["z0"]
        parts.append(box(x * 128, z * 128, (x + 1) * 128, (z + 1) * 128))
      elif code == "2":
        parts.extend(
          Polygon(poly[0], poly[1:]) for poly in region["boundaryCells"][str(i)]
        )
    assert shapely.union_all(parts).symmetric_difference(source).area < 0.0001
  assert MODULE.OUTPUT.stat().st_size < 220_000
