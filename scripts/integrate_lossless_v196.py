"""Read-only exact v196 wire predecessor for immutable historical source audits.

Only1280 explicitly pinned ordinary public packets qualify. Every full decoded
byte and exact original Git blob is verified before returning a predecessor.
"""

from __future__ import annotations

import copy
import gzip
import hashlib
import json
import subprocess
from functools import lru_cache
from pathlib import Path
from types import MappingProxyType
from typing import Callable

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
ANCHOR = "9727870f79db9c6a6e9d6437668e5ac13229522f"
MANIFEST_SHA256 = "e604a386661943d66c0789db1ff6fb9dbfa12d2ad5068a5699b6be0270ed2ad4"
RECEIPT = ROOT / "geo_data/regierungsviertel/lossless-packets-v196.json"
SOURCES = ROOT / "src/app/losslessSurroundingV196Sources.json"
Reader = Callable[[Path], bytes]
SAVED_BYTES_V196 = 27_748_130


def sha(raw: bytes) -> str:
  return hashlib.sha256(raw).hexdigest()


def git_bytes(path: Path) -> bytes:
  relative = path.resolve().relative_to(ROOT).as_posix()
  return subprocess.check_output(["git", "show", f"{ANCHOR}:{relative}"], cwd=ROOT)


@lru_cache(maxsize=1)
def original_manifest_v196() -> dict:
  raw = git_bytes(PUBLIC / "manifest.json")
  assert sha(raw) == MANIFEST_SHA256, "Changed immutable v195 manifest anchor"
  return json.loads(raw)


@lru_cache(maxsize=1)
def _validated_rows_v196(raw: bytes, pins: bytes) -> dict:
  assert sha(raw) == "a86ac4b5949c066e18c23b80e96836cfb1138fa6c08ca6abde51d06532e9fef8"
  assert sha(pins) == "509b0d1325c5b827663a332a0fab4e78bfb59698b0a3f2c0d3e11eb027bcb318"
  receipt, sources = json.loads(raw), json.loads(pins)
  assert set(receipt) == {"step", "applied", "method", "savedBytes", "rows"}
  assert receipt["step"] == 10 and receipt["applied"] is True
  assert receipt["method"] == "Zopfli one iteration; exact decompressed bytes verified"
  assert len(sources) == len(receipt["rows"]) == 1280
  assert (
    sum(row["savedBytes"] for row in receipt["rows"])
    == receipt["savedBytes"]
    == SAVED_BYTES_V196
  )
  result = {}
  for source, row in zip(sources, receipt["rows"], strict=True):
    assert {k: row[k] for k in source} == source
    assert Path(row["file"]).name == row["file"] and row["file"] not in result
    assert row["file"].endswith((".drawn.json.gz", ".minecraft.json.gz"))
    assert 0 < row["newGzipBytes"] < row["gzipBytes"] <= 4 * 1024**2
    assert 0 < row["decodedBytes"] <= 12 * 1024**2
    assert row["savedBytes"] == row["gzipBytes"] - row["newGzipBytes"]
    result[row["file"]] = MappingProxyType(row)
  return result


def rows_v196(reader: Reader = Path.read_bytes) -> dict[str, dict]:
  # Full immutable receipt/source bytes are the cache key, not a filename,
  # mtime or a caller's previous success. Changed controls always revalidate.
  return _validated_rows_v196(reader(RECEIPT), reader(SOURCES)).copy()


def verify_wire_v196(path: Path, raw: bytes, row: dict) -> bytes:
  digest = sha(raw)
  old = digest == row["gzipSha256"]
  assert digest == row["gzipSha256" if old else "newGzipSha256"], (
    "Changed registered v196 wire bytes"
  )
  assert len(raw) == row["gzipBytes" if old else "newGzipBytes"]
  decoded = gzip.decompress(raw)
  assert len(decoded) == row["decodedBytes"] and sha(decoded) == row["decodedSha256"]
  if old:
    return raw
  before = git_bytes(path)
  assert len(before) == row["gzipBytes"] and sha(before) == row["gzipSha256"]
  assert gzip.decompress(before) == decoded, "Changed complete decoded v196 source"
  return before


def predecessor_packet_bytes_v196(
  path: Path, reader: Reader = Path.read_bytes
) -> bytes:
  raw = reader(path)
  if path.resolve().parent != PUBLIC:
    return raw
  row = rows_v196(reader).get(path.name)
  return verify_wire_v196(path, raw, row) if row else raw


def predecessor_manifest_v196(current: dict, reader: Reader = Path.read_bytes) -> dict:
  """Prove the complete manifest complement before recovering published v195."""
  before = original_manifest_v196()
  expected = copy.deepcopy(before)
  rows = rows_v196(reader)
  found = set()
  assert len(current["chunks"]) == len(expected["chunks"])
  for index, descriptor in enumerate(expected["chunks"]):
    for mode in ("drawn", "minecraft"):
      asset = descriptor.get(mode, {})
      row = rows.get(asset.get("url"))
      if row is None:
        continue
      assert asset["bytes"] == row["gzipBytes"] and asset["sha256"] == row["gzipSha256"]
      assert (
        asset["decodedBytes"] == row["decodedBytes"] and asset["encoding"] == "gzip"
      )
      live = current["chunks"][index].get(mode)
      after = dict(asset, bytes=row["newGzipBytes"], sha256=row["newGzipSha256"])
      assert live in (asset, after), "Unreceipted v196 descriptor"
      descriptor[mode] = copy.deepcopy(live)
      raw = reader(PUBLIC / row["file"])
      prior = verify_wire_v196(PUBLIC / row["file"], raw, row)
      if live == after:
        assert len(raw) == live["bytes"] and sha(raw) == live["sha256"]
      else:
        assert len(prior) == live["bytes"] and sha(prior) == live["sha256"]
      found.add(row["file"])
  assert found == rows.keys() and current == expected, (
    "Changed v196 manifest complement"
  )
  return copy.deepcopy(before)
