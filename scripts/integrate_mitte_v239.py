"""Bounded northern Mitte facades, complete required owners and additive spires."""

from __future__ import annotations

import gzip
import hashlib
import json
import subprocess
from pathlib import Path
from typing import Callable

from scripts.integrate_ber_airport_v236 import verify_assets
from scripts.spree_bridge_lineage_v242 import (
  predecessor_manifest_v242,
  predecessor_packet_bytes_v242,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
DATA = ROOT / "src/app/src/data"
ADDITIONS = {
  "nikolai": GEO / "nikolaiviertel-v239-manifest-addition.json",
  "northfront": GEO / "north-mitte-fronts-v239-manifest-addition.json",
  "namedfront": GEO / "named-fronts-v239-manifest-addition.json",
}
PREFIXES = tuple(f"{name}239-" for name in ADDITIONS)
RECEIPT = GEO / "mitte-v239-integration.json"


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, value: dict) -> None:
  path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n")


def baseline_bytes() -> bytes:
  return subprocess.check_output(
    ["git", "show", "v1.0.138:" + str((PUBLIC / "manifest.json").relative_to(ROOT))],
    cwd=ROOT,
  )


def additions() -> dict:
  return {name: read(path) for name, path in ADDITIONS.items()}


def merged(previous: dict, supplements: dict) -> dict:
  assert set(supplements) == set(ADDITIONS)
  extra = []
  for name, source in supplements.items():
    assert source["chunks"]
    assert all(c["id"].startswith(f"{name}239-") for c in source["chunks"])
    extra.extend(source["chunks"])
  ids = [c["id"] for c in extra]
  assert len(ids) == len(set(ids))
  assert not set(ids) & {c["id"] for c in previous["chunks"]}
  result = {**previous, "chunks": previous["chunks"] + extra, "mitteV239": supplements}
  assert len(result["chunks"]) <= 2144
  assert len(json.dumps(result, separators=(",", ":")).encode()) < 2 * 1024**2
  return result


def verify_companions(chunks: list[dict], reader: Callable[[Path], bytes]) -> None:
  verify_assets(chunks, reader)
  for descriptor in chunks:
    if not descriptor["id"].startswith(PREFIXES):
      continue
    x0, z0, x1, z1 = descriptor["bounds"]
    assert x1 - x0 == z1 - z0 == 512
    assert 512 <= x0 < x1 <= 4096 and -2560 <= z0 < z1 <= 1024
    for mode in ("drawn", "minecraft"):
      asset = descriptor[mode]
      raw = gzip.decompress(reader(PUBLIC / asset["url"]))
      assert len(raw) == asset["decodedBytes"] <= 12 * 1024**2
      packet = json.loads(raw)
      assert packet["schemaVersion"] == 1 and packet["id"] == descriptor["id"]
      assert packet["origin"] == [x0, -10, z0]
      assert 1 <= len(packet["meshes"]) <= 16
      assert all(
        packet["nav"].get(k, []) == []
        for k in ("buildings", "ground", "roads", "water", "bridges")
      )


def normalize_mitte_additions(current: dict, reader: Callable[[Path], bytes]) -> dict:
  if "mitteV239" not in current:
    assert not any(c["id"].startswith(PREFIXES) for c in current["chunks"])
    return current
  current = predecessor_manifest_v242(current, reader)
  previous = json.loads(baseline_bytes())
  assert current == merged(previous, additions())
  verify_companions(
    current["chunks"], lambda p: predecessor_packet_bytes_v242(p, reader)
  )
  return previous


def required_models() -> dict:
  core = read(DATA / "schlossplatzV239Replacement.json")["core"]
  return {
    "schemaVersion": 1,
    **{
      mode: [
        {**core[mode], "id": core[mode]["id"] + f"-part-{i}", "meshes": [mesh]}
        for i, mesh in enumerate(core[mode]["meshes"])
      ]
      + [read(PUBLIC / f"stadthaus239-5_0.{mode}.json.gz")]
      for mode in ("drawn", "minecraft")
    },
  }


def publish_required() -> None:
  write(DATA / "requiredMitteV239.json", required_models())
  write(
    DATA / "schlossplatzV239PreviousNavigation.json",
    {
      "parts": read(DATA / "schlossplatzV239AltMittePrevious.json")[
        "previousNavigationParts"
      ]
    },
  )


def publish() -> None:
  raw = baseline_bytes()
  previous = json.loads(raw)
  supplement = additions()
  result = merged(previous, supplement)
  allowed = [previous, result]
  if RECEIPT.exists():
    allowed.append(merged(previous, read(RECEIPT)["additions"]))
  assert read(PUBLIC / "manifest.json") in allowed, "Unrelated manifest edit"
  verify_companions(result["chunks"], lambda p: p.read_bytes())
  publish_required()
  write(PUBLIC / "manifest.json", result)
  write(
    RECEIPT,
    {
      "baselineRelease": "v1.0.138",
      "baselineManifestSha256": hashlib.sha256(raw).hexdigest(),
      "retainedChunks": len(previous["chunks"]),
      "coverageUnchanged": True,
      "additions": supplement,
      "requiredModelsSha256": hashlib.sha256(
        (DATA / "requiredMitteV239.json").read_bytes()
      ).hexdigest(),
    },
  )
  print(
    f"Retained {len(previous['chunks'])} packets; added {len(result['chunks']) - len(previous['chunks'])} companions"
  )


if __name__ == "__main__":
  publish()
