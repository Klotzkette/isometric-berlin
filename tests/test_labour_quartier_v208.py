"""Independent preservation and full-prism visibility checks for BMAS / Q206."""

import hashlib
import json
import math
from pathlib import Path

import numpy as np
from shapely.geometry import Point, box, shape
from shapely.ops import unary_union

from scripts.build_labour_quartier_v208 import TARGETS

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "src/app/src/data/labourQuartierV208.json").read_text())
EVIDENCE = json.loads(
  (ROOT / "src/app/src/data/labourQuartierV208Evidence.json").read_text()
)


def test_exact_existing_parts_offsets_and_source_inputs_are_retained():
  assert len(DATA["owners"]) == len(EVIDENCE["parts"]) == 41
  assert DATA["sourceSuppressionIds"] == []
  assert {
    p["parentId"] for p in EVIDENCE["parts"] if p["kind"] != "quartier206"
  } == set(TARGETS)
  q = next(
    b
    for b in json.loads(
      (ROOT / "src/app/src/gendarmenmarktPerimeterSource.json").read_text()
    )["buildings"]
    if b["key"] == "quartier206"
  )
  assert len(q["officialParts"]) == 16
  assert EVIDENCE["q206StreetFronts"] == q["streetFronts"]
  for part, owner in zip(EVIDENCE["parts"], DATA["owners"], strict=True):
    assert owner["id"] == part["id"]
    assert abs(owner["groundY"] - (part["ground_y_m"] + part["dy"])) < 0.00001
    if part["kind"] == "quartier206":
      original = next(p for p in q["officialParts"] if p["id"] == part["id"])
      for key, value in original.items():
        assert part[key] == value
    elif part["legacyPrism"]:
      assert abs(owner["groundY"] - part["legacyPrism"]["y0_dm"] / 10) < 0.00001
  for name, digest in EVIDENCE["retainedInputs"].items():
    path = ROOT / name
    if not path.exists() and ("/raw/" in name or name.endswith(".gz")):
      continue
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest


def test_attachments_are_clipped_to_real_exposed_walls_and_q206_street_faces():
  qfronts = {(f["partId"], f["surfaceIndex"]) for f in EVIDENCE["q206StreetFronts"]}
  walls = [
    unary_union([shape(p) for p in f["exposedPolygons"]]) for f in EVIDENCE["faces"]
  ]
  seen = set()
  for fi, f in enumerate(EVIDENCE["faces"]):
    part = EVIDENCE["parts"][f["owner"]]
    assert part["surfaces"][f["surface"]]["kind"] == "WallSurface"
    if part["kind"] == "quartier206":
      key = part["id"], f["surface"]
      assert key in qfronts
      seen.add(key)
    assert abs(np.linalg.norm(f["normal"]) - 1) < 1e-9
    assert abs(np.dot(f["normal"], f["direction"])) < 1e-9
    assert not walls[fi].is_empty
  assert seen == qfronts
  for x, y, z, width, height, _, yaw, _, owner, fi, _ in DATA["boxes"]:
    f = EVIDENCE["faces"][fi]
    delta = np.array([x, z]) - f["a"]
    u = float(delta @ f["direction"])
    out = float(delta @ f["normal"])
    assert f["owner"] == owner
    assert 0.3 < out < 1.01
    assert abs(yaw - math.atan2(-f["direction"][1], f["direction"][0])) < 0.00001
    assert (
      walls[fi]
      .buffer(0.0021)
      .covers(box(u - width / 2, y - height / 2, u + width / 2, y + height / 2))
    )
  for surface in DATA["surfaces"]:
    f = EVIDENCE["faces"][surface["face"]]
    for triangle in surface["triangles"]:
      for x, y, z in triangle:
        delta = np.array([x, z]) - f["a"]
        assert abs(float(delta @ f["normal"]) - 0.35) < 0.00001
        assert (
          walls[surface["face"]]
          .buffer(0.00002)
          .covers(Point(float(delta @ f["direction"]), y))
        )


def test_all_native_prisms_clear_the_retained_4m_1m_and_q206_envelopes():
  # Reconstruct raw original columns independently; these are conservative
  # because the existing v169 transfer removes some duplicates at runtime.
  voxel = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json").read_text()
  )
  columns = {}
  grid, cell = voxel["grid"], voxel["cell_m"]
  for iz, row in enumerate(voxel["building_rows"]):
    z = (grid["min_z_idx"] + iz) * cell
    if not 580 <= z <= 810:
      continue
    for start, count, lo, hi, _ in row:
      for i in range(start, start + count):
        x = (grid["min_x_idx"] + i) * cell
        if not 755 <= x <= 1300:
          continue
        for dx in range(int(cell)):
          for dz in range(int(cell)):
            columns[x + dx, z + dz] = lo / 10, hi / 10
  for packet in [6, 7]:
    path = ROOT / f"src/app/src/data/altMitteV169Navigation/packet-{packet:03}.json"
    for x0, z0, x1, z1, high in json.loads(path.read_text()):
      if x1 < 755 or x0 > 1300 or z1 < 580 or z0 > 810:
        continue
      for x in range(x0, x1):
        for z in range(z0, z1):
          lo, hi = columns.get((x, z), (5, -100))
          columns[x, z] = min(lo, 5), max(hi, high)
  # Dedicated 2.5m Q206 source shell is additionally checked against actual
  # runtime matrices in the companion Bun test, not only this receipt.
  for x0, z0, x1, z1, low, high in EVIDENCE["nativeQuartier206Columns"]:
    for x in range(math.floor(x0), math.ceil(x1)):
      for z in range(math.floor(z0), math.ceil(z1)):
        lo, hi = columns.get((x, z), (low, high))
        columns[x, z] = min(lo, low), max(hi, high)
  for x, y, z, w, h, d, _, _, _, _ in DATA["blocks"]:
    for ix in range(math.floor(x - w / 2), math.ceil(x + w / 2)):
      for iz in range(math.floor(z - d / 2), math.ceil(z + d / 2)):
        span = columns.get((ix, iz))
        assert not span or y - h / 2 >= span[1] or y + h / 2 <= span[0]
  assert EVIDENCE["nativeMaximumClearanceM"] < 4.5
  assert len(DATA["blocks"]) < 19000
  assert len(DATA["boxes"]) < 11000
  assert DATA["stats"]["roles"]["main-portal"] == 3
  assert DATA["stats"]["roles"]["corner-glazing"] == 4
  assert EVIDENCE["quartier206StoreyDatum"]["upperFloors"] == 6
