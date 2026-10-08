"""Independent source, ownership and open-path contracts for the eastern sites."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from pyproj import Transformer
from shapely.geometry import Point, Polygon, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
EVIDENCE = json.loads(
  (ROOT / "geo_data/regierungsviertel/east-landmarks-v187-evidence.json").read_text()
)
DRAWN = json.loads((DATA / "eastLandmarksV187.json").read_text())


def ring_area(ring: list) -> float:
  """Polygon area in its own plane, independent of the production triangulator."""
  points = np.asarray(ring)
  return float(
    np.linalg.norm(np.cross(points, np.roll(points, -1, axis=0)).sum(axis=0)) / 2
  )


def test_full_official_shells_and_exact_source_ownership() -> None:
  """Every measured wall/roof area survives, including real courtyard holes."""
  features = json.loads(
    (
      ROOT / "geo_data/regierungsviertel/east-landmarks-v187-exclusions.geojson"
    ).read_text()
  )["features"]
  assert len(features) == 10
  project = Transformer.from_crs(4326, 25833, always_xy=True).transform
  for parent in EVIDENCE["sourceProfiles"]:
    pid = parent["id"]
    source_area = sum(
      ring_area(surface["rings"][0])
      - sum(ring_area(hole) for hole in surface["rings"][1:])
      for part in parent["parts"]
      for surface in part["surfaces"]
    )
    triangles = [
      triangle
      for cell in DRAWN["cells"]
      for surface in cell["surfaces"]
      if surface.get("owner") == pid
      for triangle in surface["triangles"]
    ]
    actual_area = sum(ring_area(triangle) for triangle in triangles)
    assert abs(actual_area - source_area) < max(0.2, source_area * 0.00001)
    original = unary_union([Polygon(p["ring"], p["holes"]) for p in parent["parts"]])
    feature = next(f for f in features if f["properties"]["id"] == pid)
    projected = transform(project, shape(feature["geometry"]))
    local = transform(lambda x, y: (x - 389500, 5820000 - y), projected)
    assert original.symmetric_difference(local).area < 0.001


def test_zoo_patches_and_gate_gaps_follow_source_geometry() -> None:
  """No interpreted enclosure colour is allowed beyond its mapped boundary."""
  zoo = shape(EVIDENCE["zooGeometry"])
  assert len(EVIDENCE["enclosures"]) >= 130
  assert len(EVIDENCE["barriers"]) >= 130
  assert len(EVIDENCE["gateNodes"]) > 10
  for patch in EVIDENCE["enclosures"]:
    rendered = shape(patch["geometry"])
    assert zoo.buffer(0.001).covers(rendered)
    assert shape(patch["mappedGeometry"]).buffer(0.001).covers(rendered)
  barrier = unary_union([shape(row["geometry"]) for row in EVIDENCE["barriers"]])
  for gate in EVIDENCE["gateNodes"]:
    assert barrier.distance(Point(gate["point"])) >= 1.24


def test_tower_height_includes_roof_and_navigation_retains_parts() -> None:
  """The missing Rathaus upper tower must reach 54 m, not 64 m."""
  triangles = [
    t
    for c in DRAWN["cells"]
    for s in c["surfaces"]
    if s.get("owner") == "way/180315073"
    for t in s["triangles"]
  ]
  assert max(p[1] for triangle in triangles for p in triangle) == 57
  nav = json.loads((DATA / "eastLandmarksV187Navigation.json").read_text())["buildings"]
  assert len(nav) == 28
  assert len({row["id"] for row in nav}) == 28
  tower = next(row for row in nav if row["id"] == "way/180315073")
  assert tower["topY"] - tower["groundY"] == 54
  assert all(row["topY"] > row["groundY"] for row in nav)
