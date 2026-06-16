"""Tests for deterministic isometric source rendering helpers."""

from __future__ import annotations

from shapely.geometry import box

from isometric_berlin.generation.render_quadrants import (
  RAIL,
  RAIL_PLATFORM,
  ROAD_MAJOR,
  ROAD_PATH,
  building_height,
  landmark_icon_unit,
  landmark_kind,
  rail_style,
  road_style,
)


def test_building_height_prefers_valid_lod2_measurement() -> None:
  row = {"measured_height_m": 12.5, "geometry": box(0, 0, 200, 200)}

  assert building_height(row) == 12.5


def test_building_height_ignores_missing_or_implausibly_low_values() -> None:
  row = {"measured_height_m": 0.01, "geometry": box(0, 0, 110, 100)}

  assert building_height(row) == 28.0


def test_building_height_keeps_small_landmarks_visible() -> None:
  row = {"measured_height_m": None, "geometry": box(0, 0, 22, 20)}

  assert building_height(row, is_hero=True) == 18.0


def test_road_style_separates_major_roads_from_paths() -> None:
  major_color, major_width, major_order = road_style({"highway": "primary"}, 2)
  path_color, path_width, path_order = road_style({"highway": "footway"}, 2)

  assert major_color == ROAD_MAJOR
  assert path_color == ROAD_PATH
  assert major_width > path_width
  assert major_order > path_order


def test_rail_style_filters_signal_points_and_keeps_platforms() -> None:
  assert rail_style({"railway": "signal"}, 2) is None
  assert rail_style({"railway": "rail"}, 2) == (RAIL, 2, 2)
  assert rail_style({"railway": "platform"}, 2) == (RAIL_PLATFORM, 2, 1)


def test_rail_style_hides_subway_and_tunnel_lines() -> None:
  assert rail_style({"railway": "subway"}, 2) is None
  assert rail_style({"railway": "rail", "tunnel": "yes"}, 2) is None
  assert rail_style({"railway": "rail", "covered": "yes"}, 2) is None
  assert rail_style({"railway": "rail", "layer": "-1"}, 2) is None


def test_landmark_kind_routes_required_hero_shapes() -> None:
  assert landmark_kind("Brandenburger Tor") == "gate"
  assert landmark_kind("Reichstagsgebäude") == "dome"
  assert landmark_kind("Berlin Hauptbahnhof") == "glass_station"
  assert landmark_kind("Haus der Kulturen der Welt (Schwangere Auster)") == (
    "curved_roof"
  )
  assert landmark_kind("Gustav-Heinemann-Brücke") == "bridge"
  assert landmark_kind("Unknown cafe") is None


def test_landmark_icon_unit_stays_visible_but_bounded() -> None:
  assert landmark_icon_unit(512) == 3
  assert landmark_icon_unit(6144) == 8
  assert landmark_icon_unit(12000) == 8
