"""Additive pavilion coverage preserves official sheets and the approved bounds."""

import json
from pathlib import Path

import pytest
from shapely.geometry import Point

from isometric_berlin.data.fetch_lod2 import load_bounds_polygon, project_to_berlin
from scripts.build_fernsehturm_pavilion_source import build_source

ROOT = Path(__file__).resolve().parents[1]


def test_pavilion_source_preserves_parts_without_replacing_prior_east_sources() -> None:
  source = json.loads((ROOT / "src/app/src/fernsehturmPavilionSource.json").read_text())
  assert len(source["profiles"]) == 16
  parts = [p for profile in source["profiles"] for p in profile["parts"]]
  assert len(parts) == 22
  assert len({p["id"] for p in parts}) == len(parts)
  assert all(p["surfaces"] for p in parts)
  previous = json.loads((ROOT / "src/app/src/schlossEastSource.json").read_text())
  old_ids = {
    p["id"] for profile in previous["profiles"].values() for p in profile["parts"]
  }
  assert not old_ids.intersection(p["id"] for p in parts)


def test_all_pavilion_canopies_and_stairs_remain_in_existing_bounds() -> None:
  source = json.loads((ROOT / "src/app/src/fernsehturmPavilionSource.json").read_text())
  bounds = project_to_berlin(
    load_bounds_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  for profile in source["profiles"]:
    for part in profile["parts"]:
      for surface in part["surfaces"]:
        for ring in surface["rings"]:
          for x, _, z in ring:
            assert bounds.covers(Point(389500 + x, 5820000 - z))
  assert len([p for p in source["profiles"] if p["display_role"] == "steps"]) == 4
  assert (
    max(p["top_y_m"] for profile in source["profiles"] for p in profile["parts"])
    == 24.097
  )


@pytest.mark.skipif(
  not (ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_392_5820.zip").exists(),
  reason="Optional ignored official LoD2 archive is absent in fresh clones",
)
def test_pavilion_source_regenerates_from_available_local_archive() -> None:
  source = json.loads((ROOT / "src/app/src/fernsehturmPavilionSource.json").read_text())
  assert build_source(ROOT) == source
