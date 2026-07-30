"""Smoke tests for OSM context fetching (pipeline step 3)."""

from __future__ import annotations

from pathlib import Path

import geopandas as gpd
from shapely.geometry import box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_osm import tile_polygon, use_gzip_only_encoding

OSM = Path("geo_data/regierungsviertel/osm.gpkg")
LAYERS = (
  "roads",
  "water",
  "parks",
  "vegetation",
  "playgrounds",
  "rail",
  "pois",
)


def test_tiling_covers_the_polygon_without_gaps() -> None:
  # Overpass resets the connection when the whole task-09 polygon is asked for
  # every tag at once, so the fetch runs tile by tile. The union of the tiles
  # must be the polygon itself, or a tile-sized strip of the city would be
  # silently missing from the fused sources.
  polygon = box(13.33, 52.504, 13.386, 52.531)
  tiles = tile_polygon(polygon, 0.012)
  assert len(tiles) > 1
  covered = unary_union(tiles)
  assert covered.difference(polygon).area < 1e-12
  assert polygon.difference(covered).area < 1e-12
  assert all(tile.within(polygon.buffer(1e-9)) for tile in tiles)


def test_tiling_follows_a_concave_boundary() -> None:
  lobed = box(13.33, 52.504, 13.386, 52.531).difference(
    box(13.33, 52.504, 13.355, 52.518)
  )
  tiles = tile_polygon(lobed, 0.012)
  assert unary_union(tiles).symmetric_difference(lobed).area < 1e-12


def test_overpass_requests_never_offer_deflate() -> None:
  # Offering deflate makes the network path to overpass-api.de reset every
  # request, which looks like a dead Overpass instance rather than a header
  # problem. Keep gzip so responses stay compressed.
  from osmnx import _http

  use_gzip_only_encoding()
  headers = _http._get_http_headers()
  assert headers["Accept-Encoding"] == "gzip"
  assert "User-Agent" in headers


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
  assert counts["vegetation"] > 0
  assert counts["playgrounds"] > 0
  assert counts["rail"] > 0
  assert counts["pois"] > 100

  rail = gpd.read_file(OSM, layer="rail")
  for column in ["tunnel", "covered", "layer", "service", "usage"]:
    assert column in rail.columns

  pois = gpd.read_file(OSM, layer="pois")
  for column in ["office", "diplomatic", "government"]:
    assert column in pois.columns
  assert "Botschaft der Vereinigten Staaten von Amerika" in set(pois["name"].dropna())

  playgrounds = gpd.read_file(OSM, layer="playgrounds")
  for column in ["playground", "surface", "material", "height", "wheelchair"]:
    assert column in playgrounds.columns
