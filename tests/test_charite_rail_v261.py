"""No measured Charité owner may be replaced by decorative facade geometry."""

import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data/chariteRailV261.json"


def test_exact_distinct_source_owners_are_retained():
  data = json.loads(DATA.read_text())
  raw = (ROOT / data["source"]).read_bytes()
  assert hashlib.sha256(raw).hexdigest() == data["sourceSha256"]
  old = {p["id"]: p for p in json.loads(raw)["buildings"]}
  assert len(data["parts"]) == 10
  assert sum(p["parent"].endswith("03IB") for p in data["parts"]) == 6
  for p in data["parts"]:
    assert {k: v for k, v in p.items() if k != "parent"} == old[p["id"]]


def test_snapshot_rebuild_is_byte_exact():
  spec = importlib.util.spec_from_file_location(
    "charite_rail_v261", ROOT / "scripts/build_charite_rail_v261.py"
  )
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  assert json.dumps(module.build(), separators=(",", ":")) + "\n" == DATA.read_text()
