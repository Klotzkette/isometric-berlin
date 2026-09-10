"""Verify exact screenshot differences using small synthetic images."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from types import ModuleType

import pytest
from PIL import Image


@pytest.fixture
def frames(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
  scripts = Path(__file__).resolve().parents[1] / "scripts"
  monkeypatch.syspath_prepend(str(scripts))
  spec = importlib.util.spec_from_file_location(
    "compare_viewer_frames", scripts / "compare_viewer_frames.py"
  )
  assert spec and spec.loader
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  return module


def test_diff_counts_one_channel_one_pixel_without_tolerance(
  frames: ModuleType,
) -> None:
  before = Image.new("RGB", (2, 2), (100, 100, 100))
  same = frames.pixel_difference(before, before.copy())
  assert same["changedPixels"] == 0
  assert same["differenceBounds"] is None
  after = before.copy()
  after.putpixel((0, 0), (101, 100, 100))
  diff = frames.pixel_difference(before, after)
  assert diff["changedPixels"] == 1
  assert diff["changedPercent"] == 25
  assert diff["maxChannelError"] == 1
  assert diff["meanAbsoluteChannelError"] == pytest.approx(1 / 12)
  assert diff["rootMeanSquareChannelError"] == pytest.approx((1 / 12) ** 0.5)
  assert diff["differenceBounds"] == (0, 0, 1, 1)


def test_comparison_reports_missing_views_and_size_mismatches(
  frames: ModuleType, tmp_path: Path
) -> None:
  before, after = tmp_path / "before", tmp_path / "after"
  before.mkdir()
  after.mkdir()
  Image.new("RGB", (2, 2)).save(before / "kanzleramt.png")
  Image.new("RGB", (3, 2)).save(after / "kanzleramt.png")
  Image.new("RGB", (2, 2)).save(before / "tiergarten.png")
  frames.compare(before, after)
  result = json.loads((after / "frame-comparison.json").read_text())
  assert result["views"]["kanzleramt.png"]["comparable"] is False
  assert result["views"]["tiergarten.png"]["missing"].endswith("after/tiergarten.png")
