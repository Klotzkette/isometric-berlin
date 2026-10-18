"""New architectural companions cannot conceal old or new source changes."""

import copy
import json

import pytest

from scripts.integrate_elevated_venues_v238 import (
  PUBLIC,
  additions,
  baseline_bytes,
  merged,
  normalize_elevated_additions,
  read,
)
from scripts.integrate_mitte_v239 import normalize_mitte_additions


def test_architecture_append_preserves_all_released_assets_and_coverage():
  current = normalize_mitte_additions(
    read(PUBLIC / "manifest.json"), lambda p: p.read_bytes()
  )
  snapshot = copy.deepcopy(current)
  previous = json.loads(baseline_bytes())
  assert len(previous["chunks"]) == 2108
  assert current == merged(previous, additions())
  assert current["footprint"] == previous["footprint"]
  assert current["bounds"] == previous["bounds"]
  assert normalize_elevated_additions(current, lambda p: p.read_bytes()) == previous
  assert current == snapshot


@pytest.mark.parametrize(
  "mutation",
  ["old", "missing", "extra", "footprint", "source", "budget", "unreceipted"],
)
def test_incomplete_or_unrelated_mutations_are_rejected(mutation):
  current = copy.deepcopy(
    normalize_mitte_additions(read(PUBLIC / "manifest.json"), lambda p: p.read_bytes())
  )
  if mutation == "old":
    current["chunks"][0]["drawn"]["sha256"] = "0" * 64
  elif mutation == "missing":
    current["chunks"].pop()
  elif mutation == "extra":
    current["chunks"].append(
      {**current["chunks"][-1], "id": "southrail238-unreceipted"}
    )
  elif mutation == "footprint":
    current["footprint"][-1]["ring"][0][0] += 1
  elif mutation == "source":
    current["elevatedVenuesV238"]["southrail"]["unapproved"] = True
  elif mutation == "unreceipted":
    del current["elevatedVenuesV238"]
  else:
    current["chunks"][-1]["drawn"]["decodedBytes"] += 1
  with pytest.raises(AssertionError):
    normalize_elevated_additions(current, lambda p: p.read_bytes())


@pytest.mark.parametrize("family", ["drawn", "minecraft"])
@pytest.mark.parametrize("tile", [0, -1])
def test_actual_old_and_new_payload_bytes_are_checked(family, tile):
  current = normalize_mitte_additions(
    read(PUBLIC / "manifest.json"), lambda p: p.read_bytes()
  )
  bad = PUBLIC / current["chunks"][tile][family]["url"]

  def corrupted(path):
    value = path.read_bytes()
    return value[:-1] + bytes([value[-1] ^ 1]) if path == bad else value

  with pytest.raises(AssertionError):
    normalize_elevated_additions(current, corrupted)
