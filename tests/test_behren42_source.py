"""Bounded, additive source contract for the Humboldt Carré recognition model."""

import json
from pathlib import Path

import pytest
from shapely.geometry import Polygon
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import (
  load_bounds_polygon,
  project_to_berlin,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads((ROOT / "src/app/src/behren42Source.json").read_text())


def test_complete_parent_is_inside_bounds_and_preserves_identity_conflict() -> None:
  """The LoD2 name is kept alongside the correctly sourced current identity."""
  assert SOURCE["parent_id"] == "DEBE01YYK00002wR"
  assert SOURCE["source_name_retained"] == "Botschaft Turkmenistan"
  assert len(SOURCE["parts"]) == 8
  bounds = project_to_berlin(
    load_bounds_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  for part in SOURCE["parts"]:
    ring = [(x + 389500, 5820000 - z) for x, z in part["ring"]]
    assert bounds.covers(Polygon(ring))
    assert part["ground_y_m"] == 3.313
    assert {s["kind"] for s in part["surfaces"]} == {
      "WallSurface",
      "RoofSurface",
    }
  assert max(p["top_y_m"] for p in SOURCE["parts"]) == 34.632
  assert 34.632 + SOURCE["display_y_translation_m"] == pytest.approx(36.519)


def test_old_prisms_remain_verbatim_and_replacement_is_spatially_justified() -> None:
  """Only almost wholly covered prisms are replaced, not the rear neighbour."""
  delivered = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  by_id = {p["id"]: p for p in delivered}
  footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in SOURCE["parts"]])
  for old in SOURCE["previous_display_prisms"]:
    assert old == by_id[old["id"]]
    ring = Polygon([(x / 10, z / 10) for x, z in old["ring"]])
    assert ring.intersection(footprint).area / ring.area > 0.99
  assert "56467771" not in SOURCE["replaced_prism_ids"]
  assert len(SOURCE["source_sha256"]) == 64
