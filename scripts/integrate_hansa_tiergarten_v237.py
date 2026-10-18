"""Append finite architectural companions without changing city coverage."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import subprocess
from pathlib import Path
from typing import Callable

from scripts.integrate_ber_airport_v236 import verify_assets

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
ADDITIONS = {
  "hansa": GEO / "hansa-v237-manifest-addition.json",
  "moabit": GEO / "moabit-v237-manifest-addition.json",
  "spree": GEO / "spree-v237-manifest-addition.json",
}
RECEIPT = GEO / "hansa-tiergarten-v237-integration.json"
PREFIXES = tuple(f"{name}237-" for name in ADDITIONS)
MAX_MANIFEST_CHUNKS = 2112


def read(path: Path) -> dict:
  """Read one bounded source or publication record."""
  return json.loads(path.read_bytes())


def baseline_bytes() -> bytes:
  """Resolve the actual released predecessor independently of live data."""
  return subprocess.check_output(
    ["git", "show", "v1.0.136:" + str((PUBLIC / "manifest.json").relative_to(ROOT))],
    cwd=ROOT,
  )


def additions() -> dict:
  """Keep source metadata and exact family descriptors in the receipt."""
  return {name: read(path) for name, path in ADDITIONS.items()}


def merged(previous: dict, supplements: dict) -> dict:
  """Add details only; preserve all old fields, ground footprint and bounds."""
  assert set(supplements) == set(ADDITIONS)
  chunks = []
  for name, addition in supplements.items():
    assert addition["chunks"]
    assert all(c["id"].startswith(f"{name}237-") for c in addition["chunks"])
    chunks.extend(addition["chunks"])
  ids = [c["id"] for c in chunks]
  assert len(ids) == len(set(ids))
  assert not set(ids) & {c["id"] for c in previous["chunks"]}
  result = {
    **previous,
    "chunks": previous["chunks"] + chunks,
    "hansaTiergartenV237": supplements,
  }
  assert len(result["chunks"]) <= MAX_MANIFEST_CHUNKS
  assert len(json.dumps(result, separators=(",", ":")).encode()) < 2 * 1024**2
  return result


def verify_companions(chunks: list[dict], reader: Callable[[Path], bytes]) -> None:
  """Prove new encoded bytes, local grid and normal live packet ceilings."""
  verify_assets(chunks, reader)
  for descriptor in chunks:
    if not descriptor["id"].startswith(PREFIXES):
      continue
    x0, z0, x1, z1 = descriptor["bounds"]
    assert x1 - x0 == z1 - z0 == 512
    # Finite existing Hansa/Moabit/Bellevue/Tiergarten corridor only.
    assert -4096 <= x0 < x1 <= 1024 and -3072 <= z0 < z1 <= 2560
    for family in ("drawn", "minecraft"):
      asset = descriptor[family]
      assert Path(asset["url"]).name == asset["url"]
      raw = gzip.decompress(reader(PUBLIC / asset["url"]))
      assert len(raw) == asset["decodedBytes"] <= 12 * 1024**2
      packet = json.loads(raw)
      assert packet["id"] == descriptor["id"] and packet["schemaVersion"] == 1
      assert packet["origin"] == [x0, -10, z0]
      assert len(packet["meshes"]) <= 16
      nav = packet["nav"]
      assert math.isfinite(nav["groundY"])
      assert {"ground", "water", "buildings"} <= nav.keys()
      # These are architectural companions in the already navigable core.
      # Mandatory empty navigation prevents both decoder rejection and a
      # duplicate blanket surface replacing the existing terrain.
      assert all(
        nav.get(key, []) == []
        for key in ("ground", "roads", "water", "bridges", "buildings")
      )


def normalize_hansa_additions(current: dict, reader: Callable[[Path], bytes]) -> dict:
  """Allow old audits to run only after proving the complete new supplement."""
  from scripts.integrate_elevated_venues_v238 import normalize_elevated_additions

  current = normalize_elevated_additions(current, reader)
  if "hansaTiergartenV237" not in current:
    assert not any(c["id"].startswith(PREFIXES) for c in current["chunks"])
    return current
  previous = json.loads(baseline_bytes())
  assert current == merged(previous, additions())
  verify_companions(current["chunks"], reader)
  return previous


def publish() -> None:
  """Publish only an audited additive revision of the released manifest."""
  raw = baseline_bytes()
  previous = json.loads(raw)
  supplement = additions()
  result = merged(previous, supplement)
  allowed = [previous, result]
  if RECEIPT.exists():
    allowed.append(merged(previous, read(RECEIPT)["additions"]))
  assert read(PUBLIC / "manifest.json") in allowed, "Unrelated manifest change"
  verify_companions(result["chunks"], lambda p: p.read_bytes())
  receipt = {
    "baselineRelease": "v1.0.136",
    "baselineManifestSha256": hashlib.sha256(raw).hexdigest(),
    "retainedChunks": len(previous["chunks"]),
    "coverageUnchanged": True,
    "additions": supplement,
  }
  for path, value in [(PUBLIC / "manifest.json", result), (RECEIPT, receipt)]:
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n")
  print(
    f"Retained {len(previous['chunks'])} tiles; appended {len(result['chunks']) - len(previous['chunks'])} architectural companions"
  )


if __name__ == "__main__":
  publish()
