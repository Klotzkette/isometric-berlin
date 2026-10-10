"""Bounded source preservation, facade floors and native clearance contracts."""

import hashlib
import importlib.util
import json
import math
from pathlib import Path

from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/charite-bettenhaus-v207-source.json"
RUNTIME = ROOT / "src/app/src/data/chariteBettenhausV207.json"
E, D = json.loads(SOURCE.read_text()), json.loads(RUNTIME.read_text())


def test_original_tower_parts_and_bridge_remain_identical():
  current = json.loads((ROOT / E["priorPrismPath"]).read_text())["buildings"]
  lookup = {p["id"]: p for p in current}
  assert len(E["priorPrisms"]) == 16
  assert len(E["parts"]) == 28
  assert sum(len(p["surfaces"]) for p in E["parts"]) == 179
  assert all(lookup[p["id"]] == p for p in E["priorPrisms"])
  assert lookup["L2e097lj"] == E["bridgeControl"]
  assert E["sourceSuppressionIds"] == D["sourceSuppressionIds"] == []
  assert D["sourceSha256"] == hashlib.sha256(SOURCE.read_bytes()).hexdigest()
  assert (
    hashlib.sha256((ROOT / E["priorVoxelPath"]).read_bytes()).hexdigest()
    == E["priorVoxelSha256"]
  )


def test_offline_generator_is_reproducible():
  spec = importlib.util.spec_from_file_location(
    "charite_v207", ROOT / "scripts/build_charite_bettenhaus_v207.py"
  )
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  assert module.build(E) == D


def test_twenty_one_global_levels_and_five_dark_treatment_levels():
  p, roles = D["profile"], D["stats"]["roles"]
  assert p == {
    "groundY": 5.2,
    "floorPitchM": 3.7,
    "storeys": 21,
    "treatmentStoreys": 5,
    "wardStoreys": 16,
    "baseTopY": 23.7,
  }
  assert roles["ward-glazing"] == 2144
  assert roles["treatment-glazing"] == 250
  assert roles["vertical-lesene"] == 92
  assert roles["roof-screen-upright"] == 104
  assert roles["charite-accent"] == 2
  dark = [b for b in D["boxes"] if b[-1] == 0x606A6D]
  assert dark and all(abs(b[1] + b[4] / 2 - 23.7) < 0.0001 for b in dark)
  assert all(b[4] == 18.5 for b in dark)
  for refs in E["references"]:
    assert refs["license"] == "CC0-1.0"


def test_finite_surface_only_geometry_is_bounded_to_tower():
  envelope = unary_union(
    [Polygon([(x / 10, z / 10) for x, z in p["ring"]]) for p in E["priorPrisms"]]
  )
  for field, limit in [("boxes", 0.5), ("nativeBlocks", 3.25)]:
    for row in D[field]:
      assert all(math.isfinite(v) for v in row)
      assert all(v > 0 for v in row[3:6])
      assert envelope.buffer(limit).covers(Point(row[0], row[2]))
      ceiling = 100.0 if field == "nativeBlocks" else 97.3
      assert 5.1 <= row[1] - row[4] / 2 < row[1] + row[4] / 2 < ceiling
  assert D["stats"]["drawnBufferBytes"] < 370000
  assert D["stats"]["nativeBufferBytes"] < 570000
  assert D["stats"]["nativeMaximumColumnClearanceM"] <= 3.1
  assert D["stats"]["nativeMaximumFaceOffsetM"] <= 3.25
  assert D["stats"]["nativeOccludedRecessTiles"] == 130
  assert RUNTIME.stat().st_size < 900000


def test_native_facade_clears_retained_tall_voxel_columns():
  for x, y, z, w, h, d, _ in D["nativeBlocks"]:
    for cx, cz, bottom, top, cell, _ in E["nearbyVoxelColumns"]:
      if top < 80 or top <= y - h / 2 or bottom >= y + h / 2:
        continue
      assert (
        abs(x - cx) >= (cell + w) / 2 - 0.001 or abs(z - cz) >= (cell + d) / 2 - 0.001
      )


def test_faces_follow_actual_retained_source_planes():
  by_id = {p["id"]: p for p in E["priorPrisms"]}
  for wall in D["walls"]:
    part = by_id[wall["owner"]]
    a = [v / 10 for v in part["ring"][wall["edge"]]]
    b = [v / 10 for v in part["ring"][(wall["edge"] + 1) % len(part["ring"])]]
    assert wall["a"] == a
    assert (
      -0.001 <= wall["interval"][0] < wall["interval"][1] <= math.dist(a, b) + 0.001
    )
    assert abs(sum(n * t for n, t in zip(wall["normal"], wall["tangent"]))) < 1e-9


def test_native_lettering_clears_its_own_plaque_and_screen_clears_roof():
  plaques = [b for b in D["nativeBlocks"] if b[-1] == 0xDFE5E3 and b[4] == 4]
  letters = [b for b in D["nativeBlocks"] if b[-1] == 0x34464C]
  assert len(letters) == 164 and plaques
  for x, y, z, w, h, d, _ in letters:
    for px, py, pz, pw, ph, pd, _ in plaques:
      assert (
        abs(x - px) >= (w + pw) / 2
        or abs(y - py) >= (h + ph) / 2
        or abs(z - pz) >= (d + pd) / 2
      )
  screen = [b for b in D["nativeBlocks"] if b[-1] == 0x707E82]
  assert screen and min(b[1] - b[4] / 2 for b in screen) >= 97.2499
  assert max(c[3] for c in E["nearbyVoxelColumns"]) == 97.2
