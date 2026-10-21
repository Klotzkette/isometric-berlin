"""Append only the selected playground footprints and verified packet families."""

from __future__ import annotations

import gzip
import hashlib
import json
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
GEO = ROOT / "geo_data/regierungsviertel"
PATCH = GEO / "playgrounds-v255-manifest-patch.json"
Reader = Callable[[Path], bytes]


@lru_cache(maxsize=1)
def baseline_bytes() -> bytes:
  """Use the independently published predecessor as preservation authority."""
  return subprocess.check_output(
    [
      "git",
      "show",
      "v1.0.154:src/app/public/mesh/surrounding-berlin-v159/manifest.json",
    ],
    cwd=ROOT,
  )


def merged(previous: dict, patch: dict) -> dict:
  """Retain every old descriptor and footprint, appending exact finite sites."""
  extra = patch["chunks"]
  assert len(extra) == 39 and all(c["id"].startswith("play255-") for c in extra)
  ids = [c["id"] for c in [*previous["chunks"], *extra]]
  assert len(ids) == len(set(ids)) <= 2208
  footprint = [*previous["footprint"], *patch["footprint"]]
  xs = [v[0] for p in patch["footprint"] for v in p["ring"]]
  zs = [v[1] for p in patch["footprint"] for v in p["ring"]]
  b = previous["bounds"]
  result = {
    **previous,
    "chunks": [*previous["chunks"], *extra],
    "footprint": footprint,
    "bounds": [
      min(b[0], *xs),
      min(b[1], *zs),
      max(b[2], *xs),
      max(b[3], *zs),
    ],
    "playgroundsV255": patch["playgroundsV255"],
  }
  assert len(footprint) <= 1000
  assert len(json.dumps(result, separators=(",", ":")).encode()) < 2176 * 1024
  return result


def verify_packets(patch: dict, reader: Reader = Path.read_bytes) -> None:
  """Reject missing, changed or oversized new geometry before replay/publication."""
  for descriptor in patch["chunks"]:
    for family in ("drawn", "minecraft"):
      asset = descriptor[family]
      assert Path(asset["url"]).name == asset["url"]
      compressed = reader(PUBLIC / asset["url"])
      assert len(compressed) == asset["bytes"]
      assert hashlib.sha256(compressed).hexdigest() == asset["sha256"]
      raw = gzip.decompress(compressed)
      assert len(raw) == asset["decodedBytes"] < 4 * 1024**2
      packet = json.loads(raw)
      assert packet["id"] == descriptor["id"] and packet["schemaVersion"] == 1
      # This exact boundary sliver admits no wholly contained orthogonal cell.
      # Keep its drawn counterpart; never expand native geometry outside scope.
      empty_sliver = descriptor["id"] == "play255-08--3_22" and family == "minecraft"
      assert (0 if empty_sliver else 1) <= len(packet["meshes"]) <= 16


def predecessor_manifest_v255(current: dict, reader: Reader = Path.read_bytes) -> dict:
  """Verify the complete addition before exposing the historical manifest."""
  from scripts.integrate_height_reconstruction_v259 import predecessor_manifest_v259

  current = predecessor_manifest_v259(current, reader)
  if "playgroundsV255" not in current:
    assert not any(c["id"].startswith("play255-") for c in current["chunks"])
    return current
  previous = json.loads(baseline_bytes())
  patch = json.loads(PATCH.read_bytes())
  assert current == merged(previous, patch), "Unreceipted v255 manifest change"
  verify_packets(patch, reader)
  return previous


def main() -> None:
  previous = json.loads(baseline_bytes())
  patch = json.loads(PATCH.read_bytes())
  result = merged(previous, patch)
  path = PUBLIC / "manifest.json"
  assert json.loads(path.read_bytes()) in (previous, result)
  verify_packets(patch)
  path.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
  print(
    f"Preserved {len(previous['chunks'])} descriptors; appended {len(patch['chunks'])}"
  )


if __name__ == "__main__":
  main()
