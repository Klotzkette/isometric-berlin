"""Bounded additive source/geometry contract for the Funkturm fittings."""

import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
spec = importlib.util.spec_from_file_location(
  "funkturm_v199", ROOT / "scripts/build_funkturm_v199.py"
)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def test_all_prior_tower_source_and_models_remain_byte_identical():
  e = json.loads((GEO / "funkturm-v199-evidence.json").read_text())
  for path, digest in e["preservedInputs"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
  assert e["anchorOwner"] == "way/30926247"
  old = json.loads((DATA / "westLandmarksV187.json").read_text())
  anchor = next(g["anchor"] for g in old["groups"] if g["name"] == "Funkturm")
  assert e["anchor"][0] == pytest.approx(anchor[0], abs=0.0005)
  assert e["anchor"][2] == pytest.approx(anchor[2], abs=0.0005)
  assert e["operatorLevelsM"] == {"restaurant": 55, "observation": 126, "tip": 147}


@pytest.mark.parametrize("native", [False, True])
def test_bounded_additive_shapes_reproduce_and_leave_open_shaft(native):
  model = builder.build_model(native)
  name = "funkturmV199Native.json" if native else "funkturmV199.json"
  assert json.loads((DATA / name).read_text()) == model
  assert (DATA / name).stat().st_size < 650000
  x, ground, z = model["anchor"]
  assert len(model["groups"]) == 4
  for g in model["groups"]:
    for b in g["boxes"]:
      assert all(np.isfinite(b))
      assert min(b[3:6]) > 0
      assert abs(b[0] - x) + b[3] / 2 < 12
      assert abs(b[2] - z) + b[5] / 2 < 12
      assert ground - 0.001 < b[1] + b[4] / 2 < ground + 147
    if native:
      assert not g["rods"] and not g["positions"]
  # No new tower-sized box; all high members have narrow footprint or low height.
  assert all(
    b[4] < 2 or min(b[3], b[5]) < 0.2 for g in model["groups"] for b in g["boxes"]
  )
  feet = model["groups"][0]["boxes"]
  bases = [b for b in feet if b[3] == 3.5 and b[5] == 3.5]
  assert len(bases) == 4
  assert {(round(b[0] - x), round(b[2] - z)) for b in bases} == {
    (-10, -10),
    (-10, 10),
    (10, -10),
    (10, 10),
  }
  stair = model["groups"][1]["boxes"]
  treads = [b for b in stair if b[4] == 0.075]
  assert len(treads) == 600
  # Treads stay beside the retained +/-0.55m lift, never closing it into a block.
  assert all(abs(b[2] - z) - b[5] / 2 > 0.55 for b in treads)
  assert min(b[1] for b in treads) > ground + 1
  assert max(b[1] for b in treads) < ground + 126
  # Roof addition is an apron: no new full slab over the retained roof centre.
  roof = [b for b in model["groups"][2]["boxes"] if abs(b[1] - (ground + 58.4)) < 0.001]
  assert len(roof) == 4
  assert all(abs(b[0] - x) > 7 or abs(b[2] - z) > 7 for b in roof)


def test_exact_proxy_repair_preserves_all_unrelated_faces_attributes_and_navigation():
  import gzip

  spec = importlib.util.spec_from_file_location(
    "funkturm_repair", ROOT / "scripts/repair_funkturm_packets_v199.py"
  )
  repair = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(repair)
  receipt = json.loads((GEO / "funkturm-v199-packet-repair.json").read_text())
  for mode, info in receipt["modes"].items():
    packed = (GEO / info["archive"]).read_bytes()
    assert hashlib.sha256(packed).hexdigest() == info["archiveSha256"]
    old = json.loads(gzip.decompress(packed))
    current, edits = repair.repair_payload(json.loads(json.dumps(old)))
    assert edits["removedTriangles"] == info["removedTriangles"]
    assert edits["removedLines"] == info["removedLines"]
    assert edits["removedNavigation"] == info["removedNavigation"]
    assert len(edits["removedTriangles"]) == (8 if mode == "drawn" else 0)
    for i, (a, b) in enumerate(zip(old["meshes"], current["meshes"], strict=True)):
      assert {k: v for k, v in a.items() if k != "indices"} == {
        k: v for k, v in b.items() if k != "indices"
      }
      old_faces = repair.decode(a["indices"], "<u4", 3)
      removed = {f["triangle"] for f in edits["removedTriangles"] if f["mesh"] == i}
      expected = old_faces[[j for j in range(len(old_faces)) if j not in removed]]
      assert np.array_equal(repair.decode(b["indices"], "<u4", 3), expected)
    assert {k: v for k, v in old["nav"].items() if k != "buildings"} == {
      k: v for k, v in current["nav"].items() if k != "buildings"
    }
    assert current["nav"]["buildings"] == [
      b for b in old["nav"]["buildings"] if b["sourceId"] not in repair.OWNERS
    ]
    raw = (
      json.dumps(current, ensure_ascii=False, separators=(",", ":")) + "\n"
    ).encode()
    result = gzip.compress(raw, compresslevel=9, mtime=0)
    assert hashlib.sha256(result).hexdigest() == info["descriptor"]["sha256"]
    if mode == "minecraft":
      assert result == packed
