"""Source preservation and reproducibility for the bounded Museum Island refinement."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]


def test_panorama_source_reproduces_retained_ring_and_official_entrance() -> None:
  """Source extraction must never replace the mapped ring with a generic circle."""
  sys.path.insert(0, str(ROOT / "scripts"))
  spec = importlib.util.spec_from_file_location(
    "museum_v202_builder", ROOT / "scripts/build_museum_v202.py"
  )
  assert spec and spec.loader
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  retained = json.loads(
    (ROOT / "src/app/src/pergamonPanoramaV202Source.json").read_text()
  )
  assert module.build_source(ROOT) == retained
  assert len(retained["ring"]) == 38
  assert retained["rotunda_fit"]["max_residual_m"] < 0.02
  assert retained["official_entrance"]["id"] == "DEBE00YY2O700027"
  assert Polygon(retained["ring"]).is_valid
  assert len(retained["native_replacement_columns"]) == 161
  assert [1530, -210, 5.2, 13.2] not in retained["native_replacement_columns"]
  assert all(
    record["action"].startswith("retain unrelated")
    for record in retained["overlap_audit"][:2]
  )
