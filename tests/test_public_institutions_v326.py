"""Bounded complete-source, courtyard and unchanged packet-limit proofs."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json

import numpy as np
import pytest
from shapely import STRtree
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

from scripts import build_public_institutions_v326 as compiler
from scripts import build_public_inventory_v326 as inventory_compiler


def test_published206_baseline_is_exact_and_independent_of_new_live_manifest(
  tmp_path, monkeypatch
) -> None:
  original = inventory_compiler.published_manifest_raw()
  assert len(original) == 2174832
  assert (
    hashlib.sha256(original).hexdigest()
    == "a0e6feb92ff3624360b207472c27b0d5006d389688ba1c78415af32746ba2d0e"
  )
  live = tmp_path / "manifest.json"
  live.write_text('{"schemaVersion":1,"chunks":[{"id":"our-own-new-v326"}]}')
  monkeypatch.setattr(inventory_compiler, "PACKETS", tmp_path)
  assert inventory_compiler.published_manifest() == json.loads(original)
  assert compiler.published_manifest() == json.loads(original)
  corrupt = tmp_path / "changed-published206.json.gz"
  corrupt.write_bytes(
    gzip.compress(
      original.replace(b'"schemaVersion":1', b'"schemaVersion":2', 1), mtime=0
    )
  )
  monkeypatch.setattr(inventory_compiler, "BASELINE_MANIFEST", corrupt)
  with pytest.raises(ValueError, match="Changed immutable published206 manifest"):
    inventory_compiler.published_manifest()


def square(y: float = 0) -> list[list[float]]:
  return [[0, y, 0], [8, y, 0], [8, y, 8], [0, y, 8]]


def test_complete_sheet_holes_and_rigid_datum() -> None:
  surface = {"rings": [square(), [[2, 0, 2], [2, 0, 6], [6, 0, 6], [6, 0, 2]]]}
  before = json.dumps(surface)
  triangles = compiler.source_triangles(surface, 5.2)
  polygons = [Polygon([(p[0], p[2]) for p in tri]) for tri in triangles]
  assert sum(p.area for p in polygons) == pytest.approx(48)
  assert all(not p.intersection(box(2, 2, 6, 6)).area for p in polygons)
  assert all(v[1] == 5.2 for tri in triangles for v in tri)
  assert json.dumps(surface) == before


def test_independent_native_shell_preserves_court_void_and_cardinality() -> None:
  footprint = Polygon(
    [(0, 0), (12, 0), (12, 12), (0, 12)], [[(4, 4), (8, 4), (8, 8), (4, 8)]]
  )
  rings = [
    [[x, 8, z] for x, z in footprint.exterior.coords[:-1]],
    [[x, 8, z] for x, z in footprint.interiors[0].coords[:-1]],
  ]
  source = compiler.source_triangles({"rings": rings}, 0)
  size, cells = compiler.native_columns(
    {"groundY": 0}, footprint, [("RoofSurface", source)], 0
  )
  assert size == 2
  assert cells
  for x, _, z in cells:
    assert footprint.covers(box(x * size, z * size, (x + 1) * size, (z + 1) * size))
    assert (
      box(x * size, z * size, (x + 1) * size, (z + 1) * size)
      .intersection(box(4, 4, 8, 8))
      .area
      == 0
    )
  faces = list(compiler.cell_faces(cells, size))
  for tri, _ in faces:
    normal = np.cross(np.subtract(tri[1], tri[0]), np.subtract(tri[2], tri[0]))
    assert np.count_nonzero(normal) == 1
  # The common face of adjacent blocks is absent in both windings.
  adjacent = {(0, 0, 0): (1, 2, 3), (1, 0, 0): (1, 2, 3)}
  assert len(list(compiler.cell_faces(adjacent))) == 20


def test_native_rectangle_union_has_identical_colored_oriented_surface() -> None:
  cells = {
    (x, y, z): ((157, 151, 140) if y == 2 else (211, 208, 195))
    for x in range(7)
    for y in range(3)
    for z in range(6)
    if not (2 <= x <= 3 and 2 <= z <= 3)
  }

  def planes(faces):
    result = {}
    for tri, color in faces:
      normal = np.cross(np.subtract(tri[1], tri[0]), np.subtract(tri[2], tri[0]))
      axis = int(np.flatnonzero(normal)[0])
      axes = [a for a in range(3) if a != axis]
      key = (axis, tri[0][axis], int(np.sign(normal[axis])), color)
      result.setdefault(key, []).append(Polygon([[p[a] for a in axes] for p in tri]))
    return {key: unary_union(values) for key, values in result.items()}

  original = list(compiler.cell_faces(cells))
  merged = list(compiler.merged_cell_faces(cells))
  assert len(merged) < len(original) / 3
  a, b = planes(original), planes(merged)
  assert a.keys() == b.keys()
  for key in a:
    assert a[key].symmetric_difference(b[key]).area == 0


def test_actual_old_native_expansion_and_complete_core_rle_close_new_source() -> None:
  # Drawn neighbour begins at x10; its actual retained Native body begins at8.
  # New measured x7..9 family is Drawn-disjoint but must not overwrite Native.
  ownership = object.__new__(compiler.NativeOwnership)
  ownership.polygons = [box(8, 0, 12, 4)]
  ownership.rows = [{"packet": "literal-original", "sourceId": "old-neighbour"}]
  ownership.tree = STRtree(ownership.polygons)
  ownership.voxels = {
    "cell_m": 4,
    "grid": {"min_x_idx": 0, "min_z_idx": 0, "rows": 1},
    "building_rows": [[[0, 1, 52, 132, 3]]],
  }
  assert ownership.conflict(box(7, 0, 9, 4))["sourceId"] == "old-neighbour"
  core = ownership.conflict(box(0.1, 0.1, 1, 1))
  assert core["column"] == [0, 0, 52, 132, 3]
  assert ownership.conflict(box(20, 20, 24, 24)) is None


def test_closed_native_columns_follow_each_measured_sloping_roof_sample() -> None:
  footprint = box(0, 0, 8, 8)
  rings = [[[0, 4, 0], [8, 8, 0], [8, 8, 8], [0, 4, 8]]]
  triangles = compiler.source_triangles({"rings": rings}, 0)
  size, cells = compiler.native_columns(
    {"groundY": 0}, footprint, [("RoofSurface", triangles)], 0
  )
  assert size == 2
  for x, z in {(x, z) for x, _, z in cells}:
    ys = {y for a, y, b in cells if a == x and b == z}
    measured_top = 4 + (x * size + size / 2) / 2
    assert (max(ys) + 1) * size == np.ceil(measured_top / size) * size
    assert ys == set(range(max(ys) + 1))


def test_elevated_roof_without_ground_is_not_filled_to_street() -> None:
  part = {"groundY": None, "surfaces": [{"kind": "RoofSurface", "rings": [square(20)]}]}
  support = compiler.part_footprint(part)
  triangles = compiler.source_triangles(part["surfaces"][0], -0.7)
  size, cells = compiler.native_columns(
    part, support, [("RoofSurface", triangles)], -0.7
  )
  assert support.area == 64
  assert min(y for _, y, _ in cells) * size >= 18
  assert all(p[1] == 19.3 for tri in triangles for p in tri)


def test_ground_sampler_domain_does_not_extrapolate_to_outer_berlin() -> None:
  context = {
    "cell_m": 4,
    "grid": {"min_x_idx": 0, "min_z_idx": 0, "cols": 4, "rows": 4},
    "ground_height": {"cols": 1, "rows": 1, "stride_cells": 4, "y_dm": [52]},
  }
  family = {
    "footprint": {
      "type": "Polygon",
      "coordinates": [[[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]]],
    }
  }
  assert compiler.packet_ground(family, context) == (5.2, "actual-worldGroundSampler")
  family["footprint"]["coordinates"][0] = [
    [20, 20],
    [22, 20],
    [22, 22],
    [20, 22],
    [20, 20],
  ]
  assert compiler.packet_ground(family, context) == (
    3,
    "existing-surrounding-packet-groundY",
  )


def test_packet_clipping_keeps_complement_and_roof_navigation(
  tmp_path, monkeypatch
) -> None:
  monkeypatch.setattr(compiler, "PACKETS", tmp_path)
  packets = compiler.InstitutionPackets()
  # A real cell boundary split; neither side is replaced by a bounding box.
  packets.triangle([[510, 3, 1], [514, 3, 1], [510, 7, 3]], (211, 208, 195), "family")
  footprint = Polygon([(510, 1), (514, 1), (514, 3), (510, 3)])
  packets.building(
    footprint, 3, 7, "leaf", "family", [[[510, 7, 1], [514, 7, 1], [510, 7, 3]]]
  )
  packets.finish()
  assert len(packets.saved) == 2
  area = 0
  for entry in packets.saved.values():
    descriptor = entry["drawn"]
    encoded = (tmp_path / descriptor["url"]).read_bytes()
    assert hashlib.sha256(encoded).hexdigest() == descriptor["sha256"]
    q = json.loads(gzip.decompress(encoded))
    p = (
      np.frombuffer(base64.b64decode(q["meshes"][0]["positions"]), dtype="<u2").reshape(
        -1, 3
      )
      / 100
      + q["origin"]
    )
    indices = np.frombuffer(
      base64.b64decode(q["meshes"][0]["indices"]), dtype="<u4"
    ).reshape(-1, 3)
    for ix in indices:
      a, b, c = p[ix]
      area += np.linalg.norm(np.cross(b - a, c - a)) / 2
    assert q["nav"]["buildings"][0]["sourceId"] == "leaf"
    assert q["nav"]["buildings"][0]["roofTriangles"]
    assert not q["nav"]["ground"]
    assert not q["nav"]["water"]
  assert area == pytest.approx(np.linalg.norm(np.cross([4, 0, 0], [0, 4, 2])) / 2)


def test_current_inventory_has_unique_official_school_codes_and_finite_directory_limits() -> (
  None
):
  path = (
    compiler.ROOT
    / "geo_data/regierungsviertel/public-institutions-v326-inventory.json.gz"
  )
  inventory = compiler.read(path)
  rows = inventory["records"]
  official = [r for r in rows if r["id"].startswith("school/")]
  assert len(official) == 929
  assert len({r["id"] for r in rows}) == len(rows)
  assert all(r["schoolYear"] == "2026/27" for r in official)
  assert all(r["accountingStatus"] and "families" in r for r in rows)
  assert inventory["museumMap"]["listedMapRecords"] == 200
  assert len(inventory["currentMuseumDirectory"]["records"]) == 206
  assert len(inventory["currentCourts"]["records"]) == 23


def test_every_new_packet_full_sha_arrays_and_unchanged_live_caps() -> None:
  index = compiler.read(compiler.INDEX)
  source = compiler.read(compiler.SHEETS)
  evidence = compiler.read(compiler.EVIDENCE)
  source_ids = {p["id"] for f in source["families"] for p in f["parts"]}
  assert len(source["families"]) == index["counts"]["families"]
  assert sum(len(f["parts"]) for f in source["families"]) == index["counts"]["parts"]
  assert (
    compiler.digest(compiler.SHEETS)
    == index["sourceSha256"]
    == evidence["sourceSha256"]
  )
  assert len({f["id"] for f in source["families"]}) == len(source["families"])
  for row in index["chunks"]:
    for mode in ["drawn", "minecraft"]:
      descriptor = row[mode]
      data = (compiler.PACKETS / descriptor["url"]).read_bytes()
      assert hashlib.sha256(data).hexdigest() == descriptor["sha256"]
      assert len(data) == descriptor["bytes"]
      raw = gzip.decompress(data)
      assert len(raw) == descriptor["decodedBytes"] <= 12 * 1024 * 1024
      packet = json.loads(raw)
      assert packet["origin"] == [row["bounds"][0], -10, row["bounds"][1]]
      assert len(packet["meshes"]) <= 16
      vertices, indices = 0, 0
      for mesh in packet["meshes"]:
        position = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2")
        colors = base64.b64decode(mesh["colors"])
        ix = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4")
        assert mesh["kind"] == "public-institutions-v326"
        assert len(position) % 3 == 0 and len(ix) % 3 == 0
        assert len(colors) == len(position)
        assert max(ix, default=0) < len(position) // 3
        vertices += len(position) // 3
        indices += len(ix)
      assert vertices <= 400_000 and indices <= 2_400_000
      for building in packet["nav"]["buildings"]:
        assert building["sourceId"] in source_ids
        assert building["holes"] is not None
        assert building["height"] >= 0
        if mode == "minecraft":
          assert building["nativeRoofCaps"] and "roofTriangles" not in building
