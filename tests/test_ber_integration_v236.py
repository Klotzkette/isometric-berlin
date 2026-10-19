"""Whole-release preservation and negative controls for the complete BER append."""

import copy
import json

import pytest

from scripts.integrate_ber_airport_v236 import (
  ADDITION,
  PUBLIC,
  ROOT,
  baseline_bytes,
  merged,
  normalize_ber_additions,
  read,
  verify_assets,
)
from scripts.integrate_hansa_tiergarten_v237 import normalize_hansa_additions
from scripts.spree_bridge_lineage_v242 import baseline, receipts


def released_ber_manifest():
  """Prove later supplements before exercising the original BER audit unchanged."""
  return normalize_hansa_additions(
    read(PUBLIC / "manifest.json"), lambda p: p.read_bytes()
  )


def test_airport_append_preserves_every_released_city_asset():
  current = released_ber_manifest()
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
  current = copy.deepcopy(released_ber_manifest())
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
  current = released_ber_manifest()
  bad = PUBLIC / current["chunks"][-1][family]["url"]

  def corrupted(path):
    value = path.read_bytes()
    return value[:-1] + bytes([value[-1] ^ 1]) if path == bad else value

  with pytest.raises(AssertionError):
    normalize_ber_additions(current, corrupted)


def test_historical_asset_audit_rejects_corrupted_current_bridge_bytes():
  """A matching historical descriptor never bypasses validation of live data."""
  receipt_key = next(iter(receipts()))
  family, owner = receipt_key.split(":", 1)
  manifest = json.loads(baseline(str((PUBLIC / "manifest.json").relative_to(ROOT))))
  descriptor = next(c for c in manifest["chunks"] if c["id"] == owner)
  verify_assets([descriptor], lambda path: path.read_bytes())
  target = PUBLIC / descriptor[family]["url"]

  def corrupted(path):
    value = path.read_bytes()
    return value[:-1] + bytes([value[-1] ^ 1]) if path == target else value

  with pytest.raises(AssertionError, match="Unreceipted v242 bytes"):
    verify_assets([descriptor], corrupted)
