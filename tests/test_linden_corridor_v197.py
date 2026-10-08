"""Audit the new facade layer against retained source walls and ownership."""

import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Polygon, box
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_linden_corridor_v197 as model  # noqa: E402

DATA = json.loads((model.DATA / "lindenCorridorV197.json").read_text())
RECEIPT = json.loads((model.DATA / "lindenCorridorV197Evidence.json").read_text())
PROFILE = json.loads(model.PROFILE.read_text())


def wall(face):
  a = np.asarray(face["a"])
  d = (np.asarray(face["b"]) - a) / face["length"]
  rings = [
    [(float((np.asarray([p[0], p[2]]) - a) @ d), p[1]) for p in ring]
    for ring in face["rings"]
  ]
  return a, d, Polygon(rings[0], rings[1:]).buffer(0)


def test_source_owners_datums_and_existing_scene_are_preserved():
  records = {r["id"]: r for r in model.source_records()}
  assert len(DATA["owners"]) == 13
  assert {o["id"] for o in DATA["owners"]} == {
    r["parentId"] for r in PROFILE["buildings"]
  }
  for owner in DATA["owners"]:
    source = records[owner["id"]]
    assert source["category"] == "core"
    assert not any(owner["id"].endswith(s) for s in PROFILE["protectedSuffixes"])
    assert (
      owner["sourceSha256"]
      == hashlib.sha256(json.dumps(source, sort_keys=True).encode()).hexdigest()
    )
    assert (
      owner["groundY"] == source["groundY"]
      and owner["groundNHN"] == source["groundNHN"]
    )
    assert owner["osmContext"] == source["osmContext"]
  for path, digest in RECEIPT["sourceSha256"].items():
    assert model.digest(ROOT / path) == digest
  for name, digest in {
    "altMitteDrawnV169Source.json": "b1ba8cc6003e8cdbabcc4a9add4433bcdbc62895b268a45b86bace09ffda7b4a",
    "altMitteNativeV169Source.json": "2d6800c4b4f9e7445f8a9c47404f2001bbbc3e1cecf7c7405c7eb7a943601bf6",
    "weinbergBuildingOffsetsV176.json": "d4e4a8d92cb47831a18924896fbe652fca360089f0194246ea8b2ff67d46e749",
  }.items():
    assert model.digest(model.DATA / name) == digest


def test_every_plane_and_member_fits_its_specific_measured_source_wall():
  records = {r["id"]: r for r in model.source_records()}
  for face in RECEIPT["selectedFaces"]:
    exact = [
      s
      for p in records[face["parentId"]]["parts"]
      for s in p["surfaces"]
      if s["sourcePolygonId"] == face["sourcePolygonId"]
    ]
    assert len(exact) == 1 and exact[0]["kind"] == "WallSurface"
    assert exact[0]["rings"] == face["rings"]
    a, d, poly = wall(face)
    n = np.asarray(face["normal"])
    for surface in DATA["surfaces"][
      face["firstSurface"] : face["firstSurface"] + face["surfaceCount"]
    ]:
      assert surface["owner"] == face["owner"]
      for triangle in surface["triangles"]:
        uv = []
        for x, y, z in triangle:
          p = np.asarray([x, z]) - a
          assert abs(p @ n - 0.21) < 0.00002
          uv.append((float(p @ d), y))
        assert poly.buffer(0.00002).covers(Polygon(uv))
    for r in DATA["boxes"][face["firstBox"] : face["firstBox"] + face["boxCount"]]:
      p = np.asarray([r[0], r[2]]) - a
      u = float(p @ d)
      assert r[11] == face["owner"]
      assert poly.buffer(0.0006).covers(
        box(u - r[3] / 2, r[1] - r[4] / 2, u + r[3] / 2, r[1] + r[4] / 2)
      )
      assert 0.22 <= p @ n <= 1.031
      assert 0 < r[5] <= 0.32 and r[1] + r[4] / 2 <= face["eave"] + 0.001


def test_native_boxes_are_bounded_to_their_own_frontage_and_vertical_datum():
  for face in RECEIPT["selectedFaces"]:
    a, d, poly = wall(face)
    n = np.asarray(face["normal"])
    # A 0.5m voxel can reach a full half metre beyond the sampled point in
    # each X/Z direction. This is the exact normal projection of that cell.
    cell_margin = 0.5 * (abs(n[0]) + abs(n[1])) + 0.001
    for r in DATA["blocks"][
      face["firstBlock"] : face["firstBlock"] + face["blockCount"]
    ]:
      assert r[8] == face["owner"]
      assert min(r[4], r[6], r[7]) >= 0.5
      assert all(abs(v * 2 - round(v * 2)) < 1e-6 for v in [r[4], r[6], r[7]])
      for dx in [-r[4] / 2, r[4] / 2]:
        for dz in [-r[7] / 2, r[7] / 2]:
          p = np.asarray([r[0] + dx, r[2] + dz]) - a
          assert -cell_margin <= p @ d <= face["length"] + cell_margin
          assert 0.21 + 1.10 - cell_margin <= p @ n <= 0.40 + 1.65 + cell_margin
          for dy in [-r[6] / 2, r[6] / 2]:
            assert poly.buffer(0.71).covers(
              box(
                float(p @ d) - 0.00001,
                r[1] + dy - 0.00001,
                float(p @ d) + 0.00001,
                r[1] + dy + 0.00001,
              )
            )


def test_drawn_glazing_has_visible_clearance_from_backing_and_dividers():
  # Viewer regression: the original17.5–47.5mm layer gaps produced chewed
  # panes at corridor viewing distances. Test actual emitted pieces, not a
  # constant that could become disconnected from the generated payload.
  panes = dividers = 0
  for face in RECEIPT["selectedFaces"]:
    a, _, _ = wall(face)
    n = np.asarray(face["normal"])
    for row in DATA["boxes"][face["firstBox"] : face["firstBox"] + face["boxCount"]]:
      offset = float((np.asarray([row[0], row[2]]) - a) @ n)
      if row[7] in [0x687C7C, 0x596C70, 0x586C69]:
        assert abs(offset - 0.62) < 0.00002 and row[5] == 0.03
        assert offset + row[5] / 2 - 0.44 > 0.19
        panes += 1
      elif row[5] == 0.04 and row[8] in [2, 4]:
        assert abs(offset - 0.80) < 0.00002
        assert offset + row[5] / 2 - (0.62 + 0.03 / 2) > 0.18
        dividers += 1
  assert panes > 1000 and dividers > 1000


def test_documented_axes_are_shared_across_source_fragments_not_repeated():
  faces = RECEIPT["selectedFaces"]
  for suffix, kind, street, count in [
    ("06Zy", "zollern", "Unter den Linden", 12),
    ("0D1e", "wagon", "Unter den Linden", 7),
    ("02o1", "schadow", "Schadowstraße", 7),
    ("06UP", "daimler", "Unter den Linden", 5),
  ]:
    chosen = [
      f
      for f in faces
      if f["parentId"].endswith(suffix)
      and f["composition"] == kind
      and f["street"] == street
    ]
    assert chosen and sum(f["bays"] for f in chosen) == count
    assert all(f["documentedMainBays"] == count for f in chosen)
  kaiser = [f for f in faces if f["parentId"].endswith("06UP")]
  assert {f["composition"] for f in kaiser} == {"kaiser", "daimler"}
  assert all(
    f["documentedMainBays"] == 0 for f in kaiser if f["street"] == "Mittelstraße"
  )
  assert {f["street"] for f in faces} >= {
    "Unter den Linden",
    "Mittelstraße",
    "Friedrichstraße",
    "Schadowstraße",
    "Neustädtische Kirchstraße",
    "Behrenstraße",
    "Wilhelmstraße",
  }


def test_internal_source_seams_preserve_actual_glazing_and_subfront_boundaries():
  from collections import defaultdict

  from shapely.geometry import Point, shape

  for suffix, kind, per_row, rows in [
    ("06Zy", "zollern", 24, 4),
    ("06UP", "kaiser", 5, 4),
    ("06UP", "daimler", 5, 4),
    ("02o1", "schadow", 7, 2),
  ]:
    coverage = defaultdict(float)
    for face in RECEIPT["selectedFaces"]:
      if (
        not face["parentId"].endswith(suffix)
        or face["composition"] != kind
        or face["street"] == "Mittelstraße"
      ):
        continue
      for field in face["upperFields"]:
        key = (field["row"], field["axis"], field["pair"])
        actual = [DATA["boxes"][i] for i in field["boxes"]]
        assert all(r[7] == 0x687C7C and r[8] == 2 for r in actual)
        coverage[key] += sum(r[3] * r[4] for r in actual) / (
          field["width"] * field["height"]
        )
    assert len(coverage) == per_row * rows
    # Internal source strips/recesses can interrupt a field, but no complete
    # pane is silently dropped. The worst measured gap leaves over 80%.
    assert min(coverage.values()) > 0.79
  subfronts = next(
    b["subfronts"] for b in PROFILE["buildings"] if b["style"] == "kaiser"
  )
  shapes = {s["style"]: shape(s["worldGeometry"]) for s in subfronts}
  split_faces = defaultdict(set)
  for face in RECEIPT["selectedFaces"]:
    if not face["parentId"].endswith("06UP"):
      continue
    a, d, _ = wall(face)
    lo, hi = face["presentationInterval"]
    for t in [0.01, 0.5, 0.99]:
      p = Point(*(a + d * (lo + (hi - lo) * t)))
      assert (
        min(shapes, key=lambda name: shapes[name].distance(p)) == face["composition"]
      )
    split_faces[face["sourcePolygonId"]].add(face["composition"])
  assert sum(len(kinds) == 2 for kinds in split_faces.values()) == 2


def test_emitted_window_columns_have_clear_outward_space():
  records = model.source_records()
  fps = [model.footprint(r).buffer(-0.08) for r in records]
  tree = STRtree(fps)
  # Test the actual emitted glass, including both sides of each opening, not
  # only five probes of the source wall or one frontage midpoint.
  glass = {0x687C7C, 0x596C70, 0x586C69, 0x435956}
  for face in RECEIPT["selectedFaces"]:
    a, d, _ = wall(face)
    n = np.asarray(face["normal"])
    for r in DATA["boxes"][face["firstBox"] : face["firstBox"] + face["boxCount"]]:
      if r[7] not in glass:
        continue
      middle = np.asarray([r[0], r[2]])
      for delta in [-r[3] / 2, 0, r[3] / 2]:
        p = middle + d * delta
        ray = LineString([p + n * 0.15, p + n * 2.1])
        assert not any(
          ray.intersection(fps[i]).length > 0.025 for i in tree.query(ray)
        ), face["sourcePolygonId"]


def test_native_coalescing_preserves_exact_coloured_cube_union_and_gaps():
  rows = [
    [x + 0.25, 0.75, z + 0.25, color, 0.5, 2, 1.5, 0.5]
    for x, z, color in [
      (0, 0, 1),
      (0.5, 0, 1),
      (1, 0, 1),
      (0, 0.5, 1),
      (0.5, 0.5, 1),
      (2, 0, 1),
      (0, 1, 2),
      (0.5, 1, 2),
    ]
  ]
  merged = model.merge_native_runs(rows)
  assert len(merged) < len(rows)

  def cells(runs):
    return {
      (round(x, 3), round(y, 3), round(z, 3), r[3], r[5])
      for r in runs
      for x in np.arange(r[0] - r[4] / 2 + 0.25, r[0] + r[4] / 2, 0.5)
      for y in np.arange(r[1] - r[6] / 2 + 0.25, r[1] + r[6] / 2, 0.5)
      for z in np.arange(r[2] - r[7] / 2 + 0.25, r[2] + r[7] / 2, 0.5)
    }

  assert cells(rows) == cells(merged)


def test_payload_is_bounded_reproducible_and_carries_source_uncertainty():
  data, receipt = model.make_payloads()
  assert data == DATA and receipt == RECEIPT
  path = model.DATA / "lindenCorridorV197.json"
  assert len(path.read_bytes()) < 2 * 1024 * 1024
  assert len(gzip.compress(path.read_bytes(), mtime=0)) < 400 * 1024
  assert RECEIPT["profileSha256"] == model.digest(model.PROFILE)
  assert RECEIPT["roadsSha256"] == model.digest(model.ROADS)
  assert "display estimates" in PROFILE["interpretation"]
  assert all(b["sources"] and b["sourceFacts"] for b in PROFILE["buildings"])
