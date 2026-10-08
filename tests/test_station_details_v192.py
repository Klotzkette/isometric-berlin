"""Source-preservation contracts for the two bounded station refinements."""

import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_original_station_payloads_are_byte_exact():
  evidence = json.loads(
    (ROOT / "geo_data/regierungsviertel/station-details-v192-evidence.json").read_text()
  )
  assert len(evidence["retained_payload_sha256"]) == 4
  for path, digest in evidence["retained_payload_sha256"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest


def test_small_receipt_reproduces_exact_saved_osm_and_single_original_owner():
  spec = importlib.util.spec_from_file_location(
    "station192", ROOT / "scripts/build_station_details_v192.py"
  )
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  data = json.loads((ROOT / "src/app/src/data/stationDetailsV192.json").read_text())
  assert module.build() == data
  zoo = data["zoo"]
  assert (zoo["roof"]["id"], zoo["entrance"]["id"], zoo["stairs"]["id"]) == (
    "157658318",
    "1223731363",
    "274269257",
  )
  assert zoo["roof"]["tags"]["height"] == "3"
  assert zoo["height"] == 3
  assert zoo["roof"]["points"][0] == zoo["roof"]["points"][-1]
  assert len(zoo["roof"]["points"]) == 5
  core = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )
  assert zoo["legacyPrism"] == next(
    p for p in core["buildings"] if p["id"] == "57658318"
  )
  assert any(p["id"] == "-3652421" for p in core["buildings"])


def test_photo_credits_are_complete_free_reference_only_records():
  records = json.loads(
    (ROOT / "geo_data/regierungsviertel/station-details-v192-credits.json").read_text()
  )["records"]
  assert {p["artist"] for p in records} == {"Sebastian Wallroth", "Geoprofi Lars"}
  assert {p["license"] for p in records} == {"CC BY 4.0", "CC BY-SA 4.0"}
  assert all(
    p["page_url"].startswith("https://commons.wikimedia.org/wiki/File:")
    and not p["photo_bundled"]
    for p in records
  )
