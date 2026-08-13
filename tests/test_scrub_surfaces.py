"""Source-backed OSM shrub masses for the drawn Tiergarten."""

from __future__ import annotations

import json
from pathlib import Path

from isometric_berlin.generation.build_surface_polygons import (
  SCHEMA_VERSION,
  SCRUB_SPACING_M,
)

SURFACES = Path("src/app/public/mesh/regierungsviertel/surface-polygons.json")


def test_mapped_scrub_inventory_and_samples_are_complete() -> None:
  payload = json.loads(SURFACES.read_text(encoding="utf-8"))
  assert payload["schema_version"] == SCHEMA_VERSION
  inventory = payload["scrub_inventory"]
  points = payload["scrub_points"]

  # The road/water exclusion removes twelve source polygons completely. Keep
  # the contract below the current 298 so a harmless boundary touch does not
  # make an otherwise identical source refresh fail.
  assert inventory["feature_count"] >= 295
  assert inventory["mapped_area_m2"] >= 200_000
  assert inventory["sampling_spacing_m"] == SCRUB_SPACING_M
  assert inventory["point_count"] == len(points)
  assert len(points) >= 1_400
  assert {point[4] for point in points} == {0, 1, 2}
  assert all(13 <= point[2] <= 23 for point in points)
  assert all(9 <= point[3] <= 20 for point in points)
