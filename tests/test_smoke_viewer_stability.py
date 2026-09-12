"""Captured-frame gate must reject the original visible rendering failures."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from smoke_viewer_stability import validate_frames  # noqa: E402


def test_accepts_continuous_painted_frames():
  validate_frames(
    {"frames": 180, "badFrames": [], "resizeCount": 4, "unpaintedResizes": 0}
  )


@pytest.mark.parametrize(
  "bad_frame",
  [
    {"underwater": True, "underside": False, "visible": True},
    {"underwater": False, "underside": True, "visible": False},
  ],
)
def test_rejects_blue_fog_and_disappearing_city(bad_frame):
  with pytest.raises(AssertionError):
    validate_frames(
      {"frames": 180, "badFrames": [bad_frame], "resizeCount": 4, "unpaintedResizes": 0}
    )


def test_rejects_canvas_clear_without_replacement_frame():
  with pytest.raises(AssertionError):
    validate_frames(
      {"frames": 180, "badFrames": [], "resizeCount": 4, "unpaintedResizes": 1}
    )
