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


def test_compact_preview_steps_the_palette_down_to_meet_the_binary_limit(
  monkeypatch: MonkeyPatch,
) -> None:
  # The drawn city keeps gaining detail, and a fixed 256-colour palette pushed
  # overview_source.png past the 5 MiB the release gate allows.
  source = Image.new("RGB", (64, 64), (238, 244, 239))
  for x in range(source.width):
    for y in range(source.height):
      source.putpixel((x, y), (x * 3 % 256, y * 5 % 256, (x + y) * 7 % 256))
  monkeypatch.setattr(overview, "MAX_PREVIEW_BYTES", 1)

  compact = overview.compact_preview(source)

  # Nothing fits one byte, so it must fall back to the smallest palette rather
  # than silently returning the 256-colour image it could not shrink.
  assert (
    len(compact.getcolors(maxcolors=256) or []) <= overview.PREVIEW_PALETTE_STEPS[-1]
  )
