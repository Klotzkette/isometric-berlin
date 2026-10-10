"""Independent source retention, court and attachment checks for Kapelle-Ufer."""

import hashlib
import json
import math
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "src/app/src/data/ministrySpreeV207.json").read_text())
EVIDENCE = json.loads(
  (ROOT / "src/app/src/data/ministrySpreeV207Evidence.json").read_text()
)


def test_all_original_owners_portico_sheets_holes_and_datums_are_retained():
  old = {
    p["id"]: p
    for p in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
    )["buildings"]
  }
  assert len(DATA["owners"]) == len(EVIDENCE["sourceParts"]) == 11
  assert sum(len(p["surfaces"]) for p in EVIDENCE["sourceParts"]) == 138
  main = next(p for p in EVIDENCE["sourceParts"] if p["id"] == "DEBE3DvYGtxhg1Aq")
  assert len(main["holes"]) == 3
  for part, owner in zip(EVIDENCE["sourceParts"], DATA["owners"], strict=True):
    assert part["legacyPrism"] == old[part["id"][-8:]]
    assert owner["groundY"] == old[part["id"][-8:]]["y0_dm"] / 10
    for source, placed in zip(part["surfaces"], part["placedSurfaces"], strict=True):
      for source_ring, placed_ring in zip(
        source["rings"], placed["rings"], strict=True
      ):
        assert len(source_ring) == len(placed_ring)
        for a, b in zip(source_ring, placed_ring, strict=True):
          assert a[0] == b[0] and a[2] == b[2]
          assert abs(a[1] + part["sourceYTranslationM"] - b[1]) < 0.00001
  for name, digest in EVIDENCE["retainedInputs"].items():
    path = ROOT / name
    if "/raw/" in name and not path.exists():
      continue
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest


def test_drawn_subdivisions_are_inside_their_exact_exposed_measured_faces():
  for r in DATA["boxes"]:
    x, y, z, w, h, depth, _, _, role, owner, fi = r
    if role == 7:
      part = EVIDENCE["sourceParts"][owner]
      roofs = [
        Polygon([(p[0], p[2]) for p in s["rings"][0]])
        for s in part["placedSurfaces"]
        if s["kind"] == "RoofSurface"
      ]
      assert unary_union(roofs).covers(
        box(x - w / 2, z - depth / 2, x + w / 2, z + depth / 2)
      )
      continue
    f = EVIDENCE["faces"][fi]
    delta = np.array([x, z]) - f["a"]
    u = float(delta @ f["direction"])
    outward = float(delta @ f["normal"])
    assert 0.3 < outward < 0.75
    wall = unary_union([shape(p) for p in f["exposedPolygons"]])
    assert wall.buffer(0.0001).covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2))
    assert f["owner"] == owner


def test_native_windows_clear_both_retained_shells_and_court_centres_stay_open():
  raster = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json").read_text()
  )
  cell, grid = raster["cell_m"], raster["grid"]
  columns = {}
  for zi, row in enumerate(raster["building_rows"]):
    z = (grid["min_z_idx"] + zi + 0.5) * cell
    if not -580 < z < -370:
      continue
    for start, count, low, top, _ in row:
      for xi in range(start, start + count):
        x = (grid["min_x_idx"] + xi + 0.5) * cell
        if 190 < x < 385:
          columns[(math.floor(x / cell), math.floor(z / cell))] = [low / 10, top / 10]
  # The independent v169 native envelope is essential: its 2 m wall courses
  # stand beyond many older raster faces. A raster-only skin failed this check.
  native = {}
  for packet in [6, 7]:
    spans = json.loads(
      (
        ROOT / f"src/app/src/data/altMitteV169Navigation/packet-{packet:03}.json"
      ).read_text()
    )
    for x0, z0, x1, z1, high in spans:
      if x1 < 190 or x0 > 385 or z1 < -580 or z0 > -370:
        continue
      for x in range(x0, x1):
        for z in range(z0, z1):
          native[x, z] = max(native.get((x, z), -100), high)
    for receipt in EVIDENCE["nativeAltMitteSpans"]:
      if receipt["packet"] == packet:
        assert receipt["span"] == spans[receipt["index"]]
  legacy = json.loads(
    (ROOT / "src/app/src/data/altMitteV169Navigation/packet-000.json").read_text()
  )
  transfer = []
  for part in legacy:
    shape = Polygon(
      [(x / 10, z / 10) for x, z in part["ring"]],
      [[(x / 10, z / 10) for x, z in ring] for ring in part.get("holes", [])],
    )
    if not shape.intersects(box(190, -580, 385, -370)):
      continue
    base = part["y0_dm"] / 10
    transfer.append(
      (
        shape,
        base,
        base + math.ceil(part["h_dm"] / 40) * 4,
        part["roof"] in [3100, 3200, 3300, 3400],
      )
    )
  active = {}
  for record in EVIDENCE["nativeRasterColumns"]:
    ix, iz = record["index"]
    low, high = columns[ix, iz]
    assert [low, high] == [record["groundY"], record["topY"]]
    center = box(ix * 4, iz * 4, ix * 4 + 4, iz * 4 + 4).centroid
    transferred = any(
      shape.covers(center)
      and (
        (abs(low - base) < 0.11 and abs(high - top) < 0.11)
        or (tier and abs(low - top) < 0.11 and abs(high - top - 4) < 0.11)
      )
      for shape, base, top, tier in transfer
    )
    assert transferred == record["transferredByExistingV169"]
    if not transferred:
      active[ix, iz] = [low, high]
  # This marginal raw column survives the frozen decimetre ownership test,
  # despite lying inside the more precise later source footprint.
  assert (61, -134) in active
  main = next(p for p in EVIDENCE["sourceParts"] if p["id"] == "DEBE3DvYGtxhg1Aq")
  courts = [Polygon(h).representative_point() for h in main["holes"]]
  for r in DATA["blocks"]:
    x, y, z, w, h, d, _, role, _ = r
    if role == 1:
      # Test the entire pane prism, including the night pane's wider XZ
      # outline, against every intersected source cell rather than its centre.
      for cx in range(
        math.floor(x - w / 2 - 0.0125), math.floor(x + w / 2 + 0.0125) + 1
      ):
        for cz in range(
          math.floor(z - d / 2 - 0.0125), math.floor(z + d / 2 + 0.0125) + 1
        ):
          levels = active.get((math.floor(cx / cell), math.floor(cz / cell)))
          assert not levels or y - h / 2 >= levels[1] or y + h / 2 <= levels[0]
          assert y - h / 2 >= native.get((cx, cz), -100)
    for p in courts:
      assert abs(p.x - x) > w / 2 or abs(p.y - z) > d / 2
  assert EVIDENCE["nativeMaximumAttachmentShiftM"] < 0.7
  assert EVIDENCE["nativeCellM"] == 2
  assert all(d["sourceDistanceM"] < 2.85 for d in EVIDENCE["nativeColumns"])
  assert all(d["sourceOverlapAreaM2"] > 0 for d in EVIDENCE["nativeColumns"])
  assert len(DATA["blocks"]) < 20000


def test_scope_has_one_named_parent_and_no_geometry_reassignment():
  assert {p["parentId"] for p in DATA["owners"]} == {
    "DEBE01YYK00005iG",
    "DEBE01YYK0001xGY",
  }
  assert EVIDENCE["osmIdentity"]["id"] == "way/1302352107"
  assert not any(k in DATA for k in ["replacements", "navigation", "suppressedIds"])
  assert len(DATA["boxes"]) == EVIDENCE["stats"]["drawnBoxes"]
  assert len(DATA["blocks"]) == EVIDENCE["stats"]["nativeBlocks"]
