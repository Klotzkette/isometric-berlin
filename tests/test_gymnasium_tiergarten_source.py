"""Source preservation for the bounded school recognition supplement."""

import json
from pathlib import Path

import pytest
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]


def test_school_source_keeps_all_original_parts_and_display_records() -> None:
  data = json.loads((ROOT / "src/app/src/gymnasiumTiergartenSource.json").read_text())
  assert data["parent_id"] == "DEBE01YYK0002KxL"
  assert len(data["parts"]) == len(data["previous_display_prisms"]) == 13
  assert data["display_y_translation_m"] == 0.868
  ids = {p["id"][-8:] for p in data["parts"]}
  assert ids == set(data["replaced_prism_ids"])
  assert ids == {p["id"] for p in data["previous_display_prisms"]}
  for part in data["parts"]:
    assert Polygon(part["ring"], part["holes"]).is_valid
    assert any(s["kind"] == "RoofSurface" for s in part["surfaces"])
    # Official measuredHeight and rounded surface extrema differ by at most 1 mm.
    assert abs(part["top_y_m"] - part["ground_y_m"] - part["height_m"]) < 0.0011


@pytest.mark.skipif(
  not (ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_387_5820.zip").exists(),
  reason="Original LoD2 archives are intentionally not distributed in clean clones",
)
def test_school_supplement_regenerates_from_retained_official_archive() -> None:
  from scripts.build_gymnasium_tiergarten_source import build_source

  expected = json.loads(
    (ROOT / "src/app/src/gymnasiumTiergartenSource.json").read_text()
  )
  assert build_source(ROOT) == expected
