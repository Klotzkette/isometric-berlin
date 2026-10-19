"""Complete source preservation and fail-closed bounded street integration."""

import copy
import json

import pytest

from scripts.integrate_street_fronts_v244 import (
  PUBLIC,
  additions,
  baseline_bytes,
  merged,
  predecessor_manifest_v244,
  read,
  verify_companions,
)
from scripts.integrate_street_landmarks_v245 import predecessor_manifest_v245


def test_exact_previous_city_and_all_new_payloads():
  previous = json.loads(baseline_bytes())
  current = predecessor_manifest_v245(read(PUBLIC / "manifest.json"))
  assert len(previous["chunks"]) == 2135
  assert current == merged(previous, additions())
  assert current["chunks"][:2135] == previous["chunks"]
  assert predecessor_manifest_v244(current) == previous
  assert all(current[k] == v for k, v in previous.items() if k != "chunks")


@pytest.mark.parametrize("mutation", ["old", "missing", "coverage", "receipt", "new"])
def test_no_unknown_manifest_change_can_be_hidden(mutation):
  value = copy.deepcopy(predecessor_manifest_v245(read(PUBLIC / "manifest.json")))
  if mutation == "old":
    value["chunks"][0]["drawn"]["sha256"] = "0" * 64
  elif mutation == "missing":
    value["chunks"].pop()
  elif mutation == "coverage":
    value["bounds"][0] += 1
  elif mutation == "receipt":
    del value["streetFrontsV244"]
  else:
    value["chunks"][-1]["minecraft"]["bytes"] += 1
  with pytest.raises(AssertionError):
    predecessor_manifest_v244(value)


def test_corrupt_companion_cannot_pass_through_historical_adapter():
  current = predecessor_manifest_v245(read(PUBLIC / "manifest.json"))
  bad = PUBLIC / current["chunks"][-1]["minecraft"]["url"]

  def reader(path):
    data = path.read_bytes()
    return data[:-1] + bytes([data[-1] ^ 1]) if path == bad else data

  with pytest.raises(AssertionError):
    predecessor_manifest_v244(current, reader)
  verify_companions(additions())
