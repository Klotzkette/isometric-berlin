"""Tests for the top-down placement reference map."""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
from PIL import Image

from isometric_berlin.generation.render_reference_map import (
  REFERENCE_RED,
  MapTransform,
  legend_grid,
  render_reference_map,
  sort_landmarks_for_reference,
)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data" / "regierungsviertel"
PEDESTRIAN_MAP = ROOT / "src/app/public/dzi/regierungsviertel/pedestrian_map.png"


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


def test_archival_reference_export_keeps_markers_out_of_walking_crop(
  tmp_path: Path,
) -> None:
  """The QA renderer remains usable without a public flat-map viewer asset."""
  bounds = tmp_path / "bounds.geojson"
  bounds.write_text(
    json.dumps(
      {
        "type": "FeatureCollection",
        "features": [
          {
            "type": "Feature",
            "properties": {},
            "geometry": {
              "type": "Polygon",
              "coordinates": [
                [
                  [13.37, 52.50],
                  [13.38, 52.50],
                  [13.38, 52.51],
                  [13.37, 52.51],
                  [13.37, 52.50],
                ]
              ],
            },
          }
        ],
      }
    ),
    encoding="utf-8",
  )
  landmarks = tmp_path / "landmarks.geojson"
  landmarks.write_text(
    json.dumps(
      {
        "type": "FeatureCollection",
        "features": [
          {
            "type": "Feature",
            "properties": {"name": "QA fixture", "tour_order": 1},
            "geometry": {"type": "Point", "coordinates": [13.375, 52.505]},
          }
        ],
      }
    ),
    encoding="utf-8",
  )
  reference = tmp_path / "qa" / "reference.png"
  minimap = tmp_path / "qa" / "walking.png"
  render_reference_map(
    bounds_path=bounds,
    buildings_path=tmp_path / "empty-buildings.gpkg",
    osm_path=tmp_path / "empty-osm.gpkg",
    landmarks_path=landmarks,
    out_path=reference,
    mini_map_out_path=minimap,
    width=800,
    height=450,
    legend_width=300,
    pad=30,
  )
  with Image.open(reference) as image:
    assert image.size == (800, 450)
    assert image.mode == "RGB"
    assert any(pixel == REFERENCE_RED for pixel in image.get_flattened_data())
  with Image.open(minimap) as image:
    assert image.size == (500, 450)
    assert image.mode == "RGB"
    assert all(pixel != REFERENCE_RED for pixel in image.get_flattened_data())


def test_pedestrian_map_omits_numbered_landmark_markers_and_legend() -> None:
  assert PEDESTRIAN_MAP.exists()
  assert PEDESTRIAN_MAP.stat().st_size > 100_000
  with Image.open(PEDESTRIAN_MAP) as image:
    assert image.size == (1400, 1300)
    assert image.mode == "RGB"
    assert all(pixel != REFERENCE_RED for pixel in image.get_flattened_data())


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
  assert names.index("Denkzeichen Georg Elser") + 1 == 88
  assert names.index("Queer Rainbow Memorial Berlin") + 1 == 89
  assert names.index("Richard Wagner") + 1 == 90
