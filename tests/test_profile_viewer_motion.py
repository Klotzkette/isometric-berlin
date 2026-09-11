"""Keep timing summaries and deterministic input paths honest without a browser."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/profile_viewer_motion.py"
spec = importlib.util.spec_from_file_location("profile_viewer_motion", SCRIPT)
assert spec and spec.loader
profile = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profile)


def test_percentiles_keep_stalls_and_use_strict_thresholds() -> None:
  result = profile.distribution([10.0] * 96 + [33, 34, 50, 250])
  assert result["p50"] == result["p95"] == 10
  assert result["p99"] == 50
  assert result["max"] == 250
  assert result["over33ms"] == 3
  assert result["over50ms"] == 1
  assert result["over50msPercent"] == 1
  assert profile.distribution([])["p95"] is None
  assert profile.distribution([])["over50ms"] == 0
  assert "over50ms" not in profile.distribution([1000], milliseconds=False)


def test_start_url_keeps_release_and_uses_fixed_day_landmark() -> None:
  url = urlsplit(
    profile.start_url(
      "https://example.test/viewer/?v=1.0.28&view=map&theme=night#old",
      "washingtonplatz",
    )
  )
  assert parse_qs(url.query) == {"v": ["1.0.28"], "lang": ["en"], "theme": ["day"]}
  assert url.fragment == "landmark=berlin-hauptbahnhof"
  assert url.path == "/viewer/"


def test_orbit_path_is_closed_and_independent_of_event_rate() -> None:
  assert profile.pointer_position(0, 6) == (720, 450)
  assert profile.pointer_position(6, 6) == pytest.approx((720, 450))
  assert profile.pointer_position(7, 6) == pytest.approx((720, 450))
  assert profile.pointer_position(1.5, 6) == pytest.approx(
    profile.pointer_position(3, 12)
  )
  for step in range(601):
    x, y = profile.pointer_position(step / 100, 6)
    assert 590 <= x <= 850
    assert 395 <= y <= 505


def test_panorama_exercises_far_view_without_exceeding_viewer_camera_limit() -> None:
  import math

  pose = profile.LOCATIONS["panorama"]
  assert 2400 < math.dist(pose["position"], pose["target"]) < 2600
  assert pose["fov"] == 39


def test_summary_keeps_scene_and_compositor_counts_separate_from_timing() -> None:
  phase = {
    "startMs": 100,
    "endMs": 200,
    "frames": [
      {"durationMs": 40, "renderCpuMs": 12, "calls": 502, "triangles": 1_000_002},
    ],
    "renders": [
      {"durationMs": 11, "calls": 500, "triangles": 1_000_000},
      {"durationMs": 1, "calls": 2, "triangles": 2},
    ],
  }
  result = profile.summarize(
    phase,
    [
      {"startMs": 99, "durationMs": 100},
      {"startMs": 150, "durationMs": 60},
      {"startMs": 200, "durationMs": 100},
    ],
  )
  assert result["summary"]["totalDrawCalls"] == 502
  assert result["summary"]["totalTriangles"] == 1_000_002
  assert result["summary"]["rafIntervalMs"]["over33ms"] == 1
  assert result["summary"]["renderCallCpuMs"]["max"] == 11
  assert result["summary"]["longTaskMs"]["count"] == 1
  assert "over33ms" not in result["summary"]["trianglesPerRaf"]
