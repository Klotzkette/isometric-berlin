"""Photo-led school facade, measured courtyard hall and immutable source receipt."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, box

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location(
  "steglitz_school_v250", ROOT / "scripts/build_steglitz_school_v250.py"
)
assert SPEC and SPEC.loader
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)
DATA, E = M.read(M.OUT), M.read(M.EVIDENCE)
SOURCE = M.read(M.DATA / "steglitzV182Source.json")
NATIVE = M.read(M.DATA / "steglitzV182Native.json")["boxes"]
FACES = [M.Front(f["rings"], f["normal"], f["key"], []) for f in E["faces"]]


def test_rebuild_and_all_complete_original_sources_remain_exact() -> None:
  for path, digest in E["sourceSha256"].items():
    assert M.sha(ROOT / path) == digest
  built, evidence = M.build()
  assert built == DATA
  assert json.loads(json.dumps(evidence)) == E
  assert DATA["fingerprints"] == E["fingerprints"]
  assert M.fingerprint(SOURCE["surfaces"]) == DATA["fingerprints"]["sourceSurfaces"]
  assert M.fingerprint(NATIVE) == DATA["fingerprints"]["nativeRows"]
  assert {s["owner"] for s in SOURCE["surfaces"]} >= {M.SCHOOL, M.HALL}


def test_only_identified_facade_estimates_are_superseded_and_roofs_are_untouched() -> (
  None
):
  for index in DATA["remove"]["v182.boxes"]:
    row = SOURCE["boxes"][index]
    assert any(f.owns(row, 0.2) for f in FACES)
  for index, _ in DATA["surfaceColors"]:
    s = SOURCE["surfaces"][index]
    assert s["owner"] in {M.SCHOOL, M.HALL}
    assert s["color"] in [0xB9896C, 0xB7B2A4]
    assert any(
      all(f.owns([*p, 0, 0, 0, 0, 0], 0.02) for t in s["triangles"] for p in t)
      for f in FACES
    )
  for index, colour in DATA["nativeColors"]:
    assert NATIVE[index][6] in [0x51666A, 0xDDD4BF, 0xB9896C, 0xB7B2A4]
    assert colour in [M.BRICK, 0xDDDCD2]
    assert any(f.owns(NATIVE[index], 1.1) for f in FACES)
  counts246 = M.read(M.GEO / "steglitz-details-v246-evidence.json")["counts"]
  for key in ["boxes", "nativeRows"]:
    count = counts246["schoolNative" if key == "nativeRows" else "schoolDrawn"]
    assert DATA["remove"][f"v246.{key}"] == list(range(count))


def test_every_drawn_member_follows_a_real_wall_and_no_new_mass_or_roof_is_added() -> (
  None
):
  origin = np.array(DATA["origin"])
  for row in DATA["boxes"]:
    p = np.array(row[:3]) + origin
    matching = []
    for f in FACES:
      u = float((p - f.a) @ f.d)
      offset = float((p - f.a) @ f.n)
      if 0.12 < offset < 0.30 and abs(row[6] - f.yaw) < 0.0001:
        matching.append(
          f.wall.buffer(0.002).covers(
            box(u - row[3] / 2, p[1] - row[4] / 2, u + row[3] / 2, p[1] + row[4] / 2)
          )
        )
    assert any(matching), row
    assert row[5] <= 0.15
  for row in DATA["rods"]:
    p, q = np.array(row[:3]) + origin, np.array(row[3:6]) + origin
    assert any(
      abs(float((p - f.a) @ f.n) - 0.29) < 0.001
      and abs(float((q - f.a) @ f.n) - 0.29) < 0.001
      and f.wall.buffer(0.002).covers(
        LineString(
          [(float((p - f.a) @ f.d), p[1]), (float((q - f.a) @ f.d), q[1])]
        ).buffer(row[6] / 2, cap_style=2)
      )
      for f in FACES
    ), row


def test_photo_recognition_and_orthogonal_native_glazing_have_real_depth() -> None:
  rows = DATA["boxes"]
  # Three Aula windows with three lower lights, three separate gold lintels.
  central = E["recognitionRanges"][0]["drawn"]
  aula = [r for r in rows[slice(*central)] if r[1] == 20.55 and r[-1] == M.GLASS]
  assert len(aula) == 9
  assert (
    len([r for r in rows[slice(*central)] if r[1] == 25.63 and r[-1] == M.GOLD]) == 3
  )
  # Two long high glazing banks belong to the measured two-storey hall.
  banks = [r for r in rows if r[-1] == 0xB2C3C3 and r[3] > 20]
  assert sorted((r[1], r[4]) for r in banks) == [(7.1, 4.65), (12.55, 2.65)]
  assert len(DATA["nativeRows"]) == 2778
  assert all(len(r) == 7 and all(v > 0 for v in r[3:6]) for r in DATA["nativeRows"])
  # Explicit layers survive native construction (glass .13, frame .24/.25).
  native = np.array(NATIVE)
  for colour, offset in [(M.GLASS, 0.13), (M.CREAM, 0.24)]:
    checks = 0
    for r in DATA["nativeRows"]:
      if r[-1] != colour or r[3] != 0.06:
        continue
      p = np.array(r[:3]) + DATA["origin"]
      support = (np.abs(native[:, 0] + native[:, 3] / 2 - (p[0] - offset)) < 0.0002) & (
        np.abs(native[:, 2] - p[2]) <= native[:, 5] / 2 + 0.0002
      )
      if support.any():
        checks += 1
    assert checks > 30
  # Explicit obstruction regression: former greedy body runs and old openings
  # must not protrude through a new pane at any lateral slice or height.
  for record in [
    f for f in E["faces"] if f["key"] in ["heese-0", "DEBE3DwLrQGxJf5p/6"]
  ]:
    f = M.Front(record["rings"], record["normal"], record["key"], NATIVE)
    for u in np.linspace(1, f.length - 1, 12):
      members = []
      f.native_member(members, u, 9.25, 1.42, 3.2, M.GLASS, 0.13)
      assert members
      for row in members:
        behind = [
          r
          for r in f.support
          if abs(r[f.cross] - row[f.cross]) < r[f.cross + 3] / 2 + 0.001
        ]
        assert behind
        assert (
          min(
            f.sign * (row[f.axis] - r[f.axis]) - r[f.axis + 3] / 2 - 0.03
            for r in behind
          )
          >= 0.0999
        )
