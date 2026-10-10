"""Exact religious owner transfer preserves unrelated packet content."""

from __future__ import annotations

import copy
import sys
from pathlib import Path

import pytest
from shapely.affinity import translate
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from patch_religious_sites_v205 import (  # noqa: E402
  chunk_payload,
  line_signature,
  mesh_signature,
  patch_payload,
  replacement_navigation,
)


def fixtures(minecraft: bool) -> tuple[dict, dict, dict]:
  """Real packet encoding with an owned solid and an unrelated coloured solid."""
  tile = box(0, 0, 512, 512)
  owned = {
    "sourceId": "owned",
    "height": 29.05,
    "minHeight": 0,
    "heightSource": "Berlin LoD2 parent vertical envelope",
    "geometry": box(20, 20, 40, 50),
  }
  neighbour = {**owned, "sourceId": "neighbour", "geometry": box(80, 60, 100, 85)}
  original, selected, empty = [
    chunk_payload("0_0", tile, tile, records, {}, minecraft=minecraft)
    for records in [[owned, neighbour], [owned], []]
  ]
  # The same coloured source triangles may occur in an earlier bespoke mesh;
  # their kind prevents them from being consumed as generic owner geometry.
  original["meshes"].append({**selected["meshes"][0], "kind": "retained-detail"})
  original["nav"]["futureField"] = {"preserve": [1, 2, 3]}
  original["futureMetadata"] = {"preserve": "exactly"}
  return original, selected, empty


@pytest.mark.parametrize("minecraft", [False, True])
def test_owner_transfer_preserves_every_unrelated_primitive_and_record(
  minecraft: bool,
) -> None:
  original, selected, empty = fixtures(minecraft)
  snapshot = copy.deepcopy(original)
  result, audit = patch_payload(
    original, selected, empty, frozenset({"owned"}), minecraft=minecraft
  )
  remove = mesh_signature(selected) - mesh_signature(empty)
  assert mesh_signature(result) == mesh_signature(original) - remove
  assert result["meshes"][-1] == original["meshes"][-1]
  assert result["nav"]["buildings"] == [
    r for r in original["nav"]["buildings"] if r["sourceId"] == "neighbour"
  ]
  assert audit["removedNavigationRecords"] == [
    r for r in original["nav"]["buildings"] if r["sourceId"] == "owned"
  ]
  assert audit["removedNavigationCount"] == 1
  assert audit["removedTriangles"] == sum(remove.values()) > 0
  assert result["nav"]["futureField"] == original["nav"]["futureField"]
  assert result["futureMetadata"] == original["futureMetadata"]
  assert original == snapshot
  if not minecraft:
    removed_lines = line_signature(selected["lines"]) - line_signature(empty["lines"])
    assert line_signature(result["lines"]) == (
      line_signature(original["lines"]) - removed_lines
    )
    assert audit["removedSourceInkSegments"] == sum(removed_lines.values()) > 0


def test_owner_transfer_rejects_missing_geometry_without_mutating_input() -> None:
  _, selected, empty = fixtures(False)
  original = copy.deepcopy(empty)
  snapshot = copy.deepcopy(original)
  with pytest.raises(AssertionError, match="source triangles absent"):
    patch_payload(original, selected, empty, frozenset({"owned"}), minecraft=False)
  assert original == snapshot


def test_owner_transfer_rejects_incomplete_navigation_without_mutating_input() -> None:
  original, selected, empty = fixtures(False)
  original["nav"]["buildings"] = [
    b for b in original["nav"]["buildings"] if b["sourceId"] != "owned"
  ]
  snapshot = copy.deepcopy(original)
  with pytest.raises(AssertionError, match="Owner navigation absent"):
    patch_payload(original, selected, empty, frozenset({"owned"}), minecraft=False)
  assert original == snapshot


def test_exact_replacement_parts_keep_holes_heights_and_one_fragment_per_packet() -> (
  None
):
  part = {
    "id": "part",
    "parentId": "owned",
    "siteId": "site",
    "ring": [[510, 10], [515, 10], [515, 20], [510, 20]],
    "holes": [[[511, 11], [511.5, 11], [511.5, 12], [511, 12]]],
    "baseY": 4.25,
    "topY": 29.178,
  }
  source = Polygon(part["ring"], part["holes"])
  recovered = []
  for west in [0, 512]:
    records = replacement_navigation(
      [part, copy.deepcopy(part)],
      box(west, 0, west + 512, 512),
      [west, -10, 0],
      frozenset({"owned"}),
      3,
    )
    assert len(records) == 1
    record = records[0]
    assert record["sourceId"] == record["parentId"] == "owned"
    assert record["partId"] == "part" and record["siteId"] == "site"
    assert record["height"] + 3 == part["topY"]
    assert record["minHeight"] + 3 == part["baseY"]
    recovered.append(translate(Polygon(record["ring"], record["holes"]), xoff=west))
  assert unary_union(recovered).equals(source)
  assert recovered[0].intersection(recovered[1]).area == 0
  assert len(recovered[0].interiors) == 1


def test_replacement_rejects_duplicate_part_with_conflicting_height() -> None:
  part = {
    "id": "part",
    "parentId": "owned",
    "siteId": "site",
    "ring": [[1, 1], [2, 1], [2, 2], [1, 2]],
    "holes": [],
    "baseY": 3,
    "topY": 20,
  }
  with pytest.raises(AssertionError, match="Conflicting duplicate"):
    replacement_navigation(
      [part, {**part, "topY": 21}],
      box(0, 0, 512, 512),
      [0, -10, 0],
      frozenset({"owned"}),
      3,
    )
