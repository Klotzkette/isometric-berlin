"""Exact contour, source preservation, native occupancy and finite fountain cost."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_fountain_v248 as build  # noqa: E402

DATA = build.read(build.OUT)
EVIDENCE = build.read(build.EVIDENCE)


def test_replay_and_earlier_sources_are_unchanged():
  for name, digest in EVIDENCE["sourceSha256"].items():
    assert build.sha(ROOT / name) == digest
  data, evidence = build.build()
  assert data == DATA
  assert json.loads(json.dumps(evidence)) == EVIDENCE
  assert len(DATA["boxes"]) == 88
  assert len(DATA["nativeRows"]) == 217
  assert EVIDENCE["counts"]["drawnAttributeBytes"] <= 12000
  assert EVIDENCE["counts"]["nativeAttributeBytes"] <= 18000


def test_full_rim_contour_and_open_inner_basin_match_existing_plaza_hole():
  outer, inner = shape(EVIDENCE["worldContour"]), shape(EVIDENCE["innerContour"])
  plaza = shape(
    build.read(build.GEO / "hermann-ehlers-v247-evidence.json")["worldGeometry"]
  )
  assert outer.equals(Polygon(plaza.geoms[0].interiors[0]))
  assert outer.intersection(plaza).area < 1e-8
  for surface in DATA["surfaces"]:
    triangles = [Polygon([(p[0], p[2]) for p in t]) for t in surface["triangles"]]
    expected = inner if surface["color"] == build.WATER else outer.difference(inner)
    assert unary_union(triangles).symmetric_difference(expected).area < 1e-8
    assert abs(sum(p.area for p in triangles) - expected.area) < 1e-8
    for a, b, c in surface["triangles"]:
      assert np.cross(np.subtract(b, a), np.subtract(c, a))[1] > 0
  rim = outer.difference(inner)
  for row in DATA["boxes"]:
    area = build.footprint(row)
    assert outer.buffer(1e-5).covers(area)
    if row[-1] not in [build.METAL, build.JET]:
      assert rim.buffer(1e-5).covers(area)
    assert row[1] - row[4] / 2 >= build.GROUND - 1e-5
  # Complete ring cap retains every source vertex; no catalogue-size proxy.
  vertices = {
    tuple(p[::2]) for s in DATA["surfaces"] for t in s["triangles"] for p in t
  }
  assert set(outer.exterior.coords) <= vertices


def test_independent_native_rectangles_represent_every_complete_source_cell():
  outer, inner = shape(EVIDENCE["worldContour"]), shape(EVIDENCE["innerContour"])
  groups = [
    (outer.buffer(-0.16, join_style=2).difference(inner), build.BASE, 3.025, 3.225),
    (outer.buffer(-0.08, join_style=2).difference(inner), build.MID, 3.225, 3.425),
    (outer.difference(inner), build.BRICK, 3.425, 3.625),
    (inner, build.CONCRETE, 3.025, 3.155),
    (inner, build.WATER, 3.155, 3.18),
  ]
  for polygon, color, low, high in groups:
    expected = []
    for x in range(math.floor(polygon.bounds[0] * 4), math.ceil(polygon.bounds[2] * 4)):
      for z in range(
        math.floor(polygon.bounds[1] * 4), math.ceil(polygon.bounds[3] * 4)
      ):
        cell = box(x / 4, z / 4, (x + 1) / 4, (z + 1) / 4)
        if polygon.covers(cell):
          expected.append(cell)
    rows = [r for r in DATA["nativeRows"] if r[-1] == color]
    actual = [build.footprint(r, True) for r in rows]
    assert unary_union(actual).equals(unary_union(expected))
    assert abs(sum(p.area for p in actual) - unary_union(actual).area) < 1e-8
    for r in rows:
      assert len(r) == 7 and min(r[3:6]) > 0
      assert abs(r[1] - r[4] / 2 - low) < 1e-6
      assert abs(r[1] + r[4] / 2 - high) < 1e-6
  for rows in [DATA["boxes"], DATA["nativeRows"]]:
    jets = [r for r in rows if r[-1] == build.JET]
    assert len(jets) == 3
    assert sorted(round(r[1] + r[4] / 2, 3) for r in jets) == [3.65, 3.65, 4.25]
