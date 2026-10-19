"""Source preservation, support, markings and independent native street tests."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_schlossstrasse_v247 as build  # noqa: E402

DATA = build.base.read(build.OUT)
EVIDENCE = build.base.read(build.EVIDENCE)


def footprint(row, native=False):
  x, _, z, width, _, depth = row[:6]
  angle = 0 if native else row[6]
  t = np.asarray([math.cos(angle), -math.sin(angle)])
  n = np.asarray([math.sin(angle), math.cos(angle)])
  return Polygon(
    [
      np.asarray([x, z]) + a * width / 2 * t + b * depth / 2 * n
      for a, b in [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    ]
  )


def test_sources_and_finite_payload_are_deterministic_and_preserved():
  for path, digest in EVIDENCE["sourceSha256"].items():
    assert build.base.sha(ROOT / path) == digest
  data, evidence = build.build()
  assert data == DATA
  assert json.loads(json.dumps(evidence)) == EVIDENCE
  assert len(DATA["boxes"]) == 69
  assert len(DATA["nativeRows"]) == 240
  assert len(DATA["boxes"]) <= 450 and len(DATA["nativeRows"]) <= 520
  assert {r["id"] for r in EVIDENCE["roads"]}.isdisjoint(EVIDENCE["excludedPriorWays"])
  assert all(
    t["y"] == 3 and t["rgb"] == [125, 131, 103]
    for t in EVIDENCE["sourceGroundTriangles"]
  )
  assert 63 < EVIDENCE["roadLengthM"] < 64


def test_all_paint_has_exact_mapped_lane_support_and_existing_ground_datum():
  roads = {r["id"]: r for r in EVIDENCE["roads"]}
  mapped = unary_union(
    [
      shape(r["geometry"]).buffer(
        float(r["tags"]["width"]) / 2, cap_style=2, join_style=2
      )
      for r in roads.values()
    ]
  )
  drawn_floor = unary_union(
    [footprint(r) for r in DATA["boxes"] if r[-1] == build.ASPHALT]
    + [
      Polygon([(p[0], p[2]) for p in tri])
      for s in DATA["surfaces"]
      for tri in s["triangles"]
    ]
  )
  assert mapped.difference(drawn_floor).area < 1e-5
  native_floor = unary_union(
    [footprint(r, True) for r in DATA["nativeRows"] if r[6] == build.ASPHALT]
  )
  for paint in EVIDENCE["paint"]:
    r = roads[paint["id"]]
    local = shape(r["geometry"]).buffer(
      float(r["tags"]["width"]) / 2, cap_style=2, join_style=2
    )
    assert local.buffer(0.025).covers(shape(paint["polygon"]))
    assert r["tags"]["cycleway:right:marking:both"] == "dashed_line"
    if paint["kind"] == "red":
      assert r["tags"]["cycleway:right:surface:colour"] == "red"
  for native, rows in [(False, DATA["boxes"]), (True, DATA["nativeRows"])]:
    for r in rows:
      colour = r[-1]
      p = footprint(r, native)
      if colour == build.KERB:
        continue
      assert mapped.buffer(0.025).covers(p)
      assert r[1] - r[4] / 2 >= 3 - 0.0001
      if colour == build.ASPHALT:
        assert abs(r[1] + r[4] / 2 - 3.09) < 0.0001
      elif not native:
        assert drawn_floor.buffer(0.001).covers(p)
      elif native:
        assert native_floor.buffer(0.0003).covers(p)
        assert r[1] + r[4] / 2 <= 3.1261


def test_native_curbs_follow_mapped_paths_and_lowered_crossings_stay_low():
  kerbs = {r["id"]: r for r in EVIDENCE["kerbs"]}
  for record in EVIDENCE["nativeKerbSupports"]:
    assert (
      shape(kerbs[record["id"]]["geometry"])
      .buffer(0.25)
      .covers(shape(record["footprint"]))
    )
  lowered = unary_union(
    [
      shape(r["geometry"]).buffer(0.22)
      for r in kerbs.values()
      if r["tags"].get("kerb") == "lowered"
    ]
  )
  for r in DATA["nativeRows"]:
    if r[6] != build.KERB:
      continue
    assert abs(r[1] - r[4] / 2 - 3) < 0.0001
    if lowered.covers(footprint(r, True)):
      assert r[1] + r[4] / 2 <= 3.1051
  # Every road paint tile has a real local floor; no hidden native infill or
  # rotated diagonal source box is needed to make the lane readable.
  assert all(len(r) == 7 and all(v > 0 for v in r[3:6]) for r in DATA["nativeRows"])
