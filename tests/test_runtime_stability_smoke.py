"""The runtime smoke must distinguish reclamation from lost geometry/recovery."""

import copy
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from smoke_runtime_stability import (  # noqa: E402
  MODES,
  reclamation_evidence,
  validate_runtime_transition,
  validate_source,
)


def pose(mode: str, runtime: int) -> dict:
  return {
    "mode": mode,
    "runtime": runtime,
    "position": [4, 5, 6],
    "target": [1, 2, 3],
    "fov": 39,
    "near": 0.1,
    "enabled": False,
    "requested": False,
  }


@pytest.fixture
def sources() -> list[dict]:
  return [
    {
      "family": "drawn",
      "count": 1,
      "visible": True,
      "uuid": "source-root",
      "triangles": 10,
      "renderables": 2,
      "bytes": 1200,
      "declaredBytes": 1200,
      "parents": 2,
      "chunks": 1,
      "bufferCount": 3,
      "arrayContent": "same-byte-digests",
      "sourceGpuDisposals": 0,
    },
    {"family": "native", "count": 0, "visible": False},
  ]


def test_route_exercises_every_mode_and_returns_after_minecraft() -> None:
  assert set(MODES) == {
    "day",
    "night",
    "snowstorm",
    "schwellenraum",
    "minecraft",
    "flood",
  }
  assert MODES[0] == MODES[-1] == "flood"
  assert MODES[-2] == "minecraft"


@pytest.mark.parametrize("touch", [False, True])
def test_drawn_switch_must_preserve_runtime_and_pose(touch: bool) -> None:
  validate_runtime_transition(pose("flood", 1), pose("night", 1), touch)
  with pytest.raises(AssertionError):
    validate_runtime_transition(pose("flood", 1), pose("night", 2), touch)
  changed = pose("night", 1)
  changed["position"][0] += 10
  with pytest.raises(AssertionError):
    validate_runtime_transition(pose("flood", 1), changed, touch)


def test_mobile_family_remount_is_required_but_desktop_keeps_its_runtime() -> None:
  validate_runtime_transition(pose("flood", 1), pose("minecraft", 2), True)
  validate_runtime_transition(pose("minecraft", 2), pose("flood", 3), True)
  validate_runtime_transition(pose("flood", 1), pose("minecraft", 1), False)
  with pytest.raises(AssertionError):
    validate_runtime_transition(pose("flood", 1), pose("minecraft", 1), True)
  with pytest.raises(AssertionError):
    validate_runtime_transition(pose("flood", 1), pose("minecraft", 2), False)


@pytest.mark.parametrize(
  "field", ["uuid", "triangles", "bytes", "arrayContent", "chunks"]
)
def test_source_loss_or_recreation_fails_even_with_live_gpu_buffers(
  sources: list[dict], field: str
) -> None:
  baseline = copy.deepcopy(validate_source(sources, "flood", None))
  sources[0][field] = (
    "changed" if isinstance(sources[0][field], str) else sources[0][field] + 1
  )
  with pytest.raises(AssertionError):
    validate_source(sources, "day", baseline)


def test_gpu_retirement_keeps_the_exact_resident_source(sources: list[dict]) -> None:
  baseline = copy.deepcopy(validate_source(sources, "day", None))
  sources[0]["sourceGpuDisposals"] += 20
  validate_source(sources, "flood", baseline)
  with pytest.raises(AssertionError):
    validate_source(sources, "minecraft", None)


@pytest.mark.parametrize(
  "defect", ["absent", "duplicate", "hidden", "empty", "both-visible"]
)
def test_absent_or_duplicate_real_source_fails(
  sources: list[dict], defect: str
) -> None:
  if defect == "absent":
    sources[0]["count"] = 0
  elif defect == "duplicate":
    sources[0]["count"] = 2
  elif defect == "hidden":
    sources[0]["visible"] = False
  elif defect == "empty":
    sources[0]["triangles"] = 0
  else:
    sources[1].update(count=1, visible=True)
  with pytest.raises(AssertionError):
    validate_source(sources, "flood", None)


def test_reclamation_needs_both_real_gl_deletion_and_preserved_same_runtime_source(
  sources: list[dict],
) -> None:
  before = {
    "pose": pose("day", 1),
    "view": "wide",
    "source": sources[0],
    "buffers": {"deletes": 0},
  }
  after = copy.deepcopy(before)
  after["view"] = "near"
  after["source"]["sourceGpuDisposals"] = 4
  assert reclamation_evidence([before, after]) == []
  after["buffers"]["deletes"] = 6
  assert reclamation_evidence([before, after])[0]["retainedSourceBytes"] == 1200
  after["pose"]["runtime"] = 2
  assert reclamation_evidence([before, after]) == []
  after["pose"]["runtime"] = 1
  after["source"]["arrayContent"] = "replacement-arrays"
  with pytest.raises(AssertionError):
    reclamation_evidence([before, after])
