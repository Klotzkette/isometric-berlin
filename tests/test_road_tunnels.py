"""The Tiergartentunnel must not be painted onto the park it runs under."""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import pytest
from shapely.geometry import Point, Polygon
from shapely.strtree import STRtree

from isometric_berlin.generation.build_minecraft_voxels import aboveground
from isometric_berlin.generation.build_surface_polygons import runs_underground

OSM = Path("geo_data/regierungsviertel/osm.gpkg")
SURFACES = Path("src/app/public/mesh/regierungsviertel/surface-polygons.json")


def test_runs_underground_reads_tunnel_covered_and_layer() -> None:
  assert runs_underground({"tunnel": "yes"})
  assert runs_underground({"covered": "yes"})
  assert runs_underground({"tunnel": "building_passage"})
  assert runs_underground({"layer": "-1"})
  assert not runs_underground({"tunnel": "no", "covered": "no", "layer": "1"})
  # OSM tag columns arrive as NaN floats, not strings.
  assert not runs_underground({"tunnel": float("nan"), "layer": None})


def test_aboveground_drops_tunnelled_ways() -> None:
  roads = gpd.read_file(OSM, layer="roads")
  kept = aboveground(roads)
  assert len(kept) < len(roads)
  assert not (kept["tunnel"].astype("string").fillna("no") == "yes").any()


@pytest.fixture(scope="module")
def tunnel_midpoints() -> list[Point]:
  roads = gpd.read_file(OSM, layer="roads").to_crs(epsg=25833)
  tunnelled = roads[
    (roads["tunnel"].astype(str) == "yes")
    & roads["name"].astype(str).str.startswith("Tunnel Tiergarten")
  ]
  points: list[Point] = []
  for geometry in tunnelled.geometry:
    if geometry is None or geometry.geom_type == "Point":
      continue
    for fraction in (0.25, 0.5, 0.75):
      point = geometry.interpolate(fraction, normalized=True)
      # Payload coordinates are decimetres in the world frame.
      points.append(Point((point.x - 389_500) * 10, (5_820_000 - point.y) * 10))
  return points


def test_no_carriageway_polygon_covers_the_tiergartentunnel(
  tunnel_midpoints: list[Point],
) -> None:
  assert len(tunnel_midpoints) > 30
  payload = json.loads(SURFACES.read_text(encoding="utf-8"))
  asphalt = [
    Polygon(entry["ring"]) for entry in payload["roads"] if entry["kind"] == "asphalt"
  ]
  tree = STRtree(asphalt)
  buried = [
    point for point in tunnel_midpoints if len(tree.query(point, predicate="covers"))
  ]
  assert not buried, f"{len(buried)} tunnel points are paved over"


def test_the_portal_ramps_keep_their_lane_markings() -> None:
  # Only the buried stretch goes; the open ramps at Kemperplatz and at the
  # Hauptbahnhof approach still carry their painted centre lines.
  payload = json.loads(SURFACES.read_text(encoding="utf-8"))
  ramps = [
    marking
    for marking in payload["lane_markings"]
    if marking["name"].startswith("Tunnel Tiergarten")
  ]
  assert ramps
