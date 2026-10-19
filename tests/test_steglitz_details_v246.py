"""Preservation, surface attachment and bounded source-road checks for v246."""

from __future__ import annotations

import importlib.util
import json
import math
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, shape

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
  "steglitz246", ROOT / "scripts/build_steglitz_details_v246.py"
)
assert SPEC and SPEC.loader
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)
DATA = M.read(M.OUT)
E = M.read(M.EVIDENCE)


def footprint(row: list, native: bool = False) -> Polygon:
  x, _, z, w, _, d = row[:6]
  a = 0 if native else row[6]
  t = np.array([math.cos(a), -math.sin(a)])
  n = np.array([math.sin(a), math.cos(a)])
  return Polygon(
    [
      np.array([x, z]) + t * s * w / 2 + n * q * d / 2
      for s, q in [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    ]
  )


def test_original_sources_packets_and_rebuild_are_exact() -> None:
  for path, digest in (E["sourceSha256"] | E["packetSha256"]).items():
    assert M.sha(ROOT / path) == digest
  built, evidence = M.build()
  assert built == DATA
  assert json.loads(json.dumps(evidence)) == E
  assert len(DATA["boxes"]) < 600
  assert len(DATA["nativeRows"]) < 1200


def test_school_panes_preserve_original_opening_register_and_frame_clearance() -> None:
  source = M.read(M.DATA / "steglitzV182Source.json")
  assert len(E["panes"]) == 102
  assert len({p["index"] for p in E["panes"]}) == 102
  for i, p in enumerate(E["panes"]):
    original = source["boxes"][p["index"]]
    assert original[7] == 0x51666A
    assert p["owner"] == M.SCHOOL
    assert p["nativeSupports"]
    n = np.array(p["normal"])
    for row in DATA["boxes"][i * 3 : i * 3 + 3]:
      offset = float((np.array(row[:3]) - original[:3]) @ n)
      assert offset - row[5] / 2 > original[5] / 2 + 0.02
      # Old v205 frames are 0.34m from wall, back surface at0.2925m.
      assert 0.055 + offset + row[5] / 2 < 0.2925
      assert row[3] <= original[3] and row[4] <= original[4]


def test_native_school_glass_is_on_actual_original_orthogonal_skin() -> None:
  original = M.read(M.DATA / "steglitzV182Native.json")["boxes"]
  checked = 0
  for row in DATA["nativeRows"][: E["counts"]["schoolNative"]]:
    if row[6] not in [0x8A9E9D, 0xB8C5C2]:
      continue
    x, y, z, w, h, d = row[:6]
    for yy in [y - h * 0.45, y, y + h * 0.45]:
      for zz in [z - d * 0.45, z, z + d * 0.45]:
        assert any(
          abs(b[0] + b[3] / 2 - (x - 0.035)) < 0.0002
          and b[1] - b[4] / 2 - 0.0002 <= yy <= b[1] + b[4] / 2 + 0.0002
          and b[2] - b[5] / 2 - 0.0002 <= zz <= b[2] + b[5] / 2 + 0.0002
          for b in original
        ), row
    checked += 1
  assert checked >= 200


def test_memorial_keeps_nine_panels_and_both_faces() -> None:
  source = M.read(M.DATA / "steglitzV182Source.json")
  panels = [r for r in source["boxes"] if r[3] == 0.985 and r[4] == 3.5]
  assert len(panels) == E["counts"]["mirrorPanels"] == 9
  rows = DATA["boxes"][
    E["counts"]["schoolDrawn"] : E["counts"]["schoolDrawn"]
    + E["counts"]["memorialDrawn"]
  ]
  for r in panels:
    n = np.array([math.sin(r[6]), 0, math.cos(r[6])])
    t = np.array([math.cos(r[6]), 0, -math.sin(r[6])])
    attached = [a for a in rows if abs(float((np.array(a[:3]) - r[:3]) @ t)) < 0.49]
    sides = {1 if float((np.array(a[:3]) - r[:3]) @ n) > 0 else -1 for a in attached}
    assert sides == {-1, 1}
    assert all(3.55 <= a[1] - a[4] / 2 and a[1] + a[4] / 2 <= 7.05 for a in attached)
  assert {r[3] for r in E["memorialNativeSupports"]} == {-1, 1}


def test_street_fittings_respect_tagged_road_and_do_not_invent_crossings() -> None:
  roads = [
    shape(r["geometry"]).buffer(
      float(r["tags"]["width"]) / 2, cap_style=2, join_style=2
    )
    for r in E["roads"]
  ]
  assert [r["id"] for r in E["roads"]] == ["451621864", "483483276"]
  assert all(r["tags"]["cycleway:right:surface:colour"] == "green" for r in E["roads"])
  assert all(
    r["greenSegments"] > 0 and r["priorAsphaltOverlapM2"] == 0 for r in E["roads"]
  )
  for key, count, native in [
    ("boxes", "roadDrawn", False),
    ("nativeRows", "roadNative", True),
  ]:
    for row in DATA[key][-E["counts"][count] :]:
      assert any(r.buffer(0.025).covers(footprint(row, native)) for r in roads)
      assert 3.07 <= row[1] - row[4] / 2 < row[1] + row[4] / 2 <= 3.13
  assert (
    len(
      [
        r
        for r in DATA["boxes"][-E["counts"]["roadDrawn"] :]
        if r[-1] == 0xDEDCCD and r[3] > 1.9
      ]
    )
    > 10
  )
