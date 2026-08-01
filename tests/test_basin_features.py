"""Checks for constructed water basins and the walls that sink into them."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from isometric_berlin.generation.basin_features import (
  BASIN_WATER_VALUES,
  derive_sunken_walls,
  is_basin,
  load_water_features,
)

OSM = Path("geo_data/regierungsviertel/osm.gpkg")
SURFACES = Path("src/app/public/mesh/regierungsviertel/surface-polygons.json")
VOXELS = Path("src/app/public/mesh/regierungsviertel/minecraft-voxels.json")


@pytest.fixture(scope="module")
def water_features() -> list:
  return load_water_features(OSM)


@pytest.fixture(scope="module")
def surfaces() -> dict:
  return json.loads(SURFACES.read_text(encoding="utf-8"))


def test_pond_is_not_a_basin() -> None:
  # The Neuer See and the Tiergarten ponds sit at the same groundwater
  # table as the Spree; perching them would lift them off their banks.
  assert "pond" not in BASIN_WATER_VALUES
  assert not is_basin({"water": "pond"})
  assert is_basin({"amenity": "fountain"})
  assert is_basin({"water": "reflecting_pool"})


def test_basins_are_a_minority_of_the_water(water_features: list) -> None:
  basins = [f for f in water_features if f.kind == "basin"]
  rivers = [f for f in water_features if f.kind == "river"]
  assert basins, "the district has documented fountain basins"
  assert len(rivers) > len(basins)


def test_the_invalidenpark_basin_is_water(surfaces: dict) -> None:
  # The Girot fountain, in world metres: x 334..382, z -1180..-1121.
  hits = [
    entry
    for entry in surfaces["water"]
    if entry["kind"] == "basin"
    and 3300 <= min(point[0] for point in entry["ring"]) <= 3400
    and -11850 <= min(point[1] for point in entry["ring"]) <= -11750
  ]
  assert len(hits) == 1
  assert hits[0]["area_m2"] > 2000


def test_the_sunken_wall_runs_from_the_rim_into_the_basin(
  water_features: list,
) -> None:
  walls = derive_sunken_walls(OSM, water_features)
  assert len(walls) == 1
  wall = walls[0]
  assert wall.name == "Sinkende Mauer"
  assert 2.0 < wall.width_m < 6.0
  # A wall is long and thin, and it reaches well into the basin.
  length = (
    (wall.crest_end[0] - wall.sink_end[0]) ** 2
    + (wall.crest_end[1] - wall.sink_end[1]) ** 2
  ) ** 0.5
  assert length > wall.width_m * 5


def test_the_payload_carries_the_wall_axis(surfaces: dict) -> None:
  assert surfaces["schema_version"] >= 3
  walls = surfaces["sunken_walls"]
  assert len(walls) == 1
  wall = walls[0]
  assert len(wall["ring"]) >= 4
  assert len(wall["crest"]) == 2 and len(wall["sink"]) == 2
  assert wall["crest"] != wall["sink"]


def test_every_water_polygon_is_classified(surfaces: dict) -> None:
  kinds = {entry["kind"] for entry in surfaces["water"]}
  assert kinds <= {"basin", "river"}
  assert kinds == {"basin", "river"}


def test_voxels_keep_basins_off_the_river_table() -> None:
  payload = json.loads(VOXELS.read_text(encoding="utf-8"))
  assert "basin" in payload["classes"]
  basin_id = payload["classes"].index("basin")
  cells = sum(
    run for row in payload["ground_rows"] for _, run, cid in row if cid == basin_id
  )
  assert cells > 100
