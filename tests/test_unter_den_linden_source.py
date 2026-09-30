"""Step 10: every chosen Linden envelope remains in the official source extract."""

import json
from pathlib import Path

import pytest

from scripts.build_unter_den_linden_entrances import build_source as build_entrances
from scripts.build_unter_den_linden_source import build_source

ROOT = Path(__file__).resolve().parents[1]


def test_bounded_linden_source_is_complete() -> None:
  data = json.loads((ROOT / "src/app/src/unterDenLindenSource.json").read_text())
  assert [len(p["parts"]) for p in data["profiles"]] == [16, 1, 3, 1]
  opera = data["profiles"][-1]["parts"][0]
  assert opera["id"] == "DEBE01YYK00001Ih"
  assert len(opera["surfaces"]) == 51
  assert opera["ground_y_m"] == 2.239
  assert opera["top_y_m"] == 25.046
  assert all(part["surfaces"] for p in data["profiles"] for part in p["parts"])


def test_linden_extract_reproduces_original_planes_when_raw_tile_available() -> None:
  tile = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_390_5819.zip"
  if not tile.exists():
    pytest.skip("Official source archive is deliberately not bundled")
  expected = json.loads((ROOT / "src/app/src/unterDenLindenSource.json").read_text())
  assert build_source(ROOT) == expected


def test_entrance_snapshot_preserves_tags_and_all_seven_accesses() -> None:
  expected = json.loads(
    (ROOT / "src/app/src/unterDenLindenEntranceSource.json").read_text()
  )
  assert [s["ref"] for s in expected["stairs"]] == list("ABCDE")
  assert [s["stepCount"] for s in expected["stairs"]] == [30, 24, 33, 30, 30]
  assert len(expected["escalators"]) == 3
  assert len(expected["lifts"]) == 2
  path = ROOT / "geo_data/regierungsviertel/raw/udl_v147/entrances.osm"
  if path.exists():
    assert build_entrances(path) == expected
