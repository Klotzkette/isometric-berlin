"""Tests for landmark-to-map alignment QA."""

from __future__ import annotations

from pathlib import Path

from isometric_berlin.data.verify_landmark_alignment import (
  build_alignment_report,
  normalize_name,
)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data" / "regierungsviertel"


def test_normalize_name_folds_berlin_landmark_names() -> None:
  assert normalize_name("Marie-Elisabeth-Lüders-Haus") == (
    "marie elisabeth luders haus"
  )
  assert normalize_name("Gustav-Heinemann-Brücke") == "gustav heinemann brucke"


def test_committed_landmarks_align_with_osm_city_map() -> None:
  report = build_alignment_report(
    landmarks_path=DATA / "landmarks.geojson",
    osm_path=DATA / "osm.gpkg",
    buildings_path=DATA / "buildings.gpkg",
  )

  assert report["summary"] == {
    "status": "ok",
    "landmarks_checked": 13,
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
