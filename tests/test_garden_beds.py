"""Formal gardens are drawn bed by bed, not as one green patch."""

from __future__ import annotations

import json
from pathlib import Path

from isometric_berlin.generation.build_surface_polygons import (
  MIN_GARDEN_AREA_M2,
  MIN_PARK_AREA_M2,
)

SURFACES = Path("src/app/public/mesh/regierungsviertel/surface-polygons.json")


def test_every_park_entry_carries_a_kind() -> None:
  payload = json.loads(SURFACES.read_text(encoding="utf-8"))
  kinds = {entry["kind"] for entry in payload["parks"]}
  assert kinds == {"garden", "lawn"}


def test_the_rosengarten_beds_survive_the_lawn_area_floor() -> None:
  # Beds run from 27 to 196 m², all of them under the 250 m² lawn floor.
  assert MIN_GARDEN_AREA_M2 < MIN_PARK_AREA_M2
  payload = json.loads(SURFACES.read_text(encoding="utf-8"))
  beds = [
    entry
    for entry in payload["parks"]
    if entry["kind"] == "garden"
    and all(-10500 <= x <= -9400 and 4900 <= z <= 5900 for x, z in entry["ring"])
  ]
  assert len(beds) >= 8, f"only {len(beds)} Rosengarten beds survived"
  assert any(entry["area_m2"] < MIN_PARK_AREA_M2 for entry in beds)


def test_the_rosengarten_itself_is_still_drawn() -> None:
  payload = json.loads(SURFACES.read_text(encoding="utf-8"))
  named = [entry for entry in payload["parks"] if entry["name"] == "Rosengarten"]
  assert named and named[0]["kind"] == "garden"
