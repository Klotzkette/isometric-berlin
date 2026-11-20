import sys
from pathlib import Path

import pytest
from shapely.geometry import Point

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from ring_paving_scope_v368 import PROJECT, regions, scope, world  # noqa: E402


def projected_point(lon, lat):
  east, north = PROJECT(lon, lat)
  return world(Point(east, north))


def test_ring_boundary_and_metric_band():
  areas = regions()
  ring, band = areas["ring"], areas["outer500"]
  assert ring.is_valid and band.is_valid
  assert len(ring.exterior.coords) > 1100
  assert 87 < ring.area / 1e6 < 88
  assert band.intersection(ring).area == 0
  # Pick a tangent at an actual surveyed track vertex, well away from any
  # other track segment. East from its easternmost point is always outward.
  x, z = max(ring.exterior.coords, key=lambda xy: xy[0])
  assert band.covers(Point(x + 499, z))
  assert not band.covers(Point(x + 501, z))
  assert scope().area / 1e6 == pytest.approx(150.8, abs=0.2)


@pytest.mark.parametrize(
  "key,longitude,latitude",
  [
    ("ring", 13.3982, 52.4930),
    ("steglitz", 13.3236, 52.4561),
    ("wannsee", 13.1519, 52.4194),
    ("pfaueninsel", 13.1280, 52.4317),
    ("schwanenwerder", 13.1687, 52.4447),
    ("schoenhauser_nord", 13.4112, 52.5660),
    ("tempelhofer_feld", 13.4120, 52.4747),
    ("funkturm", 13.2773, 52.5052),
    ("olympiastadion", 13.2396, 52.5147),
  ],
)
def test_named_coverage(key, longitude, latitude):
  assert regions()[key].covers(projected_point(longitude, latitude))
