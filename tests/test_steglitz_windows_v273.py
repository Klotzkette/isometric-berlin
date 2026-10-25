"""All remaining historic window estimates yield; modern and measured data stay."""

from __future__ import annotations

import importlib
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, box

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
M = importlib.import_module("build_steglitz_windows_v273")


def decode(data, key):
  rod = key == "rods"
  result = []
  for row in data[key]:
    values = []
    for i, value in enumerate(row):
      if i == len(row) - 1:
        values.append(data["palette"][value])
      elif i < (7 if rod else 6):
        values.append(
          value / 100 + (data["origin"][i % 3] if i < (6 if rod else 3) else 0)
        )
      else:
        values.append(value / 10000)
    result.append(values)
  return result


def test_rebuild_is_exact_and_every_prior_school_geometry_payload_is_unchanged():
  model, evidence = M.build()
  assert model == M.read(M.OUT)
  assert json.loads(json.dumps(evidence)) == M.read(M.EVIDENCE)
  for path, digest in evidence["sourceSha256"].items():
    assert M.sha(ROOT / path) == digest
  assert model["counts"]["auditedParts"] == 20
  assert model["counts"]["historicParts"] == 11
  assert model["counts"]["correctedFaces"] == 13
  assert model["counts"]["replacedOldRows"] == 328
  assert M.OUT.stat().st_size < 230_000


def test_complete_wall_inventory_removes_only_the_remaining_historic_estimates():
  data, ev = M.read(M.OUT), M.read(M.EVIDENCE)
  source = M.read(M.DATA / "steglitzV182Source.json")
  v250 = M.read(M.DATA / "steglitzSchoolV250.json")
  v251 = M.read(M.DATA / "steglitzCourtyardV251.json")
  old = set(v250["remove"]["v182.boxes"]) | set(v251["removeSourceBoxes"])
  removed = set(data["removeSourceBoxes"])
  assert not old & removed
  selected = {r["key"] for r in ev["faces"]}
  assert len(ev["protectedModernParts"]) == 9
  for row in ev["allWallSheets"]:
    if row["historic"] and row["remainingRows"]:
      assert row["key"] in selected
      assert set(row["remainingRows"]) <= removed
    else:
      assert row["key"] not in selected
      if not row["historic"]:
        assert not removed & set(row["oldRows"])
  for row in ev["faces"]:
    face = M.Front(row["rings"], row["normal"], row["key"], [])
    assert all(face.owns(source["boxes"][i], 0.20) for i in row["oldRows"])
    assert all(source["boxes"][i][-1] in {0x51666A, 0xDDD4BF} for i in row["oldRows"])
  prior_native = {r[0] for v in [v250, v251] for r in v["nativeColors"]}
  prior_surfaces = {r[0] for v in [v250, v251] for r in v["surfaceColors"]}
  assert not prior_native & {r[0] for r in data["nativeColors"]}
  assert not prior_surfaces & {r[0] for r in data["surfaceColors"]}
  assert all(
    source["surfaces"][i]["owner"] == M.SCHOOL for i, _ in data["surfaceColors"]
  )


def test_three_tall_registers_segmental_glazing_and_photographed_blank_end():
  data, ev = M.read(M.OUT), M.read(M.EVIDENCE)
  boxes, rods = decode(data, "boxes"), decode(data, "rods")
  assert data["counts"]["tallWindows"] == 85
  for row in ev["faces"]:
    members, strokes = boxes[slice(*row["boxes"])], rods[slice(*row["rods"])]
    face = M.Front(row["rings"], row["normal"], row["key"], [])
    if row["blankEnd"]:
      assert row["key"] == M.BLANK_END
      assert not row["windows"]
      assert not any(r[-1] == M.GLASS for r in members)
    else:
      assert {y for _, y in row["windows"]} <= set(M.FLOORS)
      for u, y in row["windows"]:
        glazing = [
          r
          for r in members
          if r[-1] == M.GLASS
          and abs(float((np.array(r[:3]) - face.a) @ face.d) - u) < 0.02
          and abs(r[1] - y) < 1.7
        ]
        assert len(glazing) == 4
        assert sum(r[4] > 2.8 for r in glazing) == 1
        upper = sorted((r[1], r[3]) for r in glazing if r[4] < 0.2)
        assert upper[0][1] > upper[1][1] > upper[2][1]
        assert any(r[-1] == M.CREAM for r in strokes)
        assert any(r[-1] == M.DARK for r in strokes)
    if face.top > 21.8 and not row["blankEnd"]:
      assert {y for _, y in row["windows"]} == set(M.FLOORS)


def test_every_added_member_attaches_to_a_complete_original_wall():
  data, ev = M.read(M.OUT), M.read(M.EVIDENCE)
  boxes, rods = decode(data, "boxes"), decode(data, "rods")
  for desc in ev["faces"]:
    f = M.Front(desc["rings"], desc["normal"], desc["key"], [])
    for row in boxes[slice(*desc["boxes"])]:
      p = np.array(row[:3])
      u = float((p - f.a) @ f.d)
      assert 0.12 < float((p - f.a) @ f.n) < 0.27
      assert abs(row[6] - f.yaw) < 0.0002
      assert f.wall.buffer(0.015).covers(
        box(u - row[3] / 2, p[1] - row[4] / 2, u + row[3] / 2, p[1] + row[4] / 2)
      )
    for row in rods[slice(*desc["rods"])]:
      p, q = np.array(row[:3]), np.array(row[3:6])
      assert abs(float((p - f.a) @ f.n) - 0.29) < 0.015
      assert abs(float((q - f.a) @ f.n) - 0.29) < 0.015
      assert f.wall.buffer(0.02).covers(
        LineString(
          [(float((p - f.a) @ f.d), p[1]), (float((q - f.a) @ f.d), q[1])]
        ).buffer(row[6] / 2, cap_style=2)
      )


def test_native_is_independent_orthogonal_and_clear_of_original_support_cells():
  data, ev = M.read(M.OUT), M.read(M.EVIDENCE)
  blocks = decode(data, "nativeRows")
  assert all(len(r) == 7 and all(v > 0 for v in r[3:6]) for r in blocks)
  assert all(all(np.isfinite(v) for v in r) for r in blocks)
  native = M.read(M.DATA / "steglitzV182Native.json")["boxes"]
  for desc in ev["faces"]:
    f = M.Front(desc["rings"], desc["normal"], desc["key"], native)
    for u in np.linspace(0.5, f.length - 0.5, 5):
      rows = []
      f.native_member(rows, float(u), min(19.75, f.top - 1), 0.8, 1.2, M.GLASS, 0.14)
      for row in rows:
        supports = [
          r
          for r in f.support
          if abs(r[f.cross] - row[f.cross]) < r[f.cross + 3] / 2 + 0.001
        ]
        assert supports
        assert (
          min(
            f.sign * (row[f.axis] - r[f.axis]) - r[f.axis + 3] / 2 - 0.03
            for r in supports
          )
          > 0.109
        )
