"""Bounded John-Lennon facade: immutable shell and actual wall attachment."""

from __future__ import annotations

import gzip
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Polygon, box

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
  "build_lennon_v250", ROOT / "scripts/build_lennon_v250.py"
)
assert spec and spec.loader
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


def payloads() -> tuple[dict, dict]:
  return (
    json.loads((ROOT / "src/app/src/data/lennonV250.json").read_text()),
    json.loads(
      (ROOT / "geo_data/regierungsviertel/lennon-v250-evidence.json").read_text()
    ),
  )


def test_original_sources_and_complete_school_remain_unchanged() -> None:
  data, ev = payloads()
  for name, digest in ev["sourceHashes"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest
  source = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-391_5821-00.json.gz"
      ).read_bytes()
    )
  )
  school = next(b for b in source["buildings"] if b["id"] == data["owner"])
  assert len(school["parts"]) == ev["partCountRetained"] == 11
  assert ev["terrainOffsetY"] == 6.91
  for face in ev["faces"]:
    part = next(p for p in school["parts"] if p["id"] == face["partId"])
    original = part["surfaces"][face["sheetIndex"]]
    assert original["kind"] == "WallSurface"
    for before, after in zip(original["rings"], face["rings"], strict=True):
      np.testing.assert_allclose(np.array(before) + [0, 6.91, 0], after, atol=1e-10)
  assert data["previous"] == build.previous()


def test_every_facing_and_opening_is_on_its_exact_source_wall() -> None:
  data, ev = payloads()
  origin = np.array(data["origin"])
  for audit in ev["faceAudit"]:
    pts = np.array(audit["rings"][0])
    a, b = max(
      ((a, b) for a in pts for b in pts),
      key=lambda ab: np.linalg.norm((ab[1] - ab[0])[[0, 2]]),
    )
    d = np.array([b[0] - a[0], 0, b[2] - a[2]])
    d /= np.linalg.norm(d)
    n = np.array(audit["normal"])
    wall = Polygon(
      [[(float(np.dot(np.array(p) - a, d)), p[1]) for p in r] for r in audit["rings"]][
        0
      ]
    )
    for index in audit["boxes"]:
      row = data["boxes"][index]
      p = np.array(row[:3]) / 1000 + origin
      width, height = row[3] / 1000, row[4] / 1000
      u = float(np.dot(p - a, d))
      assert wall.buffer(0.002).covers(
        box(u - width / 2, p[1] - height / 2, u + width / 2, p[1] + height / 2)
      )
      assert 0.49 < float(np.dot(p - a, n)) < 0.8
    for index in audit["rods"]:
      row = data["rods"][index]
      p = np.array(row[:3]) / 1000 + origin
      q = np.array(row[3:6]) / 1000 + origin
      assert wall.buffer(0.002).covers(
        LineString(
          [(float(np.dot(p - a, d)), p[1]), (float(np.dot(q - a, d)), q[1])]
        ).buffer(row[6] / 2000, cap_style=2)
      )
      assert abs(float(np.dot(p - a, n)) - 0.74) < 0.002
  assert data["counts"]["occupiedLevels"] == len(ev["levels"]) == 4
  assert len(ev["portals"]) == data["counts"]["portals"] == 3
  assert {p["sheetIndex"] for p in ev["portals"]} == {3, 4, 9}
  assert all(row[3] > 0 and row[4] > 0 and row[5] > 0 for row in data["nativeRows"])
  assert data["counts"]["drawn"] * 76 < 130_000
  assert data["counts"]["native"] * 76 < 270_000


def test_replay_is_deterministic_and_does_not_write_any_old_owner() -> None:
  paths = [
    ROOT / "src/app/src/data/lennonV250.json",
    ROOT / "geo_data/regierungsviertel/lennon-v250-evidence.json",
  ]
  before = [p.read_bytes() for p in paths]
  build.build()
  assert before == [p.read_bytes() for p in paths]
  test_original_sources_and_complete_school_remain_unchanged()
