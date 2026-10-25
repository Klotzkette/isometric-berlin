"""Exact original-source, roof and independent replacement-scope receipts."""

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

from shapely.geometry import Polygon, box

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location(
  "tempodrom_anhalter_v266", ROOT / "scripts/build_tempodrom_anhalter_v266.py"
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_reproducible_complete_source_and_roof() -> None:
  evidence, runtime = MODULE.build()
  assert evidence == json.loads(
    (
      ROOT / "geo_data/regierungsviertel/tempodrom-anhalter-v266-evidence.json"
    ).read_text()
  )
  assert runtime == json.loads(
    (ROOT / "src/app/src/data/tempodromAnhalterV266.json").read_text()
  )
  original = evidence["measuredPortico"]
  assert len(original["all_surfaces"]) == 12
  assert len(original["surfaces"]) == 11
  assert runtime["portico"]["roof"] == [
    s for s in original["surfaces"] if s["kind"] == "RoofSurface"
  ]
  assert len(runtime["columns"]) == 8
  assert evidence["retainedForeignNativeColumns"] == []


def test_exact_native_cells_have_no_foreign_source_owner() -> None:
  evidence, runtime = MODULE.build()
  prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  cells = [
    box(c[0] * 4, c[1] * 4, (c[0] + 1) * 4, (c[1] + 1) * 4) for c in runtime["columns"]
  ]
  for p in prisms:
    if p["id"] == "400001p6":
      continue
    polygon = Polygon([(x / 10, z / 10) for x, z in p["ring"]])
    assert all(polygon.intersection(cell).area < 0.001 for cell in cells)
  assert (
    hashlib.sha256(evidence["legacyRecipe"].encode()).hexdigest()
    == evidence["legacyRecipeSha256"]
  )
  assert "35, 20, 7" in evidence["legacyRecipe"]
  assert runtime["tempodrom"]["retainedPrism"] == evidence["retainedTempodromPrism"]
