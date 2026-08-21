"""Checks for the filling-station half of the street-details payload."""

from __future__ import annotations

import json
import math
from collections import Counter
from pathlib import Path

import geopandas as gpd
from shapely.geometry import LineString, Point, Polygon, box

from isometric_berlin.data.common import load_bounds_polygon, project_geometry
from isometric_berlin.generation.build_street_details import (
  DEFAULT_BOUNDS,
  DEFAULT_OSM,
  ORIGIN_EASTING,
  ORIGIN_NORTHING,
  SCHWELLENRAUM_PROTECTED_OSM_KEYS,
  _eligible_verge_boundaries,
  _exterior_boundaries,
  _small_unverified_road_holes,
  build_traffic_signal_data,
  deduplicate_floraplatz_animals,
  rectangle_axis,
)

VERIFIED_ISLAND_SIGNAL_KEYS = {
  "node/2089708636",
  "node/4558372625",
  "node/8881562153",
  "node/10966083541",
  "node/11842476822",
  "node/11842507431",
  "node/12873153765",
  "node/13235279484",
}

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
  assert payload["schema_version"] == 7

  placements = payload["traffic_signal_placements"]
  assert len(placements) == len(expected) == 1_328
  assert len({entry["osm_key"] for entry in placements}) == len(placements)
  assert sorted(entry["source_dm"] for entry in placements) == expected
  assert Counter(entry["placement"] for entry in placements) == {
    "relocated_verge": 1_093,
    "surveyed_verge": 227,
    "verified_island": 8,
  }

  islands = {
    entry["osm_key"]: entry
    for entry in placements
    if entry["placement"] == "verified_island"
  }
  assert set(islands) == VERIFIED_ISLAND_SIGNAL_KEYS
  assert all(entry["position_dm"] == entry["source_dm"] for entry in islands.values())
  assert {key for key, entry in islands.items() if entry["source_on_carriageway"]} == {
    "node/2089708636",
    "node/4558372625",
  }

  relocated = [entry for entry in placements if entry["placement"] == "relocated_verge"]
  assert all(entry["source_requires_relocation"] for entry in relocated)
  assert {
    entry["osm_key"] for entry in relocated if not entry["source_on_carriageway"]
  } == {"node/3098737953"}
  assert all(entry["position_dm"] != entry["source_dm"] for entry in relocated)
  assert all(entry["offset_dm"] > 0 for entry in relocated)
  assert min(entry["road_clearance_dm"] for entry in relocated) >= 5

  surveyed = [entry for entry in placements if entry["placement"] == "surveyed_verge"]
  assert all(not entry["source_on_carriageway"] for entry in surveyed)
  assert all(not entry["source_requires_relocation"] for entry in surveyed)
  assert all(entry["position_dm"] == entry["source_dm"] for entry in surveyed)


def test_signal_placement_moves_only_live_lane_nodes_and_keeps_sourced_islands() -> (
  None
):
  crs = "EPSG:25833"
  roads = gpd.GeoDataFrame(
    {
      "element": ["way", "node", "node", "node"],
      "id": ["10", "11", "12", "13"],
      "highway": ["primary", "traffic_signals", "traffic_signals", "traffic_signals"],
      "crossing:island": [None, None, None, "yes"],
      "tunnel": [None, None, None, None],
      "covered": [None, None, None, None],
      "layer": [None, None, None, None],
      "width": ["10", None, None, None],
    },
    geometry=[
      LineString([(0, 0), (100, 0)]),
      Point(25, 0),
      Point(25, 10),
      Point(50, 0),
    ],
    crs=crs,
  )
  _, placements = build_traffic_signal_data(roads, box(-20, -20, 120, 20))
  by_key = {entry["osm_key"]: entry for entry in placements}
  assert by_key["node/11"]["placement"] == "relocated_verge"
  assert by_key["node/11"]["position_dm"] != by_key["node/11"]["source_dm"]
  assert by_key["node/11"]["road_clearance_dm"] >= 5
  assert by_key["node/12"]["placement"] == "surveyed_verge"
  assert by_key["node/12"]["position_dm"] == by_key["node/12"]["source_dm"]
  assert by_key["node/13"]["placement"] == "verified_island"
  assert by_key["node/13"]["position_dm"] == by_key["node/13"]["source_dm"]


def test_signal_verge_projection_never_uses_unverified_union_holes() -> None:
  polygon = Polygon(
    [(0, 0), (20, 0), (20, 20), (0, 20)],
    holes=[[(8, 8), (12, 8), (12, 12), (8, 12)]],
  )
  exteriors = _exterior_boundaries(polygon)
  assert math.isclose(exteriors.length, 80.0)
  assert exteriors.distance(Point(10, 10)) == 10.0
  eligible = _eligible_verge_boundaries(polygon)
  forbidden = _small_unverified_road_holes(polygon)
  assert eligible.distance(Point(10, 10)) == 10.0
  assert forbidden.covers(Point(10, 10))


def test_signal_verge_projection_escapes_a_connected_dual_carriageway_median() -> None:
  crs = "EPSG:25833"
  road_lines = [
    LineString([(-15, -4), (15, -4)]),
    LineString([(-15, 4), (15, 4)]),
    LineString([(-15, -4), (-15, 4)]),
    LineString([(15, -4), (15, 4)]),
  ]
  roads = gpd.GeoDataFrame(
    {
      "element": ["way", "way", "way", "way", "node"],
      "id": ["1", "2", "3", "4", "99"],
      "highway": ["primary"] * 4 + ["traffic_signals"],
      "crossing:island": [None] * 5,
      "tunnel": [None] * 5,
      "covered": [None] * 5,
      "layer": [None] * 5,
      "width": ["4"] * 4 + [None],
    },
    geometry=[*road_lines, Point(0, -4)],
    crs=crs,
  )
  _, placements = build_traffic_signal_data(roads, box(-30, -20, 30, 20))
  placement = placements[0]
  target_northing = ORIGIN_NORTHING - placement["position_dm"][1] / 10
  assert placement["placement"] == "relocated_verge"
  assert target_northing < -6.5


def test_fuel_stations_are_exported_with_a_forecourt_axis() -> None:
  payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  assert payload["schema_version"] == 7
  stations = payload["fuel_stations"]
  assert sorted(entry["name"] for entry in stations) == [
    "Agip",
    "Aral",
    "Aral",
    "Aral",
    "Aral",
    "Esso",
    "SB Tank",
    "Shell",
    "Shell",
    "Sprint",
    "Total",
    "Total",
    "Westfehling",
  ]
  for entry in stations:
    assert math.isclose(math.hypot(*entry["axis"]), 1.0, abs_tol=1e-3)
    assert entry["w_dm"] > 0 and entry["d_dm"] > 0
  surveyed = sorted(entry["name"] for entry in stations if entry["surveyed_outline"])
  assert surveyed == ["SB Tank", "Shell", "Shell", "Total"]


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


def test_floraplatz_exports_exactly_eight_restored_animals() -> None:
  payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  animals = [
    entry
    for entry in payload["monuments"]
    if -2_100 <= entry["x_dm"] <= -1_200
    and 4_100 <= entry["z_dm"] <= 5_200
    and entry["name"]
    in {"Hirsch", "Bison", "Liegender Bison Ⅱ", "Elch", "Bär", "Stier"}
  ]
  assert len(animals) == 8
  assert sorted(entry["name"] for entry in animals) == [
    "Bison",
    "Bär",
    "Elch",
    "Elch",
    "Hirsch",
    "Hirsch",
    "Liegender Bison Ⅱ",
    "Stier",
  ]


def test_memorial_subtypes_survive_the_osm_pipeline() -> None:
  payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  monuments = payload["monuments"]
  stolpersteine = [
    entry for entry in monuments if entry["memorial_type"] == "stolperstein"
  ]
  assert len(stolpersteine) > 200
  assert any(entry["name"] == "Martha Gabali" for entry in stolpersteine)
  assert any(
    entry["memorial_type"] == "statue" and entry["name"] == "Sophie Charlotte"
    for entry in monuments
  )


def test_every_monument_has_a_stable_osm_identity_and_protection_contract() -> None:
  payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  monuments = payload["monuments"]
  keys = [entry["osm_key"] for entry in monuments]
  assert len(keys) == len(set(keys))
  for entry in monuments:
    assert entry["osm_element"] in {"node", "way", "relation"}
    assert entry["osm_id"].isdigit()
    assert entry["osm_key"] == f"{entry['osm_element']}/{entry['osm_id']}"
    assert isinstance(entry["schwellenraum_protected"], bool)


def test_schwellenraum_protection_is_conservative_and_keeps_art_reviewable() -> None:
  payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  monuments = payload["monuments"]
  protected = [entry for entry in monuments if entry["schwellenraum_protected"]]

  # Every source-declared memorial and every Stolperstein stays ordinary Day.
  assert all(
    entry["schwellenraum_protected"]
    for entry in monuments
    if entry["kind"] == "memorial" or entry["memorial_type"]
  )
  assert sum(entry["memorial_type"] == "stolperstein" for entry in protected) > 900

  # Stable-key exceptions cover artwork embedded in the Moabit/Krolloper/Neue
  # Wache remembrance ensembles even though OSM does not tag it as a memorial.
  protected_keys = {entry["osm_key"] for entry in protected}
  assert SCHWELLENRAUM_PROTECTED_OSM_KEYS <= protected_keys
  assert next(entry for entry in monuments if entry["name"] == "Nie wieder Krieg")[
    "schwellenraum_protected"
  ]

  # The flag is selective and inspectable, not an accidental blanket setting.
  assert not next(entry for entry in monuments if entry["name"] == "Knut")[
    "schwellenraum_protected"
  ]


def test_floraplatz_deduplication_is_narrow_and_deterministic() -> None:
  monuments = [
    {"name": "Liegender Bison Ⅱ", "x_dm": 100, "z_dm": 100},
    {"name": "Bison", "x_dm": 106, "z_dm": 102},
    {"name": "Bison", "x_dm": 300, "z_dm": 300},
    {"name": "Hirsch", "x_dm": 102, "z_dm": 103},
  ]
  assert deduplicate_floraplatz_animals(monuments) == [
    monuments[0],
    monuments[2],
    monuments[3],
  ]
