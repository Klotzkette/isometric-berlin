"""New architectural companions cannot conceal old or new source changes."""

import copy
import json

import pytest

from scripts.integrate_hansa_tiergarten_v237 import (
  PUBLIC,
  additions,
  baseline_bytes,
  merged,
  normalize_hansa_additions,
  read,
)


def test_architecture_append_preserves_all_released_assets_and_coverage():
  current = read(PUBLIC / "manifest.json")
  snapshot = copy.deepcopy(current)
  previous = json.loads(baseline_bytes())
  assert len(previous["chunks"]) == 2098
  assert current == merged(previous, additions())
  assert current["footprint"] == previous["footprint"]
  assert current["bounds"] == previous["bounds"]
  assert normalize_hansa_additions(current, lambda p: p.read_bytes()) == previous
  assert current == snapshot


@pytest.mark.parametrize(
  "mutation",
  ["old", "missing", "extra", "footprint", "source", "budget", "unreceipted"],
)
def test_incomplete_or_unrelated_mutations_are_rejected(mutation):
  current = copy.deepcopy(read(PUBLIC / "manifest.json"))
  if mutation == "old":
    current["chunks"][0]["drawn"]["sha256"] = "0" * 64
  elif mutation == "missing":
    current["chunks"].pop()
  elif mutation == "extra":
    current["chunks"].append({**current["chunks"][-1], "id": "spree237-unreceipted"})
  elif mutation == "footprint":
    current["footprint"][-1]["ring"][0][0] += 1
  elif mutation == "source":
    current["hansaTiergartenV237"]["spree"]["unapproved"] = True
  elif mutation == "unreceipted":
    del current["hansaTiergartenV237"]
  else:
    current["chunks"][-1]["drawn"]["decodedBytes"] += 1
  with pytest.raises(AssertionError):
    normalize_hansa_additions(current, lambda p: p.read_bytes())


@pytest.mark.parametrize("family", ["drawn", "minecraft"])
@pytest.mark.parametrize("tile", [0, -1])
def test_actual_old_and_new_payload_bytes_are_checked(family, tile):
  current = read(PUBLIC / "manifest.json")
  bad = PUBLIC / current["chunks"][tile][family]["url"]

  def corrupted(path):
    value = path.read_bytes()
    return value[:-1] + bytes([value[-1] ^ 1]) if path == bad else value

  with pytest.raises(AssertionError):
    normalize_hansa_additions(current, corrupted)
