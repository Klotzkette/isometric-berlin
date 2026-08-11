"""Checks for constructed water basins and the walls that sink into them."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from shapely.geometry import Polygon

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
  # Natural ponds need a local soft-bank level, not a built basin rim.
  assert "pond" not in BASIN_WATER_VALUES
  assert not is_basin({"water": "pond"})
  assert is_basin({"amenity": "fountain"})
  assert is_basin({"water": "reflecting_pool"})


def test_basins_are_a_minority_of_the_water(water_features: list) -> None:
  basins = [f for f in water_features if f.kind == "basin"]
  rivers = [f for f in water_features if f.kind == "river"]
  ponds = [f for f in water_features if f.kind == "pond"]
  streams = [f for f in water_features if f.kind == "stream"]
  assert basins, "the district has documented fountain basins"
  assert ponds, "the Tiergarten's mapped ponds must retain natural banks"
  assert streams, "mapped Tiergarten streams and ditches must not be discarded"
  assert len(rivers) > len(basins)


def test_tiergarten_water_keeps_its_specific_class(water_features: list) -> None:
  named = {(feature.name, feature.kind) for feature in water_features}
  assert ("Venusbassin", "pond") in named
  assert ("Neuer See", "pond") in named
  assert all(
    feature.geometry.area >= 2 for feature in water_features if feature.kind == "stream"
  )


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


def test_the_sunken_wall_climbs_from_the_rim_into_the_basin(
  water_features: list,
) -> None:
  walls = derive_sunken_walls(OSM, water_features)
  assert len(walls) == 1
  wall = walls[0]
  assert wall.name == "Sinkende Mauer"
  assert 2.0 < wall.width_m < 6.0
  # A wall is long and thin, and it reaches well into the basin.
  length = (
    (wall.crest_end[0] - wall.foot_end[0]) ** 2
    + (wall.crest_end[1] - wall.foot_end[1]) ** 2
  ) ** 0.5
  assert length > wall.width_m * 5
  # The owner's photographs: ground level in the north, climbing south to
  # the high point that breaks off into the water. Northing decreases
  # southwards, so the foot is the northern end.
  assert wall.foot_end[1] > wall.crest_end[1]


def test_the_payload_carries_the_wall_axis(surfaces: dict) -> None:
  assert surfaces["schema_version"] >= 4
  walls = surfaces["sunken_walls"]
  assert len(walls) == 1
  wall = walls[0]
  assert len(wall["ring"]) >= 4
  assert len(wall["crest"]) == 2 and len(wall["foot"]) == 2
  assert wall["crest"] != wall["foot"]
  # World z runs south, so the high crest carries the larger z.
  assert wall["crest"][1] > wall["foot"][1]


def test_voxel_wedge_steps_up_towards_the_crest() -> None:
  payload = json.loads(VOXELS.read_text(encoding="utf-8"))
  # A freestanding wall gets its own class so the voxel viewer does not
  # punch storey windows into it.
  wall = payload["classes"].index("wall")
  wedge = sorted(
    (z_idx, y1 - y0)
    for x_idx, z_idx, y0, y1, cid in payload["buildings"]
    if cid == wall and x_idx == 89 and -296 <= z_idx <= -284
  )
  assert len(wedge) >= 6
  heights = [height for _, height in wedge]
  assert heights == sorted(heights)
  assert heights[0] < heights[-1]


def test_every_water_polygon_is_classified(surfaces: dict) -> None:
  kinds = {entry["kind"] for entry in surfaces["water"]}
  assert kinds <= {"basin", "pond", "river", "stream"}
  assert kinds == {"basin", "pond", "river", "stream"}


def test_parkland_does_not_cover_natural_tiergarten_water(surfaces: dict) -> None:
  def polygon(entry: dict) -> Polygon:
    shell = [(x / 10, z / 10) for x, z in entry["ring"]]
    holes = [[(x / 10, z / 10) for x, z in ring] for ring in entry.get("holes", [])]
    return Polygon(shell, holes)

  ponds = [
    polygon(entry)
    for entry in surfaces["water"]
    if entry.get("name") in {"Neuer See", "Venusbassin"}
  ]
  parks = [polygon(entry) for entry in surfaces["parks"]]
  assert ponds
  assert all(
    not any(park.covers(pond.representative_point()) for park in parks)
    for pond in ponds
  )


def test_voxels_keep_basins_off_the_river_table() -> None:
  payload = json.loads(VOXELS.read_text(encoding="utf-8"))
  assert "basin" in payload["classes"]
  basin_id = payload["classes"].index("basin")
  cells = sum(
    run for row in payload["ground_rows"] for _, run, cid in row if cid == basin_id
  )
  assert cells > 100


def test_voxels_keep_park_water_on_local_terrain() -> None:
  payload = json.loads(VOXELS.read_text(encoding="utf-8"))
  assert "pond" in payload["classes"]
  pond_id = payload["classes"].index("pond")
  cells = sum(
    run for row in payload["ground_rows"] for _, run, cid in row if cid == pond_id
  )
  assert cells > 100
