"""Flood browser evidence must contain a real, single, reusable water mesh."""

import copy
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from smoke_flood_mode import flood_url, validate_water  # noqa: E402


@pytest.fixture
def water_sample() -> dict:
  return {
    "mode": "flood",
    "water": [
      {
        "uuid": "one-water",
        "geometryUuid": "retained-geometry",
        "materialUuid": "retained-shader",
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
    ("bytes", 1024),
    ("indices", 0),
    ("positions", 0),
    ("textures", 1),
    ("depthWrite", False),
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
