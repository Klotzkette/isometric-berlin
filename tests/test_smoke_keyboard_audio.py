"""Ensure the browser regression cannot mistake an idle render loop for motion."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from smoke_keyboard_audio import assert_continuous_motion


def test_rejects_motion_that_stops_after_first_audio_update() -> None:
  samples = [{"position": [x, 10, 0]} for x in (0, 2, 2, 2, 2)]
  with pytest.raises(AssertionError, match="Held navigation stopped"):
    assert_continuous_motion(samples)


def test_accepts_continuous_motion_across_every_sample() -> None:
  samples = [{"position": [x, 10, 0]} for x in (0, 2, 4, 6, 8)]
  assert assert_continuous_motion(samples) == [2, 2, 2, 2]
