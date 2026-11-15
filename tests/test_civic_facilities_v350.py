"""Reject stale address ownership and retain deterministic source-wall recipes."""

import copy
import hashlib

import pytest

from scripts.build_civic_facilities_v350 import (
  GEO,
  ROOT,
  short_name,
  validate_address_cache,
)
from scripts.build_cluster_facades_v320 import read


def test_exact_address_cache_is_bound_to_both_actual_inventories():
  cache = read(GEO / "civic-facilities-v350-address-buildings.json.gz")
  files = {
    row["path"]: hashlib.sha256((ROOT / row["path"]).read_bytes()).hexdigest()
    for row in cache["source"]["inventories"]
  }
  validate_address_cache(cache, files)
  changed = copy.deepcopy(files)
  changed[next(iter(changed))] = "0" * 64
  with pytest.raises(ValueError, match="does not match inventory"):
    validate_address_cache(cache, changed)


def test_full_inventory_survives_as_explicit_admitted_or_unresolved_outcomes():
  inventories = [
    read(GEO / (name + "-v350-inventory.json.gz"))
    for name in ("education", "pharmacies")
  ]
  ids = {row["id"] for source in inventories for row in source["records"]}
  receipt = read(GEO / "civic-facilities-v350-evidence.json.gz")
  assert set(receipt["outcomes"]) == ids
  assert sum(receipt["counts"]["statuses"].values()) == len(ids)
  assert short_name("Kita Bärenstraße – Süd") == "KITA BARENSTRASSE SUD"


def test_frozen_runtime_modules_have_complete_production_preservation_proofs():
  receipt = read(GEO / "civic-facilities-v350-evidence.json.gz")
  data = ROOT / "src/app/src/data"
  keys = set()
  for file, digest in receipt["runtimeSources"].items():
    assert hashlib.sha256((data / file).read_bytes()).hexdigest() == digest
    module = read(data / file)
    assert len(module["keys"]) <= 32
    keys.update(module["keys"])
  proof = receipt["completeProductionProof"]
  assert proof["allSourceFamiliesPassed"]
  assert {row["key"] for row in proof["keys"]} == keys
  assert all(row["valid"] and row["fullyDecodedSupport"] for row in proof["keys"])
  assert "day-night-material-hook-and-uniforms" in proof["checks"]
  assert "fully-decoded-live-wall-and-fitting-clearance" in proof["checks"]
