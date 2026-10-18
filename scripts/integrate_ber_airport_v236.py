"""Append only the finite BER supplement, preserving every released city packet."""

from __future__ import annotations

import gzip
import hashlib
import json
import subprocess
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
ADDITION = GEO / "ber-v236-manifest-addition.json"
RECEIPT = GEO / "ber-v236-integration.json"
MAX_MANIFEST_CHUNKS = 2112


def read(path: Path) -> dict:
  """Read a bounded, committed JSON record."""
  return json.loads(path.read_bytes())


def baseline_bytes() -> bytes:
  """Bind preservation to the actual released predecessor, not live metadata."""
  return subprocess.check_output(
    ["git", "show", "v1.0.135:" + str((PUBLIC / "manifest.json").relative_to(ROOT))],
    cwd=ROOT,
  )


def merged(previous: dict, addition: dict) -> dict:
  """Keep historical fields/order and append only uniquely identified BER tiles."""
  ids = [c["id"] for c in addition["chunks"]]
  assert ids and len(ids) == len(set(ids))
  assert all(i.startswith("ber236-") for i in ids)
  assert not set(ids) & {c["id"] for c in previous["chunks"]}
  result = {
    **previous,
    "chunks": previous["chunks"] + addition["chunks"],
    "footprint": previous["footprint"] + addition["footprint"],
    "bounds": [
      (min if i < 2 else max)(previous["bounds"][i], addition["bounds"][i])
      for i in range(4)
    ],
    "berAirportV236": addition["source"],
  }
  # Descriptor capacity is separate from unchanged runtime byte/packet budgets.
  assert len(result["chunks"]) <= MAX_MANIFEST_CHUNKS
  assert len(json.dumps(result, separators=(",", ":")).encode()) < 2 * 1024**2
  return result


def verify_assets(descriptors: list[dict], reader: Callable[[Path], bytes]) -> None:
  """Hash actual bytes, including all older city files, without retaining copies."""
  for descriptor in descriptors:
    for family in ("drawn", "minecraft"):
      asset = descriptor[family]
      assert (
        not Path(asset["url"]).is_absolute() and ".." not in Path(asset["url"]).parts
      )
      if descriptor["id"].startswith("ber236-"):
        assert Path(asset["url"]).name == asset["url"]
      packed = reader(PUBLIC / asset["url"])
      assert len(packed) == asset["bytes"]
      assert hashlib.sha256(packed).hexdigest() == asset["sha256"], asset["url"]
      if descriptor["id"].startswith("ber236-"):
        raw = gzip.decompress(packed)
        assert len(raw) == asset["decodedBytes"] <= 12 * 1024**2
        packet = json.loads(raw)
        assert packet["id"] == descriptor["id"] and packet["schemaVersion"] == 1
        assert packet["origin"] == [
          descriptor["bounds"][0],
          -10,
          descriptor["bounds"][1],
        ]


def normalize_ber_additions(current: dict, reader: Callable[[Path], bytes]) -> dict:
  """Strictly prove this entire addition before older preservation audits run."""
  from scripts.integrate_hansa_tiergarten_v237 import normalize_hansa_additions

  current = normalize_hansa_additions(current, reader)
  if "berAirportV236" not in current:
    assert not any(c["id"].startswith("ber236-") for c in current["chunks"])
    return current
  previous = json.loads(baseline_bytes())
  addition = read(ADDITION)
  assert current == merged(previous, addition)
  verify_assets(current["chunks"], reader)
  return previous


def publish() -> None:
  """Publish after verifying the prior release and any prior local iteration."""
  prior_bytes = baseline_bytes()
  previous = json.loads(prior_bytes)
  addition = read(ADDITION)
  result = merged(previous, addition)
  current = read(PUBLIC / "manifest.json")
  allowed = [previous, result]
  if RECEIPT.exists():
    allowed.append(merged(previous, read(RECEIPT)["addition"]))
  assert current in allowed, "Unrelated manifest change; preserve and reconcile it"
  verify_assets(result["chunks"], lambda p: p.read_bytes())
  for path, value in [
    (PUBLIC / "manifest.json", result),
    (
      RECEIPT,
      {
        "baselineRelease": "v1.0.135",
        "baselineManifestSha256": hashlib.sha256(prior_bytes).hexdigest(),
        "retainedChunks": len(previous["chunks"]),
        "addition": addition,
      },
    ),
  ]:
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n")
  print(
    f"Preserved {len(previous['chunks'])} city packets; appended {len(addition['chunks'])} BER packets"
  )


if __name__ == "__main__":
  publish()
