"""Flood browser evidence must contain a real, single, reusable water mesh."""

import copy
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from smoke_flood_mode import (  # noqa: E402
  flood_url,
  validate_depth_change,
  validate_water,
)


@pytest.fixture
def water_sample() -> dict:
  return {
    "mode": "flood",
    "depth": 3,
    "water": [
      {
        "uuid": "one-water",
        "geometryUuid": "retained-geometry",
        "materialUuid": "retained-shader",
        "cpuBuffers": {"position": [1, 2, 3], "index": [4, 5, 6]},
        "gpuBuffers": {"position": 7, "index": 8},
        "offsetY": 0,
        "surfaceY": 7.2,
        "visible": True,
        "positions": 20,
        "indices": 48,
        "bytes": 640,
        "textures": 0,
        "depthWrite": True,
      }
    ],
  }


def test_visible_flood_and_hidden_day_reuse_the_same_water(water_sample: dict) -> None:
  identity = copy.deepcopy(water_sample["water"][0])
  validate_water(water_sample, "flood", identity)
  water_sample["mode"] = "day"
  water_sample["water"][0]["visible"] = False
  validate_water(water_sample, "day", identity)


@pytest.mark.parametrize("defect", ["missing", "duplicate", "wrong-mode", "hidden"])
def test_missing_duplicate_and_wrong_mode_water_fail(
  water_sample: dict,
  defect: str,
) -> None:
  identity = copy.deepcopy(water_sample["water"][0])
  if defect == "missing":
    water_sample["water"] = []
  elif defect == "duplicate":
    water_sample["water"].append(copy.deepcopy(identity))
  elif defect == "wrong-mode":
    water_sample["mode"] = "day"
  else:
    water_sample["water"][0]["visible"] = False
  with pytest.raises(AssertionError):
    validate_water(water_sample, "flood", identity)


@pytest.mark.parametrize(
  ("field", "value"),
  [
    ("uuid", "second-water"),
    ("geometryUuid", "rebuilt"),
    ("materialUuid", "rebuilt-shader"),
    ("cpuBuffers", {"position": [1, 9, 10], "index": [4, 5, 6]}),
    ("bytes", 1024),
    ("indices", 0),
    ("positions", 0),
    ("textures", 1),
    ("depthWrite", False),
    ("offsetY", 3),
    ("surfaceY", 10.2),
  ],
)
def test_rebuilt_empty_or_heavier_water_fails(
  water_sample: dict,
  field: str,
  value: object,
) -> None:
  identity = copy.deepcopy(water_sample["water"][0])
  water_sample["water"][0][field] = value
  with pytest.raises(AssertionError):
    validate_water(water_sample, "flood", identity)


@pytest.mark.parametrize("size", [0, 2 * 1024 * 1024])
def test_stable_but_empty_or_oversized_water_fails(
  water_sample: dict, size: int
) -> None:
  water_sample["water"][0]["bytes"] = size
  identity = copy.deepcopy(water_sample["water"][0])
  with pytest.raises(AssertionError):
    validate_water(water_sample, "flood", identity)


def test_cold_flood_url_preserves_host_path_and_unrelated_query() -> None:
  url = flood_url("https://example.test/berlin/?theme=night&lang=de&custom=1#old-view")
  parts = urlsplit(url)
  assert parts.scheme == "https" and parts.netloc == "example.test"
  assert parts.path == "/berlin/" and not parts.fragment
  assert parse_qs(parts.query) == {"theme": ["flood"], "lang": ["en"], "custom": ["1"]}


@pytest.mark.parametrize("depth", [3, 6, 21])
def test_depth_controls_move_only_existing_water(
  water_sample: dict, depth: int
) -> None:
  after = copy.deepcopy(water_sample)
  after["depth"] = depth
  after["water"][0].update(offsetY=depth - 3, surfaceY=4.2 + depth)
  validate_depth_change(water_sample, after, depth)
  after["mode"] = "day"
  after["water"][0]["visible"] = False
  validate_water(after, "day", water_sample["water"][0], depth)


@pytest.mark.parametrize("depth", [0, 4, 12, 22])
def test_unsupported_selected_depth_fails(water_sample: dict, depth: int) -> None:
  water_sample["depth"] = depth
  with pytest.raises(AssertionError):
    validate_water(water_sample, "flood", water_sample["water"][0], depth)


def test_control_cannot_report_a_depth_that_runtime_did_not_apply(
  water_sample: dict,
) -> None:
  with pytest.raises(AssertionError):
    validate_water(water_sample, "flood", water_sample["water"][0], 6)


@pytest.mark.parametrize("gpu_buffers", [{}, {"position": None, "index": 8}])
def test_unuploaded_water_cannot_prove_gpu_reuse(
  water_sample: dict, gpu_buffers: dict
) -> None:
  water_sample["water"][0]["gpuBuffers"] = gpu_buffers
  with pytest.raises(AssertionError):
    validate_depth_change(water_sample, copy.deepcopy(water_sample), 3)


def test_new_gpu_handle_fails_even_when_cpu_arrays_stay_identical(
  water_sample: dict,
) -> None:
  after = copy.deepcopy(water_sample)
  after["water"][0]["gpuBuffers"]["position"] = 9
  with pytest.raises(AssertionError):
    validate_depth_change(water_sample, after, 3)
