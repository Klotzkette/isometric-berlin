"""Complete source-plan composition, colour precision and closed conflicts."""

import base64
import copy
import struct

import pytest

from scripts.integrate_northern_v309 import compose_plans, fingerprint, merge_append


def mesh(linear=False):
  def packed(fmt, values):
    return base64.b64encode(struct.pack("<" + fmt, *values)).decode()

  return {
    "kind": "component",
    "positionType": "u16cm",
    "positions": packed("9H", [0, 100, 0, 100, 100, 0, 0, 100, 100]),
    "colors": packed("9H" if linear else "9B", [1, 2, 3] * 3),
    **({"colorType": "u16linear"} if linear else {}),
    "indices": packed("3I", [0, 1, 2]),
  }


def plan(index=0):
  return {
    "origin": [0, -10, 0],
    "records": [{"mesh": 0, "kind": "city", "fingerprint": 23}],
    "preparedRecords": [{"mesh": 0, "kind": "city", "fingerprint": 23}],
    "navGuard": 31,
    "preparedNavGuard": 32,
    "lineGuard": None,
    "preparedLineGuard": None,
    "retire": [{"mesh": 0, "triangles": [index]}],
    "retireLines": [],
    "retireNav": [],
    "appendNav": [],
    "owners": [f"owner-{index}"],
    "append": mesh(index == 1),
  }


def test_mixed_original_bytes_and_final_linear_words_retain_complete_triangles():
  first, second = mesh(), mesh(True)
  before = copy.deepcopy([first, second])
  merged = merge_append([first, second])
  assert merged["colorType"] == "u16linear"
  assert (
    base64.b64decode(merged["positions"]) == base64.b64decode(first["positions"]) * 2
  )
  assert struct.unpack("<18H", base64.b64decode(merged["colors"])) == tuple(
    [257, 514, 771] * 3 + [1, 2, 3] * 3
  )
  assert struct.unpack("<6I", base64.b64decode(merged["indices"])) == (0, 1, 2, 3, 4, 5)
  assert [first, second] == before


def test_one_atomic_plan_joins_only_disjoint_complete_predecessors():
  a, b = plan(), plan(1)
  result = compose_plans([a, b])
  assert result["retire"] == [{"mesh": 0, "triangles": [0, 1]}]
  assert result["owners"] == ["owner-0", "owner-1"]
  p = result["append"]
  assert result["appendFingerprint"] == fingerprint(
    p["positions"] + p["colors"] + p["indices"]
  )
  assert (
    result["records"] == a["records"]
    and result["preparedRecords"] == a["preparedRecords"]
  )


@pytest.mark.parametrize(
  "key",
  [
    "origin",
    "records",
    "preparedRecords",
    "navGuard",
    "preparedNavGuard",
    "lineGuard",
    "preparedLineGuard",
  ],
)
def test_any_changed_complete_predecessor_rejects_composition(key):
  a, b = plan(), plan(1)
  b[key] = "foreign source"
  with pytest.raises(ValueError, match="complete predecessor"):
    compose_plans([a, b])


def test_overlapping_source_ownership_is_never_silently_deduplicated():
  with pytest.raises(ValueError, match="triangle retirement"):
    compose_plans([plan(), plan()])
  for field, value in [
    ("retireLines", [2]),
    ("retireNav", [{"sourceId": "source-owner", "height": 2}]),
  ]:
    a, b = plan(), plan(1)
    a[field] = b[field] = value
    with pytest.raises(ValueError, match="retirement"):
      compose_plans([a, b])
