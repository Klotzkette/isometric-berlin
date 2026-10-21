"""Offline source replay for the bounded court and Waisenstraße additions."""

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_exact_offline_source_replay():
  path = ROOT / "scripts/build_litten_instanz_v257.py"
  spec = importlib.util.spec_from_file_location("litten_instanz", path)
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  delivered = ROOT / "src/app/src/data/littenInstanzV257.json"
  assert module.build() == json.loads(delivered.read_text())
  assert delivered.stat().st_size < 45_000
