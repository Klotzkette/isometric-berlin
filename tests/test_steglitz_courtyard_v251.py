"""Photographed courtyard features, full shell preservation and native clearances."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, box

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
  "steglitz_courtyard_v251", ROOT / "scripts/build_steglitz_courtyard_v251.py"
)
assert spec and spec.loader
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)


def payloads():
  return M.read(M.OUT), M.read(M.EVIDENCE)


def decode(data, key):
  result = []
  rod = key == "rods"
  for row in data[key]:
    q = []
    for i, v in enumerate(row):
      if i == len(row) - 1:
        q.append(data["palette"][v])
      elif i < (7 if rod else 6):
        q.append(v / 100 + (data["origin"][i % 3] if i < (6 if rod else 3) else 0))
      else:
        q.append(v / 10000)
    result.append(q)
  return result


def test_sources_front_hall_and_rebuild_remain_exact():
  data, ev = payloads()
  for path, digest in ev["sourceSha256"].items():
    assert M.sha(ROOT / path) == digest
  built, evidence = M.build()
  assert built == data
  assert json.loads(json.dumps(evidence)) == ev
  assert data["counts"]["aulaArches"] == 3
  assert data["counts"]["smallGableWindows"] == 5
  assert data["counts"]["modernWindowBands"] == 5
  assert data["counts"]["historicWingFloors"] == 3
  assert data["counts"]["historicWingWindowBays"] == 20
  assert M.OUT.stat().st_size < 160_000


def test_photographed_wings_have_three_tall_window_registers_and_blank_end():
  data, ev = payloads()
  boxes = decode(data, "boxes")
  for feature in ev["ranges"]:
    if feature["key"] not in M.WINGS:
      continue
    rows = boxes[slice(*feature["boxes"])]
    glazing = [r for r in rows if r[-1] == M.GLASS]
    bays = M.WINGS[feature["key"]]
    assert len(glazing) == bays * 3
    if bays:
      assert sorted({r[1] for r in glazing}) == M.WING_FLOORS
      assert all(r[4] == 3.0 and r[3] == 1.37 for r in glazing)
      assert all(sum(r[1] == y for r in glazing) == bays for y in M.WING_FLOORS)
    else:
      assert not glazing
      assert not any(r[-1] == M.CREAM for r in rows)
  source = M.read(M.DATA / "steglitzV182Source.json")
  removed = set(data["removeSourceBoxes"])
  for desc in ev["faces"]:
    if desc["key"] not in M.WINGS:
      continue
    face = M.Front(desc["rings"], desc["normal"], desc["key"], [])
    old = [i for i, row in enumerate(source["boxes"]) if face.owns(row, 0.2)]
    assert old and set(old) <= removed


def test_every_detail_is_attached_to_a_measured_wall_without_changing_its_shell():
  data, ev = payloads()
  faces = [M.Front(f["rings"], f["normal"], f["key"], []) for f in ev["faces"]]
  for row in decode(data, "boxes"):
    p = np.array(row[:3])
    assert any(
      0.12 < float((p - f.a) @ f.n) < 0.51
      and abs(row[6] - f.yaw) < 0.0002
      and f.wall.buffer(0.015).covers(
        box(
          float((p - f.a) @ f.d) - row[3] / 2,
          p[1] - row[4] / 2,
          float((p - f.a) @ f.d) + row[3] / 2,
          p[1] + row[4] / 2,
        )
      )
      for f in faces
    ), row
  for row in decode(data, "rods"):
    p, q = np.array(row[:3]), np.array(row[3:6])
    assert any(
      abs(float((p - f.a) @ f.n) - 0.29) < 0.015
      and abs(float((q - f.a) @ f.n) - 0.29) < 0.015
      and f.wall.buffer(0.02).covers(
        LineString(
          [(float((p - f.a) @ f.d), p[1]), (float((q - f.a) @ f.d), q[1])]
        ).buffer(row[6] / 2, cap_style=2)
      )
      for f in faces
    ), row
  native = decode(data, "nativeRows")
  assert all(len(r) == 7 and all(v > 0 for v in r[3:6]) for r in native)
  assert all(all(np.isfinite(v) for v in r) for r in native)


def test_replaced_old_windows_and_repainted_roofs_have_exact_ownership():
  data, ev = payloads()
  source = M.read(M.DATA / "steglitzV182Source.json")
  faces = [M.Front(f["rings"], f["normal"], f["key"], []) for f in ev["faces"]]
  previous = M.read(M.DATA / "steglitzSchoolV250.json")
  assert not set(data["removeSourceBoxes"]) & set(previous["remove"]["v182.boxes"])
  assert not {r[0] for r in data["surfaceColors"]} & {
    r[0] for r in previous["surfaceColors"]
  }
  assert not {r[0] for r in data["nativeColors"]} & {
    r[0] for r in previous["nativeColors"]
  }
  for index in data["removeSourceBoxes"]:
    assert any(f.owns(source["boxes"][index], 0.20) for f in faces)
  for index, color in data["surfaceColors"]:
    assert source["surfaces"][index]["owner"] == M.SCHOOL
    if color == M.ROOF:
      assert index in ev["tiledRoofIndices"]
      assert source["surfaces"][index]["color"] == 0x5A625D
  assert len(ev["tiledRoofIndices"]) >= 10
  assert {f["key"] for f in ev["faces"]} >= {
    "DEBE3DaafYxEtad7/4",
    "DEBE3DaafYxEtad7/8",
    "DEBE3DaafYxEtad7/13",
    "DEBE3DE7hShD6utU/1+2",
    "DEBE3DKr6xQqvvnx/0",
  }


def test_native_window_fronts_clear_all_old_source_supports():
  data, ev = payloads()
  native = M.read(M.DATA / "steglitzV182Native.json")["boxes"]
  for desc in ev["faces"]:
    f = M.Front(desc["rings"], desc["normal"], desc["key"], native)
    for u in np.linspace(0.5, f.length - 0.5, 5):
      rows = []
      f.native_member(rows, float(u), min(20.5, f.top - 2), 0.8, 1.2, M.GLASS, 0.13)
      for r in rows:
        support = [
          b
          for b in f.support
          if abs(b[f.cross] - r[f.cross]) < b[f.cross + 3] / 2 + 0.001
        ]
        assert support
        assert (
          min(
            f.sign * (r[f.axis] - b[f.axis]) - b[f.axis + 3] / 2 - 0.03 for b in support
          )
          > 0.099
        )
