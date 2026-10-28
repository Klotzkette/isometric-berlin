"""The fountain transaction preserves sources and retires only its exact proxy."""

import hashlib
import json
from pathlib import Path

from shapely.geometry import box

from scripts.build_weltkugel_ownership_v281 import build, polygon


def test_reproducible_fountain_receipt_and_immutable_inputs():
  data = json.loads(Path("src/app/src/data/weltkugelV281Ownership.json").read_bytes())
  assert build() == data
  assert [p["id"] for p in data["previousPrisms"]] == ["20866116"]
  assert data["previousPrisms"][0]["h_dm"] == 90
  assert len(data["columns"]) == 17
  assert not data["retainedSharedColumns"]
  for row in data["inputs"]:
    assert hashlib.sha256(Path(row["path"]).read_bytes()).hexdigest() == row["sha256"]


def test_only_intersecting_source_columns_are_retired():
  data = build()
  footprint = polygon(data["previousPrisms"][0])
  assert footprint.is_valid
  assert len(footprint.exterior.coords) == 27
  assert 279 < footprint.area < 282
  for x, z, low, high, kind in data["columns"]:
    assert footprint.intersection(box(x * 4, z * 4, x * 4 + 4, z * 4 + 4)).area > 0
    assert (low, high, kind) == (52, 172, 3)
