"""Reject stale address ownership and retain deterministic source-wall recipes."""

import copy
import hashlib

import pytest

from scripts.build_civic_facilities_v350 import (
  GEO,
  ROOT,
  plate,
  plate_height_offset,
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


def test_reviewed_kita_height_stays_bound_to_its_verified_owner_and_live_wall():
  receipt = read(GEO / "civic-facilities-v350-evidence.json.gz")
  owner = next(
    row for row in receipt["sourceOwners"] if "kita:04071240" in row["facilityIds"]
  )
  offset = plate_height_offset(owner["facilityIds"], owner["owner"])
  assert offset == owner["displayHeightOffsetMetres"] == 1.0
  assert plate_height_offset(["kita:unrelated"], owner["owner"]) == 0.0
  with pytest.raises(ValueError, match="no longer matches its owner"):
    plate_height_offset(owner["facilityIds"], "different-building")
  module = read(ROOT / "src/app/src/data/civicFacilitiesV350Packets00.json")
  for mode, face in (("drawn", "drawnFace"), ("minecraft", "nativeFace")):
    key = mode + ":-10_-1"
    packet = module["packets"][key]
    assert packet["plates"][0] == plate(
      owner[face],
      packet["origin"],
      owner["category"],
      owner["names"][0],
      height_offset=offset,
    )
    proof = next(
      row for row in receipt["completeProductionProof"]["keys"] if row["key"] == key
    )
    assert proof["valid"] and proof["fullyDecodedSupport"]
