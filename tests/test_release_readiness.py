"""Tests for release-readiness checks."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType

ROOT = Path(__file__).resolve().parents[1]


def load_script_module(name: str, relative_path: str) -> ModuleType:
  module_path = ROOT / relative_path
  spec = importlib.util.spec_from_file_location(name, module_path)
  assert spec is not None
  assert spec.loader is not None
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  return module


def test_current_tree_is_release_ready() -> None:
  release_readiness = load_script_module(
    "check_release_readiness", "scripts/check_release_readiness.py"
  )

  assert release_readiness.collect_failures(ROOT) == []


def write_tiny_dzi(public_dzi: Path) -> None:
  public_dzi.mkdir(parents=True, exist_ok=True)
  (public_dzi / "regierungsviertel.dzi").write_text(
    """<?xml version='1.0' encoding='utf-8'?>
<Image TileSize="256" Overlap="0" Format="jpg" xmlns="http://schemas.microsoft.com/deepzoom/2008">
  <Size Width="2" Height="2" />
</Image>
""",
    encoding="utf-8",
  )
  for level in ["0", "1"]:
    level_dir = public_dzi / "regierungsviertel_files" / level
    level_dir.mkdir(parents=True, exist_ok=True)
    (level_dir / "0_0.jpg").write_bytes(b"tile")


def write_minimal_release_tree(root: Path, version: str = "9.9.9") -> Path:
  (root / "pyproject.toml").write_text(
    f'[project]\nname = "fixture"\nversion = "{version}"\n',
    encoding="utf-8",
  )
  package_script = root / "scripts" / "package_static_site.py"
  package_script.parent.mkdir(parents=True)
  package_script.write_text(
    f'PACKAGE_VERSION = "{version}"\n',
    encoding="utf-8",
  )
  init = root / "src" / "isometric_berlin" / "__init__.py"
  init.parent.mkdir(parents=True)
  init.write_text(f'__version__ = "{version}"\n', encoding="utf-8")
  app_package = root / "src" / "app" / "package.json"
  app_package.parent.mkdir(parents=True)
  app_package.write_text(f'{{"version": "{version}"}}\n', encoding="utf-8")
  (root / "README.md").write_text(f"Local v{version}\n", encoding="utf-8")
  (root / "docs").mkdir(parents=True)
  (root / "docs" / "landmark-alignment.md").write_text("ok\n", encoding="utf-8")
  (root / "docs" / "metric-precision.md").write_text("ok\n", encoding="utf-8")
  (root / "geo_data" / "regierungsviertel").mkdir(parents=True)
  (root / "geo_data/regierungsviertel/landmark_alignment.json").write_text(
    "{}\n", encoding="utf-8"
  )
  (root / "geo_data/regierungsviertel/metric_precision.json").write_text(
    "{}\n", encoding="utf-8"
  )

  public_dzi = root / "src" / "app" / "public" / "dzi" / "regierungsviertel"
  write_tiny_dzi(public_dzi)
  for filename in [
    "landmarks.json",
    "reference_map.png",
    "wikimedia_attribution.json",
  ]:
    (public_dzi / filename).write_bytes(b"shared")
  bundled = root / "src" / "app" / "src" / "data"
  bundled.mkdir(parents=True)
  (bundled / "regierungsviertel-landmarks.json").write_bytes(b"shared")
  return public_dzi


def test_dzi_tile_failures_accepts_complete_pyramid(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_complete", "scripts/check_release_readiness.py"
  )
  write_tiny_dzi(tmp_path)

  assert release_readiness.dzi_tile_failures(tmp_path) == []


def test_dzi_tile_failures_require_tile_directory(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_missing_dir", "scripts/check_release_readiness.py"
  )
  write_tiny_dzi(tmp_path)
  for tile in (tmp_path / "regierungsviertel_files").rglob("*"):
    if tile.is_file():
      tile.unlink()
  for directory in sorted(
    (tmp_path / "regierungsviertel_files").rglob("*"), reverse=True
  ):
    if directory.is_dir():
      directory.rmdir()
  (tmp_path / "regierungsviertel_files").rmdir()

  assert release_readiness.dzi_tile_failures(tmp_path) == [
    f"Missing DZI tile directory: {tmp_path / 'regierungsviertel_files'}"
  ]


def test_dzi_tile_failures_require_referenced_tiles(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_missing_tile", "scripts/check_release_readiness.py"
  )
  write_tiny_dzi(tmp_path)
  missing_tile = tmp_path / "regierungsviertel_files" / "1" / "0_0.jpg"
  missing_tile.unlink()

  assert release_readiness.dzi_tile_failures(tmp_path) == [
    f"Missing DZI tile: {missing_tile}"
  ]


def test_collect_failures_rejects_mismatched_bundled_landmarks(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_landmarks", "scripts/check_release_readiness.py"
  )
  write_minimal_release_tree(tmp_path)
  (tmp_path / "src/app/src/data/regierungsviertel-landmarks.json").write_bytes(
    b"different"
  )

  assert (
    "Bundled app landmarks differ from src/app/public/dzi/regierungsviertel/landmarks.json"
    in release_readiness.collect_failures(tmp_path)
  )


def test_collect_failures_rejects_packaged_mac_command(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_package", "scripts/check_release_readiness.py"
  )
  write_minimal_release_tree(tmp_path)
  package_dir = tmp_path / "releases" / release_readiness.PACKAGE_NAME
  package_dir.mkdir(parents=True)
  (package_dir / "START-HERE.html").write_text(
    '<img src="dzi/regierungsviertel/overview.png">'
    '<img src="dzi/regierungsviertel/overview_source.png">'
    "<button>Drehen/Swivel</button>"
    '<button id="view-north">Nord</button>'
    '<div id="compass"></div>'
    "<script>event.shiftKey; setViewPreset</script>",
    encoding="utf-8",
  )
  (package_dir / "start-mac.command").write_text("#!/bin/sh\n", encoding="utf-8")

  assert (
    f"Forbidden macOS Gatekeeper-blocked launcher: {package_dir / 'start-mac.command'}"
    in release_readiness.collect_failures(tmp_path)
  )


def test_collect_failures_rejects_stale_server_fallback(tmp_path: Path) -> None:
  release_readiness = load_script_module(
    "check_release_readiness_stale_server", "scripts/check_release_readiness.py"
  )
  write_minimal_release_tree(tmp_path)
  package_dir = tmp_path / "releases" / release_readiness.PACKAGE_NAME
  package_dir.mkdir(parents=True)
  (package_dir / "START-HERE.html").write_text(
    '<img src="dzi/regierungsviertel/overview.png">'
    '<img src="dzi/regierungsviertel/overview_source.png">'
    "<button>Drehen/Swivel</button>"
    '<button id="view-north">Nord</button>'
    '<div id="compass"></div>'
    "<script>event.shiftKey; setViewPreset</script>",
    encoding="utf-8",
  )
  (package_dir / "serve-local.py").write_text(
    'print("old root launcher")\n',
    encoding="utf-8",
  )

  assert (
    f"Package server fallback does not open/flush START-HERE.html: {package_dir / 'serve-local.py'}"
    in release_readiness.collect_failures(tmp_path)
  )
