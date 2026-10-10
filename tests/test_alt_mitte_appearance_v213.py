"""Source identity, hole preservation and immutable appearance-selector checks."""

from __future__ import annotations

import base64
import importlib.util
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from shapely.geometry import box
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
  "appearance_v213", ROOT / "scripts/build_alt_mitte_appearance_v213.py"
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def packed(points: list, indices: list, rgb: tuple[int, int, int]) -> dict:
  """Tiny real packet encoding, including an index stream shared by faces."""

  def encode(value: list, dtype: str) -> str:
    return base64.b64encode(np.asarray(value, dtype=dtype).tobytes()).decode()

  return {
    "kind": "alt-mitte-v169",
    "positionType": "u16cm",
    "positions": encode(np.rint(np.asarray(points) * 100), "<u2"),
    "colors": encode([rgb] * len(points), "u1"),
    "indices": encode(indices, "<u4"),
  }


def test_reciprocal_evidence_rejects_large_overlapping_osm_block() -> None:
  small = box(0, 0, 10, 10)
  assert not MODULE.reciprocal_match(small, box(0, 0, 100, 100))[0]
  assert MODULE.reciprocal_match(small, box(0.1, 0, 10.1, 10))[0]
  assert MODULE.reliable_levels({"building:levels": "5"}) == 5
  for value in ("4.5", "5;3;4", "many", "0"):
    assert MODULE.reliable_levels({"building:levels": value}) is None
  assert MODULE.colour("red;white") is None


def test_source_plane_rejects_windows_holes_and_wrong_old_colours() -> None:
  sheet = {
    "kind": "WallSurface",
    "rings": [
      [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]],
      [[3, 3, 0], [3, 7, 0], [7, 7, 0], [7, 3, 0]],
    ],
  }
  surface = MODULE.make_surface(
    "house", "leaf", sheet, (210, 204, 186), (210, 204, 186)
  )
  assert surface
  triangle = np.array([[0, 0, 0], [2, 0, 0], [2, 2, 0]], dtype=float)
  assert surface.matches(triangle, surface.before)
  assert not surface.matches(triangle + [0, 0, 0.055], surface.before)
  assert not surface.matches(triangle + [4, 4, 0], surface.before)
  assert not surface.matches(triangle, (1, 2, 3))
  assert not surface.matches(
    np.array([[0, 0, 0], [10, 0, 0], [10, 10, 0]]), surface.before
  )


def test_shared_unselected_corner_preserves_entire_connected_surface() -> None:
  indices = np.array([[0, 1, 2], [2, 3, 4], [5, 6, 7]], dtype=np.uint32)
  original = np.zeros((8, 3), dtype=np.uint8)
  colour = (4, 5, 6)
  changed = MODULE.unanimous_vertex_colours(indices, [colour, None, colour], original)
  assert changed == {5: colour, 6: colour, 7: colour}
  assert (
    MODULE.unanimous_vertex_colours(indices[:2], [colour, (7, 8, 9)], original) == {}
  )


def test_protected_native_neighbor_blocks_eligible_owner() -> None:
  before, after = (70, 80, 90), (30, 35, 40)
  eligible = MODULE.NativePart(
    "eligible", "one", box(0, 0, 10, 10), 0, 10, (("RoofSurface", before, after),)
  )
  blocked = MODULE.NativePart(
    "authored",
    "two",
    box(0, 0, 10, 10),
    0,
    10,
    (("RoofSurface", before, before),),
    False,
  )
  points = [[2, 10, 2], [4, 10, 2], [4, 10, 4]]
  packet = packed(points, [[0, 1, 2]], before)
  owners: set[str] = set()
  assert (
    MODULE.compile_mesh(
      packet,
      [0, 0, 0],
      [],
      [eligible, blocked],
      True,
      STRtree([eligible.footprint, blocked.footprint]),
      [eligible, blocked],
      Counter(),
      owners,
    )
    == {}
  )
  assert not owners


def test_owner_counts_follow_final_colour_changes_not_candidate_matches() -> None:
  before, after = (70, 80, 90), (30, 35, 40)
  eligible = MODULE.NativePart(
    "house", "leaf", box(0, 0, 10, 10), 0, 10, (("RoofSurface", before, after),)
  )
  # The second connected triangle falls outside the source envelope.
  points = [[2, 10, 2], [4, 10, 2], [4, 10, 4], [20, 10, 20]]
  packet = packed(points, [[0, 1, 2], [2, 1, 3]], before)
  owners: set[str] = set()
  counts = Counter()
  assert (
    MODULE.compile_mesh(
      packet,
      [0, 0, 0],
      [],
      [eligible],
      True,
      STRtree([eligible.footprint]),
      [eligible],
      counts,
      owners,
    )
    == {}
  )
  assert not owners
  assert counts["RoofSurfaceMatchedTriangles"] == 1
  assert counts["RoofSurfaceChangedTriangles"] == 0


def test_published_sidecar_preserves_every_immutable_packet_receipt() -> None:
  evidence = MODULE.read(MODULE.EVIDENCE)
  output = json.loads(MODULE.OUTPUT.read_bytes())
  assert evidence["packetFilesChanged"] == 0
  assert evidence["sourceCounts"]["catalogueRecords"] == 15914
  assert evidence["sourceManifestSha256"] == MODULE.digest(
    MODULE.SOURCE / "source-manifest.json"
  )
  assert evidence["protectionSha256"] == MODULE.digest(MODULE.PROTECTED)
  assert output["packets"] and output["palette"]
  assert all(
    isinstance(entry["runs"], str)
    for entries in output["packets"].values()
    for entry in entries
  )
  assert all(
    MODULE.digest(ROOT / receipt["file"]) == receipt["sha256"]
    for receipt in evidence["packetReceipts"]
  )
  protected = set(MODULE.read(MODULE.PROTECTED)["ids"])
  for identities in evidence["ownersReceivingSelectors"].values():
    assert identities and not set(identities) & protected
