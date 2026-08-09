"""Checks for the filling-station half of the street-details payload."""

from __future__ import annotations

import json
import math
from pathlib import Path

import geopandas as gpd
from shapely.geometry import Polygon

from isometric_berlin.data.common import load_bounds_polygon, project_geometry
from isometric_berlin.generation.build_street_details import (
  DEFAULT_BOUNDS,
  DEFAULT_OSM,
  ORIGIN_EASTING,
  ORIGIN_NORTHING,
  rectangle_axis,
)

PAYLOAD = Path("src/app/public/mesh/regierungsviertel/street-details.json")


def test_rectangle_axis_flips_northing_into_world_z() -> None:
  # Northing grows north but world_z grows south, so an easting/northing
  # edge heading north-east has to come back as heading north-west.
  axis, along, across = rectangle_axis(Polygon([(0, 0), (10, 10), (8, 12), (-2, 2)]))
  assert along > across
  assert axis[0] > 0
  assert axis[1] < 0
  assert math.isclose(math.hypot(*axis), 1.0, rel_tol=1e-9)


def test_every_in_bounds_osm_traffic_signal_is_exported() -> None:
  payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  bounds = project_geometry(load_bounds_polygon(DEFAULT_BOUNDS))
  roads = gpd.read_file(DEFAULT_OSM, layer="roads").to_crs(epsg=25833)
  signals = roads[
    (roads["highway"] == "traffic_signals") & (roads.geometry.geom_type == "Point")
  ]
  expected = sorted(
    [
      round((point.x - ORIGIN_EASTING) * 10),
      round((ORIGIN_NORTHING - point.y) * 10),
    ]
    for point in signals.geometry
    if bounds.contains(point)
  )
  assert payload["traffic_signals_dm"] == expected


def test_fuel_stations_are_exported_with_a_forecourt_axis() -> None:
  payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  assert payload["schema_version"] == 4
  stations = payload["fuel_stations"]
  assert sorted(entry["name"] for entry in stations) == [
    "Aral",
    "Aral",
    "Esso",
    "Shell",
    "Total",
  ]
  for entry in stations:
    assert math.isclose(math.hypot(*entry["axis"]), 1.0, abs_tol=1e-3)
    assert entry["w_dm"] > 0 and entry["d_dm"] > 0
  surveyed = sorted(entry["name"] for entry in stations if entry["surveyed_outline"])
  assert surveyed == ["Shell", "Total"]


def test_zollpackhof_beer_garden_keeps_its_surveyed_ring() -> None:
  payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  garden = next(
    entry for entry in payload["beer_gardens"] if entry["name"] == "Zollpackhof"
  )
  # OSM way 422205278, measured at 1601 m² on the full planet extract.
  assert 1550 <= garden["area_m2"] <= 1650
  assert len(garden["ring_dm"]) >= 4
  assert garden["ring_dm"][0] == garden["ring_dm"][-1]
  assert math.isclose(math.hypot(*garden["axis"]), 1.0, abs_tol=1e-3)


def test_capital_beach_is_the_only_node_only_riverside_bar() -> None:
  payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  bars = payload["riverside_bars"]
  # Every other drinking venue on the bank has an outline of its own and is
  # drawn from it; a bar listed here has nothing but a node.
  assert [entry["name"] for entry in bars] == ["Capital Beach"]
  beach = bars[0]
  assert beach["surveyed_outline"] is False
  assert beach["shore_dist_m"] < 60
  # The deck chairs stand on surveyed benches, not on an invented grid.
  assert len(beach["seats"]) >= 10
  for seat in beach["seats"]:
    assert math.isclose(math.hypot(*seat["axis"]), 1.0, abs_tol=1e-3)


def test_node_station_axis_matches_the_mapped_esso_canopy() -> None:
  # OSM way 25780043 is the Esso roof on Lessingstraße. Its long side runs
  # (0.859, 0.512) in world coordinates, which is exactly perpendicular to
  # the street — the rule the exporter uses for node-only stations.
  payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  esso = next(entry for entry in payload["fuel_stations"] if entry["name"] == "Esso")
  dot = esso["axis"][0] * 0.859 + esso["axis"][1] * 0.512
  assert abs(dot) > 0.99
