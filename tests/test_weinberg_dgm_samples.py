"""The official terrain extract must preserve coordinates, datum and raw heights."""

from __future__ import annotations

import json

import numpy as np
import pytest

from scripts.build_weinberg_dgm_samples import (
  DEST,
  GRID,
  SOURCE_HASHES,
  sample_height,
  tile_code,
)


@pytest.mark.parametrize(
  ("east", "north", "expected"),
  [(391999.9, 5821999.9, "390_5820"), (392000.0, 5822000.0, "392_5822")],
)
def test_dgm_tile_seams(east: float, north: float, expected: str) -> None:
  assert tile_code(east, north) == expected


def test_source_centres_keep_north_to_negative_z_transform() -> None:
  tiles = {
    code: np.broadcast_to(np.array(47.23), (2000, 2000)) for code in SOURCE_HASHES
  }
  nhn, x, z, code = sample_height(tiles, 2499.9, -2000.1)
  assert (nhn, x, z, code) == (47.23, 2499.5, -2000.5, "390_5822")
  assert sample_height(tiles, 2500.0, -2000.0) == (47.23, 2500.5, -2000.5, "392_5822")


def test_committed_evidence_retains_measured_hill_and_datum() -> None:
  payload = json.loads(DEST.read_text())
  heights = np.asarray(payload["heightsNHN"])
  assert heights.shape == (GRID["height"], GRID["width"])
  assert np.isfinite(heights).all()
  assert payload["grid"] == GRID
  assert payload["horizontalCrs"] == "EPSG:25833"
  assert payload["verticalDatum"] == "DHHN2016 / NHN, EPSG:7837"
  assert payload["sourceResolutionM"] == 1
  assert payload["license"] == "dl-de/zero-2-0"
  assert {row["tile"]: row["archiveSha256"] for row in payload["sourceFiles"]} == (
    SOURCE_HASHES
  )
  named = {row["name"]: row for row in payload["namedSamples"]}
  assert named["Zionskirche"]["heightNHN"] == 53.52
  assert named["Rosenthaler Platz"]["heightNHN"] == 37.12
  assert named["Weinbergspark blue playground"]["heightNHN"] == 50.62
  assert named["Pappelallee beginning"]["heightNHN"] == 49.41
  for row in named.values():
    assert row["worldYAtNHNMinus30"] == round(row["heightNHN"] - 30, 2)
    assert all(value % 1 == 0.5 for value in row["sourceWorldXZ"])
