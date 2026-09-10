"""The opening-view gate rejects late camera resets and incomplete observations."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/smoke_start_views.py"
SPEC = importlib.util.spec_from_file_location("start_views_smoke", SCRIPT)
assert SPEC and SPEC.loader
PROBE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROBE)
VIEW = {"position": [10, 30, 20], "target": [1, 3, 2], "fov": 39}
POSE = {"camera": [10, 30, 20], "target": [1, 3, 2], "fov": 39, "ready": True}


def test_accepts_bounded_floating_point_camera_rounding() -> None:
  assert PROBE.pose_matches({**POSE, "camera": [10.0001, 30, 20]}, VIEW)


@pytest.mark.parametrize(
  "replacement",
  [
    {"camera": [10, 30, 25]},
    {"target": [1, 4, 2]},
    {"fov": 16},
    {"camera": [10, float("nan"), 20]},
    {"camera": [10, 30]},
  ],
)
def test_rejects_wrong_pose_or_lens(replacement: dict[str, Any]) -> None:
  assert not PROBE.pose_matches({**POSE, **replacement}, VIEW)


def test_gate_rejects_a_late_camera_reset() -> None:
  with pytest.raises(AssertionError):
    PROBE.check_samples(
      [{**POSE, "ready": False}, POSE, {**POSE, "camera": [100, 30, 20]}], VIEW
    )


@pytest.mark.parametrize("samples", [[], [POSE], [{**POSE, "ready": False}]])
def test_gate_requires_both_pre_ready_and_ready_observation(samples: list) -> None:
  with pytest.raises(AssertionError):
    PROBE.check_samples(samples, VIEW)


def test_matching_pre_and_post_ready_poses_pass() -> None:
  PROBE.check_samples([{**POSE, "ready": False}, POSE], VIEW)


def test_probe_url_keeps_release_but_removes_old_deep_link() -> None:
  assert PROBE.viewer_url("https://example.test/map/?v=1.2#old") == (
    "https://example.test/map/?v=1.2&lang=de&theme=day"
  )
  assert PROBE.viewer_url("https://example.test/", "station") == (
    "https://example.test/?lang=de&theme=day#landmark=station"
  )
