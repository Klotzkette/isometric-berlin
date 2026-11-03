"""Actual client guards cannot silently alter the immutable local contact."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import box

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_core_runtime_delta_v310 import (  # noqa: E402
  SOURCE_SHA,
  match_local_rows_v310,
)

DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
DELTA_SHA = "fc64c21cbccbd17ae0d10748a07c06ac992d6b34c08dc080c8b9c158bda58a76"


def rows(points: list[tuple[float, float, float]]) -> dict:
  matrices = np.tile(np.eye(4, dtype="<f4").T.reshape(1, 16), (len(points), 1))
  matrices[:, [0, 5, 10]] = 1
  matrices[:, [12, 13, 14]] = points
  colors = np.tile(np.array([0.25, 0.5, 0.75], dtype="<f4"), (len(points), 1))
  return {
    "instances": {
      "count": len(points),
      "matrix": base64.b64encode(matrices.tobytes()).decode(),
      "colors": base64.b64encode(colors.tobytes()).decode(),
    }
  }


def test_actual_derivative_preserves_all_original_core_source_bytes():
  assert (
    hashlib.sha256((DATA / "coreTerrainContactV307.json").read_bytes()).hexdigest()
    == SOURCE_SHA
  )
  assert (
    hashlib.sha256((DATA / "coreTerrainActualV310.json").read_bytes()).hexdigest()
    == DELTA_SHA
  )
  delta = json.loads((DATA / "coreTerrainActualV310.json").read_text())
  proof = json.loads(
    gzip.decompress((GEO / "core-terrain-actual-v310-evidence.json.gz").read_bytes())
  )
  assert delta["baseSourceSha256"] == proof["baseSourceSha256"] == SOURCE_SHA
  assert set(delta["variants"]) == {"drawn-initial", "minecraft"}
  assert delta["baseVariantControls"] == {
    "drawn-initial": 691981172,
    "drawn-worker": 2745148416,
    "minecraft": 398998653,
  }
  base = json.loads((DATA / "coreTerrainContactV307.json").read_text())
  assert len(base["meshes"]) == 20
  for p in proof["parts"]:
    key = p["variant"]
    patch = delta["variants"][key]
    assert set(patch) == {"basePartControl", "captureSha256", "instances", "retire"}
    assert p["omittedOriginalLocalRows"] == p["newUnmatchedLocalRows"] == 0
    assert p["actualLocalRowsExactlyEqual"] is True
    assert p["oldLocalOrderedWordsSha256"] == p["actualLocalInOldOrderWordsSha256"]
    assert patch["retire"] == sorted(set(patch["retire"]))
    assert (
      len(patch["retire"])
      == p["localRows"]
      == len(base["variants"][key]["parts"][0]["retire"])
    )
    assert patch["captureSha256"] == p["actualCaptureSha256"]
    assert patch["instances"] == p["actualGuards"]
    assert max(patch["retire"]) < patch["instances"]["count"]


def test_exact_local_remapping_allows_unrelated_global_source_changes():
  old = rows([(50, 0, 50), (1, 3, 1), (2, 4, 2), (90, 0, 90)])
  actual = rows([(1, 3, 1), (80, -1, 80), (2, 4, 2)])
  retired, _, _, _ = match_local_rows_v310(old, actual, box(0, 0, 4, 4), [1, 2])
  assert retired == [0, 2]


@pytest.mark.parametrize(
  "damage", ["missing", "new-local", "paint", "geometry", "duplicate", "reorder"]
)
def test_guard_only_derivative_rejects_every_local_source_difference(damage):
  old = rows([(1, 3, 1), (2, 4, 2)])
  actual = copy.deepcopy(old)
  if damage == "missing":
    actual = rows([(1, 3, 1)])
  elif damage == "new-local":
    actual = rows([(1, 3, 1), (2, 4, 2), (3, 4, 3)])
  elif damage == "geometry":
    actual = rows([(1, 3.000001, 1), (2, 4, 2)])
  elif damage == "duplicate":
    actual = rows([(1, 3, 1), (2, 4, 2), (1, 3, 1)])
  elif damage == "reorder":
    actual = rows([(2, 4, 2), (1, 3, 1)])
  else:
    color = bytearray(base64.b64decode(actual["instances"]["colors"]))
    color[0] ^= 1
    actual["instances"]["colors"] = base64.b64encode(color).decode()
  with pytest.raises(ValueError):
    match_local_rows_v310(old, actual, box(0, 0, 4, 4), [0, 1])
