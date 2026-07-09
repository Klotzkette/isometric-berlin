"""Tests for deterministic isometric source rendering helpers."""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
from PIL import Image, ImageChops, ImageDraw
from shapely.geometry import Point, Polygon, box

from isometric_berlin.generation.render_quadrants import (
  BACKGROUND,
  BUILDING_HERO,
  BUILDING_WALL,
  RAIL,
  RAIL_PLATFORM,
  ROAD_MAJOR,
  ROAD_PATH,
  architectural_shadow_offsets,
  building_height,
  building_surface_palette,
  draw_building,
  facade_bay_count,
  facade_detail_counts,
  facade_microtexture_count,
  landmark_icon_unit,
  landmark_kind,
  landmark_reference_id,
  landmark_signature_buildings,
  load_reference_geometries,
  load_wikimedia_material_cues,
  mix_color,
  parse_hex_color,
  poi_style,
  rail_style,
  road_style,
  roof_grid_count,
  roof_service_count,
  roof_texture_count,
  stable_fraction,
  stable_variation,
  vegetation_detail_limit,
  vegetation_spacing,
  water_ripple_limit,
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


def test_stable_fraction_is_deterministic_unit_interval() -> None:
  first = stable_fraction("tiergarten:venusteich")
  second = stable_fraction("tiergarten:venusteich")

  assert first == second
  assert 0 <= first <= 1


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
  assert roof_grid_count(roof_span=120, is_hero=False) == 5
  assert roof_grid_count(roof_span=320, is_hero=False) == 9
  assert roof_grid_count(roof_span=320, is_hero=True) == 13


def test_roof_service_count_adds_small_large_roof_equipment() -> None:
  assert roof_service_count(roof_span=80, is_hero=False) == 0
  assert roof_service_count(roof_span=180, is_hero=False) == 2
  assert roof_service_count(roof_span=480, is_hero=False) == 6
  assert roof_service_count(roof_span=480, is_hero=True) == 7


def test_microtexture_counts_add_bounded_surface_grain() -> None:
  assert facade_microtexture_count(wall_width=10, height_m=12, is_hero=True) == 0
  assert facade_microtexture_count(wall_width=120, height_m=30, is_hero=False) > 8
  assert facade_microtexture_count(wall_width=120, height_m=30, is_hero=True) > (
    facade_microtexture_count(wall_width=120, height_m=30, is_hero=False)
  )
  assert roof_texture_count(roof_span=40, is_hero=True) == 0
  assert roof_texture_count(roof_span=260, is_hero=True) > roof_texture_count(
    roof_span=260, is_hero=False
  )


def test_facade_bay_count_scales_with_long_hero_facades() -> None:
  assert facade_bay_count(wall_width=20, is_hero=True) == 0
  assert facade_bay_count(wall_width=96, is_hero=False) == 4
  assert facade_bay_count(wall_width=96, is_hero=True) > facade_bay_count(
    wall_width=96, is_hero=False
  )


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
  assert landmark_kind("TIPI am Kanzleramt") == "tent"
  assert landmark_kind("Eduardo-Chillida-Skulptur Berlin") == "sculpture"
  assert landmark_kind("Kanzlergarten / Non-Violence-Skulptur") == (
    "kanzlergarten_sculpture"
  )
  assert landmark_kind("Carillon im Tiergarten") == "carillon"
  assert landmark_kind("Mahnmal für verfolgte Zeugen Jehovas") == "jehovahs_memorial"
  assert landmark_kind("Gedenkort für Polen 1939-1945") == "poland_memorial"
  assert landmark_kind("Reichstagsvorfeld / Berlin-Pavillon") == "visitor_pavilion"
  assert landmark_kind("Platz der Republik Heckenbosquets") == "forecourt_garden"
  assert landmark_kind("Gustav-Heinemann-Brücke") == "bridge"
  assert landmark_kind("Hugo-Preuß-Brücke") == "bridge"
  assert landmark_kind("Moltkebrücke") == "bridge"
  assert landmark_kind("Botschaft der Vereinigten Staaten von Amerika") == (
    "embassy_block"
  )
  assert landmark_kind("Denkmal für die ermordeten Juden Europas") == ("memorial_field")
  assert (
    landmark_kind(
      "Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas"
    )
    == "sinti_roma_memorial"
  )
  assert landmark_kind("Pariser Platz") == "urban_square"
  assert landmark_kind("Großer Tiergarten") == "park_reference"
  assert landmark_kind("Venusbassin / Goldfischteich") == "pond_reference"
  assert landmark_kind(
    "Tiergartentunnel Südeingang (Sony Center / Potsdamer Platz)"
  ) == ("tunnel")
  assert landmark_kind("Unknown cafe") is None


def test_landmark_reference_id_maps_to_wikimedia_records() -> None:
  assert landmark_reference_id("Brandenburger Tor") == "brandenburger_tor"
  assert landmark_reference_id("Reichstagsgebäude") == "reichstag"
  assert landmark_reference_id("Berlin Hauptbahnhof") == "hauptbahnhof"
  assert landmark_reference_id("Bundeskanzleramt") == "bundeskanzleramt"
  assert landmark_reference_id("TIPI am Kanzleramt") == "tipi_am_kanzleramt"
  assert landmark_reference_id("Eduardo-Chillida-Skulptur Berlin") == (
    "chillida_berlin_sculpture"
  )
  assert landmark_reference_id("Kanzlergarten / Non-Violence-Skulptur") == (
    "kanzlergarten"
  )
  assert landmark_reference_id("Carillon im Tiergarten") == "carillon_tiergarten"
  assert landmark_reference_id("Mahnmal für verfolgte Zeugen Jehovas") == (
    "jehovahs_witnesses_memorial"
  )
  assert landmark_reference_id("Gedenkort für Polen 1939-1945") == "poland_memorial"
  assert landmark_reference_id("Reichstagsvorfeld / Berlin-Pavillon") == (
    "reichstag_forecourt"
  )
  assert landmark_reference_id("Platz der Republik Heckenbosquets") == (
    "reichstag_forecourt"
  )
  assert landmark_reference_id("Paul-Löbe-Haus") == "paul_loebe_haus"
  assert landmark_reference_id("Marie-Elisabeth-Lüders-Haus") == (
    "marie_elisabeth_lueders_haus"
  )
  assert landmark_reference_id("Zollpackhof") == "zollpackhof"
  assert landmark_reference_id("Moltkebrücke") == "moltkebruecke"
  assert landmark_reference_id("Pariser Platz") == "pariser_platz"
  assert landmark_reference_id("Botschaft der Vereinigten Staaten von Amerika") == (
    "us_embassy"
  )
  assert landmark_reference_id("Denkmal für die ermordeten Juden Europas") == (
    "holocaust_memorial"
  )
  assert landmark_reference_id("Venusbassin / Goldfischteich") == (
    "venusteich_goldfischteich"
  )
  assert landmark_reference_id("Großer Tiergarten") == "tiergarten"
  assert landmark_reference_id("Unknown cafe") is None


def test_landcover_detail_limits_are_bounded_by_semantics() -> None:
  meadow = {"landuse": "meadow"}
  wood = {"natural": "wood"}
  scrub = {"natural": "scrub"}

  assert vegetation_spacing(wood) < vegetation_spacing(meadow)
  assert vegetation_spacing(scrub) < vegetation_spacing(wood)
  assert vegetation_detail_limit(120, meadow) == 0
  assert 1 <= vegetation_detail_limit(10_000, meadow) <= 96
  assert 1 <= vegetation_detail_limit(120_000, wood) <= 160
  assert water_ripple_limit(100) == 0
  assert 2 <= water_ripple_limit(30_000) <= 80


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


def test_load_reference_geometries_reads_geojson_lines(tmp_path: Path) -> None:
  path = tmp_path / "tunnel.geojson"
  path.write_text(
    json.dumps(
      {
        "type": "FeatureCollection",
        "features": [
          {
            "type": "Feature",
            "properties": {"name": "Tunnel"},
            "geometry": {
              "type": "LineString",
              "coordinates": [[13.36763, 52.52643], [13.37071, 52.51222]],
            },
          }
        ],
      }
    ),
    encoding="utf-8",
  )

  routes = load_reference_geometries(path)

  assert len(routes) == 1
  assert routes.crs is not None
  assert routes.geometry.iloc[0].geom_type == "LineString"


def test_landmark_icon_unit_scales_for_high_resolution_renders() -> None:
  assert landmark_icon_unit(512) == 3
  assert landmark_icon_unit(6144) == 8
  assert landmark_icon_unit(12000) == 16
  assert landmark_icon_unit(48000) == 32


def test_landmark_signature_selects_one_primary_containing_body() -> None:
  buildings = gpd.GeoDataFrame(
    {"name": ["main", "roof detail", "nearby"]},
    geometry=[box(-20, -20, 20, 20), box(-2, -2, 2, 2), box(30, 0, 34, 4)],
    crs="EPSG:25833",
  )
  landmarks = gpd.GeoDataFrame(
    {"name": ["Reichstagsgebäude"]},
    geometry=[Point(0, 0)],
    crs="EPSG:25833",
  )

  signatures = landmark_signature_buildings(buildings, landmarks)

  assert signatures == {0: "reichstag"}


def test_landmark_signature_ignores_non_building_visual_references() -> None:
  buildings = gpd.GeoDataFrame(
    geometry=[box(-20, -20, 20, 20)],
    crs="EPSG:25833",
  )
  landmarks = gpd.GeoDataFrame(
    {"name": ["Venusbassin / Goldfischteich"]},
    geometry=[Point(0, 0)],
    crs="EPSG:25833",
  )

  assert landmark_signature_buildings(buildings, landmarks) == {}


def test_draw_building_handles_lod2_interior_rings() -> None:
  image = Image.new("RGB", (360, 360), BACKGROUND)
  draw = ImageDraw.Draw(image)
  building = Polygon(
    [(0, 0), (80, 0), (80, 80), (0, 80), (0, 0)],
    holes=[[(28, 28), (52, 28), (52, 52), (28, 52), (28, 28)]],
  )

  draw_building(
    draw,
    building,
    height_m=18,
    is_hero=True,
    surface_row={"building_id": "courtyard", "roof_type": "5000"},
    center_x=40,
    center_y=40,
    scale=2,
    width=360,
    height=360,
    outline_width=1,
  )

  diff = ImageChops.difference(image, Image.new("RGB", image.size, BACKGROUND))
  assert diff.getbbox() is not None
