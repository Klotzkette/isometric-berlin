"""Tests for the Regierungsviertel bounds editor (pipeline step 1)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from isometric_berlin.generation import create_bounds as cb

REPO_ROOT = Path(__file__).resolve().parents[1]
BOUNDS = REPO_ROOT / "geo_data" / "regierungsviertel" / "bounds.geojson"
LANDMARKS = REPO_ROOT / "geo_data" / "regierungsviertel" / "landmarks.geojson"

# A small valid square around the centre of the quarter.
SQUARE = [
  [13.36, 52.508],
  [13.382, 52.508],
  [13.382, 52.528],
  [13.36, 52.528],
  [13.36, 52.508],
]


def test_outer_ring_and_properties() -> None:
  fc = cb.load_geojson(BOUNDS)
  ring = cb.outer_ring(fc)
  assert ring[0] == ring[-1], "ring must be closed"
  props = cb.bounds_properties(fc)
  assert props["name"] == "Regierungsviertel MVP bounds"
  assert props["description"]


def test_committed_bounds_contain_all_landmarks() -> None:
  ring = cb.outer_ring(cb.load_geojson(BOUNDS))
  report = cb.landmark_report(ring, cb.load_geojson(LANDMARKS))
  assert len(report) == 8
  assert all(report.values()), f"landmarks outside bounds: {report}"


def test_validate_ring_accepts_simple_polygon() -> None:
  assert cb.validate_ring(SQUARE) == []


def test_validate_ring_rejects_too_few_points() -> None:
  errors = cb.validate_ring([[0, 0], [1, 1]])
  assert errors


def test_validate_ring_rejects_self_intersection() -> None:
  bowtie = [
    [13.36, 52.508],
    [13.382, 52.528],
    [13.382, 52.508],
    [13.36, 52.528],
    [13.36, 52.508],
  ]
  errors = cb.validate_ring(bowtie)
  assert errors


def test_close_ring_appends_first_point() -> None:
  ring = cb.close_ring([[0, 0], [1, 0], [1, 1]])
  assert ring[0] == ring[-1]
  assert len(ring) == 4


def test_build_feature_collection_round_trips_properties() -> None:
  fc = cb.build_feature_collection(SQUARE, "n", "d", "s")
  assert fc["type"] == "FeatureCollection"
  props = fc["features"][0]["properties"]
  assert (props["name"], props["description"], props["source"]) == ("n", "d", "s")
  assert fc["features"][0]["geometry"]["type"] == "Polygon"


@pytest.fixture
def client(tmp_path: Path):
  bounds_copy = tmp_path / "bounds.geojson"
  bounds_copy.write_text(BOUNDS.read_text(encoding="utf-8"), encoding="utf-8")
  app = cb.create_app(bounds_copy, LANDMARKS)
  app.config.update(TESTING=True)
  return app.test_client(), bounds_copy


def test_get_endpoints(client) -> None:
  test_client, _ = client
  assert test_client.get("/").status_code == 200
  bounds = test_client.get("/api/bounds").get_json()
  assert bounds["features"][0]["geometry"]["type"] == "Polygon"
  landmarks = test_client.get("/api/landmarks").get_json()
  assert len(landmarks["features"]) == 8


def test_post_valid_polygon_saves_and_preserves_properties(client) -> None:
  test_client, bounds_copy = client
  original = cb.bounds_properties(json.loads(bounds_copy.read_text()))
  res = test_client.post(
    "/api/bounds",
    json={
      "geometry": {
        "type": "Polygon",
        "coordinates": [SQUARE],
      }
    },
  )
  data = res.get_json()
  assert res.status_code == 200
  assert data["ok"] is True
  assert data["all_inside"] is True
  saved = json.loads(bounds_copy.read_text())
  assert cb.bounds_properties(saved)["name"] == original["name"]
  assert saved["features"][0]["geometry"]["coordinates"][0][0] == SQUARE[0]


def test_post_polygon_with_hole_is_rejected(client) -> None:
  test_client, _ = client
  res = test_client.post(
    "/api/bounds",
    json={
      "geometry": {
        "type": "Polygon",
        "coordinates": [SQUARE, SQUARE],
      }
    },
  )
  assert res.status_code == 400
  assert res.get_json()["ok"] is False
