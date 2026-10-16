"""The additive house selector retains complete official source boundaries."""

from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path

import shapely
from shapely.geometry import Polygon, box

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
  "house_scope_v226", ROOT / "scripts/build_district_house_scope_v226.py"
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_two_source_bound_scopes_are_exact_compact_and_reproducible() -> None:
  result = MODULE.build()
  assert result == json.loads(MODULE.OUTPUT.read_text())
  assert [region["name"] for region in result["regions"]] == [
    "Kreuzberg",
    "Friedrichshain",
  ]
  for region, source in zip(result["regions"], MODULE.source_regions().values()):
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
    assert shapely.union_all(parts).symmetric_difference(source).area < 0.0002
    # New districts do not consume or shift any previous scope.
    for old in MODULE.COMPILER.source_regions().values():
      assert source.intersection(old).area < 0.0001
  assert MODULE.OUTPUT.stat().st_size < 90_000


def test_previous_selector_and_all_five_results_remain_frozen() -> None:
  prior = ROOT / "src/app/src/data/districtHouseScopeV225.json"
  assert MODULE.COMPILER.build() == json.loads(prior.read_text())
  assert hashlib.sha256(prior.read_bytes()).hexdigest() == (
    "f5944daefadcb228c88cf444fe90ff8e488172bf68a32579588197bb143b16e3"
  )
