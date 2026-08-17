"""Tests for the global Deep Zoom render context."""

import json
from pathlib import Path

import geopandas as gpd
from PIL import Image
from pytest import MonkeyPatch

from isometric_berlin.generation import render_overview as overview

TUNNEL_OVERLAY = Path("src/app/public/dzi/regierungsviertel/tiergartentunnel.json")


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


def test_overview_uses_additive_current_buildings_loader(
  monkeypatch: MonkeyPatch,
) -> None:
  # The implementation must not regress to a direct official-only layer read:
  # the outer task-13 ring is intentionally supplied by the sibling OSM
  # context GeoPackage and is shared with the prism/Minecraft generators.
  expected = gpd.GeoDataFrame({"building_id": ["context"]}, geometry=[None])
  requested: list[Path] = []

  def fake_load_current_buildings(path: Path) -> gpd.GeoDataFrame:
    requested.append(path)
    return expected

  monkeypatch.setattr(overview, "load_current_buildings", fake_load_current_buildings)
  result = overview.load_overview_buildings(Path("buildings.gpkg"))

  assert result is expected
  assert requested == [Path("buildings.gpkg")]


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


def test_committed_tunnel_overlay_uses_task_13_projection() -> None:
  payload = json.loads(TUNNEL_OVERLAY.read_text(encoding="utf-8"))
  projection = payload["projection"]
  route = payload["routes"][0]

  assert projection["scope_name"] == (
    "Regierungsviertel bounds — task-13 additional 500 m context expansion"
  )
  assert projection["metric_crs"] == "EPSG:25833"
  assert projection["coordinate_space"] == [2157, 1529]
  assert projection["effective_margin_m"] == 790.0
  assert len(route["points"]) == 11
  assert route["points"][0] == {
    "x": 1319,
    "y": 743,
    "label": "Minna-Cauer-Straße",
  }
  assert route["points"][-1] == {
    "x": 642,
    "y": 1171,
    "label": "Reichpietschufer",
  }
  assert route["portals"][-1]["x"] == route["points"][-1]["x"]
  assert route["portals"][-1]["y"] == route["points"][-1]["y"]
