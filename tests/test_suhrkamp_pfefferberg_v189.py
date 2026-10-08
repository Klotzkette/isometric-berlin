"""Step 10: measured wall containment, immutable inputs and native contract."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path

import pytest
from shapely.geometry import box, shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
  "suhrkamp_pfefferberg", ROOT / "scripts/build_suhrkamp_pfefferberg_v189.py"
)
assert spec and spec.loader
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
SOURCE = json.loads(builder.SOURCE.read_text())
RUNTIME = json.loads(builder.DEST.read_text())


def test_finite_owner_inventory_and_unmodified_source_inputs() -> None:
  """This bounded layer cannot hide an owner, rewrite a packet or move terrain."""
  assert len(SOURCE["buildings"]) == 8
  assert {b["kind"] for b in SOURCE["buildings"]} == {
    v[0] for v in builder.TARGETS.values()
  }
  assert RUNTIME["sourcePartCount"] == 22
  assert {b["id"] for b in SOURCE["buildings"]} == set(builder.TARGETS)
  for path, expected in SOURCE["inputSha256"].items():
    input_path = ROOT / path
    if not input_path.exists():
      # Ignored extraction caches are intentionally absent in a clean clone;
      # the committed bounded evidence is sufficient for reproduction.
      assert "/raw/" in path
      continue
    assert hashlib.sha256(input_path.read_bytes()).hexdigest() == expected
  assert RUNTIME == json.loads(json.dumps(builder.build(SOURCE)))
  for building in SOURCE["buildings"]:
    bounds = shape(building["footprint"]).bounds
    assert 2600 < bounds[0] < bounds[2] < 2800
    assert -1440 < bounds[1] < bounds[3] < -940
    assert building["sourceGroundY"] + building["translationY"] == pytest.approx(
      3, abs=0.001
    )


def test_each_facade_is_contained_by_an_actual_original_wall() -> None:
  """Generic parent tops cannot turn into false roof apex window rectangles."""
  assert len(RUNTIME["faces"]) == 45
  for face in RUNTIME["faces"]:
    wall = shape(face["wallGeometry"])
    length = math.dist(face["a"], face["b"])
    assert wall.buffer(0.003).covers(
      box(0.04, face["bottom"] + 0.04, length - 0.04, face["top"] - 0.04)
    )
    assert face["bottom"] >= 3
    assert math.hypot(*face["normal"]) == pytest.approx(1, abs=1e-7)
    owner = next(b for b in SOURCE["buildings"] if b["id"] == face["ownerId"])
    assert face["partId"] in {p["id"] for p in owner["parts"]}
    mx, mz = [(a + b) / 2 for a, b in zip(face["a"], face["b"], strict=True)]
    from shapely.geometry import Point

    assert not shape(owner["footprint"]).contains(
      Point(mx + face["normal"][0] * 0.25, mz + face["normal"][1] * 0.25)
    )


def test_suhrkamp_complete_prior_parts_are_retained() -> None:
  """Facade authoring does not re-extrude Suhrkamp or lose irregular parts."""
  prior = json.loads(
    (ROOT / "geo_data/regierungsviertel/scheunenviertel-v168.json").read_text()
  )
  for building in SOURCE["buildings"][:2]:
    old = next(
      b for b in prior["retainedDetailedBuildings"] if b["id"] == building["id"]
    )
    assert {p["id"] for p in old["parts"]} == {p["id"] for p in building["parts"]}
    for part in building["parts"]:
      old_part = next(p for p in old["parts"] if p["id"] == part["id"])
      source_points = {
        (round(p[0], 3), round(p[1] + building["translationY"], 3), round(p[2], 3))
        for s in part["surfaces"]
        for r in s["rings"]
        for p in r
      }
      old_points = {
        (round(p[0], 3), round(p[1], 3), round(p[2], 3))
        for s in old_part["surfaces"]
        for r in s["rings"]
        for p in r
      }
      assert source_points == old_points


def test_mapped_stair_evidence_does_not_become_floating_geometry() -> None:
  """Exact stair routes remain evidence while flat existing terrain is kept."""
  stairs = {s["id"]: s for s in SOURCE["stairsEvidenceOnly"]}
  assert stairs["way/184595081"]["tags"]["step_count"] == "13"
  assert stairs["way/184595078"]["tags"]["step_count"] == "12"
  assert stairs["way/184595085"]["tags"]["step_count"] == "12"
  assert "actual elevated beer garden" in RUNTIME["policy"]
  assert "stairs" not in RUNTIME
  assert "geometry" not in RUNTIME
