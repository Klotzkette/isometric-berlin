"""The transferred old facade is derived from one retained owner recipe."""

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_exact_facade_receipt_is_reproducible_without_touching_packets(tmp_path):
  sys.path.insert(0, str(ROOT / "scripts"))
  spec = importlib.util.spec_from_file_location(
    "panorama_v202_builder", ROOT / "scripts/build_panorama_facade_v202.py"
  )
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  expected = module.OUTPUT.read_bytes()
  module.OUTPUT = tmp_path / "receipt.json"
  receipt = module.build()
  assert module.OUTPUT.read_bytes() == expected
  assert [len(r["triangles"]) for r in receipt["records"]] == [1138, 1162, 246, 219]
  assert receipt["owner"] == "OSM-way-235493631"
