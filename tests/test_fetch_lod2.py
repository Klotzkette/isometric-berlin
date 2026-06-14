"""Tests for Berlin LoD2 fetching and clipping (pipeline step 2)."""

from __future__ import annotations

from pathlib import Path

import geopandas as gpd
from shapely.geometry import box

from isometric_berlin.data import fetch_lod2 as lod2


def test_tiles_for_regierungsviertel_bounds_are_minimal() -> None:
  bounds = Path("geo_data/regierungsviertel/bounds.geojson")
  tiles = lod2.tiles_for_bounds(bounds)
  assert [tile.tile_id for tile in tiles] == [
    "388_5819",
    "388_5820",
    "389_5818",
    "389_5819",
    "389_5820",
    "389_5821",
    "390_5819",
    "390_5820",
  ]


def test_citygml_building_parser_preserves_lod2_attributes(tmp_path: Path) -> None:
  xml = b"""<?xml version="1.0" encoding="UTF-8"?>
<core:CityModel
  xmlns:bldg="http://www.opengis.net/citygml/building/1.0"
  xmlns:core="http://www.opengis.net/citygml/1.0"
  xmlns:gen="http://www.opengis.net/citygml/generics/1.0"
  xmlns:gml="http://www.opengis.net/gml">
  <core:cityObjectMember>
    <bldg:Building gml:id="DEBE_TEST">
      <gen:stringAttribute name="Grundrissaktualitaet">
        <gen:value>2026-01-01</gen:value>
      </gen:stringAttribute>
      <bldg:function>31001_1000</bldg:function>
      <bldg:roofType>1000</bldg:roofType>
      <bldg:measuredHeight uom="urn:adv:uom:m">12.5</bldg:measuredHeight>
      <bldg:boundedBy>
        <bldg:GroundSurface>
          <bldg:lod2MultiSurface>
            <gml:MultiSurface>
              <gml:surfaceMember>
                <gml:Polygon>
                  <gml:exterior>
                    <gml:LinearRing>
                      <gml:posList srsDimension="3">0 0 34 10 0 34 10 10 34 0 10 34 0 0 34</gml:posList>
                    </gml:LinearRing>
                  </gml:exterior>
                </gml:Polygon>
              </gml:surfaceMember>
            </gml:MultiSurface>
          </bldg:lod2MultiSurface>
        </bldg:GroundSurface>
      </bldg:boundedBy>
    </bldg:Building>
  </core:cityObjectMember>
</core:CityModel>
"""
  source = tmp_path / "sample.xml"
  source.write_bytes(xml)
  with source.open("rb") as source_file:
    records = lod2.parse_buildings_from_xml(
      source_file,
      tile=lod2.Lod2Tile(0, 0),
      source_zip=tmp_path / "sample.zip",
      clip_polygon=box(0, 0, 20, 20),
    )
  assert len(records) == 1
  assert records[0]["building_id"] == "DEBE_TEST"
  assert records[0]["roof_type"] == "1000"
  assert records[0]["function"] == "31001_1000"
  assert records[0]["measured_height_m"] == 12.5
  assert records[0]["ground_plan_date"] == "2026-01-01"
  assert records[0]["geometry"].area == 100


def test_generated_buildings_gpkg_contains_lod2_footprints() -> None:
  path = Path("geo_data/regierungsviertel/buildings.gpkg")
  assert path.exists()
  assert path.stat().st_size < 5 * 1024 * 1024

  gdf = gpd.read_file(path, layer="buildings")
  assert len(gdf) > 100
  assert gdf.crs is not None
  assert gdf.crs.to_epsg() == 25833
  assert {"building_id", "roof_type", "measured_height_m", "geometry"} <= set(
    gdf.columns
  )
  assert gdf["building_id"].notna().all()
  assert gdf["measured_height_m"].notna().any()
  assert gdf.geometry.notna().all()
