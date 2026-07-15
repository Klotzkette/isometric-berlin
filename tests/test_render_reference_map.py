"""Tests for the top-down placement reference map."""

from __future__ import annotations

from pathlib import Path

import geopandas as gpd
from PIL import Image

from isometric_berlin.generation.render_reference_map import (
  MapTransform,
  legend_grid,
  sort_landmarks_for_reference,
)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data" / "regierungsviertel"
REFERENCE_MAP = ROOT / "src/app/public/dzi/regierungsviertel/reference_map.png"


def test_map_transform_keeps_north_up() -> None:
  transform = MapTransform(
    minx=0,
    miny=0,
    maxx=100,
    maxy=100,
    width=300,
    height=220,
    legend_width=80,
    pad=10,
  )

  east = transform.point(90, 50)
  west = transform.point(10, 50)
  north = transform.point(50, 90)
  south = transform.point(50, 10)

  assert east[0] > west[0]
  assert north[1] < south[1]


def test_committed_reference_map_is_packaged_asset() -> None:
  assert REFERENCE_MAP.exists()
  assert REFERENCE_MAP.stat().st_size > 100_000
  with Image.open(REFERENCE_MAP) as image:
    assert image.size == (2200, 1300)
    assert image.mode == "RGB"


def test_legend_grid_uses_two_columns_for_full_landmark_inventory() -> None:
  assert legend_grid(26) == (1, 26)
  assert legend_grid(39) == (2, 20)
  assert legend_grid(40) == (2, 20)


def test_reference_map_numbers_follow_viewer_tour_order() -> None:
  landmarks = gpd.read_file(DATA / "landmarks.geojson")

  ordered = sort_landmarks_for_reference(landmarks)
  names = list(ordered["name"])

  assert names[:7] == [
    "Berlin Hauptbahnhof",
    "Humboldthafen",
    "Hugo-Preuß-Brücke",
    "Rahel-Hirsch-Straße",
    "Gustav-Heinemann-Brücke",
    "Moltkebrücke",
    "Zollpackhof",
  ]
  assert names.index("Schweizerische Botschaft") + 1 == 8
  assert names.index("Brandenburger Tor") + 1 == 25
  assert names.index("Venusbassin / Goldfischteich") + 1 == 35
  assert names.index("Spielplatz an der Luiseninsel") + 1 == 38
  assert (
    names.index("Tiergartentunnel Südeingang (Sony Center / Potsdamer Platz)") + 1 == 40
  )
