"""Negative controls for the centralized append-only predecessor audit."""

import copy

import pytest
from packet_additions_v230 import (
  PUBLIC,
  audited_v230_additions,
  baseline_v229,
  normalize_v230_additions,
  read,
)


def test_exact_additions_and_full_immutable_predecessor():
  current = read(PUBLIC / "manifest.json")
  snapshot = copy.deepcopy(current)
  before, additions = normalize_v230_additions(current, lambda p: p.read_bytes())
  assert before == baseline_v229()
  assert len(additions) == 107
  assert current == snapshot
  assert audited_v230_additions() == additions


@pytest.mark.parametrize(
  "mutation",
  [
    "old_descriptor",
    "old_metadata",
    "old_footprint",
    "new_footprint",
    "missing",
    "duplicate",
    "unreceipted",
    "renamed",
    "new_bounds",
    "outer_counts",
    "historic_counts",
    "marzahn_count",
    "budget",
    "remove_metadata",
  ],
)
def test_manifest_mutations_cannot_be_normalized_away(mutation):
  m = copy.deepcopy(read(PUBLIC / "manifest.json"))
  if mutation == "old_descriptor":
    m["chunks"][0]["drawn"]["sha256"] = "0" * 64
  elif mutation == "old_metadata":
    m["groundY"] += 1
  elif mutation == "old_footprint":
    m["footprint"][0]["ring"][0][0] += 0.1
  elif mutation == "new_footprint":
    m["footprint"][-1]["ring"][0][0] += 0.1
  elif mutation == "missing":
    m["chunks"].pop()
  elif mutation == "duplicate":
    m["chunks"].append(m["chunks"][-1])
  elif mutation == "unreceipted":
    m["chunks"].append({**m["chunks"][-1], "id": "outerfacade230-unreceipted"})
  elif mutation == "renamed":
    m["chunks"][-1]["id"] = "marzahn230-unreceipted"
  elif mutation == "new_bounds":
    m["chunks"][-1]["bounds"][0] -= 1
  elif mutation == "outer_counts":
    m["outerFacadesV230"]["fronts"] += 1
  elif mutation == "historic_counts":
    m["outskirtsV187"]["chunkCount"] += 1
  elif mutation == "marzahn_count":
    m["marzahnV230"]["buildingCount"] += 1
  elif mutation == "budget":
    m["chunks"][-1]["drawn"]["decodedBytes"] = 3_000_000
  elif mutation == "remove_metadata":
    del m["outerFacadesV230"]
    del m["marzahnV230"]
  with pytest.raises(AssertionError):
    normalize_v230_additions(m, lambda p: p.read_bytes())


@pytest.mark.parametrize("which", ["old", "outer", "marzahn"])
def test_actual_payload_corruption_is_not_hidden_by_unchanged_metadata(which):
  current = read(PUBLIC / "manifest.json")
  index = {"old": 0, "outer": 1905, "marzahn": -1}[which]
  bad = PUBLIC / current["chunks"][index]["drawn"]["url"]

  def reader(path):
    raw = path.read_bytes()
    return raw[:-1] + bytes([raw[-1] ^ 1]) if path == bad else raw

  with pytest.raises(AssertionError):
    normalize_v230_additions(current, reader)
