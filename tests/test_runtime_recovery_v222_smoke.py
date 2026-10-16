"""The browser descent check must reject a snap hidden by a later landing."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from smoke_runtime_recovery_v222 import validate_descent  # noqa: E402


def pose(height: float, grounded: bool = False, x: float = -253.58) -> dict:
  return {
    "enabled": True,
    "position": [x, height, 1383.31],
    "pedestrian": {"grounded": grounded},
  }


def descent() -> list[dict]:
  return [pose(height) for height in range(24, 7, -1)] + [pose(7, True)]


def test_smooth_descent_preserves_the_initial_eye_and_lands() -> None:
  evidence = validate_descent(pose(25), descent(), 25)
  assert evidence["initialEyeY"] == 25
  assert evidence["landedEyeY"] == 7
  assert evidence["largestObservedDropM"] == 1


@pytest.mark.parametrize(
  "entry,observed",
  [
    (pose(7, True), [pose(7, True)] * 18),  # Immediate entry snap.
    (pose(25), [pose(10), *descent()[14:]]),  # A later snap cannot hide.
    (pose(25), [pose(26), *descent()]),  # Falling never rises first.
    (pose(25), [*descent()[:-1], pose(7)]),  # Must actually land.
    (pose(25), [*descent()[:-1], pose(7, True, x=-230)]),  # No relocation.
  ],
)
def test_descent_validation_rejects_navigation_regressions(entry, observed) -> None:
  with pytest.raises(AssertionError):
    validate_descent(entry, observed, 25)
