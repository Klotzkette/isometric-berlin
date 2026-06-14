"""Smoke tests."""

from __future__ import annotations


def test_package_imports() -> None:
  import isometric_berlin

  assert isometric_berlin.__version__ == "0.1.0"


def test_bounds_geojson_exists() -> None:
  from pathlib import Path

  p = Path(__file__).resolve().parents[1] / "geo_data" / "regierungsviertel" / "bounds.geojson"
  assert p.exists()
  assert p.stat().st_size > 0
