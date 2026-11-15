"""The building fallback never guesses an address, level or neighbouring owner."""

import importlib
import sys
from pathlib import Path

from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sources = importlib.import_module("build_pharmacies_v350")
extractor = importlib.import_module("extract_facility_address_buildings_v350")
digest, read, OUT, key = sources.digest, sources.read, extractor.OUT, extractor.key


def test_exact_address_cache_matches_unchanged_inputs_and_unique_valid_buildings():
  cache = read(OUT)
  inventory = {}
  for item in cache["source"]["inventories"]:
    path = ROOT / item["path"]
    assert digest(path.read_bytes()) == item["sha256"]
    inventory.update((r["id"], r) for r in read(path)["records"])
  seen, buildings = set(), set()
  for feature in cache["features"]:
    p = feature["properties"]
    geometry = shape(feature["geometry"])
    assert geometry.is_valid and not geometry.is_empty and geometry.area > 2
    assert p["building"] and p["building"] != "no"
    assert p["osmId"] not in buildings
    buildings.add(p["osmId"])
    for facility_id in p["facilityIds"]:
      assert facility_id not in seen
      seen.add(facility_id)
      r = inventory[facility_id]
      assert key(r["street"], r["houseNumber"], r["postcode"]) == key(
        p["street"], p["houseNumber"], p["postcode"]
      )
      assert r.get("evidence", {}).get("level") in (None, "", "0", 0)
  assert len(buildings) == cache["audit"]["uniqueAddressedBuildings"]
  assert len(seen) == cache["audit"]["matchedFacilities"]
  assert not seen.intersection(cache["audit"]["ambiguousFacilitiesExcluded"])
  assert not seen.intersection(cache["audit"]["nonGroundPharmaciesExcluded"])


def test_only_numeric_zero_padding_is_normalized_without_range_or_unit_guess():
  assert key("Dorfstraße", "023", "12207") == key("Dorfstr.", "23", "12207")
  assert key("Dorfstraße", "023A", "12207") != key("Dorfstraße", "23", "12207")
  assert key("Dorfstraße", "23-25", "12207") != key("Dorfstraße", "23", "12207")
  assert key("Dorfstraße", "23", "12207") != key("Dorfstraße", "23", "12209")
  assert key("Dorfstraße", "23", "") == ""
