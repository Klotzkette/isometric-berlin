"""Ownership, material precedence and lossless legacy shell colour receipts."""

from __future__ import annotations

import base64
from collections import Counter

import numpy as np
from shapely.geometry import box
from shapely.strtree import STRtree

from scripts import build_weinberg_legacy_materials_v271 as module


def test_complete_ground_union_keeps_court_holes_and_reciprocal_evidence() -> None:
  part = {
    "surfaces": [
      {
        "kind": "GroundSurface",
        "rings": [
          [[0, 3, 0], [10, 3, 0], [10, 3, 10], [0, 3, 10]],
          [[2, 3, 2], [2, 3, 8], [8, 3, 8], [8, 3, 2]],
        ],
      }
    ]
  }
  ground = module.footprint([part])
  assert ground.area == 64
  assert not ground.intersects(box(3, 3, 7, 7))
  row = {"id": "retained-osm", "tags": {"roof:colour": "red"}}
  assert module.mapped_context(ground, [row], [ground], STRtree([ground])) == (
    row,
    [1.0, 1.0],
  )
  # An encompassing block and two overlapping identities are not house proof.
  broad = box(-10, -10, 20, 20)
  assert module.mapped_context(ground, [row], [broad], STRtree([broad])) == ({}, [])
  assert module.mapped_context(
    ground, [row, row], [ground, ground], STRtree([ground, ground])
  ) == ({}, [])


def test_material_observations_are_not_replaced_with_unknown_paint() -> None:
  assert module.material_tones({"roof:colour": "#c75d4d"}) == (None, (199, 93, 77))
  assert module.material_tones(
    {"building:colour": "white", "building:material": "brick"}
  )[0] == module.prior.colour("white")
  assert (
    module.material_tones({"building:colour": "red", "facade:colour": "white"})[0]
    is None
  )
  assert module.material_tones({"building:colour": "red;white"})[0] is None
  evidence = module.prior.read(module.EVIDENCE)
  owners = {row["id"]: row for row in evidence["owners"]}
  for owner, context, colour in (
    ("DEBE01YYK000049V", "OSM-way-24531239", (158, 160, 157)),
    ("DEBE01YYK00005wJ", "OSM-way-386915705", (199, 93, 77)),
    ("DEBE01YYK0000Ek9", "OSM-way-24531231", (158, 160, 157)),
  ):
    row = owners[owner]
    assert row["contextId"] == context
    assert min(row["contextCoverage"]) >= 0.97
    assert tuple(row["roofSrgb"]) == colour
    assert row["roofEvidence"] == "mapped colour/material"


def test_original_source_and_packet_bytes_stay_exact_and_scope_is_finite() -> None:
  evidence = module.prior.read(module.EVIDENCE)
  runtime = module.prior.read(module.OUTPUT)
  assert module.prior.read(module.INDEX) == sorted(runtime["packets"])
  assert evidence["packetFilesChanged"] == 0
  assert len(evidence["owners"]) == 75
  assert Counter(row["kind"] for row in evidence["owners"]) == {
    "mitte-street-fronts-v166": 66,
    "scheunenviertel-v168": 9,
  }
  selected = {row["id"] for row in evidence["owners"]}
  for row in evidence["sourceFiles"] + evidence["packetReceipts"]:
    assert module.prior.digest(module.ROOT / row["file"]) == row["sha256"]
  for kind, path in module.SOURCES.items():
    records = {row["id"]: row for row in module.prior.read(path)["buildings"]}
    for owner in evidence["owners"]:
      if owner["kind"] != kind:
        continue
      record = records[owner["id"]]
      assert owner["parts"] == [part["id"] for part in record["parts"]]
      assert module.footprint(record["parts"]).intersects(box(*module.BOUNDS))
  for mode, owners in evidence["ownersReceivingSelectors"].items():
    assert set(owners) <= selected
    assert len(owners) >= (70 if mode == "drawn" else 45)
    assert evidence["modeCounts"][mode]["WallSurfaceChangedVertices"] > 500
    assert evidence["modeCounts"][mode]["RoofSurfaceChangedVertices"] > 500


def test_every_actual_selector_targets_only_original_neutral_surface_vertices() -> None:
  evidence = module.prior.read(module.EVIDENCE)
  runtime = module.prior.read(module.OUTPUT)
  accepted = {module.prior.linear(module.WALL), module.prior.linear(module.ROOF)}
  counts = Counter()
  for row in evidence["packetReceipts"]:
    packet = module.prior.read(module.ROOT / row["file"])
    tile = (module.ROOT / row["file"]).name.split(".")[0]
    key = row["mode"] + ":" + tile
    for receipt in runtime["packets"][key]:
      part = packet["meshes"][receipt["mesh"]]
      assert part["kind"] == receipt["kind"] in module.SOURCES
      assert module.prior.fingerprint(part) == receipt["fingerprint"]
      colours = np.frombuffer(base64.b64decode(part["colors"]), dtype="u1").reshape(
        -1, 3
      )
      runs = np.frombuffer(base64.b64decode(receipt["runs"]), dtype="<u4").reshape(
        -1, 3
      )
      previous = 0
      for first, count, tone in map(lambda r: tuple(map(int, r)), runs):
        assert first >= previous and count > 0 and first + count <= len(colours)
        assert 0 <= runtime["palette"][tone] <= 0xFFFFFF
        assert {
          tuple(map(int, rgb)) for rgb in colours[first : first + count]
        } <= accepted
        previous = first + count
        counts[row["mode"]] += count
  assert dict(counts) == {
    mode: stats["selectedVertices"] for mode, stats in evidence["modeCounts"].items()
  }


def test_ambiguous_native_shared_face_is_retained() -> None:
  before, after = module.prior.linear(module.WALL), (100, 80, 60)
  eligible = module.prior.NativePart(
    "one", "part", box(0, 0, 10, 10), 0, 10, (("WallSurface", before, after),)
  )
  neighbour = module.prior.NativePart(
    "two", "other", box(0, 0, 10, 10), 0, 10, (("WallSurface", before, before),), False
  )

  def encode(value, dtype):
    return base64.b64encode(np.asarray(value, dtype=dtype).tobytes()).decode()

  part = {
    "positions": encode([[200, 0, 200], [400, 0, 200], [400, 400, 200]], "<u2"),
    "colors": encode([before] * 3, "u1"),
    "indices": encode([0, 1, 2], "<u4"),
  }
  counts, owners = Counter(), set()
  assert (
    module.prior.compile_mesh(
      part,
      [0, 0, 0],
      [],
      [eligible, neighbour],
      True,
      STRtree([eligible.footprint, neighbour.footprint]),
      [eligible, neighbour],
      counts,
      owners,
    )
    == {}
  )
  assert counts["ambiguousTriangles"] == 1 and not owners


def test_drawn_role_uses_old_legacy_flat_bytes_and_single_owner_tone() -> None:
  surfaces, native, _, _ = module.source_selectors()
  for rows in surfaces.values():
    for surface in rows:
      assert surface.before == module.prior.linear(
        module.ROOF if surface.role == "RoofSurface" else module.WALL
      )
  # Neither layer borrows native indices/ownership from drawn geometry.
  for kind in module.SOURCES:
    assert surfaces[kind] and native[kind]
    assert all(len(part.roles) == 1 for part in native[kind])
