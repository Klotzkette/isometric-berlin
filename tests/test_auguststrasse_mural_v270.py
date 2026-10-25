"""Exact source complement, supported artwork, independent native shell and sightline."""

import base64
import hashlib
import json

import numpy as np
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

from scripts.build_auguststrasse_mural_v270 import (
  BASE,
  CELL,
  DATA,
  EVIDENCE,
  OFFSET,
  ORIGIN,
  OWNER,
  PRISM,
  PRISMS,
  PROFILE,
  ROOT,
  SOURCE,
  VOXELS,
  A,
  N,
  core_cornice_receipt,
  gable_clearance_receipt,
  native_old_support,
  read,
  roof_at,
  sha,
  triangles_for,
  upper_clip,
)


def mesh(mode):
  p = read(DATA)[mode]
  v = np.frombuffer(base64.b64decode(p["positions"]), "<u2").reshape(-1, 3)
  i = np.frombuffer(base64.b64decode(p["indices"]), "<u4").reshape(-1, 3)
  return v.astype(float) / 100 + ORIGIN, i


def test_exact_retained_complete_source_and_lower_cut_receipt():
  e, p = read(EVIDENCE), read(PROFILE)
  assert e["source"] == next(b for b in read(SOURCE)["buildings"] if b["id"] == OWNER)
  assert e["previousPrism"] == next(
    b for b in read(PRISMS)["buildings"] if b["id"] == PRISM
  )
  assert (
    p["sourceOwnerSha256"]
    == hashlib.sha256(
      json.dumps(e["source"], sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
  )
  assert all(sha(ROOT / r["path"]) == r["sha256"] for r in e["sourceInputs"])
  assert (p["groundY"], p["drawnCutY"], p["nativeCutY"]) == (5.2, 20.2, 21.2)
  expected = []
  for part in e["source"]["parts"]:
    for s in part["surfaces"]:
      if s["kind"] not in ["WallSurface", "RoofSurface", "ClosureSurface"]:
        continue
      expected.append(
        dict(
          part=part["id"],
          polygon=s["sourcePolygonId"],
          kind=s["kind"],
          cutY=20.2,
          triangles=[
            t for tri in triangles_for(s["rings"]) for t in upper_clip(tri, 20.2)
          ],
        )
      )
  assert e["lowerCutReceipt"] == expected
  vertices, indices = mesh("drawn")
  upper = read(DATA)["metrics"]["drawn"]["upperTriangles"]
  actual = {
    tuple(sorted(tuple(np.round(v, 2)) for v in vertices[t])) for t in indices[:upper]
  }
  expected_triangles = {
    tuple(sorted(tuple(np.round(v, 2)) for v in t))
    for r in expected
    for t in r["triangles"]
  }
  assert actual == expected_triangles
  cornice = e["supersededCoreCornice"]
  assert cornice == core_cornice_receipt(e["previousPrism"])
  assert len(cornice["triangles"]) == 10 and len(cornice["lineSegments"]) == 12
  assert cornice["requiredReadyGate"] == "options.tachelesFrontsV270"
  ys = np.array(cornice["triangles"])[:, :, 1]
  assert abs(ys.min() - 19.94) < 1e-5 and abs(ys.max() - 20.16) < 1e-5
  world = (ROOT / "src/app/src/IsometricCityWorld.ts").read_text()
  assert (
    "!roofTriangles && !(options.tachelesFrontsV270 && isAuguststrasseOldGableRimV270("
    in world
  )
  assert "bodyHeight, CORNICE_HEIGHT_M, CORNICE_DEPTH_M," in world


def test_native_roof_is_complete_independent_cardinal_complement():
  e, p = read(EVIDENCE), read(PROFILE)
  footprint = unary_union(
    [Polygon(f["ring"], f["holes"]) for f in p["drawnFootprints"]]
  )
  cells = {(x, z): y for x, z, y in e["nativeRoofCells"]}
  for (x, z), y in cells.items():
    assert footprint.covers(Point((x + 0.5) * CELL, (z + 0.5) * CELL))
    assert (
      y
      == np.ceil(roof_at(p["roofTriangles"], (x + 0.5) * CELL, (z + 0.5) * CELL) / CELL)
      * CELL
    )
  native = unary_union([Polygon(f["ring"], f["holes"]) for f in p["nativeFootprints"]])
  assert (
    native.symmetric_difference(
      unary_union(
        [box(x * CELL, z * CELL, (x + 1) * CELL, (z + 1) * CELL) for x, z in cells]
      )
    ).area
    < 1e-8
  )
  vertices, indices = mesh("native")
  normal = np.cross(
    vertices[indices[:, 1]] - vertices[indices[:, 0]],
    vertices[indices[:, 2]] - vertices[indices[:, 0]],
  )
  assert np.all(np.sum(abs(normal) > 1e-8, axis=1) == 1)


def test_art_is_single_supported_field_with_all_recognition_elements():
  e, p, data = read(EVIDENCE), read(PROFILE), read(DATA)
  roles = {r["role"] for r in e["vectorLayers"]}
  assert {
    "dark-field",
    "light-sky",
    "face",
    "teddy-body",
    "red-balloon",
    "sun",
    "balloon-string",
  } <= roles
  assert {"letter-" + c for c in "BRINGTHEMOW"} <= roles
  assert p["text"] == "BRING THEM HOME NOW"
  vertices, indices = mesh("drawn")
  paint = vertices[indices[data["metrics"]["drawn"]["upperTriangles"] :]]
  assert np.max(abs((paint[:, :, [0, 2]] - A) @ N - OFFSET)) < 0.007
  assert paint[:, :, 1].min() >= BASE
  area = (
    np.linalg.norm(
      np.cross(paint[:, 1] - paint[:, 0], paint[:, 2] - paint[:, 0]), axis=1
    ).sum()
    / 2
  )
  panel = Polygon(e["panel"]["ring"], e["panel"]["holes"])
  expected = panel.area * p["anchor"]["width"] * p["anchor"]["height"] / 10_000
  assert (
    abs(area - expected) / expected < 0.002
  )  # One centimetre quantisation; no layered full-wall copies.
  for x, y, z0, z1, _ in e["nativePaintRuns"]:
    for z in np.arange(z0 + 0.05, z1, 0.1):
      size = 4 if y < p["nativeCutY"] else CELL
      rows = e["sourceColumns"] if size == 4 else e["nativeRoofCells"]
      xs = [
        r[0] * size
        for r in rows
        if r[1] == np.floor(z / size) and (r[3] / 10 if size == 4 else r[2]) >= y + 0.05
      ]
      xs += [
        ix * 2
        for ix, iy, iz in e["nativeOldSupport"]["cells"]
        if iz == np.floor(z / 2) and iy * 2 + 3 <= y + 0.05 < (iy + 1) * 2 + 3
      ]
      assert abs(x - min(xs) + e["nativePaintOffsetM"]) < 1e-7
  assert DATA.stat().st_size < 550_000 and PROFILE.stat().st_size < 6_000


def triangle_hit(eye, target, triangle):
  a, b, c = np.array(triangle)
  d = target - eye
  e1, e2 = b - a, c - a
  q = np.cross(d, e2)
  det = np.dot(e1, q)
  if abs(det) < 1e-9:
    return False
  u = np.dot(eye - a, q) / det
  r = np.cross(eye - a, e1)
  v, t = np.dot(d, r) / det, np.dot(e2, r) / det
  return u >= 0 and v >= 0 and u + v <= 1 and 1e-6 < t < 0.99


def test_tacheles_camera_clears_actual_neighbour_core_and_complete_source_sheets():
  eye = np.array(read(PROFILE)["camera"]["eye"])
  targets = [[1290, 14.5, -753], [1290, 21, -753], [1289, 8, -757], [1291, 8, -749]]
  near = []
  for b in read(SOURCE)["buildings"]:
    if b["id"] == OWNER:
      continue
    shape = unary_union(
      [Polygon(p["ring"], p["holes"]) for p in b["footprintPolygons"]]
    )
    if shape.intersects(box(1235, -761, 1293, -732)):
      near.extend(
        t for p in b["parts"] for s in p["surfaces"] for t in triangles_for(s["rings"])
      )
  assert len(near) > 100
  for target in targets:
    assert not any(triangle_hit(eye, np.array(target), t) for t in near)
    line = LineString([eye[[0, 2]], np.array(target)[[0, 2]]])
    for p in read(PRISMS)["buildings"]:
      poly = Polygon(
        np.array(p["ring"]) / 10, [np.array(h) / 10 for h in p.get("holes", [])]
      )
      if not line.intersects(poly):
        continue
      intersection = line.intersection(poly)
      for piece in getattr(intersection, "geoms", [intersection]):
        for x, z in piece.coords:
          fraction = line.project(Point(x, z)) / line.length
          assert (
            fraction >= 0.99
            or eye[1] + fraction * (target[1] - eye[1]) >= (p["y0_dm"] + p["h_dm"]) / 10
          )


def test_actual_original_native_columns_remain_the_art_support():
  e, voxel = read(EVIDENCE), read(VOXELS)
  for x, z, lo, hi, kind in e["sourceColumns"]:
    row = voxel["building_rows"][z - voxel["grid"]["min_z_idx"]]
    assert any(
      voxel["grid"]["min_x_idx"] + start
      <= x
      < voxel["grid"]["min_x_idx"] + start + count
      and [low, high, cls] == [lo, hi, kind]
      for start, count, low, high, cls in row
    )
  assert len(e["sourceColumns"]) == 11


def test_quantised_gable_ornaments_stay_behind_minimally_offset_artwork():
  e, data = read(EVIDENCE), read(DATA)
  receipt = e["oldGableClearance"]
  assert receipt == gable_clearance_receipt()
  assert receipt["owner"] == PRISM
  assert receipt["kind"] == "oranien-corridors-v167"
  assert len(receipt["triangles"]) > 50
  assert receipt["chosenOffsetM"] == 0.27
  assert receipt["exactMaximumOutwardM"] < 0.257
  vertices, indices = mesh("drawn")
  paint = vertices[indices[data["metrics"]["drawn"]["upperTriangles"] :]]
  assert np.min((paint[:, :, [0, 2]] - A) @ N) - receipt["exactMaximumOutwardM"] > 0.007


def test_native_side_and_cap_paint_is_supported_by_exact_published_original_cells():
  e, p = read(EVIDENCE), read(PROFILE)
  assert e["nativeOldSupport"] == native_old_support()
  assert len(e["nativeOldSupport"]["cells"]) == 38
  assert len(e["nativeOldSupport"]["triangles"]) == 308
  boxes = [
    [x * 4, lo / 10, z * 4, (x + 1) * 4, hi / 10, (z + 1) * 4]
    for x, z, lo, hi, _ in e["sourceColumns"]
  ]
  boxes += [
    [x * 2, y * 2 + 3, z * 2, (x + 1) * 2, (y + 1) * 2 + 3, (z + 1) * 2]
    for x, y, z in e["nativeOldSupport"]["cells"]
  ]
  boxes += [
    [x * CELL, p["nativeCutY"], z * CELL, (x + 1) * CELL, h, (z + 1) * CELL]
    for x, z, h in e["nativeRoofCells"]
  ]
  boxes = np.array(boxes)
  for face in e["nativePaintWraps"]:
    point = np.mean(face["quad"], axis=0)
    point[face["axis"]] -= face["sign"] * (e["nativePaintOffsetM"] + 0.005)
    assert np.any(
      np.all(point >= boxes[:, :3] - 1e-7, axis=1)
      & np.all(point <= boxes[:, 3:] + 1e-7, axis=1)
    )
  assert len(e["nativePaintWraps"]) > 1000
