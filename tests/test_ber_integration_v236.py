"""Whole-release preservation and negative controls for the complete BER append."""

import copy
import json

import pytest

from scripts.integrate_ber_airport_v236 import (
  ADDITION,
  PUBLIC,
  baseline_bytes,
  merged,
  normalize_ber_additions,
  read,
)


def test_airport_append_preserves_every_released_city_asset():
  current = read(PUBLIC / "manifest.json")
  snapshot = copy.deepcopy(current)
  previous = json.loads(baseline_bytes())
  assert len(previous["chunks"]) == 2012
  assert current == merged(previous, read(ADDITION))
  assert normalize_ber_additions(current, lambda p: p.read_bytes()) == previous
  assert current == snapshot


@pytest.mark.parametrize(
  "mutation", ["old", "missing", "extra", "footprint", "source", "budget"]
)
def test_airport_append_cannot_hide_unrelated_or_incomplete_changes(mutation):
  current = copy.deepcopy(read(PUBLIC / "manifest.json"))
  if mutation == "old":
    current["chunks"][0]["drawn"]["sha256"] = "0" * 64
  elif mutation == "missing":
    current["chunks"].pop()
  elif mutation == "extra":
    current["chunks"].append({**current["chunks"][-1], "id": "ber236-unreceipted"})
  elif mutation == "footprint":
    current["footprint"][-1]["ring"][0][0] += 1
  elif mutation == "source":
    current["berAirportV236"]["unapproved"] = True
  else:
    current["chunks"][-1]["drawn"]["decodedBytes"] += 1
  with pytest.raises(AssertionError):
    normalize_ber_additions(current, lambda p: p.read_bytes())


@pytest.mark.parametrize("family", ["drawn", "minecraft"])
def test_airport_actual_payload_bytes_are_checked(family):
  current = read(PUBLIC / "manifest.json")
  bad = PUBLIC / current["chunks"][-1][family]["url"]

  def corrupted(path):
    value = path.read_bytes()
    return value[:-1] + bytes([value[-1] ^ 1]) if path == bad else value

  with pytest.raises(AssertionError):
    normalize_ber_additions(current, corrupted)
