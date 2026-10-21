import copy
import json

import pytest

from scripts.integrate_height_reconstruction_v259 import predecessor_manifest_v259
from scripts.integrate_playgrounds_v255 import (
  PATCH,
  PUBLIC,
  baseline_bytes,
  merged,
  predecessor_manifest_v255,
)


def test_complete_previous_manifest_survives_verified_addition():
  previous = json.loads(baseline_bytes())
  current = json.loads((PUBLIC / "manifest.json").read_bytes())
  current = predecessor_manifest_v259(current)
  assert current == merged(previous, json.loads(PATCH.read_bytes()))
  assert current["chunks"][:2151] == previous["chunks"]
  assert current["footprint"][: len(previous["footprint"])] == previous["footprint"]
  assert predecessor_manifest_v255(current) == previous


def test_unknown_source_changes_and_corrupt_new_packets_fail_closed():
  current = json.loads((PUBLIC / "manifest.json").read_bytes())
  changed = copy.deepcopy(current)
  changed["chunks"][0]["drawn"]["sha256"] = "0" * 64
  with pytest.raises(AssertionError):
    predecessor_manifest_v255(changed)
  corrupt = PUBLIC / current["chunks"][-1]["minecraft"]["url"]

  def reader(path):
    raw = path.read_bytes()
    return raw[:-1] if path == corrupt else raw

  with pytest.raises(AssertionError):
    predecessor_manifest_v255(current, reader)
