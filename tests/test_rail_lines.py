"""The aboveground railway must reach every in-bounds OSM chain end."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from isometric_berlin.data.common import load_bounds_polygon, project_geometry
from isometric_berlin.generation.build_rail_lines import (
  DECK_CLEARANCE_M,
  DEFAULT_BOUNDS,
  DEFAULT_OSM,
  ORIGIN_EASTING,
  SCHEMA_VERSION,
  TRACK_HALF_WIDTH_M,
  collect_tracks,
  is_carried,
  runs_underground,
  station_deck_top_m,
)

RAIL = Path("src/app/public/mesh/regierungsviertel/rail-lines.json")
SCENE = Path("src/app/public/mesh/regierungsviertel/scene.json")

# The task-13 data hull runs from x −3900 to x 2420 (see worldEnvelope.ts). The
# Stadtbahn crosses the whole of it, so a corridor that stops well short of
# either edge means the export lost the line somewhere.
WEST_EDGE_M = -3900
EAST_EDGE_M = 2420
NORTH_EDGE_M = -3620
SOUTH_EDGE_M = 2920


@pytest.fixture(scope="module")
def payload() -> dict:
  return json.loads(RAIL.read_text(encoding="utf-8"))


def test_runs_underground_and_is_carried_read_the_osm_tags() -> None:
  assert runs_underground({"tunnel": "yes"})
  assert runs_underground({"covered": "yes"})
  assert runs_underground({"layer": "-2"})
  assert not runs_underground({"tunnel": float("nan"), "layer": None})
  assert is_carried({"bridge": "viaduct"})
  assert is_carried({"layer": "1"})
  assert not is_carried({"bridge": "no", "layer": "0"})
  # A layer of "-1;0" is not a number and must not read as carried.
  assert not is_carried({"layer": "-1;0"})


def test_schema_and_deck_height_come_from_the_station_model(
  payload: dict,
) -> None:
  assert payload["schema_version"] == SCHEMA_VERSION
  # The deck is not an invented height: it is the model's own deck, minus
  # the clearance that lets the model cover it inside the train shed.
  expected = station_deck_top_m(SCENE) - DECK_CLEARANCE_M
  assert payload["deck_top_y_m"] == pytest.approx(expected, abs=0.001)


def test_the_viaduct_reaches_the_available_osm_chain_ends(payload: dict) -> None:
  xs = [x / 10 for surface in payload["viaduct"] for x, _ in surface["ring"]]
  assert xs, "no viaduct corridor was exported at all"
  bounds = project_geometry(load_bounds_polygon(DEFAULT_BOUNDS))
  carried, _ = collect_tracks(DEFAULT_OSM, bounds)
  source_xs = [x - ORIGIN_EASTING for line in carried for x, _ in line.coords]
  assert source_xs, "no carried OSM railway was found inside the bounds"

  # The task-10 bounds are an irregular hull, not the rectangular data
  # envelope.  Compare with the actual clipped railway ends so an unrelated
  # east/west hull extreme cannot demand a fictional extension of the line.
  assert min(xs) <= min(source_xs)
  assert max(xs) >= max(source_xs)
  assert min(source_xs) - min(xs) <= TRACK_HALF_WIDTH_M + 1.5
  assert max(xs) - max(source_xs) <= TRACK_HALF_WIDTH_M + 1.5


def test_the_viaduct_stands_on_piers(payload: dict) -> None:
  piers = payload["piers"]
  assert len(piers) > 100
  # Piers are decimetres in the same world frame as the rings, so a pier
  # far outside the map means the coordinates were converted twice.
  for x, z in piers:
    assert WEST_EDGE_M * 10 - 600 < x < EAST_EDGE_M * 10 + 600
    assert NORTH_EDGE_M * 10 - 600 < z < SOUTH_EDGE_M * 10 + 600


def test_every_drawn_track_is_a_real_chain(payload: dict) -> None:
  for key in ("viaduct_tracks", "embankment_tracks"):
    paths = payload[key]
    assert paths, f"{key} is empty"
    for path in paths:
      assert len(path) >= 2


def test_underground_cutaway_keeps_real_osm_plan_geometry(payload: dict) -> None:
  underground = payload["underground"]
  assert underground["utility_networks_included"] is False
  assert "not survey data" in underground["geometry_status"]
  assert len(underground["tracks"]) > 150
  assert len(underground["platforms"]) > 20
  assert len(underground["entrances"]) > 40
  for track in underground["tracks"]:
    assert track["id"].startswith(("way/", "relation/"))
    assert len(track["points"]) >= 2
    assert track["depth_m"] > 0
    assert track["track_y_m"] < underground["surface_reference_y_m"]


def test_u5_and_north_south_sbahn_are_identified_without_snapping(
  payload: dict,
) -> None:
  families = [track["line_family"] for track in payload["underground"]["tracks"]]
  assert families.count("u5") >= 12
  assert families.count("north_south_sbahn") >= 15
  assert payload["route_evidence"]["u5"]["official_sequence"] == [
    "Hauptbahnhof",
    "Bundestag",
    "Brandenburger Tor",
    "Unter den Linden",
  ]
  assert payload["route_evidence"]["u5"]["source"] == (
    "https://www.bvg.de/de/verbindungen/linienuebersicht/u5"
  )
  assert payload["route_evidence"]["north_south_sbahn"]["official_sequence"] == [
    "Friedrichstraße",
    "Brandenburger Tor",
    "Potsdamer Platz",
    "Anhalter Bahnhof",
  ]
  assert payload["route_evidence"]["north_south_sbahn"]["services"] == [
    "S1",
    "S2",
    "S25",
    "S26",
  ]
  names = {
    platform["name"]
    for platform in payload["underground"]["platforms"]
    if platform["name"]
  }
  for expected in {
    "Hauptbahnhof",
    "Bundestag",
    "Brandenburger Tor",
    "Friedrichstraße",
    "Potsdamer Platz",
    "Anhalter Bahnhof",
  }:
    assert expected in names


def test_tram_catenary_is_tied_to_osm_tracks(payload: dict) -> None:
  catenary = payload["tram_catenary"]
  assert "approximation" in catenary["geometry_status"]
  assert len(catenary["tracks"]) > 20
  for track in catenary["tracks"]:
    assert track["id"].startswith(("way/", "relation/"))
    assert len(track["points"]) >= 2
