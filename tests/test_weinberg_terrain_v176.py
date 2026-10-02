"""The small viewer profile retains official elevations, datum and bounded scope."""

import json

import pytest

from scripts.weinberg_terrain_v176 import (
  DEST,
  SOURCE,
  build_profile,
  building_offset,
  sample_offset,
  terrain_weight,
)


def test_committed_profile_reproduces_authoritative_samples() -> None:
  assert json.loads(DEST.read_text()) == json.loads(json.dumps(build_profile()))
  samples = json.loads(SOURCE.read_text())["namedSamples"]
  for sample in samples[:12]:
    x, z = sample["queryWorldXZ"]
    assert terrain_weight(x, z) == pytest.approx(1)
    assert 3 + sample_offset(x, z) == pytest.approx(sample["heightNHN"] - 30, abs=0.25)


def test_scene_datum_and_rigid_source_placement() -> None:
  assert building_offset(53.332, 3, 2231.897, -1706.217) == 20.33
  assert building_offset(53.332, 5.245, 2231.897, -1706.217) == 18.09
  for x, z in [(0, 0), (1820, -1600), (2600, -1700), (2200, -2100)]:
    assert sample_offset(x, z) == 0
    assert building_offset(53.332, 3, x, z) == 0
