"""The photographed sport court follows mapped pitches and stays walkable."""

from __future__ import annotations

import importlib.util
import json
import math
import sys
from pathlib import Path

from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location(
  "steglitz_court_ground_v251", ROOT / "scripts/build_steglitz_court_ground_v251.py"
)
assert SPEC and SPEC.loader
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)


def test_reproducible_complete_source_retention_and_small_budget() -> None:
  data, evidence = M.build()
  assert data == M.read(M.OUT)
  assert M.floor_profile(data) == M.read(M.FLOOR)
  assert json.loads(json.dumps(evidence)) == M.read(M.EVIDENCE)
  for path, digest in evidence["sourceSha256"].items():
    assert M.sha(ROOT / path) == digest
  assert M.OUT.stat().st_size < 30_000
  assert M.OUT.stat().st_size + M.FLOOR.stat().st_size < 32_000
  assert len(data["boxes"]) + len(data["rods"]) < 500
  assert len(data["nativeRows"]) < 1000
  assert all(
    len(r) == 7 and min(r[3:6]) > 0 and all(math.isfinite(v) for v in r)
    for r in data["nativeRows"]
  )
  assert "remove" not in data


def test_ground_matches_mapped_pitches_and_never_closes_courtyard() -> None:
  data, evidence = M.build()
  nav = M.read(M.DATA / "steglitzV182Navigation.json")
  bodies = unary_union([Polygon(b["ring"], b["holes"]) for b in nav["buildings"]])
  mapped = [M.mapped_way(identity) for identity in ["1107082380", "1107082381"]]
  for key, native, count in [
    ("boxes", False, data["groundCounts"][0]),
    ("nativeRows", True, data["groundCounts"][1]),
  ]:
    for i, row in enumerate(data[key][:count]):
      r = [v + data["origin"][k] if k < 3 else v for k, v in enumerate(row)]
      footprint = M.row_polygon(r, native)
      assert not footprint.intersects(bodies)
      assert abs(r[1] + r[4] / 2 - 3.55) < 0.0001
      assert r[4] <= 0.12
      if key == "boxes" and i < 2:
        assert mapped[i].buffer(0.01).covers(footprint)
        assert footprint.area / mapped[i].area > 0.985
  # Gabled Aula entry/fountain zone remains free; no 2-D site collider exists.
  assert "colliders" not in data
  assert evidence["floorY"] == 3.55


def test_photo_recognition_and_receipted_anchors() -> None:
  data, evidence = M.build()
  ranges = {r["name"]: r for r in evidence["recognitionRanges"]}
  assert set(ranges) == {
    "photographed white handball markings",
    "yellow basketball and blue inset markings",
    "two mapped basketball hoops",
    "photo-visible black grid goal",
    "three photo-visible table tennis tables",
    "six retained OSM courtyard tree anchors",
  }
  assert len(evidence["trees"]) == 6
  assert len(evidence["tableEstimates"]) == 3
  for key in [
    "photographed white handball markings",
    "yellow basketball and blue inset markings",
  ]:
    a, b = ranges[key]["rods"]
    assert b > a
    assert all(
      abs(r[1] - 0.02) < 0.001 and abs(r[4] - 0.02) < 0.001 for r in data["rods"][a:b]
    )
  a, b = ranges["two mapped basketball hoops"]["boxes"]
  assert len([r for r in data["boxes"][a:b] if r[-1] == M.WHITE]) == 2
  assert all(p["id"].startswith("way/110708238") for p in evidence["courtSources"])
