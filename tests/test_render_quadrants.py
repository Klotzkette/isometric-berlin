"""Tests for deterministic isometric source rendering helpers."""

from __future__ import annotations

from shapely.geometry import box

from isometric_berlin.generation.render_quadrants import (
  BUILDING_HERO,
  BUILDING_WALL,
  RAIL,
  RAIL_PLATFORM,
  ROAD_MAJOR,
  ROAD_PATH,
  building_height,
  building_surface_palette,
  landmark_icon_unit,
  landmark_kind,
  mix_color,
  poi_style,
  rail_style,
  road_style,
  stable_variation,
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


def test_mix_color_is_channel_wise_and_clamped() -> None:
  assert mix_color((0, 100, 200), (100, 200, 300), 0.5) == (50, 150, 250)


def test_stable_variation_is_deterministic_and_bounded() -> None:
  first = stable_variation("DEBE01YYK0002R7V:5000")
  second = stable_variation("DEBE01YYK0002R7V:5000")

  assert first == second
  assert -9 <= first <= 9


def test_building_surface_palette_uses_lod2_surface_evidence() -> None:
  row = {
    "building_id": "DEBE01YYK0002R7V",
    "function": "31001_2010",
    "roof_type": "5000",
  }

  palette = building_surface_palette(row, is_hero=False, height_m=12.0)
  hero_palette = building_surface_palette(row, is_hero=True, height_m=12.0)
  tall_palette = building_surface_palette(row, is_hero=False, height_m=32.0)

  assert set(palette) == {"wall", "wall_dark", "wall_light", "roof", "roof_line"}
  assert palette["wall"] != BUILDING_WALL
  assert hero_palette["wall"] != palette["wall"]
  assert (
    hero_palette["wall"] != BUILDING_HERO or hero_palette["roof"] != palette["roof"]
  )
  assert tall_palette["wall"] != palette["wall"]


def test_poi_style_adds_named_context_without_low_signal_clutter() -> None:
  assert poi_style({"amenity": "bench"}, 2) is None
  assert poi_style({"amenity": "restaurant", "name": "Zollpackhof"}, 2) is not None
  assert poi_style({"tourism": "attraction"}, 2)[2] == 3  # type: ignore[index]
  assert poi_style({"name": "Named place"}, 2)[2] == 1  # type: ignore[index]


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
