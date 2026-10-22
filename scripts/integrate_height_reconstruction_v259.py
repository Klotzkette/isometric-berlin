"""Append verified missing upper structures without changing the retained city."""

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
ADDITION = GEO / "height-reconstruction-v259-manifest-addition.json"
Reader = Callable[[Path], bytes]


@lru_cache(maxsize=1)
def baseline_bytes() -> bytes:
  """Retain the immutable published predecessor as the preservation authority."""
  return subprocess.check_output(
    [
      "git",
      "show",
      "v1.0.158:src/app/public/mesh/surrounding-berlin-v159/manifest.json",
    ],
    cwd=ROOT,
  )


def merged(previous: dict, addition: dict) -> dict:
  """Append only three local companions; retain metadata and coverage exactly."""
  extra = addition["chunks"]
  assert len(extra) == 3
  parents = {c["id"]: c for c in previous["chunks"]}
  assert {c["detailCompanionOf"] for c in extra} == {"7_4", "-3_6", "10_3"}
  for c in extra:
    assert c["id"].startswith("height259-") and c["id"] not in parents
    parent = parents[c["detailCompanionOf"]]
    assert "detailCompanionOf" not in parent and c["bounds"] == parent["bounds"]
  assert len({c["id"] for c in extra}) == 3
  result = {
    **previous,
    "chunks": [*previous["chunks"], *extra],
    "heightReconstructionV259": hashlib.sha256(
      json.dumps(addition, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest(),
  }
  assert len(result["chunks"]) <= 2208
  assert len(json.dumps(result, separators=(",", ":")).encode()) < 2176 * 1024
  return result


def verify_packets(addition: dict, reader: Reader = Path.read_bytes) -> None:
  """Reject damaged, unbounded or navigationally intrusive new companions."""
  for desc in addition["chunks"]:
    x0, z0, x1, z1 = desc["bounds"]
    assert x1 - x0 == z1 - z0 == 512
    for mode in ("drawn", "minecraft"):
      a = desc[mode]
      assert Path(a["url"]).name == a["url"]
      data = reader(PUBLIC / a["url"])
      assert len(data) == a["bytes"] and hashlib.sha256(data).hexdigest() == a["sha256"]
      raw = gzip.decompress(data)
      assert len(raw) == a["decodedBytes"] < 4 * 1024**2
      packet = json.loads(raw)
      assert packet["id"] == desc["id"] and packet["schemaVersion"] == 1
      assert packet["origin"] == [x0, -10, z0]
      assert 1 <= len(packet["meshes"]) <= 16
      assert all(
        not packet["nav"].get(k, [])
        for k in ("ground", "water", "buildings", "roads", "bridges")
      )


def predecessor_manifest_v259(current: dict, reader: Reader = Path.read_bytes) -> dict:
  """Expose historical data only after proving the complete finite extension."""
  from scripts.integrate_adlershof_kuehn_v261 import predecessor_manifest_v261

  current = predecessor_manifest_v261(current, reader)
  if "heightReconstructionV259" not in current:
    assert not any(c["id"].startswith("height259-") for c in current["chunks"])
    return current
  previous = json.loads(baseline_bytes())
  addition = json.loads(ADDITION.read_bytes())
  assert current == merged(previous, addition), "Unreceipted v259 manifest change"
  verify_packets(addition, reader)
  for desc in previous["chunks"]:
    if desc["id"] in {"7_4", "-3_6", "10_3"}:
      for mode in ("drawn", "minecraft"):
        a = desc[mode]
        data = reader(PUBLIC / a["url"])
        assert (
          len(data) == a["bytes"] and hashlib.sha256(data).hexdigest() == a["sha256"]
        )
  return previous


def main() -> None:
  previous = json.loads(baseline_bytes())
  addition = json.loads(ADDITION.read_bytes())
  result = merged(previous, addition)
  path = PUBLIC / "manifest.json"
  assert json.loads(path.read_bytes()) in (previous, result)
  verify_packets(addition)
  path.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
  print(
    f"Preserved {len(previous['chunks'])} descriptors; appended 3 missing-top companions"
  )


if __name__ == "__main__":
  main()
