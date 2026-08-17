"""Tests for the Regierungsviertel bounds editor (pipeline step 1)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from isometric_berlin.generation import create_bounds as cb

REPO_ROOT = Path(__file__).resolve().parents[1]
BOUNDS = REPO_ROOT / "geo_data" / "regierungsviertel" / "bounds.geojson"
LANDMARKS = REPO_ROOT / "geo_data" / "regierungsviertel" / "landmarks.geojson"

# A valid square enclosing every committed landmark (lon 13.3295..13.3905,
# lat 52.5035..52.5365 since the task-10 expansion), so the editor's
# all_inside check accepts it.
SQUARE = [
  [13.325, 52.499],
  [13.395, 52.499],
  [13.395, 52.544],
  [13.325, 52.544],
  [13.325, 52.499],
]

TASK_12_RING = [
  [13.399866438, 52.511388518],
  [13.399864137, 52.497704843],
  [13.375870776, 52.497705495],
  [13.359484949, 52.500845912],
  [13.357818657, 52.503345052],
  [13.355382589, 52.503519016],
  [13.33998399, 52.504000243],
  [13.322134957, 52.503489675],
  [13.322131317, 52.525262279],
  [13.343994694, 52.525968272],
  [13.349730423, 52.526750533],
  [13.351539483, 52.532180133],
  [13.348674048, 52.546493427],
  [13.38141664, 52.546493787],
  [13.38642498, 52.532716092],
  [13.392776535, 52.526450615],
  [13.397136832, 52.523316239],
  [13.397812412, 52.518581847],
  [13.399866438, 52.511388518],
]

TASK_13_RING = [
  [13.35269636, 52.499102798],
  [13.339967973, 52.499500483],
  [13.314771488, 52.498778901],
  [13.314761208, 52.529524084],
  [13.342989174, 52.530436531],
  [13.343459777, 52.530500723],
  [13.344078916, 52.532359795],
  [13.340346398, 52.550986251],
  [13.387334485, 52.550987285],
  [13.393350507, 52.534431783],
  [13.398753792, 52.529100933],
  [13.40427426, 52.525132052],
  [13.405125027, 52.519163243],
  [13.407233016, 52.511776578],
  [13.407226772, 52.493209212],
  [13.374741773, 52.493210978],
  [13.353970812, 52.497191573],
  [13.35269636, 52.499102798],
]


def test_outer_ring_and_properties() -> None:
  fc = cb.load_geojson(BOUNDS)
  ring = cb.outer_ring(fc)
  assert ring[0] == ring[-1], "ring must be closed"
  assert ring == TASK_13_RING
  props = cb.bounds_properties(fc)
  assert props["name"] == (
    "Regierungsviertel bounds — task-13 additional 500 m context expansion"
  )
  assert "additional metric 500 m outward buffer" in props["description"]
  assert "exactly 500 m" in props["source"]


def test_task_13_is_reproducible_exact_500_m_expansion_of_task_12() -> None:
  task_12 = cb.build_feature_collection(TASK_12_RING, "task-12", "", "")
  generated = cb.expand_feature_collection(task_12, 500.0)
  committed = cb.load_geojson(BOUNDS)

  assert cb.outer_ring(generated) == TASK_13_RING
  assert cb.outer_ring(committed) == TASK_13_RING
  old_polygon = cb.project_bounds_polygon(task_12)
  new_polygon = cb.project_bounds_polygon(committed)
  report = cb.metric_expansion_report(task_12, committed)

  assert new_polygon.covers(old_polygon)
  assert new_polygon.bounds == pytest.approx(
    (385602.602, 5817089.116, 391910.578, 5823617.370), abs=0.002
  )
  assert report["old_area_m2"] == pytest.approx(19_962_478.952, abs=0.002)
  assert report["new_area_m2"] == pytest.approx(30_977_268.666, abs=0.002)
  assert report["ring_area_m2"] == pytest.approx(11_014_789.714, abs=0.002)
  # Nine-decimal CRS84 storage is the only deviation from the metric buffer.
  assert report["minimum_boundary_distance_m"] == pytest.approx(500.0, abs=0.0001)


@pytest.mark.parametrize("distance", [0.0, -1.0, float("inf"), float("nan")])
def test_expansion_rejects_non_positive_or_non_finite_distance(
  distance: float,
) -> None:
  task_12 = cb.build_feature_collection(TASK_12_RING, "task-12", "", "")
  with pytest.raises(ValueError, match="finite positive"):
    cb.expand_feature_collection(task_12, distance)


def test_committed_bounds_contain_all_landmarks() -> None:
  ring = cb.outer_ring(cb.load_geojson(BOUNDS))
  report = cb.landmark_report(ring, cb.load_geojson(LANDMARKS))
  assert len(report) >= 13
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
  page = test_client.get("/")
  assert page.status_code == 200
  assert b"https://unpkg.com" not in page.data
  assert b"/static/leaflet/leaflet.css" in page.data
  assert b"/static/leaflet/leaflet.js" in page.data
  assert b"/static/leaflet-draw/leaflet.draw.css" in page.data
  assert b"/static/leaflet-draw/leaflet.draw.js" in page.data
  assert b"https://tile.openstreetmap.org/{z}/{x}/{y}.png" in page.data
  assert "© OpenStreetMap contributors".encode() in page.data
  assert test_client.get("/static/leaflet/leaflet.js").status_code == 200
  assert test_client.get("/static/leaflet-draw/leaflet.draw.js").status_code == 200
  bounds = test_client.get("/api/bounds").get_json()
  assert bounds["features"][0]["geometry"]["type"] == "Polygon"
  landmarks = test_client.get("/api/landmarks").get_json()
  assert len(landmarks["features"]) >= 13


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


def test_post_polygon_excluding_landmarks_is_rejected(client) -> None:
  test_client, bounds_copy = client
  before = bounds_copy.read_text(encoding="utf-8")
  res = test_client.post(
    "/api/bounds",
    json={
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [13.0, 52.0],
            [13.1, 52.0],
            [13.1, 52.1],
            [13.0, 52.1],
            [13.0, 52.0],
          ]
        ],
      }
    },
  )
  data = res.get_json()
  assert res.status_code == 400
  assert data["ok"] is False
  assert data["all_inside"] is False
  assert "Bounds must include all landmarks" in data["errors"][0]
  assert bounds_copy.read_text(encoding="utf-8") == before
