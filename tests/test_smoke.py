"""Smoke tests."""

from __future__ import annotations

import json
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def project_version() -> str:
  metadata = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
  return str(metadata["project"]["version"])


def test_package_imports() -> None:
  import isometric_berlin

  assert isometric_berlin.__version__ == project_version()


def test_project_versions_stay_in_sync() -> None:
  import isometric_berlin
  from scripts.package_static_site import PACKAGE_VERSION

  app_package = json.loads(
    (ROOT / "src" / "app" / "package.json").read_text(encoding="utf-8")
  )
  version = project_version()
  assert isometric_berlin.__version__ == version
  assert PACKAGE_VERSION == version
  assert app_package["version"] == version


def test_readme_quickstart_is_current() -> None:
  readme = (ROOT / "README.md").read_text(encoding="utf-8")
  assert "Local v" in readme
  assert "python3 scripts/serve_local_viewer.py" in readme
  assert "python3 scripts/package_static_site.py" in readme
  assert "# Bounds editor (TODO)" not in readme
  assert "# Web viewer (TODO)" not in readme
  assert "# Bounds-Editor (TODO)" not in readme
  assert "# Web-Viewer (TODO)" not in readme


def test_bounds_geojson_exists() -> None:
  p = ROOT / "geo_data" / "regierungsviertel" / "bounds.geojson"
  assert p.exists()
  assert p.stat().st_size > 0
