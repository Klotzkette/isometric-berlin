"""The James-Simon supplement must retain every raw official source surface."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

from isometric_berlin.data.fetch_lod2 import (
  building_footprint,
  leaf_building_parts,
  load_bounds_polygon,
  project_to_berlin,
)

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_spree_recognition_source import extract_parent, part_profile  # noqa: E402


def test_james_simon_keeps_all_official_parts_and_surfaces() -> None:
  """Original source walls/roofs survive the procedural passage/stair openings."""
  archive = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_391_5820.zip"
  if not archive.exists():
    pytest.skip("Official raw tile is intentionally unbundled")
  source = json.loads((ROOT / "src/app/src/jamesSimonSource.json").read_text())
  parent = extract_parent(archive, source["parent_id"])
  original = [part_profile(part, True) for part in leaf_building_parts(parent)]
  assert source["parts"] == original
  assert len(original) == 8
  bounds = project_to_berlin(
    load_bounds_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  assert bounds.covers(building_footprint(parent))
  assert source["previous_display_prism"]["id"] == "94422265"
