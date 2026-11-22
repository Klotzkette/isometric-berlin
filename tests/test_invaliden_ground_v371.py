"""Regression checks against the actual delivered Invalidenstraße triangle stream."""

import base64
import gzip
import json

import numpy as np
import pytest
import shapely
from shapely.geometry import LineString, Point, Polygon

from scripts import build_invaliden_ground_v371 as ground


def unpack(encoded, count, components):
  # Independent inverse of the JS decoder using unsigned prefix sums.
  raw = gzip.decompress(base64.b64decode(encoded, validate=True))
  planes = np.frombuffer(raw, np.uint8).reshape(2, count * components)
  delta = planes.T.copy().view("<u2").reshape(components, count)
  return delta.cumsum(axis=1, dtype=np.uint16).T


@pytest.fixture(scope="module")
def delivered():
  package = json.loads(ground.OUTPUT.read_bytes())
  assert tuple(package["bounds"]) == ground.BOUNDS
  surfaces = []
  classes = []
  for group in package["groups"]:
    points = unpack(group["xz"], group["vertices"], 2) / package["unitsPerMetre"]
    points += ground.BOUNDS[:2]
    faces = unpack(group["indices"], group["indexCount"], 1).reshape(-1, 3)
    assert int(faces.max()) < len(points)
    triangles = points[faces]
    vectors = np.stack(
      [triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]], axis=1
    )
    assert np.all(np.linalg.det(vectors) < 0), "a front-sided floor triangle was lost"
    assert np.ptp(triangles, axis=1).max() <= 16.001
    surfaces.extend(shapely.polygons(triangles))
    classes.extend([group["material"]] * len(faces))
  tree = shapely.STRtree(surfaces)
  return tree, classes


def material_at(delivered, x, z):
  tree, classes = delivered
  return {classes[i] for i in tree.query(Point(x, z), predicate="intersects")}


def test_mobile_road_gaps_have_real_ground_faces(delivered):
  assert material_at(delivered, 381.6, -1091.2) == {"asphalt"}
  assert material_at(delivered, 552.6, -1159.9) == {"asphalt"}
  # Both sand beds were traced independently from the 2026 orthophoto.
  for u, v in [(141, 338), (465, 163)]:
    assert material_at(delivered, 230 + u / 5, -1310 + v / 5) == {"sand"}


def test_water_park_and_u6_openings_remain_open(delivered):
  # Inside the separately drawn park basin, just inside the actual park,
  # and over the canal. No replacement terrain can close these holes.
  for x, z in [(359, -1160), (334, -1262), (177, -1030)]:
    assert not material_at(delivered, x, z)
  tree, _ = delivered
  openings = []
  for version in (261, 281):
    path = ground.OUTPUT.parent / f"ubahnEntrancesV{version}.json"
    for s in json.loads(path.read_bytes())["stairs"]:
      p = LineString([s["top"], s["bottom"]]).buffer(s["width"] / 2, cap_style="flat")
      if ground.DOMAIN.covers(p):
        openings.append(s["station"])
        # Exclude half the diagonal of the 2 cm packing lattice.
        assert not len(tree.query(p.buffer(-0.015), predicate="intersects"))
  assert {"naturkundemuseum", "oranienburger-tor"} <= set(openings)


def test_source_contains_measured_non_raster_edges():
  survey = json.loads(gzip.decompress(ground.SOURCE.read_bytes()))
  cadastral_edges = [
    f for f in survey["features"] if f["properties"].get("kind") == "Fahrbahnbegrenzungslinie"
  ]
  paths = [f for f in survey["features"] if f["properties"].get("class") == "AX_WegPfadSteig"]
  assert len(cadastral_edges) >= 800 and len(paths) >= 100
  park = Polygon(json.loads(ground.PARK.read_bytes())["boundary"])
  assert ground.DOMAIN.covers(park)
