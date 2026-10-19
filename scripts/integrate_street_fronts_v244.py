"""Append bounded Torstraße/Danziger street fronts with exact city preservation."""

from __future__ import annotations

import gzip
import hashlib
import json
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
ADDITIONS = {
  "torfront": GEO / "tor-fronts-v244-manifest-addition.json",
  "danzigerfront": GEO / "danziger-fronts-v244-manifest-addition.json",
}
PREFIXES = tuple(f"{name}244-" for name in ADDITIONS)
RECEIPT = GEO / "street-fronts-v244-integration.json"
MAX_DESCRIPTORS = 2176
Reader = Callable[[Path], bytes]


def read(path: Path) -> dict:
  """Read a bounded JSON publication receipt."""
  return json.loads(path.read_bytes())


@lru_cache(maxsize=1)
def baseline_bytes() -> bytes:
  """Resolve the independently released predecessor, never a local receipt copy."""
  return subprocess.check_output(
    ["git", "show", "v1.0.143:" + str((PUBLIC / "manifest.json").relative_to(ROOT))],
    cwd=ROOT,
  )


def additions() -> dict:
  """Retain exact generated street descriptor provenance."""
  return {name: read(path) for name, path in ADDITIONS.items()}


def merged(previous: dict, supplements: dict) -> dict:
  """Append unique companions; bounds, footprint, previous metadata stay exact."""
  assert set(supplements) == set(ADDITIONS)
  extra = []
  for name, supplement in supplements.items():
    assert supplement["chunks"]
    assert all(c["id"].startswith(f"{name}244-") for c in supplement["chunks"])
    extra.extend(supplement["chunks"])
  ids = [c["id"] for c in extra]
  assert len(ids) == len(set(ids))
  assert not set(ids) & {c["id"] for c in previous["chunks"]}
  result = {
    **previous,
    "chunks": previous["chunks"] + extra,
    "streetFrontsV244": supplements,
  }
  assert len(result["chunks"]) <= MAX_DESCRIPTORS
  assert len(json.dumps(result, separators=(",", ":")).encode()) < 2 * 1024**2
  return result


def verify_companions(supplements: dict, reader: Reader = Path.read_bytes) -> None:
  """Verify complete new families before allowing historical preservation replay."""
  for name, addition in supplements.items():
    assert name in ADDITIONS
    for desc in addition["chunks"]:
      assert desc["id"].startswith(f"{name}244-")
      x0, z0, x1, z1 = desc["bounds"]
      assert x1 - x0 == z1 - z0 == 512
      assert 512 <= x0 < x1 <= 6144 and -3584 <= z0 < z1 <= 0
      for mode in ("drawn", "minecraft"):
        asset = desc[mode]
        assert Path(asset["url"]).name == asset["url"]
        packed = reader(PUBLIC / asset["url"])
        assert len(packed) == asset["bytes"]
        assert hashlib.sha256(packed).hexdigest() == asset["sha256"]
        raw = gzip.decompress(packed)
        assert len(raw) == asset["decodedBytes"] <= 4 * 1024**2
        packet = json.loads(raw)
        assert packet["schemaVersion"] == 1 and packet["id"] == desc["id"]
        assert packet["origin"] == [x0, -10, z0]
        assert 1 <= len(packet["meshes"]) <= 16
        assert all(
          packet["nav"].get(key, []) == []
          for key in ("ground", "water", "buildings", "roads", "bridges")
        )


def predecessor_manifest_v244(current: dict, reader: Reader = Path.read_bytes) -> dict:
  """Only prove the exact whole extension; never discard unknown changes."""
  if "streetFrontsV244" not in current:
    assert not any(c["id"].startswith(PREFIXES) for c in current["chunks"])
    return current
  previous = json.loads(baseline_bytes())
  supplements = additions()
  assert current == merged(previous, supplements), "Unreceipted v244 manifest"
  verify_companions(supplements, reader)
  return previous


def publish() -> None:
  """Integrate additive streets only after validating all current payloads."""
  from scripts.integrate_ber_airport_v236 import verify_assets

  previous = json.loads(baseline_bytes())
  supplements = additions()
  result = merged(previous, supplements)
  assert read(PUBLIC / "manifest.json") in (previous, result)
  verify_assets(previous["chunks"], Path.read_bytes)
  verify_companions(supplements)
  for path, value in (
    (PUBLIC / "manifest.json", result),
    (
      RECEIPT,
      {
        "baselineRelease": "v1.0.143",
        "baselineManifestSha256": hashlib.sha256(baseline_bytes()).hexdigest(),
        "retainedChunks": len(previous["chunks"]),
        "addedChunks": len(result["chunks"]) - len(previous["chunks"]),
        "coverageUnchanged": True,
        "residentBudgetsUnchanged": True,
        "additions": supplements,
      },
    ),
  ):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")
  print(
    f"Preserved {len(previous['chunks'])} chunks; added {len(result['chunks']) - len(previous['chunks'])} front companions"
  )


if __name__ == "__main__":
  publish()
