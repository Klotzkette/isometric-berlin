"""The browser audit must reject the reported truncated Invalidenpark view."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
SPEC = importlib.util.spec_from_file_location(
  "water_smoke", SCRIPTS / "smoke_drawn_water.py"
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


@pytest.fixture
def complete_water() -> dict:
  return {
    "coarse": True,
    "ready": True,
    "water": 175,
    "basins": 37,
    "walls": 1,
    "genericExcluded": True,
    "rasterDouble": False,
    "names": [
      "basin water",
      "natural pond water",
      "smooth quay walls",
      "sunken walls",
      "sunken wall crown path",
      "basin and sunken wall ink",
    ],
    "wall": {"min": [354, 4, -1178.5], "max": [361, 11, -1139.4], "visible": True},
    "crown": {"min": [355, 5, -1178.4], "max": [360, 11.05, -1139.5], "visible": True},
    "ink": {"min": [334, 5, -1180], "max": [382, 12.05, -1121]},
  }


def test_browser_accepts_the_complete_sloped_memorial(complete_water: dict) -> None:
  MODULE.validate_report(complete_water)


@pytest.mark.parametrize(
  "defect", ["short_wall", "missing_crown", "generic_double", "raster_double"]
)
def test_browser_rejects_truncated_or_duplicate_water(
  complete_water: dict, defect: str
) -> None:
  if defect == "short_wall":
    complete_water["wall"]["max"][2] = -1172
  elif defect == "missing_crown":
    complete_water["crown"] = None
  elif defect == "generic_double":
    complete_water["genericExcluded"] = False
  else:
    complete_water["rasterDouble"] = True
  with pytest.raises(AssertionError):
    MODULE.validate_report(complete_water)
