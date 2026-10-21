"""Source containment and bounded cost for the Reichstag public realm."""

from __future__ import annotations

import importlib.util
import json
import math
from pathlib import Path

from shapely.geometry import LineString, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
  "reichstag_public_v256", ROOT / "scripts/build_reichstag_public_v256.py"
)
assert SPEC and SPEC.loader
BUILD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILD)
SOURCE = json.loads(BUILD.SOURCE.read_text())
DATA = json.loads(BUILD.OUTPUT.read_text())


def test_replay_retains_source_roads_surfaces_and_buildings():
  assert BUILD.build(SOURCE) == DATA
  assert BUILD.sha(BUILD.SOURCE) == DATA["sourceSha256"]
  for name, digest in SOURCE["retainedFiles"].items():
    assert BUILD.sha(ROOT / name) == digest
  assert {f["id"] for f in SOURCE["fountains"]} == BUILD.FOUNTAINS
  assert {f["tags"]["name"] for f in SOURCE["roads"]} == {
    "Ebertstraße",
    "Paul-Löbe-Allee",
    "Scheidemannstraße",
  }
  assert all(f["tags"]["fountain"] == "splash_pad" for f in SOURCE["fountains"])


def test_every_fountain_member_stays_in_its_exact_narrow_source_owner():
  owners = {f["id"]: shape(f["geometry"]) for f in SOURCE["fountains"]}
  for owner in DATA["owners"]:
    polygon = owners[owner["id"]]
    assert len(polygon.geoms) == 1
    assert len(polygon.geoms[0].exterior.coords) == 5
    for field, mode, native in [
      ("boxes", "drawn", False),
      ("nativeRows", "native", True),
    ]:
      start, end = owner[mode]
      rows = DATA[field][start:end]
      assert rows and all(
        polygon.buffer(1e-5).covers(BUILD.row_footprint(r, native)) for r in rows
      )
      # Water remains a small static, individually fitted recognition detail.
      assert all(r[1] - r[4] / 2 >= 0.21 for r in rows)
      assert max(r[1] + r[4] / 2 for r in rows) < 1.4
    assert polygon.bounds[0] > -3 and polygon.bounds[2] < 86
    assert polygon.bounds[1] > -161 and polygon.bounds[3] < -118


def test_kerbs_use_existing_courses_and_independent_native_source_cells():
  district = json.loads(BUILD.DISTRICT.read_text())
  old = unary_union([LineString(p) for p in district["curbs_m"]])
  selected = unary_union([LineString(f["points"]) for f in SOURCE["kerbs"]])
  assert selected.difference(old.buffer(1e-7)).length < 1e-5
  support = unary_union(
    [
      LineString(f["points"]).buffer(0.11, cap_style=2, join_style=2)
      for f in SOURCE["kerbs"]
    ]
  )
  count = DATA["counts"]
  drawn = DATA["boxes"][count["drawnFountainMembers"] :]
  start = count["nativeFountainMembers"]
  native_caps = DATA["nativeRows"][start : start + count["nativeKerbMembers"]]
  native_joints = DATA["nativeRows"][start + count["nativeKerbMembers"] :]
  assert len(drawn) == len(native_joints) == count["curbJoints"] == 874
  for rows, native in [(drawn, False), (native_joints, True), (native_caps, True)]:
    for row in rows:
      assert support.buffer(1e-5).covers(BUILD.row_footprint(row, native))
  caps = [BUILD.row_footprint(row, True) for row in native_caps]
  joined = unary_union(caps)
  assert abs(sum(p.area for p in caps) - joined.area) < 1e-6
  assert joined.area > support.area * 0.4
  for row in native_caps:
    assert abs(row[1] - row[4] / 2 - 0.18) < 1e-7
    assert abs(row[1] + row[4] / 2 - 0.32) < 1e-7
    for value in BUILD.row_footprint(row, True).bounds:
      assert math.isclose(value * 10, round(value * 10), abs_tol=1e-7)
  # Every joint centre is retained; neither mode shifts the street course.
  assert [r[::2][:2] for r in drawn] == [r[::2][:2] for r in native_joints]


def test_finite_texture_free_detail_has_fixed_budget_without_new_surface_meshes():
  counts = DATA["counts"]
  assert counts["fountains"] == 20 and counts["jets"] == 134
  for field, stride, key in [("boxes", 8, "drawn"), ("nativeRows", 7, "native")]:
    rows = DATA[field]
    assert all(len(r) == stride and all(math.isfinite(v) for v in r) for r in rows)
    assert all(min(r[3:6]) > 0 for r in rows)
    assert len(rows) == counts[f"{key}Members"]
    assert len(rows) * 76 == counts[f"{key}InstanceBytes"]
  assert counts["drawnInstanceBytes"] < 100_000
  assert counts["nativeInstanceBytes"] < 190_000
  assert BUILD.OUTPUT.stat().st_size < 280_000
  assert set(DATA) == {
    "schemaVersion",
    "sourceSha256",
    "boxes",
    "nativeRows",
    "owners",
    "counts",
  }
