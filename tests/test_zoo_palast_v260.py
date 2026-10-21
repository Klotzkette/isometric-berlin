"""The v260 addon keeps its extraction reproducible and the full v166 owner."""

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_extracted_facade_anchors_are_reproducible() -> None:
  spec = importlib.util.spec_from_file_location(
    "zoo_palast_v260", ROOT / "scripts/build_zoo_palast_v260.py"
  )
  assert spec is not None and spec.loader is not None
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  assert module.build() == json.loads(
    (ROOT / "src/app/src/data/zooPalastV260.json").read_text()
  )


def test_native_occupancy_is_an_exact_subset_of_retained_source() -> None:
  source = json.loads(
    (ROOT / "src/app/src/data/cityWestCinemasV166Source.json").read_text()
  )
  addon = json.loads((ROOT / "src/app/src/data/zooPalastV260.json").read_text())
  cells = {tuple(int(v // 2) for v in r[:3]) for r in source["nativeBlocks"]}
  assert set(map(tuple, addon["nativeOccupiedCells"])) <= cells
  assert len([p for p in source["parts"] if p["parentId"] == addon["owner"]]) == 7
