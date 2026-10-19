"""Reproducible, source-bound and bounded v247 walking-floor index."""

import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load():
  path = ROOT / "scripts/build_steglitz_ground_v247.py"
  spec = importlib.util.spec_from_file_location("steglitz_ground_v247", path)
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  return module


def test_deterministic_replay_matches_committed_floor_index():
  module = load()
  first = module.build()
  assert first == module.build()
  assert json.loads(json.dumps(first)) == json.loads(module.OUT.read_text())


def test_floor_index_binds_both_current_rendered_recipes():
  module = load()
  data = json.loads(module.OUT.read_text())
  assert set(data["sourceSha256"]) == {
    "hermannEhlersV247Details.json",
    "schlossstrasseV247Details.json",
  }
  for name, digest in data["sourceSha256"].items():
    assert hashlib.sha256((module.DATA / name).read_bytes()).hexdigest() == digest


def test_small_index_retains_only_local_surface_floors_and_both_holes():
  module = load()
  data = json.loads(module.OUT.read_text())
  assert module.OUT.stat().st_size < 20_000
  assert 0 < len(data["drawn"]) < 12
  assert 0 < len(data["native"]) < 220
  assert {surface["topY"] for surface in data["drawn"]} == {3.025, 3.09}
  assert {row[4] for row in data["native"]} == {3.025, 3.09}
  plaza = [surface for surface in data["drawn"] if surface["topY"] == 3.025]
  assert len(plaza) == 1 and len(plaza[0]["holes"]) == 2
  min_x, min_z, max_x, max_z = data["bounds"]
  assert -3700 < min_x < max_x < -3400
  assert 6700 < min_z < max_z < 6900
  for x0, z0, x1, z1, _ in data["native"]:
    assert min_x <= x0 < x1 <= max_x
    assert min_z <= z0 < z1 <= max_z
