"""The mobile route must report context losses even after automatic recovery."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from smoke_mobile_memory import validate_sample  # noqa: E402


def test_recovered_context_is_not_a_passing_stability_result():
  sample = {
    "ready": True,
    "mode": "schwellenraum",
    "lost": 1,
    "contextLost": False,
    "speculativeWarmup": False,
    "instanceResidentBytes": 1024,
    "instanceResidentBuffers": 2,
    "geometryResidentBuffers": 5,
  }
  with pytest.raises(AssertionError):
    validate_sample(sample, "schwellenraum")
  sample["lost"] = 0
  validate_sample(sample, "schwellenraum")


@pytest.mark.parametrize("field,value", [("ready", False), ("contextLost", True)])
def test_unavailable_viewer_is_rejected(field, value):
  sample = {
    "ready": True,
    "mode": "day",
    "lost": 0,
    "contextLost": False,
    "speculativeWarmup": False,
    "instanceResidentBytes": 1024,
    "instanceResidentBuffers": 2,
    "geometryResidentBuffers": 5,
  }
  sample[field] = value
  with pytest.raises(AssertionError):
    validate_sample(sample, "day")
