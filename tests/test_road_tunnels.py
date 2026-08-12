"""The Tiergartentunnel must not be painted onto the park it runs under."""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import pytest
from shapely import make_valid
from shapely.geometry import Point, Polygon
from shapely.strtree import STRtree

from isometric_berlin.generation.build_minecraft_voxels import aboveground
from isometric_berlin.generation.build_surface_polygons import (
  OPEN_TUNNEL_RAMP_APPROACH_M,
  open_tunnel_ramp_corridors,
  runs_underground,
)
from isometric_berlin.generation.prepare_webgl_mesh import (
  PORTAL_APPROACH_WAYS,
  tunnel_portal_approaches,
)

OSM = Path("geo_data/regierungsviertel/osm.gpkg")
SURFACES = Path("src/app/public/mesh/regierungsviertel/surface-polygons.json")
SCENE = Path("src/app/public/mesh/regierungsviertel/scene.json")


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


def test_open_portal_corridors_are_not_covered_by_smooth_surfaces() -> None:
  """The mouth view must not look at a road, basin, or lawn plate.

  The southern OSM approach has an adjacent ``water=basin`` polygon. It was
  not an asphalt issue after the full-hull refetch, but it still completely
  covered the daylight trough until the corridor was subtracted from both
  surface families.
  """
  corridors = open_tunnel_ramp_corridors(SCENE)
  assert corridors is not None
  payload = json.loads(SURFACES.read_text(encoding="utf-8"))

  def payload_polygon(entry: dict[str, object]) -> Polygon:
    def to_utm(point: list[int]) -> tuple[float, float]:
      return (389_500 + point[0] / 10, 5_820_000 - point[1] / 10)

    return Polygon(
      [to_utm(point) for point in entry["ring"]],  # type: ignore[index]
      [
        [to_utm(point) for point in hole]
        for hole in entry["holes"]  # type: ignore[index]
      ],
    )

  covered = [
    entry
    for family in ("parks", "roads", "water")
    for entry in payload[family]
    if (
      (polygon := make_valid(payload_polygon(entry))).intersects(corridors)
      and polygon.intersection(corridors).area > 1.0
    )
  ]
  assert not covered, "a smooth park, road, or water plate still roofs a portal ramp"


def test_open_portal_corridors_include_every_measured_carriageway() -> None:
  corridors = open_tunnel_ramp_corridors(SCENE)
  assert corridors is not None
  scene = json.loads(SCENE.read_text(encoding="utf-8"))
  approaches = scene["tiergartentunnel"]["portal_approaches"]

  def world_to_utm(point: list[float]) -> Point:
    return Point(389_500 + point[0], 5_820_000 - point[2])

  assert set(approaches) == set(PORTAL_APPROACH_WAYS)
  assert sum(len(value["carriageways"]) for value in approaches.values()) == 8
  for approach in approaches.values():
    for carriageway in approach["carriageways"]:
      surface, neighbour = carriageway["points"][:2]
      surface_point = world_to_utm(surface)
      toward_surface_x = surface_point.x - world_to_utm(neighbour).x
      toward_surface_y = surface_point.y - world_to_utm(neighbour).y
      length = (toward_surface_x**2 + toward_surface_y**2) ** 0.5
      outside = Point(
        surface_point.x + toward_surface_x / length * (OPEN_TUNNEL_RAMP_APPROACH_M - 1),
        surface_point.y + toward_surface_y / length * (OPEN_TUNNEL_RAMP_APPROACH_M - 1),
      )
      assert corridors.covers(outside)
      assert corridors.covers(world_to_utm(carriageway["points"][-1]))


def test_all_portal_approaches_are_reproducible_from_osm_and_official_mesh() -> None:
  scene = json.loads(SCENE.read_text(encoding="utf-8"))
  committed = scene["tiergartentunnel"]["portal_approaches"]
  generated = tunnel_portal_approaches()
  assert generated.keys() == committed.keys()
  assert generated == committed

  corridors = open_tunnel_ramp_corridors(SCENE)
  assert corridors is not None
  for approach in committed.values():
    for carriageway in approach["carriageways"]:
      for point in carriageway["points"]:
        assert corridors.covers(Point(389_500 + point[0], 5_820_000 - point[2]))


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
