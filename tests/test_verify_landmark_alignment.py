"""Tests for landmark-to-map alignment QA."""

from __future__ import annotations

import json
from pathlib import Path

from pytest import MonkeyPatch

from isometric_berlin.data import verify_landmark_alignment as vla

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data" / "regierungsviertel"
VIEWER_LANDMARKS = ROOT / "src/app/public/dzi/regierungsviertel/landmarks.json"


def test_normalize_name_folds_berlin_landmark_names() -> None:
  assert vla.normalize_name("Marie-Elisabeth-Lüders-Haus") == (
    "marie elisabeth luders haus"
  )
  assert vla.normalize_name("Gustav-Heinemann-Brücke") == "gustav heinemann brucke"


def test_committed_landmarks_align_with_osm_city_map() -> None:
  report = vla.build_alignment_report(
    landmarks_path=DATA / "landmarks.geojson",
    osm_path=DATA / "osm.gpkg",
    buildings_path=DATA / "buildings.gpkg",
  )

  assert report["summary"] == {
    "status": "ok",
    "landmarks_checked": 13,
    "relative_relationships_checked": 8,
    "landmark_review_count": 0,
    "relative_review_count": 0,
    "review_count": 0,
  }
  checks = {check["name"]: check for check in report["checks"]}
  assert checks["Paul-Löbe-Haus"]["best_osm_match"]["name"] == "Paul-Löbe-Haus"
  assert checks["Marie-Elisabeth-Lüders-Haus"]["best_osm_match"]["name"] == (
    "Marie-Elisabeth-Lüders-Haus"
  )
  assert (
    checks["Botschaft der Vereinigten Staaten von Amerika"]["best_osm_match"]["name"]
    == "Botschaft der Vereinigten Staaten von Amerika"
  )
  assert all(check["status"] == "ok" for check in checks.values())
  assert all(
    relation["status"] == "ok" for relation in report["relative_relationships"]
  )


def test_relative_relationship_reviews_affect_summary_status(
  monkeypatch: MonkeyPatch,
) -> None:
  expectations = [dict(expectation) for expectation in vla.RELATIVE_EXPECTATIONS]
  expectations[0]["east_west"] = "east"
  monkeypatch.setattr(vla, "RELATIVE_EXPECTATIONS", tuple(expectations))

  report = vla.build_alignment_report(
    landmarks_path=DATA / "landmarks.geojson",
    osm_path=DATA / "osm.gpkg",
    buildings_path=DATA / "buildings.gpkg",
  )

  assert report["summary"]["status"] == "review"
  assert report["summary"]["landmark_review_count"] == 0
  assert report["summary"]["relative_review_count"] == 1
  assert report["summary"]["review_count"] == 1
  assert any(
    relationship["status"] == "review"
    for relationship in report["relative_relationships"]
  )


def test_committed_landmarks_preserve_real_world_relative_order() -> None:
  landmarks = vla.load_landmarks(DATA / "landmarks.geojson").set_index("name")

  def delta(from_name: str, to_name: str) -> tuple[float, float]:
    start = landmarks.loc[from_name].geometry
    end = landmarks.loc[to_name].geometry
    return float(end.x - start.x), float(end.y - start.y)

  dx, dy = delta("Berlin Hauptbahnhof", "Bundeskanzleramt")
  assert dx < 0
  assert dy < 0

  dx, dy = delta("Berlin Hauptbahnhof", "Marie-Elisabeth-Lüders-Haus")
  assert dx > 0
  assert dy < 0

  dx, dy = delta("Bundeskanzleramt", "Reichstagsgebäude")
  assert dx > 0
  assert dy < 0

  dx, dy = delta("Haus der Kulturen der Welt (Schwangere Auster)", "Reichstagsgebäude")
  assert dx > 0
  assert dy < 0

  dx, dy = delta("Berlin Hauptbahnhof", "Reichstagsgebäude")
  assert dx > 0
  assert dy < 0

  dx, dy = delta("Bundeskanzleramt", "Marie-Elisabeth-Lüders-Haus")
  assert dx > 0
  assert dy > 0

  dx, dy = delta("Reichstagsgebäude", "Brandenburger Tor")
  assert dx > 0
  assert dy < 0

  dx, dy = delta("Brandenburger Tor", "Botschaft der Vereinigten Staaten von Amerika")
  assert dx > 0
  assert dy < 0


def test_exported_viewer_landmarks_preserve_isometric_relative_order() -> None:
  payload = json.loads(VIEWER_LANDMARKS.read_text(encoding="utf-8"))
  landmarks = {row["name"]: row for row in payload["landmarks"]}

  def delta(from_name: str, to_name: str) -> tuple[float, float]:
    start = landmarks[from_name]
    end = landmarks[to_name]
    return float(end["x"] - start["x"]), float(end["y"] - start["y"])

  dx, dy = delta("Berlin Hauptbahnhof", "Bundeskanzleramt")
  assert dx < 0
  assert dy > 0

  dx, dy = delta("Berlin Hauptbahnhof", "Marie-Elisabeth-Lüders-Haus")
  assert dx > 0
  assert dy > 0

  dx, dy = delta("Berlin Hauptbahnhof", "Reichstagsgebäude")
  assert dx < 0
  assert dy > 0

  dx, dy = delta("Reichstagsgebäude", "Brandenburger Tor")
  assert dx < 0
  assert dy > 0

  dx, dy = delta("Brandenburger Tor", "Botschaft der Vereinigten Staaten von Amerika")
  assert dx < 0
  assert dy > 0
