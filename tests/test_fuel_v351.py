"""Evidence boundaries and exact closed-canopy corrections retain the old city."""

import base64

import numpy as np
from shapely.geometry import Polygon

from scripts.build_fuel_inventory_v351 import GEO, ROOT, category, fuel_state, read, sha
from scripts.build_fuel_packets_v351 import fingerprint

DATA = ROOT / "src/app/src/data"


def plans():
  for group in read(DATA / "fuelStationsV351Index.json")["sources"]:
    source = read(DATA / group["file"])
    assert source["keys"] == group["keys"]
    assert len(group["keys"]) <= 16
    yield from source["packets"].values()


def test_lifecycle_and_fuel_types_are_not_conflated():
  assert fuel_state({"amenity": "fuel", "disused": "yes"}) == "disused"
  assert fuel_state({"disused:amenity": "fuel"}) == "disused"
  assert fuel_state({"amenity": "charging_station"}) is None
  assert category({"fuel:h70": "yes"}) == "hydrogen-station"
  assert category({"fuel:h70": "yes", "fuel:diesel": "yes"}) == "fuel-station"
  assert category({"amenity": "fuel", "access": "private"}) == "restricted-fuel-site"


def test_every_mapped_site_retained_and_all_legacy_models_unchanged():
  source = read(GEO / "fuel-v351-source.json.gz")
  inventory = read(GEO / "fuel-v351-inventory.json.gz")
  assert inventory["sourceSha256"] == sha(GEO / "fuel-v351-source.json.gz")
  assert len(source["records"]) == inventory["counts"]["sourceRecords"] == 305
  assert {r["id"] for r in source["records"]} == {r["id"] for r in inventory["records"]}
  assert inventory["counts"]["states"] == {
    "mapped-active": 292,
    "disused": 12,
    "razed": 1,
  }
  old_path = ROOT / source["sources"]["legacy"]["path"]
  assert sha(old_path) == source["sources"]["legacy"]["sha256"]
  assert [r["source"] for r in source["legacyModels"]] == read(old_path)[
    "fuel_stations"
  ]
  assert len(source["legacyModels"]) == 13
  changed = {r["site"] for r in read(GEO / "fuel-v351-ownership.json.gz")["owners"]}
  assert not changed.intersection({r["site"] for r in source["legacyModels"]})


def test_complete_replacement_records_leave_roofs_and_lines_untouched():
  for plan in plans():
    assert plan["retireLines"] == []
    assert plan["appendFingerprint"] == fingerprint(plan["append"])
    assert len(plan["preparedRecords"]) < 16
    assert plan["retireNav"] and len(plan["retireNav"]) <= len(plan["appendNav"])
    for old in plan["retireNav"]:
      roof = next(b for b in plan["appendNav"] if b["sourceId"] == old["sourceId"])
      assert old["minHeight"] == 0
      assert roof["ring"] == old["ring"] and roof["holes"] == old["holes"]
      assert roof["height"] == old["height"]
      assert 2.5 <= roof["minHeight"] < roof["height"]
    # The removed complement consists only of literal vertical walls.
    # Preserved triangles and complete nav are checked through the actual
    # decoder in scripts/check-fuel-v351.ts against every prepared packet.
    for retired in plan["retire"]:
      assert retired["triangles"] == sorted(set(retired["triangles"]))
    part = plan["append"]
    points = np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3)
    indices = np.frombuffer(base64.b64decode(part["indices"]), "<u4")
    assert max(indices) < len(points)
    assert len(indices) % 3 == 0
    assert np.isfinite(points).all()


def test_pump_and_column_collision_bodies_fit_their_canopies():
  for plan in plans():
    roofs = [
      Polygon(b["ring"], b["holes"])
      for b in plan["appendNav"]
      if any(b["sourceId"] == old["sourceId"] for old in plan["retireNav"])
    ]
    for b in plan["appendNav"]:
      if not any(
        marker in b["sourceId"] for marker in (":post:", ":island:", ":pump:")
      ):
        continue
      footprint = Polygon(b["ring"], b["holes"])
      assert footprint.is_valid and footprint.area > 0
      assert any(roof.buffer(0.02).covers(footprint) for roof in roofs)
      assert b["height"] > b["minHeight"]


def test_every_source_site_has_one_honest_representation_disposition():
  dispositions = read(GEO / "fuel-v351-dispositions.json.gz")
  inventory = read(GEO / "fuel-v351-inventory.json.gz")
  assert dispositions["inventorySha256"] == sha(GEO / "fuel-v351-inventory.json.gz")
  assert {r["id"] for r in dispositions["records"]} == {
    r["id"] for r in inventory["records"]
  }
  assert len(dispositions["records"]) == 305
  assert dispositions["counts"] == {
    "preserved-legacy": 13,
    "unresolved-geometry": 215,
    "canopy-corrected": 31,
    "newly-modeled-canopy": 33,
    "inactive-source": 13,
  }
