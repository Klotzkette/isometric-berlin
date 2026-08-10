"""Metric road-width and bridge-deck contracts."""

from __future__ import annotations

import math

import geopandas as gpd
import pytest
from shapely import union_all
from shapely.geometry import LineString, Point, Polygon, box

from isometric_berlin.generation.build_minecraft_voxels import (
  bridge_deck_bands,
  road_surface_bands,
)
from isometric_berlin.generation.build_surface_polygons import (
  ROAD_BROWSER_HOLE_THRESHOLD,
  ROAD_CURVE_SEGMENT_M,
  partition_road_surface,
  smooth_road_line,
)
from isometric_berlin.generation.road_geometry import (
  parse_osm_measure_m,
  road_width_m,
  road_width_source,
)


@pytest.mark.parametrize(
  ("raw", "expected"),
  [
    ("4", 4.0),
    ("3,2 m", 3.2),
    (".82", 0.82),
    ("12 ft", 3.6576),
    ("6' 6\"", 1.9812),
  ],
)
def test_parse_osm_measure_m_accepts_metric_and_imperial_values(
  raw: str, expected: float
) -> None:
  assert parse_osm_measure_m(raw) == pytest.approx(expected)


@pytest.mark.parametrize("raw", [None, "", "!", "3 - 25", "0", float("nan")])
def test_parse_osm_measure_m_rejects_ambiguous_or_nonpositive_values(
  raw: object,
) -> None:
  assert parse_osm_measure_m(raw) is None


def test_road_width_prefers_mapped_measure_then_lanes_then_class() -> None:
  assert road_width_m({"highway": "footway", "width": "1.5"}) == 1.5
  assert road_width_source({"highway": "footway", "width": "1.5"}) == "width"
  assert road_width_m({"highway": "primary", "lanes": "4"}) == 13.0
  assert road_width_source({"highway": "primary", "lanes": "4"}) == "lanes"
  assert road_width_m({"highway": "secondary"}) == 12.0
  assert road_width_source({"highway": "secondary"}) == "class_fallback"
  assert road_width_m({"highway": "construction", "width": "20"}) is None


def test_surface_and_bridge_bands_keep_their_distinct_mapped_widths() -> None:
  frame = gpd.GeoDataFrame(
    {
      "highway": ["primary", "footway"],
      "lanes": ["4", None],
      "width": [None, "1.5"],
      "bridge": [None, "yes"],
      "geometry": [LineString([(0, 0), (20, 0)]), LineString([(0, 20), (20, 20)])],
    },
    geometry="geometry",
    crs="EPSG:25833",
  )

  road_bands = road_surface_bands(frame)
  bridge_bands = bridge_deck_bands(frame)

  assert len(road_bands) == 2
  assert road_bands[0].bounds[3] - road_bands[0].bounds[1] == pytest.approx(13.0)
  assert road_bands[1].bounds[3] - road_bands[1].bounds[1] == pytest.approx(1.5)
  assert len(bridge_bands) == 1
  # The four-metre Minecraft grid keeps a two-metre half-width capture floor,
  # but never inflates a narrow stegbound cluster to a 17 m road bridge.
  assert bridge_bands[0].bounds[3] - bridge_bands[0].bounds[1] == pytest.approx(4.0)


def test_complex_paving_partition_preserves_the_exact_union() -> None:
  holes = [
    list(box(12 + x * 40, 12 + y * 80, 18 + x * 40, 18 + y * 80).exterior.coords)
    for y in range(8)
    for x in range(16)
  ]
  assert len(holes) == ROAD_BROWSER_HOLE_THRESHOLD
  paving = Polygon(box(0, 0, 800, 800).exterior.coords, holes)

  parts = partition_road_surface(paving, "paving")

  assert len(parts) > 1
  assert max(len(part.interiors) for part in parts) < ROAD_BROWSER_HOLE_THRESHOLD
  assert union_all(parts).symmetric_difference(paving).area == pytest.approx(0.0)
  assert partition_road_surface(paving, "asphalt") == [paving]


def direction_changes(line: LineString) -> list[float]:
  points = list(line.coords)
  changes: list[float] = []
  for previous, current, following in zip(points, points[1:], points[2:]):
    incoming = (current[0] - previous[0], current[1] - previous[1])
    outgoing = (following[0] - current[0], following[1] - current[1])
    in_run = (incoming[0] ** 2 + incoming[1] ** 2) ** 0.5
    out_run = (outgoing[0] ** 2 + outgoing[1] ** 2) ** 0.5
    cosine = max(
      -1.0,
      min(
        1.0,
        (incoming[0] * outgoing[0] + incoming[1] * outgoing[1]) / (in_run * out_run),
      ),
    )
    changes.append(math.degrees(math.acos(cosine)))
  return changes


def test_road_curve_interpolation_removes_visible_polyline_elbows() -> None:
  coarse = LineString(
    [
      (60.0, 0.0),
      (55.43, 22.96),
      (42.43, 42.43),
      (22.96, 55.43),
      (0.0, 60.0),
    ]
  )

  curved = smooth_road_line(coarse)

  assert len(curved.coords) > len(coarse.coords) * 3
  assert max(direction_changes(curved)) < 8.0
  assert (
    max(LineString([a, b]).length for a, b in zip(curved.coords, curved.coords[1:]))
    <= ROAD_CURVE_SEGMENT_M + 0.05
  )
  for point in coarse.coords:
    assert curved.distance(Point(point)) < 1e-9


def test_road_curve_interpolation_preserves_deliberate_hard_corners() -> None:
  corner = LineString([(0, 0), (30, 0), (30, 30)])

  curved = smooth_road_line(corner)

  assert list(curved.coords) == list(corner.coords)


def test_road_curve_interpolation_survives_duplicate_nodes() -> None:
  duplicate = LineString([(0, 0), (0, 0), (0, 0), (20, 0)])

  curved = smooth_road_line(duplicate)

  assert list(curved.coords) == [(0.0, 0.0), (20.0, 0.0)]
