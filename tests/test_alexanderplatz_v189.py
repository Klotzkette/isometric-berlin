"""Bounded recognition must retain source sheets and leave plaza voids alone."""

import gzip
import hashlib
import importlib.util
import json
import math
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
  "alexanderplatz_v189", ROOT / "scripts/build_alexanderplatz_v189.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_reproducible_members_and_complete_original_source() -> None:
  drawn, native, evidence = module.build()
  for relative, value in [
    ("src/app/src/data/alexanderplatzV189.json", drawn),
    ("src/app/src/data/alexanderplatzV189Native.json", native),
    ("geo_data/regierungsviertel/alexanderplatz-v189-evidence.json", evidence),
  ]:
    assert json.loads((ROOT / relative).read_text()) == value
  path = ROOT / evidence["sourcePath"]
  assert hashlib.sha256(path.read_bytes()).hexdigest() == evidence["sourceSha256"]
  original = next(
    b
    for b in json.loads(gzip.decompress(path.read_bytes()))["buildings"]
    if b["id"] == module.PARENT
  )
  assert evidence["building"] == original
  assert len(original["parts"]) == 6
  assert original["osmContext"]["id"] == "OSM-way-24273225"
  assert len(evidence["faces"]) == 9
  for face in evidence["faces"]:
    part = next(p for p in original["parts"] if p["id"] == face["partId"])
    assert face["rings"] == part["surfaces"][face["surfaceIndex"]]["rings"]


def test_only_shallow_upper_members_and_bounded_independent_native_cost() -> None:
  drawn, native, evidence = module.build()
  footprint = unary_union(
    [Polygon(p["ring"], p["holes"]) for p in evidence["building"]["footprintPolygons"]]
  )
  assert len(drawn["boxes"]) == 732
  assert len(native["boxes"]) == 1520
  assert drawn["counts"]["curved-podium-shell"] == 240
  assert drawn["counts"]["aluminium-spandrel"] == 105
  for source in [drawn, native]:
    for row in source["boxes"]:
      assert all(math.isfinite(v) for v in row)
      assert min(row[3:6]) > 0
      assert row[1] - row[4] / 2 > 12.5
      # No member reaches a ground-level street, stair, courtyard or public void.
      assert footprint.buffer(2.5).covers(Point(row[0], row[2]))
      assert row[1] + row[4] / 2 < 70
  # Native geometry is separately sampled rather than smooth matrices reused.
  assert all(len(row) == 7 for row in native["boxes"])
  assert all(len(row) == 9 for row in drawn["boxes"])


def test_backing_is_source_contained_outside_old_windows_and_behind_new_glazing() -> (
  None
):
  drawn, _, evidence = module.build()
  assert drawn["counts"]["source-contained-curtain-wall-backing"] == 7
  for face in evidence["faces"]:
    if face["partId"] not in module.TOWER:
      continue
    skin = drawn["boxes"][face["firstBox"]]
    assert skin[8] == 0xC0C2B7
    n = np.array(face["normal"])
    source_origin = np.array(face["rings"][0][0])
    signed_distance = float(np.dot(np.array(skin[:3]) - source_origin, n))
    assert abs(signed_distance - 0.29) < 0.00002
    outer = signed_distance + skin[5] / 2
    # Original v169 sill depth is 0.125 m and v186 edge reaches 0.285 m.
    assert outer > 0.30
    skin_d = np.array([math.cos(skin[6]), 0, -math.sin(skin[6])])
    wall = Polygon(
      [
        [float(np.dot(np.array(p) - source_origin, skin_d)), p[1]]
        for p in face["rings"][0]
      ]
    )
    center_u = float(np.dot(np.array(skin[:3]) - source_origin, skin_d))
    for u in [center_u - skin[3] / 2, center_u + skin[3] / 2]:
      for y in [skin[1] - skin[4] / 2, skin[1] + skin[4] / 2]:
        assert wall.buffer(0.0002).covers(Point(u, y))
    for row in drawn["boxes"][
      face["firstBox"] + 1 : face["firstBox"] + face["boxCount"]
    ]:
      if row[8] != 0x668594:
        continue
      glass_distance = float(np.dot(np.array(row[:3]) - source_origin, n))
      assert glass_distance - row[5] / 2 > outer + 0.004
