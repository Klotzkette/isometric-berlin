"""Additive HU ornament preserves every previous source and authored owner."""

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Point

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_humboldt_main_v168 as module  # noqa: E402

P = json.loads((ROOT / "src/app/src/data/humboldtMainV168Source.json").read_text())


def test_existing_hero_source_and_facade_files_unchanged() -> None:
  for record in P["preservedFiles"]:
    assert (
      hashlib.sha256((ROOT / record["path"]).read_bytes()).hexdigest()
      == record["sha256"]
    )
  assert P["newReplacedOwners"] == []
  assert P["lod2ParentId"] == "DEBE01YYK0000Cm9"
  assert P["osmIdentity"] == "relation/6647"
  assert P["sourceBoundaryPolygons"] == 95
  profile = json.loads(module.SOURCE.read_text())["profiles"]["humboldt"]
  assert len(profile["parts"]) == 1 and len(profile["parts"][0]["holes"]) == 1
  assert profile["parts"][0]["ground_y_m"] == -1.245
  assert profile["parts"][0]["top_y_m"] == 25.018


def test_axes_are_existing_measured_wall_planes() -> None:
  part = json.loads(module.SOURCE.read_text())["profiles"]["humboldt"]["parts"][0]
  walls = [
    LineString([(v[0], v[2]) for v in s["rings"][0]])
    for s in part["surfaces"]
    if s["kind"] == "WallSurface"
  ]
  assert len(P["axes"]) == 11
  for axis in P["axes"]:
    # Compare exact endpoint pair to a source wall, including projected wing ends.
    assert any(
      w.distance(Point(axis["start"])) < 0.002
      and w.distance(Point(axis["end"])) < 0.002
      for w in walls
    )
  assert sum(a["bays"] for a in P["axes"][:3]) == 17
  assert P["axes"][1]["bays"] == 5


def test_new_geometry_is_finite_bounded_and_has_no_new_world_support() -> None:
  for field in ["boxes", "rods", "beads", "nativeBoxes"]:
    assert all(np.isfinite(r).all() for r in P[field])
  assert len([r for r in P["rods"] if r[8] == 8]) == 6 * 20
  assert len([r for r in P["boxes"] if r[8] == 12]) == 18
  assert all(
    r[3] > 0 and r[4] > 0 and r[5] > 0
    for r in P["boxes"] + P["beads"] + P["nativeBoxes"]
  )
  nav = json.loads((module.DEST.parent / "humboldtMainV168Navigation.json").read_text())
  assert nav["newCollisionSolids"] == [] and nav["newRoofSupport"] == []
  assert nav["newReplacedOwners"] == []
  assert min(r[1] - r[4] / 2 for r in P["nativeBoxes"]) > 5.2


def test_generation_is_deterministic_and_native_ornament_is_separate() -> None:
  rebuilt = module.build()
  for key in ["axes", "boxes", "rods", "beads", "nativeBoxes"]:
    assert P[key] == rebuilt[key]
  assert len(P["nativeBoxes"]) < 4000
  assert len(P["nativeBoxes"]) > 1000
  assert len(P["boxes"]) + len(P["rods"]) + len(P["beads"]) < 6000
