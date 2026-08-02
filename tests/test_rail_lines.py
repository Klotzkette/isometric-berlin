"""The aboveground railway must reach the map edges, not stop in mid-air."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from isometric_berlin.generation.build_rail_lines import (
  DECK_CLEARANCE_M,
  SCHEMA_VERSION,
  is_carried,
  runs_underground,
  station_deck_top_m,
)

RAIL = Path("src/app/public/mesh/regierungsviertel/rail-lines.json")
SCENE = Path("src/app/public/mesh/regierungsviertel/scene.json")

# The drawn map runs from x −2880 to x 690 (see worldEnvelope.ts). The
# Stadtbahn crosses the whole of it, so a corridor that stops well short of
# either edge means the export lost the line somewhere.
WEST_EDGE_M = -2880
EAST_EDGE_M = 690


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


def test_the_viaduct_runs_out_to_the_east_edge(payload: dict) -> None:
  xs = [x / 10 for surface in payload["viaduct"] for x, _ in surface["ring"]]
  assert xs, "no viaduct corridor was exported at all"
  # East is the side that used to stop in mid-air over the Humboldthafen.
  assert max(xs) > EAST_EDGE_M - 60
  # West, the OSM extract's rail layer itself ends near Bahnhof Zoo at
  # x −2654, well inside the bounds; the corridor must reach that limit
  # rather than stopping short of it.
  assert min(xs) < -2600
  assert min(xs) > WEST_EDGE_M


def test_the_viaduct_stands_on_piers(payload: dict) -> None:
  piers = payload["piers"]
  assert len(piers) > 100
  # Piers are decimetres in the same world frame as the rings, so a pier
  # far outside the map means the coordinates were converted twice.
  for x, z in piers:
    assert WEST_EDGE_M * 10 - 600 < x < EAST_EDGE_M * 10 + 600
    assert -13_100 - 600 < z < 16_200 + 600


def test_every_drawn_track_is_a_real_chain(payload: dict) -> None:
  for key in ("viaduct_tracks", "embankment_tracks"):
    paths = payload[key]
    assert paths, f"{key} is empty"
    for path in paths:
      assert len(path) >= 2
