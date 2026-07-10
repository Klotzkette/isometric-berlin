"""Tests for the global Deep Zoom render context."""

from pathlib import Path

import geopandas as gpd
from PIL import Image
from pytest import MonkeyPatch

from isometric_berlin.generation import render_overview as overview


def test_overview_context_includes_surface_and_tunnel_layers(
  monkeypatch: MonkeyPatch,
) -> None:
  loaded: list[tuple[Path, str]] = []
  tunnel_path = Path("tunnel.geojson")

  def fake_load_layer(path: Path, layer: str) -> gpd.GeoDataFrame:
    loaded.append((path, layer))
    return gpd.GeoDataFrame(geometry=[], crs="EPSG:25833")

  def fake_load_routes(path: Path) -> gpd.GeoDataFrame:
    assert path == tunnel_path
    return gpd.GeoDataFrame(geometry=[], crs="EPSG:25833")

  monkeypatch.setattr(overview, "load_layer", fake_load_layer)
  monkeypatch.setattr(overview, "load_reference_geometries", fake_load_routes)

  layers = overview.load_overview_context(
    osm_path=Path("osm.gpkg"),
    alkis_path=Path("alkis.gpkg"),
    tunnel_path=tunnel_path,
  )

  assert set(layers) == {
    "roads",
    "water",
    "parks",
    "rail",
    "pois",
    "alkis",
    "tunnel_routes",
  }
  assert (Path("alkis.gpkg"), "flurstuecke") in loaded


def test_compact_preview_preserves_size_with_bounded_palette() -> None:
  source = Image.new("RGB", (120, 80), (238, 244, 239))
  for x in range(source.width):
    source.putpixel((x, x % source.height), (x * 2, 180, 90))

  compact = overview.compact_preview(source)

  assert compact.size == source.size
  assert compact.mode == "P"
  assert len(compact.getcolors(maxcolors=256) or []) <= 256
