"""Tests for deterministic isometric source rendering helpers."""

from __future__ import annotations

import json
from pathlib import Path

from shapely.geometry import box

from isometric_berlin.generation.render_quadrants import (
  BUILDING_HERO,
  BUILDING_WALL,
  RAIL,
  RAIL_PLATFORM,
  ROAD_MAJOR,
  ROAD_PATH,
  architectural_shadow_offsets,
  building_height,
  building_surface_palette,
  facade_detail_counts,
  landmark_icon_unit,
  landmark_kind,
  landmark_reference_id,
  load_wikimedia_material_cues,
  mix_color,
  parse_hex_color,
  poi_style,
  rail_style,
  road_style,
  roof_grid_count,
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


def test_parse_hex_color_accepts_only_rgb_hex() -> None:
  assert parse_hex_color("#d2be96") == (210, 190, 150)
  assert parse_hex_color("6fa4b5") == (111, 164, 181)
  assert parse_hex_color("bad") is None


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

  assert set(palette) == {
    "wall",
    "wall_dark",
    "wall_light",
    "roof",
    "roof_line",
    "window",
    "window_dark",
  }
  assert palette["wall"] != BUILDING_WALL
  assert hero_palette["wall"] != palette["wall"]
  assert (
    hero_palette["wall"] != BUILDING_HERO or hero_palette["roof"] != palette["roof"]
  )
  assert tall_palette["wall"] != palette["wall"]
  assert tall_palette["window"] != palette["window"]


def test_building_surface_palette_accepts_wikimedia_material_cue() -> None:
  row = {
    "building_id": "DEBE01YYK0002R7V",
    "function": "31001_2010",
    "roof_type": "5000",
  }
  plain = building_surface_palette(row, is_hero=True, height_m=18.0)
  cued = building_surface_palette(
    row,
    is_hero=True,
    height_m=18.0,
    material_cue={
      "wall": (210, 190, 150),
      "roof": (150, 170, 185),
      "wall_dark": (118, 100, 86),
      "wall_light": (232, 220, 198),
      "roof_line": (90, 90, 80),
      "glass": (120, 168, 185),
      "glass_dark": (70, 110, 128),
    },
  )

  assert cued["wall"] != plain["wall"]
  assert cued["roof"] != plain["roof"]
  assert cued["window"] != plain["window"]


def test_facade_detail_counts_scale_for_hero_and_tall_buildings() -> None:
  small = facade_detail_counts(wall_width=18, height_m=9, is_hero=False)
  tall = facade_detail_counts(wall_width=90, height_m=36, is_hero=False)
  hero = facade_detail_counts(wall_width=90, height_m=36, is_hero=True)

  assert small[2:] == (3, 0)
  assert tall[0] > small[0]
  assert tall[2] > small[2]
  assert hero[1] > tall[1]
  assert hero[2] >= tall[2]


def test_architectural_shadow_offsets_scale_with_height_and_heroes() -> None:
  small = architectural_shadow_offsets(height_m=8, is_hero=False, outline_width=1)
  tall = architectural_shadow_offsets(height_m=60, is_hero=False, outline_width=1)
  hero = architectural_shadow_offsets(height_m=60, is_hero=True, outline_width=1)

  assert small[0] < tall[0] <= tall[1] <= tall[2]
  assert hero[2] > tall[2]


def test_roof_grid_count_adds_bounded_architectural_ribs() -> None:
  assert roof_grid_count(roof_span=20, is_hero=False) == 0
  assert roof_grid_count(roof_span=120, is_hero=False) == 3
  assert roof_grid_count(roof_span=320, is_hero=False) == 4
  assert roof_grid_count(roof_span=320, is_hero=True) == 7


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


def test_landmark_reference_id_maps_to_wikimedia_records() -> None:
  assert landmark_reference_id("Brandenburger Tor") == "brandenburger_tor"
  assert landmark_reference_id("Reichstagsgebäude") == "reichstag"
  assert landmark_reference_id("Berlin Hauptbahnhof") == "hauptbahnhof"
  assert landmark_reference_id("Bundeskanzleramt") == "bundeskanzleramt"
  assert landmark_reference_id("Unknown cafe") is None


def test_load_wikimedia_material_cues_groups_dominant_colours(tmp_path: Path) -> None:
  manifest = tmp_path / "wikimedia_references.json"
  manifest.write_text(
    json.dumps(
      {
        "records": [
          {
            "landmark_id": "reichstag",
            "dominant_colours": ["#d6c4a0", "#f8f8f8", "#222222"],
          },
          {"landmark_id": "hauptbahnhof", "dominant_colours": ["#6fa4b5"]},
        ]
      }
    ),
    encoding="utf-8",
  )

  cues = load_wikimedia_material_cues(manifest)

  assert set(cues) == {"reichstag", "hauptbahnhof"}
  assert set(cues["reichstag"]) == {
    "wall",
    "wall_dark",
    "wall_light",
    "roof",
    "roof_line",
    "glass",
    "glass_dark",
  }


def test_landmark_icon_unit_stays_visible_but_bounded() -> None:
  assert landmark_icon_unit(512) == 3
  assert landmark_icon_unit(6144) == 8
  assert landmark_icon_unit(12000) == 8
