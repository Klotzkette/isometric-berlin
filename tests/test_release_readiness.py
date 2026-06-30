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
