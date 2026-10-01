"""The owner-approved outer preview adds exact districts without losing the core."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest
from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import Point, Polygon, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
SPEC = importlib.util.spec_from_file_location(
  "build_surrounding_bounds", ROOT / "scripts/build_surrounding_bounds.py"
)
assert SPEC and SPEC.loader
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform


def metric_bounds(name: str):
  return transform(
    PROJECT, shape(json.loads((DATA / name).read_text())["features"][0]["geometry"])
  )


def test_surrounding_bounds_are_reproducible_and_finite() -> None:
  actual = json.loads((DATA / "bounds.geojson").read_text())
  manifest = json.loads((DATA / "surrounding-bounds-manifest.json").read_text())
  rebuilt, rebuilt_manifest = builder.build(ROOT)
  assert actual == rebuilt
  # Tuples in source constants serialize as JSON arrays.
  assert manifest == json.loads(json.dumps(rebuilt_manifest))
  current = metric_bounds("bounds.geojson")
  assert current.is_valid and current.geom_type == "Polygon" and not current.interiors
  assert current.area == pytest.approx(81_456_979.438, abs=1)
  assert current.bounds == pytest.approx(
    (383341.702, 5815620.314, 396333.836, 5824374.355), abs=0.002
  )
  assert manifest["tour_place_count"] == 93


def test_every_previous_source_area_and_complete_district_survive() -> None:
  current = metric_bounds("bounds.geojson")
  for archive in ["bounds-task13.geojson", "bounds-v158.geojson"]:
    assert metric_bounds(archive).difference(current.buffer(0.0001)).area == 0
  districts = json.loads((DATA / "surrounding-district-boundaries.geojson").read_text())
  assert {f["properties"]["nam"] for f in districts["features"]} == {
    "Moabit",
    "Prenzlauer Berg",
  }
  for feature in districts["features"]:
    assert shape(feature["geometry"]).difference(current.buffer(0.0001)).area == 0
  assert districts["source"]["licence"] == "dl-de/zero-2-0"


def test_preload_navigation_scope_matches_exact_outer_ground_and_excludes_core() -> (
  None
):
  path = ROOT / "src/app/src/data/surroundingCityScope.json"
  scope = json.loads(path.read_text())
  bounds = json.loads((DATA / "bounds.geojson").read_text())
  assert scope == builder.build_navigation_scope(bounds, ROOT)
  assert scope["groundY"] == 3
  assert path.stat().st_size < 100_000
  actual = unary_union([Polygon(p["ring"], p["holes"]) for p in scope["footprint"]])
  core = Polygon(scope["core"]["ring"], scope["core"]["holes"])
  affine = [1, 0, 0, -1, -389500, 5820000]
  expected_core = affine_transform(metric_bounds("bounds-v158.geojson"), affine)
  expected = affine_transform(metric_bounds("bounds.geojson"), affine).difference(core)
  assert core.equals_exact(expected_core, tolerance=0)
  assert actual.symmetric_difference(expected).area < 1e-8
  assert actual.intersection(core).area < 1e-8
  assert actual.covers(Point(4403.98, 2113.55))  # Schlesisches Tor surroundings.
  assert not actual.covers(Point(0, 0))  # Detailed existing city owns the core.


@pytest.mark.parametrize(
  ("name", "lon", "lat"),
  [
    ("Joachim-Friedrich-Str south", 13.2956331, 52.4935234),
    ("Joachim-Friedrich-Str north", 13.2966569, 52.5014662),
    ("Knaackstr south", 13.4143090, 52.5329309),
    ("Knaackstr north", 13.4208861, 52.5406518),
    ("Karl-Marx-Allee Alexanderplatz", 13.4165351, 52.5221629),
    ("Karl-Marx-Allee Frankfurter Tor", 13.4541966, 52.5157554),
    ("Schlesisches Tor station", 13.4414625, 52.5008341),
    ("Rathaus Schöneberg area", 13.3445, 52.4853),
  ],
)
def test_requested_road_extrema_and_neighbourhoods_fit(
  name: str, lon: float, lat: float
) -> None:
  # Road extrema derive from the complete named OSM way sets in the retained
  # 2026-09-29 extract; neighbourhood points are scope checks, not model anchors.
  assert metric_bounds("bounds.geojson").covers(Point(*PROJECT(lon, lat))), name
