"""Complete, additive Danziger courses with distinct native railheads."""

import importlib.util
import itertools
import json
import math
from pathlib import Path

import pytest
from shapely.geometry import LineString, Polygon, box
from shapely.ops import linemerge, unary_union

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def artifacts():
  spec = importlib.util.spec_from_file_location(
    "danziger_tram", ROOT / "scripts/build_danziger_tram_v249.py"
  )
  builder = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(builder)
  data, source = builder.build()
  return builder, data, source


def test_complete_source_replay_and_unchanged_original(artifacts):
  b, data, source = artifacts
  assert data == json.loads(b.OUT.read_bytes())
  assert source == json.loads(b.EVIDENCE.read_bytes())
  assert len(source["features"]) == 21
  assert {f["id"] for f in source["features"]} == set(b.TRACK_IDS + b.PLATFORM_IDS)
  assert source["sha256"] == b.sha(b.RAW)
  assert source["terrain"]["sha256"] == b.sha(b.TERRAIN)
  assert 5942 < source["sourceLengthM"] < 5943
  tracks = [
    LineString(f["coordinates"]) for f in source["features"] if f["id"] in b.TRACK_IDS
  ]
  merged = linemerge(unary_union(tracks))
  assert len(merged.geoms) == 2
  actual = [LineString(p) for p in data["rails"]]
  for track in merged.geoms:
    for side in [-1, 1]:
      expected = track.offset_curve(side * 0.7175, join_style="mitre")
      assert min(expected.hausdorff_distance(a) for a in actual) < 0.0001
  assert data["gauge"] == 1.435
  assert all(
    f["tags"]["gauge"] == "1435" for f in source["features"] if f["id"] in b.TRACK_IDS
  )


def test_all_native_railheads_are_complete_and_never_cross(artifacts):
  _, data, _ = artifacts
  native_areas = []
  for drawn, native in zip(data["rails"], data["nativeRails"], strict=True):
    # Every subdivided native span remains on the complete source-derived rail.
    original, path = LineString(drawn), LineString(native)
    assert path.hausdorff_distance(original) < 0.00015
    assert abs(path.length - original.length) < 0.001
    assert native[0] == drawn[0] and native[-1] == drawn[-1]
    blocks = []
    for a, b in zip(native, native[1:], strict=False):
      assert 0 < math.dist(a, b) <= 1.50015
      blocks.append(
        box(
          min(a[0], b[0]) - 0.05,
          min(a[1], b[1]) - 0.05,
          max(a[0], b[0]) + 0.05,
          max(a[1], b[1]) + 0.05,
        )
      )
    area = unary_union(blocks)
    assert area.covers(path)
    native_areas.append(area)
  for a, b in itertools.combinations(native_areas, 2):
    assert a.intersection(b).area == 0


def test_platform_geometry_and_vehicle_evidence_are_distinct(artifacts):
  b, data, source = artifacts
  assert len(data["floors"]) == 2
  for owner, floor in zip(b.PLATFORM_IDS, data["floors"], strict=True):
    axis = LineString(
      next(f["coordinates"] for f in source["features"] if f["id"] == owner)
    )
    area = Polygon(floor["ring"])
    assert abs(area.area - axis.length * 1.7) < 0.015
    assert floor["top"] == 3.4
    for r in data["nativeBoxes"][slice(*floor["native"])]:
      assert r[4] == 0.24
      assert abs(r[1] + r[4] / 2 - floor["top"]) < 0.00001
  assert source["tram"]["lengthM"] == 40
  assert source["tram"]["widthM"] == 2.4
  assert source["tram"]["modules"] == 7
  assert source["tram"]["animated"] is False
  assert source["references"][1]["credit"].startswith("Bombardier")
  assert all(
    len(r) == 7 and all(math.isfinite(v) for v in r) for r in data["nativeBoxes"]
  )


def test_finite_additions_and_replay_do_not_modify_old_packets(artifacts):
  b, data, _ = artifacts
  assert b.OUT.stat().st_size < 500_000
  assert data["counts"]["drawnRows"] * 76 == 74_556
  assert data["counts"]["nativeRows"] * 76 <= 700_000
  assert all(v > 0 for r in data["boxes"] + data["nativeBoxes"] for v in r[3:6])
  component = (ROOT / "src/app/src/DanzigerTramV249.ts").read_text()
  assert "new Mesh" not in component and "requestAnimationFrame" not in component
  assert "setInterval" not in component and "new Map" not in component
