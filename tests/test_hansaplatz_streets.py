"""Regress source routes and the small open Hansaplatz courts in both styles."""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import numpy as np
import pytest
import shapely
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from scripts.hansaplatz_streets import HANSAPLATZ_WINDOW, hansaplatz_clearance
from tests.test_district_streets import surface_triangles

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def hansa() -> tuple[dict, dict, dict]:
  streets = json.loads((ROOT / "src/app/src/data/districtStreets.json").read_text())
  native = json.loads(
    (ROOT / "src/app/src/data/hansaplatzBlockStreets.json").read_text()
  )
  surfaces = {}
  for surface in streets["surfaces"]:
    triangles = surface_triangles(surface)
    means = triangles.mean(axis=1)
    local = triangles[
      (means[:, 0] > -2250)
      & (means[:, 0] < -1870)
      & (means[:, 1] > -230)
      & (means[:, 1] < 130)
    ]
    surfaces[surface["kind"]] = unary_union([Polygon(t) for t in local])
  return streets, native, surfaces


def test_school_and_theatre_streets_follow_existing_osm_axes(hansa: tuple) -> None:
  streets, _, surfaces = hansa
  assert streets["source"]["hansaplatz"]["window_epsg25833"] == list(HANSAPLATZ_WINDOW)
  assert {"Lessingstraße", "Altonaer Straße", "Bartningallee"} <= {
    r["name"] for r in streets["roads"]
  }
  roads = gpd.read_file(
    ROOT / "geo_data/regierungsviertel/osm.gpkg",
    layer="roads",
    bbox=HANSAPLATZ_WINDOW,
  )
  for identity in ("527591141", "455280945", "1471432243"):
    line = roads.loc[roads["id"] == identity].geometry.iloc[0]
    middle = line.interpolate(0.5, normalized=True)
    point = Point(middle.x - 389500, 5820000 - middle.y)
    assert surfaces["asphalt"].buffer(0.015).covers(point), identity
  for identity in streets["source"]["hansaplatz"]["ground_roads_under_railway"]:
    road = roads.loc[roads["id"] == identity].iloc[0]
    assert road["name"] == "Altonaer Straße"
    assert road["covered"] == "yes" and road["surface"] == "asphalt"
    assert all(
      not isinstance(road.get(tag), str) for tag in ("bridge", "tunnel", "layer")
    )
    assert identity not in streets["elevated_path_ids"]
  # The mapped paved route in front of the school/Hand mit Uhr is distinct
  # from the asphalt road, at the same raised level as the visible kerb top.
  assert surfaces["sidewalk"].buffer(0.015).covers(Point(-2149.18, -70.7))


def test_source_courts_and_u9_remain_free_of_added_sidewalks(hansa: tuple) -> None:
  _, native, surfaces = hansa
  grips = json.loads((ROOT / "src/app/src/gripsHansaplatzSource.json").read_text())
  for court in grips["courts"]:
    assert surfaces["sidewalk"].intersection(Polygon(court["ring"])).area < 0.01
  exclusion = hansaplatz_clearance(ROOT)
  for x, z, length, _ in native["runs"]:
    cell_run = box(389500 + x, 5820000 - z - 1, 389500 + x + length, 5820000 - z)
    assert not cell_run.intersects(exclusion)


def test_native_runs_are_bounded_nonoverlapping_and_preserve_open_crossings(
  hansa: tuple,
) -> None:
  streets, native, _ = hansa
  assert native["osm_sha256"] == streets["source"]["osm_sha256"]
  assert native["cell_count"] == sum(r[2] for r in native["runs"])
  assert len(native["runs"]) < 7500
  assert native["cell_count"] < 26000
  occupied = set()
  for x, z, length, kind in native["runs"]:
    assert 0 <= kind <= 2 and length > 0
    for offset in range(length):
      point = (x + offset, z)
      assert point not in occupied
      occupied.add(point)
      assert box(*HANSAPLATZ_WINDOW).covers(
        Point(389500 + point[0] + 0.5, 5820000 - point[1] - 0.5)
      )
  # Native kerb cells can only hug an exported open kerb. Their generation
  # cannot form a new stripe across a lowered mapped foot/cycle approach.
  kerbs = unary_union([shapely.LineString(line) for line in streets["curbs_m"]])
  kerb_cells = np.array(
    [
      [x + i + 0.5, z + 0.5]
      for x, z, n, k in native["runs"]
      if k == 2
      for i in range(n)
    ]
  )
  assert shapely.distance(kerbs, shapely.points(kerb_cells)).max() < 0.515
