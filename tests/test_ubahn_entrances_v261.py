"""Bounded source/transformation regressions for the seven named entrance runs."""

import json
from pathlib import Path

from scripts.build_ubahn_entrances_v261 import OUTPUT, SOURCE, build


def test_runtime_payload_rebuilds_exactly():
  assert build() == json.loads(OUTPUT.read_text())


def test_source_endpoints_are_existing_mapped_entrances():
  source = json.loads(SOURCE.read_text())
  for run in source["runs"]:
    entrance = next(n for n in run["nodes"] if n["id"] == run["entranceNode"])
    assert entrance["tags"]["railway"] == "subway_entrance"
    assert entrance["tags"]["ref"] == run["ref"]
    assert run["tags"]["highway"] == "steps"
    assert run["tags"]["incline"] == "up"
    assert run["nodes"][-1] == entrance
    assert run["version"] > 0
  assert len(source["runs"]) == 7
  assert OUTPUT.stat().st_size < 10_000
  assert SOURCE.stat().st_size < 20_000
  assert not list(Path("src/app/public").glob("**/*ubahn-v261*.jpg"))
