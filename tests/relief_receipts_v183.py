"""Reverse only the strict, independently hashed v183 altitude/provenance delta."""

import copy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def digest(value: object) -> str:
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def restore_v183_altitudes(value: object, filename: str) -> object:
  """Validate both ends and every changed Y before returning the exact v182 value."""
  payload = json.loads(
    (ROOT / "geo_data/regierungsviertel/derived-provenance-v183.json").read_bytes()
  )
  assert (
    payload["previousReceiptSha256"]
    == hashlib.sha256(
      (ROOT / "geo_data/regierungsviertel/derived-provenance-v182.json").read_bytes()
    ).hexdigest()
  )
  receipt = next(
    row for row in payload["altitudeReceipts"] if row["file"].endswith("/" + filename)
  )
  assert receipt["baseline"] == "v1.0.82"
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
        key in {"position", "points", "outline", "rings", "ring", "anchor"}
        for key in path
      )
    parent = restored
    for key in path[:-1]:
      parent = parent[key]
    assert parent[path[-1]] == new
    parent[path[-1]] = old
  assert digest(restored) == receipt["beforeJsonSha256"]
  return restored


def restore_v183_metadata(value: dict, filename: str) -> dict:
  """The older six geometry-hash contracts survive exact dependency chaining."""
  rows = json.loads(
    (ROOT / "geo_data/regierungsviertel/derived-provenance-v183.json").read_bytes()
  )["tables"]
  row = next(row for row in rows if row["file"] == filename)
  keys = row["metadataKeys"]
  assert {key: value[key] for key in keys} == row["metadataAfter"]
  assert (
    digest({key: item for key, item in value.items() if key not in keys})
    == row["unchangedGeometrySha256"]
  )
  return {**value, **row["metadataBefore"]}
