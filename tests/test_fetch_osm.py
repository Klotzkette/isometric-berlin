"""Smoke tests for OSM context fetching (pipeline step 3)."""

from __future__ import annotations

from pathlib import Path

import geopandas as gpd

OSM = Path("geo_data/regierungsviertel/osm.gpkg")
LAYERS = ("roads", "water", "parks", "rail", "pois")


def test_generated_osm_gpkg_contains_required_layers() -> None:
  assert OSM.exists()
  assert OSM.stat().st_size < 5 * 1024 * 1024

  counts: dict[str, int] = {}
  for layer in LAYERS:
    gdf = gpd.read_file(OSM, layer=layer)
    counts[layer] = len(gdf)
    assert gdf.crs is not None
    assert gdf.crs.to_epsg() == 25833
    assert gdf.geometry.notna().all()

  assert counts["roads"] > 100
  assert counts["water"] > 0
  assert counts["parks"] > 0
  assert counts["rail"] > 0
  assert counts["pois"] > 100

  rail = gpd.read_file(OSM, layer="rail")
  for column in ["tunnel", "covered", "layer", "service", "usage"]:
    assert column in rail.columns
