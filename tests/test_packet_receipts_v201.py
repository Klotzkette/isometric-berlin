"""Independent final geometry replay and immutable pre-v201 checkpoint contract."""

import base64
import copy
import gzip
import json

import numpy as np
import pytest
from packet_receipts_v201 import (
  GEO,
  PUBLIC,
  _wuhl,
  audited_v201_changes,
  baseline,
  digest,
  load,
  predecessor_v201,
  verify_mesh,
)


@pytest.mark.parametrize("omit", ["packet", "representation"])
def test_updated_wuhl_packets_cannot_skip_their_geometry_audit(omit: str) -> None:
  receipt = load(GEO / "wuhlheide-v201-packet-audit.json")
  if omit == "packet":
    receipt["chunks"].pop()
  else:
    receipt["chunks"][-1]["modes"].pop("minecraft")
  old = {d["id"]: d for d in json.loads(baseline(PUBLIC / "manifest.json"))["chunks"]}
  current = {d["id"]: d for d in load(PUBLIC / "manifest.json")["chunks"]}
  with pytest.raises(AssertionError):
    _wuhl(receipt, old, current)


def test_final_packets_replay_all_original_source_geometry() -> None:
  changes, companions, counts = audited_v201_changes()
  assert 70 <= len(changes) <= 86
  assert len(companions) == 17
  assert all(d["detailCompanionOf"].startswith("outer187--") for d in companions)
  assert set(counts) <= {
    "outer187--19_0",
    "outer187-22_13",
    "outer187-23_13",
    "east200-22_12",
    "east200-22_13",
    "east200-23_12",
    "east200-23_13",
  }
  assert all(after <= before for before, after in counts.values())


def test_historical_checks_receive_only_byte_exact_v100_predecessors() -> None:
  changes, _, _ = audited_v201_changes()
  old = {d["id"]: d for d in json.loads(baseline(PUBLIC / "manifest.json"))["chunks"]}
  for (identity, mode), (before, after) in changes.items():
    path = PUBLIC / old[identity][mode]["url"]
    assert digest(path.read_bytes()) == after
    raw = predecessor_v201(path)
    assert raw == baseline(path) and digest(raw) == before
    assert len(gzip.decompress(raw)) == old[identity][mode]["decodedBytes"]


def test_duplicate_or_recoloured_ground_is_not_accepted_as_preserved_coverage() -> None:
  from test_weinberg_terrain_packets_v176 import _mesh

  source = _mesh([[0, 3, 0], [4, 3, 0], [0, 3, 4]], [[0, 1, 2]], [0, 0, 0], kind="city")
  after = copy.deepcopy(source)
  after["indices"] = base64.b64encode(
    np.array([[0, 1, 2], [0, 1, 2]], dtype="<u4").tobytes()
  ).decode()
  report = {
    "sourceTriangles": 1,
    "resultTriangles": 2,
    "placementRuns": [[0, 1, "terrain", 0, 2]],
  }
  with pytest.raises(AssertionError):
    verify_mesh(
      source,
      [0, 0, 0],
      [({"origin": [0, 0, 0]}, after)],
      report,
      False,
      lambda *args: 0,
    )

  after = copy.deepcopy(source)
  after["colors"] = base64.b64encode(np.full((3, 3), 99, dtype="u1").tobytes()).decode()
  with pytest.raises(AssertionError):
    verify_mesh(
      source,
      [0, 0, 0],
      [({"origin": [0, 0, 0]}, after)],
      {
        "sourceTriangles": 1,
        "resultTriangles": 1,
        "placementRuns": [[0, 1, "rigid", 0, 1]],
      },
      False,
      lambda *args: 0,
    )


def test_building_wall_cannot_be_reclassified_as_bank_or_moved_by_receipt_alone() -> (
  None
):
  from test_weinberg_terrain_packets_v176 import _mesh

  source = _mesh([[0, 3, 0], [4, 3, 0], [0, 8, 0]], [[0, 1, 2]], [0, 0, 0], kind="city")
  collapsed = _mesh(
    [[0, 3, 0], [4, 3, 0], [0, 3, 0]], [[0, 1, 2]], [0, 0, 0], kind="city"
  )
  moved = _mesh([[0, 8, 0], [4, 8, 0], [0, 13, 0]], [[0, 1, 2]], [0, 0, 0], kind="city")
  for after, kind, dy in [
    (collapsed, "bank", 0),
    (collapsed, "terrain", 0),
    (moved, "rigid", 500),
  ]:
    with pytest.raises(AssertionError):
      verify_mesh(
        source,
        [0, 0, 0],
        [({"origin": [0, 0, 0]}, after)],
        {
          "sourceTriangles": 1,
          "resultTriangles": 1,
          "placementRuns": [[0, 1, kind, dy, 1]],
        },
        False,
        lambda *args: 0,
        lambda points: 2,
      )
