"""No previous source or live budget may be concealed by the new additions."""

import copy
import json

import pytest

from scripts.integrate_mitte_v239 import (
  DATA,
  PUBLIC,
  additions,
  baseline_bytes,
  merged,
  normalize_mitte_additions,
  read,
  required_models,
)
from scripts.spree_bridge_lineage_v242 import predecessor_manifest_v242


def test_complete_required_models_match_frozen_agent_outputs():
  assert read(DATA / "requiredMitteV239.json") == required_models()
  assert (
    read(DATA / "schlossplatzV239PreviousNavigation.json")["parts"]
    == read(DATA / "schlossplatzV239AltMittePrevious.json")["previousNavigationParts"]
  )


def test_bounded_companions_preserve_the_complete_previous_city():
  current = read(PUBLIC / "manifest.json")
  before = copy.deepcopy(current)
  previous = json.loads(baseline_bytes())
  assert len(previous["chunks"]) == 2121
  assert predecessor_manifest_v242(current) == merged(previous, additions())
  assert normalize_mitte_additions(current, lambda p: p.read_bytes()) == previous
  assert current == before


@pytest.mark.parametrize("mutation", ["old", "missing", "coverage", "unreceipted"])
def test_unrelated_or_incomplete_changes_are_rejected(mutation):
  value = copy.deepcopy(read(PUBLIC / "manifest.json"))
  if mutation == "old":
    value["chunks"][0]["drawn"]["sha256"] = "0" * 64
  elif mutation == "missing":
    value["chunks"].pop()
  elif mutation == "coverage":
    value["bounds"][0] += 1
  else:
    del value["mitteV239"]
  with pytest.raises(AssertionError):
    normalize_mitte_additions(value, lambda p: p.read_bytes())
