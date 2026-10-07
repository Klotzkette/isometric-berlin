"""Strict reversal of recorded park altitudes for historical flat-ground checks."""

import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def digest(value: object) -> str:
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def restore_recorded_altitudes(value: object, filename: str) -> object:
  """Reject any unrecorded change; don't widen the old global height bounds."""
  receipts = json.loads(
    (ROOT / "geo_data/regierungsviertel/derived-provenance-v182.json").read_bytes()
  )["altitudeReceipts"]
  receipt = next(r for r in receipts if r["file"].endswith("/" + filename))
  assert receipt["baseline"] == "v1.0.81"
  assert digest(value) == receipt["afterJsonSha256"]
  restored = copy.deepcopy(value)
  seen = set()
  for path, old, new in receipt["changes"]:
    assert tuple(path) not in seen
    seen.add(tuple(path))
    if receipt["field"] == "ground_height":
      assert len(path) == 2 and path[0] == "y_dm"
    elif receipt["field"] == "tree_rows":
      assert len(path) == 3 and path[-1] == 1
    else:
      assert path[-1] == 1 and any(
        k
        in {
          "position",
          "points",
          "outline",
          "rings",
          "ring",
          "anchor",
        }
        for k in path
      )
    parent = restored
    for key in path[:-1]:
      parent = parent[key]
    assert parent[path[-1]] == new
    parent[path[-1]] = old
  assert digest(restored) == receipt["beforeJsonSha256"]
  return restored
