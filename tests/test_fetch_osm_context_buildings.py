"""OSM fallback buildings for the owner-approved task-13 context ring."""

from __future__ import annotations

from pathlib import Path

import geopandas as gpd
from shapely.geometry import box

from isometric_berlin.data.common import BERLIN_PROJECTED, load_bounds_polygon
from isometric_berlin.data.fetch_osm_context_buildings import (
  build_context_frame,
  resolve_height,
)
from isometric_berlin.generation.building_corrections import (
  load_current_buildings,
)

CONTEXT = Path("geo_data/regierungsviertel/osm_context_buildings.gpkg")
BOUNDS = Path("geo_data/regierungsviertel/bounds.geojson")
OFFICIAL = Path("geo_data/regierungsviertel/buildings.gpkg")


def raw_feature(
  osm_id: str,
  geometry: object,
  *,
  building: str = "yes",
  tags: str = "",
  name: str | None = None,
) -> dict[str, object]:
  return {
    "osm_id": None,
    "osm_way_id": osm_id,
    "name": name,
    "building": building,
    "other_tags": tags,
    "geometry": geometry,
  }


def test_height_evidence_precedes_levels_and_display_fallback() -> None:
  assert resolve_height(
    height="12.6 m",
    building_levels="9",
    roof_levels="2",
    building_class="apartments",
  ) == (12.6, "osm:height")
  assert resolve_height(
    height=None,
    building_levels="4",
    roof_levels="1",
    building_class="apartments",
  ) == (13.5, "osm:building:levels+roof:levels")
  assert resolve_height(
    height=None,
    building_levels=None,
    roof_levels=None,
    building_class="shed",
  ) == (3.0, "display_fallback:building=shed")


def test_lod2_and_grounded_parts_win_without_rendering_floating_walls() -> None:
  raw = gpd.GeoDataFrame(
    [
      raw_feature("1", box(0, 0, 10, 10), tags='"height"=>"30"'),
      raw_feature("2", box(20, 0, 30, 10), tags='"height"=>"9"'),
      raw_feature(
        "3",
        box(20, 0, 30, 10),
        tags='"building:part"=>"yes","height"=>"15","roof:shape"=>"gabled"',
      ),
      raw_feature(
        "4",
        box(40, 0, 50, 10),
        building="roof",
        tags='"height"=>"9","min_height"=>"5"',
      ),
      raw_feature(
        "5",
        box(95, 0, 105, 10),
        building="apartments",
        tags='"building:levels"=>"4","roof:levels"=>"1"',
      ),
      raw_feature(
        "6",
        box(60, 0, 70, 10),
        building="roof",
        tags='"height"=>"8","min_height"=>"variable"',
      ),
    ],
    geometry="geometry",
    crs=BERLIN_PROJECTED,
  )
  official = gpd.GeoDataFrame(
    {"building_id": ["lod2-1"], "geometry": [box(-1, -1, 11, 11)]},
    geometry="geometry",
    crs=BERLIN_PROJECTED,
  )

  context = build_context_frame(
    raw,
    clip_polygon=box(-5, -5, 100, 15),
    official_buildings=official,
  )

  assert set(context["building_id"]) == {"OSM-way-3", "OSM-way-5"}
  part = context.set_index("building_id").loc["OSM-way-3"]
  assert part["measured_height_m"] == 15.0
  assert part["height_source"] == "osm:height"
  assert part["roof_type"] == "3100"
  clipped = context.set_index("building_id").loc["OSM-way-5"]
  assert clipped.geometry.bounds == (95.0, 0.0, 100.0, 10.0)
  assert clipped["height_source"] == "osm:building:levels+roof:levels"
  assert clipped["source_url"] == "https://www.openstreetmap.org/way/5"


def test_load_current_buildings_appends_sidecar_and_keeps_corrections(
  tmp_path: Path,
) -> None:
  official_path = tmp_path / "buildings.gpkg"
  context_path = tmp_path / "osm_context_buildings.gpkg"
  official = gpd.GeoDataFrame(
    {
      "building_id": ["tee", "lab", "base"],
      "parent_building_id": [None, None, None],
      "building_name": [
        "Teehaus",
        "Landeslabor Berlin-Brandenburg",
        "Bestand",
      ],
      "function": ["31001_1010"] * 3,
      "roof_type": ["3100"] * 3,
      "measured_height_m": [8.0, 29.0, 10.0],
      "geometry": [box(0, 0, 2, 2), box(3, 0, 5, 2), box(6, 0, 8, 2)],
    },
    geometry="geometry",
    crs=BERLIN_PROJECTED,
  )
  context = gpd.GeoDataFrame(
    {
      "building_id": ["OSM-way-9"],
      "parent_building_id": [None],
      "building_name": ["Kontext"],
      "function": ["osm_context:yes"],
      "roof_type": ["9999"],
      "measured_height_m": [9.0],
      "height_source": ["display_fallback:building=yes"],
      "provenance": ["OpenStreetMap via Geofabrik Berlin extract (ODbL-1.0)"],
      "source_url": ["https://www.openstreetmap.org/way/9"],
      "geometry": [box(9, 0, 11, 2)],
    },
    geometry="geometry",
    crs=BERLIN_PROJECTED,
  )
  official.to_file(official_path, layer="buildings", driver="GPKG")
  context.to_file(context_path, layer="buildings", driver="GPKG")

  combined = load_current_buildings(official_path)

  assert set(combined["building_id"]) == {"tee", "base", "OSM-way-9"}
  teehaus = combined[combined["building_id"] == "tee"].iloc[0]
  assert teehaus["measured_height_m"] == 2.4
  assert teehaus["roof_type"] == "1000"
  appended = combined[combined["building_id"] == "OSM-way-9"].iloc[0]
  assert appended["height_source"] == "display_fallback:building=yes"


def test_committed_context_sidecar_is_bounded_and_compact() -> None:
  assert CONTEXT.exists()
  # Source-side GeoPackage, not a browser asset: task-13 keeps all 12k+ outer
  # footprints, so its bounded regression ceiling grows with the real area.
  assert CONTEXT.stat().st_size < 8 * 1024 * 1024
  context = gpd.read_file(CONTEXT, layer="buildings")
  assert 1_000 < len(context) < 20_000
  assert context.crs is not None and context.crs.to_epsg() == 25833
  for column in [
    "building_id",
    "measured_height_m",
    "function",
    "roof_type",
    "building_name",
    "height_source",
    "provenance",
    "source_url",
  ]:
    assert column in context.columns
  bounds = (
    gpd.GeoSeries([load_bounds_polygon(BOUNDS)], crs="EPSG:4326")
    .to_crs(BERLIN_PROJECTED)
    .iloc[0]
  )
  assert context.geometry.difference(bounds).area.max() < 1e-6
  official = gpd.read_file(OFFICIAL, layer="buildings")
  official_union = official.geometry.union_all()
  assert not context.geometry.representative_point().covered_by(official_union).any()
