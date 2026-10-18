"""Actual retained raster ownership and passage checks for the native Panke."""

import hashlib
import importlib.util
import json
from pathlib import Path

import pytest
from shapely.geometry import Point, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"


@pytest.fixture(scope="module")
def source():
  spec = importlib.util.spec_from_file_location(
    "native_panke", ROOT / "scripts/build_panke_native_banks_v229.py"
  )
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  return (
    module,
    json.loads((DATA / "pankeNativeBanksV229.json").read_text()),
    json.loads((GEO / "panke-native-banks-v229-evidence.json").read_text()),
    json.loads(module.GROUND.read_text()),
  )


def test_native_faces_are_on_original_water_land_edges_and_original_run_tops(source):
  module, model, receipt, ground = source
  for label, path in [
    ("ground", module.GROUND),
    ("source", module.SOURCE),
    ("drawn", module.DRAWN),
    ("native", module.DEST),
  ]:
    assert receipt[label + "Sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
  assert receipt["nativeRasterBanks"] >= 900
  grid, field = ground["grid"], ground["ground_height"]
  directions = set()
  for r in receipt["banks"]:
    a, z, b, zz, nx, nz, _, top_a, top_b, owner = model["banks"][r["bank"]]
    ix, iz = r["waterCell"]
    lx, lz = r["landCell"]
    assert abs(lx - ix) + abs(lz - iz) == 1
    assert (nx, nz) == (ix - lx, iz - lz)
    directions.add((nx, nz))
    assert (a == b) != (z == zz)
    assert abs(a - b) + abs(z - zz) == 4
    assert all(v % 4 == 0 for v in (a, z, b, zz))
    water_box = box(ix * 4, iz * 4, ix * 4 + 4, iz * 4 + 4)
    land_box = box(lx * 4, lz * 4, lx * 4 + 4, lz * 4 + 4)
    for t in [0.01, 0.33, 0.99]:
      x, y = a + (b - a) * t, z + (zz - z) * t
      assert water_box.contains(Point(x + nx * 0.06, y + nz * 0.06))
      assert land_box.contains(Point(x - nx * 0.06, y - nz * 0.06))
    # Check the original run rather than treating a sampled cell as a new run.
    xo, count, zo, class_id = r["landRun"]
    assert [xo, count, class_id] in ground["ground_rows"][zo]
    assert grid["min_z_idx"] + zo == lz
    assert xo <= lx - grid["min_x_idx"] < xo + count
    assert ground["classes"][class_id] in module.LAND
    water_runs = ground["ground_rows"][iz - grid["min_z_idx"]]
    water_class = next(
      c for x, n, c in water_runs if x <= ix - grid["min_x_idx"] < x + n
    )
    assert ground["classes"][water_class] == "water"
    col = int((xo + count / 2) // field["stride_cells"])
    row = zo // field["stride_cells"]
    actual_top = field["y_dm"][row * field["cols"] + col] / 10
    assert r["landTop"] == actual_top
    assert top_a == top_b == round(actual_top + 0.12, 3)
    assert owner == -2
  assert len(directions) == 4


def test_whole_native_box_footprints_keep_passages_open(source):
  module, model, receipt, ground = source
  source_geometry = json.loads(module.SOURCE.read_text())
  protected = unary_union(
    [
      shape(source_geometry["tunnels"]),
      shape(source_geometry["mouths"]).buffer(0.2),
      *[box(x * 4, z * 4, x * 4 + 4, z * 4 + 4) for x, z in receipt["bridgeCells"]],
    ]
  )
  for row in model["banks"]:
    assert not module.native_footprint(row).intersects(protected)
  original = json.loads(module.DRAWN.read_text())["banks"]
  assert model["banks"][receipt["nativeRasterBanks"] :] == [
    original[i] for i in receipt["retainedOutsideCoreIndices"]
  ]
  assert model["waterY"] == ground["water_top_y_m"] == -1.15


def test_native_bank_builder_replays_without_modifying_source(source, tmp_path):
  module, _, _, _ = source
  old_dest, old_evidence = module.DEST, module.EVIDENCE
  try:
    module.DEST = tmp_path / "native.json"
    module.EVIDENCE = tmp_path / "evidence.json"
    module.build()
    assert module.DEST.read_bytes() == old_dest.read_bytes()
    assert module.EVIDENCE.read_bytes() == old_evidence.read_bytes()
  finally:
    module.DEST, module.EVIDENCE = old_dest, old_evidence
