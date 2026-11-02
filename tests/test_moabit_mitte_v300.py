"""Independent source/ownership checks for the bounded Moabit/Mitte correction."""

from __future__ import annotations

import base64
import gzip
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def test_complete_source_parent_sheets_and_navigation():
  source = read(ROOT / "geo_data/regierungsviertel/moabit-mitte-v300-source.json.gz")
  profile = read(DATA / "moabitMitteV300Profile.json")
  parents = {p["id"]: p for p in source["parents"]}
  assert len(profile["sites"]) == 27
  assert sum(len(s["addresses"]) for s in profile["sites"]) == 29
  assert len(profile["fronts"]) == 43
  assert all(s["parent"] != "DEBE01YYK00002OM" for s in profile["sites"])
  nav = {p["id"]: p for p in profile["navigation"]}
  for site in profile["sites"]:
    parent = parents[site["parent"]]
    receipt = next(
      r for r in profile["sourceParentReceipts"] if r["parent"] == parent["id"]
    )
    assert receipt["parts"] == [p["id"] for p in parent["parts"]]
    assert receipt["surfaces"] == sum(len(p["surfaces"]) for p in parent["parts"])
    for part in parent["parts"]:
      actual = nav[part["id"]]
      assert actual["ring"] == part["ring"]
      assert actual["holes"] == part["holes"]
      assert abs(actual["low"] - part["ground_y_m"] - site["displayOffsetY"]) < 1e-7
      assert abs(actual["high"] - part["top_y_m"] - site["displayOffsetY"]) < 1e-7
      assert actual["roofTriangles"]
  for number, minimum in [("53", 23), ("54", 23), ("55", 25)]:
    site = next(
      s
      for s in profile["sites"]
      if {"street": "Waldstraße", "number": number}
      in [{k: a[k] for k in ("street", "number")} for a in s["addresses"]]
    )
    assert site["correctedBody"] and site["measuredHeight"] > minimum


def test_complete_measured_drawn_sheets_and_cardinal_native_members():
  data = read(DATA / "moabitMitteV300Core.json")
  p = np.frombuffer(base64.b64decode(data["drawn"]["positions"]), "<f4").reshape(-1, 3)
  ix = np.frombuffer(base64.b64decode(data["drawn"]["indices"]), "<u4").reshape(-1, 3)
  assert len(ix) == data["counts"]["sourceTriangles"] == 2230
  assert np.isfinite(p).all() and ix.max() < len(p)
  assert data["counts"]["drawnTriangles"] == len(ix) + len(data["fittings"]) * 12
  assert data["counts"]["nativeTriangles"] == len(data["nativeBoxes"]) * 12
  for row in data["nativeBoxes"]:
    assert len(row) == 8 and row[6] == 0
    assert all(value > 0 for value in row[3:6])
  assert data["roles"]["drawn"]["measured-wall"] > 0
  assert data["roles"]["drawn"]["measured-roof"] > 0
  assert data["roles"]["drawn"]["photo-guided-projecting-balcony-slab"] > 0


def test_every_retired_native_column_is_actual_exclusive_and_every_old_prism_exact():
  owners = read(DATA / "moabitMitteV300Owners.json")
  core = read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")
  voxel = read(ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json")
  by_id = {p["id"]: p for p in core["buildings"]}
  ours = {p["id"] for p in owners["oldPrisms"] + owners["retainedPrisms"]}
  assert len(owners["oldPrisms"]) == 24 and len(owners["retainedPrisms"]) == 13
  for p in owners["oldPrisms"] + owners["retainedPrisms"]:
    assert by_id[p["id"]] == p
  assert "24362573" not in ours  # incomplete Tucholsky38 old footprint stays.
  assert owners["nativeClasses"] == voxel["classes"]
  assert owners["nativeGrid"] == voxel["grid"]
  for r in owners["nativeRows"]:
    assert r["row"] == voxel["building_rows"][r["index"]]
  shapes = [
    Polygon(np.array(p["ring"]) / 10, [np.array(h) / 10 for h in p.get("holes", [])])
    for p in core["buildings"]
  ]
  tree = STRtree(shapes)
  assert len(owners["nativeColumns"]) == 681
  for x, z, low, high, kind in owners["nativeColumns"]:
    row = voxel["building_rows"][z - voxel["grid"]["min_z_idx"]]
    assert any(
      voxel["grid"]["min_x_idx"] + r[0] <= x < voxel["grid"]["min_x_idx"] + r[0] + r[1]
      and r[2:] == [low, high, kind]
      for r in row
    )
    point = Point((x + 0.5) * 4, (z + 0.5) * 4)
    actual = [
      core["buildings"][int(i)]["id"]
      for i in tree.query(point)
      if shapes[int(i)].covers(point)
    ]
    assert actual and set(actual) <= ours


def test_complementary_court_faces_stay_outside_source_seams_and_foreign_party_walls():
  profile = read(DATA / "moabitMitteV300Profile.json")
  source = read(ROOT / "geo_data/regierungsviertel/moabit-mitte-v300-source.json.gz")
  core = read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")
  from shapely.ops import unary_union

  footprints = {
    p["id"]: unary_union([Polygon(q["ring"], q["holes"]) for q in p["parts"]])
    for p in source["parents"]
  }
  shapes = [
    Polygon(np.array(p["ring"]) / 10, [np.array(h) / 10 for h in p.get("holes", [])])
    for p in core["buildings"]
  ]
  tree = STRtree(shapes)
  sites = {s["parent"]: s for s in profile["sites"]}
  assert len(profile["complementaryFaces"]) == 94
  assert any(f["owner"] == "DEBE01YYK0002VJ5" for f in profile["complementaryFaces"])
  for face in profile["complementaryFaces"]:
    a, b, n = face["a"], face["b"], face["normal"]
    outside = Point((a[0] + b[0]) / 2 + n[0] * 0.4, (a[1] + b[1]) / 2 + n[1] * 0.4)
    assert not footprints[face["owner"]].covers(outside)
    old_ids = set(sites[face["owner"]]["oldIds"])
    assert not any(
      core["buildings"][int(i)]["id"] not in old_ids and shapes[int(i)].covers(outside)
      for i in tree.query(outside)
    )
  assert profile["conservativeOmissions"][0]["oldCoverage"][0]["coveredFraction"] < 0.67
  data = read(DATA / "moabitMitteV300Core.json")
  assert (
    data["roles"]["native"]["complementary-reference-estimated-window-glazing-native"]
    > 0
  )


def test_every_emitted_drawn_fitting_is_inside_its_actual_source_wall_and_free_interval():
  from shapely.geometry import LineString, box

  source = read(ROOT / "geo_data/regierungsviertel/moabit-mitte-v300-source.json.gz")
  profile = read(DATA / "moabitMitteV300Profile.json")
  data = read(DATA / "moabitMitteV300Core.json")
  core = read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")
  parents = {p["id"]: p for p in source["parents"]}
  sites = {s["parent"]: s for s in profile["sites"]}
  shapes = [
    Polygon(np.array(p["ring"]) / 10, [np.array(h) / 10 for h in p.get("holes", [])])
    for p in core["buildings"]
  ]
  tree = STRtree(shapes)
  covered = set()
  for f in profile["fronts"] + profile["complementaryFaces"]:
    a, b, n = np.array(f["a"]), np.array(f["b"]), np.array(f["normal"])
    d = (b - a) / np.linalg.norm(b - a)
    part = next(p for p in parents[f["owner"]]["parts"] if p["id"] == f["part"])
    rings = [
      [
        [
          float(np.dot(np.array([q[0], q[2]]) - a, d)),
          q[1] + sites[f["owner"]]["displayOffsetY"],
        ]
        for q in ring
      ]
      for ring in part["surfaces"][f["surface"]]["rings"]
    ]
    wall = Polygon(rings[0], rings[1:]).buffer(0.001)
    first, count = f["drawnFittingRange"]
    own_ids = set(sites[f["owner"]]["oldIds"])
    for i in range(first, first + count):
      row = data["fittings"][i]
      u = float(np.dot(np.array([row[0], row[2]]) - a, d))
      assert wall.covers(
        box(u - row[3] / 2, row[1] - row[4] / 2, u + row[3] / 2, row[1] + row[4] / 2)
      ), (f["owner"], f["part"], f["surface"], i)
      line = LineString(
        [a + d * (u - row[3] / 2) + n * 0.4, a + d * (u + row[3] / 2) + n * 0.4]
      )
      assert not any(
        core["buildings"][int(j)]["id"] not in own_ids
        and shapes[int(j)].intersection(line).length > 0.002
        for j in tree.query(line)
      ), (f["owner"], i)
      covered.add(i)
  assert covered == set(range(len(data["fittings"])))


def test_native_roof_navigation_rows_equal_actual_compiled_cap_boxes():
  from shapely.geometry import box

  profile = read(DATA / "moabitMitteV300Profile.json")
  data = read(DATA / "moabitMitteV300Core.json")
  caps = [r for r in data["nativeBoxes"] if r[7] in {0x645D56, 0x755B4D}]
  shapes = [
    box(r[0] - r[3] / 2, r[2] - r[5] / 2, r[0] + r[3] / 2, r[2] + r[5] / 2)
    for r in caps
  ]
  tree = STRtree(shapes)
  assert len(profile["nativeRoofs"]) > 1000
  for _, x, z, length, _, high in profile["nativeRoofs"]:
    for ix in {x, x + length - 1}:
      point = Point((ix + 0.5) * 0.5, (z + 0.5) * 0.5)
      matches = [
        caps[int(i)][1] + caps[int(i)][4] / 2
        for i in tree.query(point)
        if shapes[int(i)].covers(point)
      ]
      assert any(abs(y - high) < 1e-5 for y in matches)


def test_every_native_glazing_strip_has_a_complete_exposed_cardinal_support_face():
  import math

  profile = read(DATA / "moabitMitteV300Profile.json")
  data = read(DATA / "moabitMitteV300Core.json")
  cells = {}
  for parent, x, z, length, low, high in profile["nativeRoofs"]:
    family = cells.setdefault(parent, {})
    for ix in range(x, x + length):
      family[(ix, z)] = (low, high - 0.05)
  checked = 0
  for face in profile["fronts"] + profile["complementaryFaces"]:
    axis = 0 if abs(face["normal"][0]) >= abs(face["normal"][1]) else 1
    across = 1 - axis
    sign = 1 if face["normal"][axis] > 0 else -1
    family = cells[face["owner"]]
    start, count = face["nativeFittingRange"]
    for row in data["nativeBoxes"][start : start + count]:
      if row[7] != 0x526263:
        continue
      point = [row[0], row[2]]
      plane = point[axis] - sign * 0.108
      assert abs(plane / 0.5 - round(plane / 0.5)) < 1e-5
      along_width = row[3] if axis == 1 else row[5]
      left, right = point[across] - along_width / 2, point[across] + along_width / 2
      axis_index = round(plane / 0.5) - (1 if sign > 0 else 0)
      covered = 0
      for across_index in range(math.floor(left / 0.5), math.ceil(right / 0.5)):
        lo, hi = max(left, across_index * 0.5), min(right, (across_index + 1) * 0.5)
        if hi - lo < 1e-5:
          continue
        key = [0, 0]
        key[axis], key[across] = axis_index, across_index
        support = family.get(tuple(key))
        assert (
          support
          and support[0] <= row[1] - row[4] / 2 + 1e-5
          and support[1] >= row[1] + row[4] / 2 - 1e-5
        ), (face["owner"], row)
        key[axis] += sign
        neighbour = family.get(tuple(key))
        assert (
          not neighbour
          or neighbour[0] >= row[1] + row[4] / 2 - 1e-5
          or neighbour[1] <= row[1] - row[4] / 2 + 1e-5
        )
        covered += hi - lo
      assert abs(covered - along_width) < 1e-5
      checked += 1
  assert checked > 1000
