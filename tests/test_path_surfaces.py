"""Source-faithful materials for the complete bounded OSM path network."""

from __future__ import annotations

import json
from pathlib import Path

from isometric_berlin.generation.build_surface_polygons import road_surface_kind

SURFACES = Path("src/app/public/mesh/regierungsviertel/surface-polygons.json")


def test_explicit_path_surface_beats_park_context() -> None:
  assert road_surface_kind({"surface": "asphalt"}, "cycleway", True) == "asphalt"
  assert road_surface_kind({"surface": "paving_stones"}, "footway", True) == "paving"
  assert road_surface_kind({"surface": "fine_gravel"}, "footway", False) == "sand"
  assert road_surface_kind({"surface": "ground"}, "path", False) == "earth"
  assert road_surface_kind({"surface": "wood"}, "footway", False) == "wood"
  assert road_surface_kind({"surface": "metal"}, "steps", False) == "metal"


def test_untagged_park_paths_keep_the_sandy_fallback() -> None:
  assert road_surface_kind({"surface": None}, "footway", True) == "sand"
  assert road_surface_kind({"surface": float("nan")}, "cycleway", True) == "sand"
  assert road_surface_kind({"surface": None}, "footway", False) == "paving"
  # The existing motor-road contract is intentionally unchanged.
  assert road_surface_kind({"surface": "sett"}, "primary", False) == "asphalt"


def test_payload_documents_every_bounded_path_family_and_material() -> None:
  payload = json.loads(SURFACES.read_text(encoding="utf-8"))
  assert payload["schema_version"] == 7
  inventory = payload["path_inventory"]
  assert inventory["scope"] == "bounded above-ground OSM path geometry"
  assert inventory["line_parts"] >= 8_000
  assert inventory["mapped_surface_line_parts"] >= 7_000
  assert inventory["mapped_width_line_parts"] >= 900
  assert set(inventory["by_highway"]) == {
    "cycleway",
    "footway",
    "path",
    "pedestrian",
    "steps",
    "track",
  }
  assert set(inventory["by_resolved_material"]) == {
    "asphalt",
    "earth",
    "metal",
    "paving",
    "sand",
    "wood",
  }
  assert sum(inventory["by_highway"].values()) == inventory["line_parts"]
  assert sum(inventory["by_resolved_material"].values()) == inventory["line_parts"]
