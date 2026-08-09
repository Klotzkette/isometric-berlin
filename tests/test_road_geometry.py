"""Metric road-width and bridge-deck contracts."""

from __future__ import annotations

import geopandas as gpd
import pytest
from shapely import union_all
from shapely.geometry import LineString, Polygon, box

from isometric_berlin.generation.build_minecraft_voxels import (
  bridge_deck_bands,
  road_surface_bands,
)
from isometric_berlin.generation.build_surface_polygons import (
  ROAD_BROWSER_HOLE_THRESHOLD,
  partition_road_surface,
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
