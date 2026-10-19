"""Verify additive v242 packet lineage before replaying historical preservation checks.

Only the twenty receipted public files qualify. Their complete pre-v242 JSON
must equal the immutable v1.0.141 packet after removing exactly the appended
bridge mesh and its named navigation field; all other values remain checked.
"""

from __future__ import annotations

import copy
import gzip
import hashlib
import json
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
EVIDENCE = ROOT / "geo_data/regierungsviertel/spree-bridges-v242-evidence.json"
Reader = Callable[[Path], bytes]


@lru_cache(maxsize=1)
def receipts() -> dict[str, dict]:
  return json.loads(EVIDENCE.read_bytes())["packets"]


@lru_cache(maxsize=21)
def baseline(relative: str) -> bytes:
  return subprocess.check_output(["git", "show", f"v1.0.141:{relative}"], cwd=ROOT)


def predecessor_packet_bytes_v242(
  path: Path, reader: Reader = Path.read_bytes
) -> bytes:
  """Return frozen predecessor bytes only after exact whole-packet verification."""
  raw = reader(path)
  relative = str(path.resolve().relative_to(ROOT))
  receipt = next((r for r in receipts().values() if r["url"] == relative), None)
  if receipt is None:
    return raw
  sha = hashlib.sha256(raw).hexdigest()
  if sha == receipt["sha256"]:
    return raw  # An explicitly historical reader already supplied the predecessor.
  assert sha == receipt["stagedSha256"], f"Unreceipted v242 bytes: {relative}"
  assert len(raw) == receipt["bytes"]
  decoded = gzip.decompress(raw)
  assert len(decoded) == receipt["decodedBytes"]
  value = json.loads(decoded)
  assert len(value["meshes"]) == receipt["meshes"] + 1
  assert value["meshes"][-1]["kind"] == "spree-bridges-v242"
  value["meshes"].pop()
  del value["nav"]["spreeBridgesV242"]
  canonical = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  assert hashlib.sha256(canonical).hexdigest() == receipt["originalContentSha256"]
  original = baseline(relative)
  assert hashlib.sha256(original).hexdigest() == receipt["sha256"]
  assert value == json.loads(gzip.decompress(original)), relative
  return original


def predecessor_manifest_v242(current: dict, reader: Reader = Path.read_bytes) -> dict:
  """Normalize only independently proven byte metadata, never scope or owners."""
  from scripts.integrate_street_fronts_v244 import predecessor_manifest_v244

  current = predecessor_manifest_v244(current, reader)
  result = copy.deepcopy(current)
  previous = {
    c["id"]: c
    for c in json.loads(baseline(str((PUBLIC / "manifest.json").relative_to(ROOT))))[
      "chunks"
    ]
  }
  chunks = {c["id"]: c for c in result["chunks"]}
  for key, receipt in receipts().items():
    family, chunk_id = key.split(":", 1)
    if chunk_id not in chunks:
      continue  # Earlier manifest replay can precede this chunk's introduction.
    chunk = chunks[chunk_id]
    old = previous[chunk_id][family]
    expected = {
      **old,
      **{k: receipt[k] for k in ("bytes", "decodedBytes")},
      "sha256": receipt["stagedSha256"],
    }
    assert chunk[family] in (old, expected), f"Unreceipted descriptor: {key}"
    original = predecessor_packet_bytes_v242(ROOT / receipt["url"], reader)
    assert hashlib.sha256(original).hexdigest() == old["sha256"]
    chunk[family] = copy.deepcopy(old)
  return result


def assert_preserved_v242(path: Path, expected: str) -> None:
  assert hashlib.sha256(predecessor_packet_bytes_v242(path)).hexdigest() == expected
