"""Keep the bounded street supplement source-bound and open at tunnel ramps."""

from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path

import numpy as np
import pytest
import shapely
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

from isometric_berlin.generation.build_surface_polygons import (
  DEFAULT_SCENE,
  open_tunnel_ramp_corridors,
)

ROOT = Path(__file__).resolve().parents[1]
PAYLOAD = ROOT / "src/app/src/data/districtStreets.json"


@pytest.fixture(scope="module")
def streets() -> dict:
  return json.loads(PAYLOAD.read_text())


def surface_triangles(surface: dict) -> np.ndarray:
  points = np.frombuffer(base64.b64decode(surface["positions_cm_b64"]), dtype="<i4")
  points = points.reshape(-1, 2).astype(float) / 100
  indices = np.frombuffer(base64.b64decode(surface["indices_b64"]), dtype="<u4")
  return points[indices].reshape(-1, 3, 2)


def test_all_requested_street_districts_are_represented(streets: dict) -> None:
  names = {road["name"] for road in streets["roads"]}
  assert {
    "Tiergartenstraße",
    "Helmut-Kohl-Allee",
    "Straße des 17. Juni",
    "Altonaer Straße",
    "Stülerstraße",
    "Klingelhöferstraße",
    "Invalidenstraße",
    "Heidestraße",
    "Luisenstraße",
    "Otto-von-Bismarck-Allee",
    "Potsdamer Straße",
    "Ebertstraße",
  } <= names
  assert streets["schema_version"] == 2
  assert len(streets["source"]["district_windows_epsg25833"]) == 6
  assert streets["inventory"]["source_road_count"] == len(streets["roads"])
  assert set(streets["elevated_path_ids"]).isdisjoint(
    {road["id"] for road in streets["roads"]}
  )


def test_geometry_is_inside_scope_and_retains_bounded_terrain_samples(
  streets: dict,
) -> None:
  scope = unary_union([Polygon(ring) for ring in streets["scope_rings_m"]]).buffer(
    0.025
  )
  count = 0
  for surface in streets["surfaces"]:
    triangles = surface_triangles(surface)
    count += len(triangles)
    assert np.isfinite(triangles).all()
    lengths = np.linalg.norm(triangles - np.roll(triangles, 1, axis=1), axis=2)
    assert lengths.max() <= 16.02
    centres = triangles.mean(axis=1)
    assert shapely.covers(scope, shapely.points(centres)).all()
    edges = triangles[:, 1:] - triangles[:, :1]
    area = (
      np.abs(edges[:, 0, 0] * edges[:, 1, 1] - edges[:, 0, 1] * edges[:, 1, 0]).sum()
      / 2
    )
    # Centimetre encoding moves a boundary by at most sqrt(2)*5mm. Narrow
    # sidewalk/median polygons have much more perimeter per square metre than
    # the old citywide road union; use that geometric error bound, not a fixed
    # area percentage that rejects correct centimetre quantization.
    assert area == pytest.approx(
      surface["area_m2"], abs=surface["source_perimeter_m"] * 0.0071 + 0.02
    )
  assert count == streets["inventory"]["triangle_count"]


def test_tunnel_approaches_are_never_capped_or_kerbed(streets: dict) -> None:
  ramps = open_tunnel_ramp_corridors(DEFAULT_SCENE)
  assert ramps is not None
  for surface in streets["surfaces"]:
    centres = surface_triangles(surface).mean(axis=1)
    projected = np.column_stack([389500 + centres[:, 0], 5820000 - centres[:, 1]])
    assert not shapely.contains(ramps, shapely.points(projected)).any()
  for line in streets["curbs_m"]:
    projected_line = LineString([(389500 + x, 5820000 - z) for x, z in line])
    assert projected_line.intersection(ramps).length == 0


def test_width_evidence_and_source_hash_are_explicit(streets: dict) -> None:
  assert all(0.5 <= road["width_m"] <= 45 for road in streets["roads"])
  assert set(streets["inventory"]["by_width_source"]) <= {
    "width",
    "est_width",
    "lanes",
    "class_fallback",
  }
  assert "not a traffic-paint survey" in streets["source"]["marking_policy"]
  osm = ROOT / "geo_data/regierungsviertel/osm.gpkg"
  if osm.exists():
    assert (
      hashlib.sha256(osm.read_bytes()).hexdigest() == streets["source"]["osm_sha256"]
    )
