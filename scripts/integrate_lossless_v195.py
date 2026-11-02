"""Read-only exact v195 wire predecessor for immutable historical source audits.

Only96 explicitly pinned ordinary public packets qualify. Every full decoded
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
from typing import Callable

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
ANCHOR = "8ab885c894768234d2198b56366fc1ba638c6f84"
MANIFEST_SHA256 = "e857777aa707055c43130275d6aeadb72e3773f3d7a3688c10392ac65a0b18b8"
RECEIPT = ROOT / "geo_data/regierungsviertel/lossless-packets-v195.json"
SOURCES = ROOT / "src/app/losslessSurroundingV195Sources.json"
Reader = Callable[[Path], bytes]


def sha(raw: bytes) -> str:
  return hashlib.sha256(raw).hexdigest()


def git_bytes(path: Path) -> bytes:
  relative = path.resolve().relative_to(ROOT).as_posix()
  return subprocess.check_output(["git", "show", f"{ANCHOR}:{relative}"], cwd=ROOT)


@lru_cache(maxsize=1)
def original_manifest_v195() -> dict:
  raw = git_bytes(PUBLIC / "manifest.json")
  assert sha(raw) == MANIFEST_SHA256, "Changed immutable v194 manifest anchor"
  return json.loads(raw)


def rows_v195(reader: Reader = Path.read_bytes) -> dict[str, dict]:
  raw, pins = reader(RECEIPT), reader(SOURCES)
  assert sha(raw) == "3c8601078a6e042e9bca10a28cee963bccc755b3db2ebfaf30ca1c4cd2f024f8"
  assert sha(pins) == "34355d00375aee02afc7e5f25a8ed006d3b440fba96129977af589c88cfbe4a5"
  receipt, sources = json.loads(raw), json.loads(pins)
  assert set(receipt) == {"step", "applied", "method", "savedBytes", "rows"}
  assert receipt["step"] == 10 and receipt["applied"] is True
  assert receipt["method"] == "Zopfli one iteration; exact decompressed bytes verified"
  assert len(sources) == len(receipt["rows"]) == 96
  assert (
    sum(row["savedBytes"] for row in receipt["rows"])
    == receipt["savedBytes"]
    == 5_203_540
  )
  result = {}
  for source, row in zip(sources, receipt["rows"], strict=True):
    assert {k: row[k] for k in source} == source
    assert Path(row["file"]).name == row["file"] and row["file"] not in result
    assert row["file"].endswith((".drawn.json.gz", ".minecraft.json.gz"))
    assert 0 < row["newGzipBytes"] < row["gzipBytes"] <= 4 * 1024**2
    assert 0 < row["decodedBytes"] <= 12 * 1024**2
    assert row["savedBytes"] == row["gzipBytes"] - row["newGzipBytes"]
    result[row["file"]] = row
  return result


def verify_wire_v195(path: Path, raw: bytes, row: dict) -> bytes:
  digest = sha(raw)
  old = digest == row["gzipSha256"]
  assert digest == row["gzipSha256" if old else "newGzipSha256"], (
    "Changed registered v195 wire bytes"
  )
  assert len(raw) == row["gzipBytes" if old else "newGzipBytes"]
  decoded = gzip.decompress(raw)
  assert len(decoded) == row["decodedBytes"] and sha(decoded) == row["decodedSha256"]
  if old:
    return raw
  before = git_bytes(path)
  assert len(before) == row["gzipBytes"] and sha(before) == row["gzipSha256"]
  assert gzip.decompress(before) == decoded, "Changed complete decoded v195 source"
  return before


def predecessor_packet_bytes_v195(
  path: Path, reader: Reader = Path.read_bytes
) -> bytes:
  raw = reader(path)
  if path.resolve().parent != PUBLIC:
    return raw
  row = rows_v195(reader).get(path.name)
  return verify_wire_v195(path, raw, row) if row else raw


def predecessor_manifest_v195(current: dict, reader: Reader = Path.read_bytes) -> dict:
  """Prove the complete manifest complement before recovering published v194."""
  before = original_manifest_v195()
  expected = copy.deepcopy(before)
  rows = rows_v195(reader)
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
      assert live in (asset, after), "Unreceipted v195 descriptor"
      descriptor[mode] = copy.deepcopy(live)
      raw = reader(PUBLIC / row["file"])
      prior = verify_wire_v195(PUBLIC / row["file"], raw, row)
      if live == after:
        assert len(raw) == live["bytes"] and sha(raw) == live["sha256"]
      else:
        assert len(prior) == live["bytes"] and sha(prior) == live["sha256"]
      found.add(row["file"])
  assert found == rows.keys() and current == expected, (
    "Changed v195 manifest complement"
  )
  return copy.deepcopy(before)
