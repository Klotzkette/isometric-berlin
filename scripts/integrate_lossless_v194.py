"""Read-only exact v194 wire-encoding predecessor for historical source audits."""

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
ANCHOR = "ac0e16fb2f0ed8fdb63e62d52e7d00c4340d8a37"
RECEIPT = ROOT / "geo_data/regierungsviertel/lossless-packets-v194.json"
SOURCES = ROOT / "src/app/losslessSurroundingV194Sources.json"
Reader = Callable[[Path], bytes]


def sha(raw: bytes) -> str:
  return hashlib.sha256(raw).hexdigest()


@lru_cache(maxsize=1)
def original_manifest_v194() -> dict:
  return json.loads(git_bytes(PUBLIC / "manifest.json"))


def git_bytes(path: Path) -> bytes:
  relative = path.resolve().relative_to(ROOT).as_posix()
  return subprocess.check_output(["git", "show", f"{ANCHOR}:{relative}"], cwd=ROOT)


def rows_v194(reader: Reader) -> dict[str, dict]:
  raw, pins = reader(RECEIPT), reader(SOURCES)
  assert sha(raw) == "7a60542fa00ca56be59fb381beb2e65c1379a0eccdc71a5dfb14135e9b9b627a"
  assert sha(pins) == "e6bb489573a962ff7a7f6e1141190bfcb6c5e16ee77748d75a0fb42e3cdf44de"
  receipt, sources = json.loads(raw), json.loads(pins)
  assert receipt["applied"] is True and len(sources) == len(receipt["rows"]) == 96
  assert (
    sum(row["savedBytes"] for row in receipt["rows"])
    == receipt["savedBytes"]
    == 9_844_867
  )
  result = {}
  for source, row in zip(sources, receipt["rows"], strict=True):
    assert {k: row[k] for k in source} == source
    assert Path(row["file"]).name == row["file"] and row["file"] not in result
    assert (
      row["newGzipBytes"] < row["gzipBytes"] and row["decodedBytes"] <= 12 * 1024**2
    )
    result[row["file"]] = row
  return result


def verify_wire_v194(path: Path, raw: bytes, row: dict) -> bytes:
  digest = sha(raw)
  old = digest == row["gzipSha256"]
  assert digest == row["gzipSha256" if old else "newGzipSha256"]
  assert len(raw) == row["gzipBytes" if old else "newGzipBytes"]
  decoded = gzip.decompress(raw)
  assert len(decoded) == row["decodedBytes"] and sha(decoded) == row["decodedSha256"]
  if old:
    return raw
  before = git_bytes(path)
  assert len(before) == row["gzipBytes"] and sha(before) == row["gzipSha256"]
  assert gzip.decompress(before) == decoded
  return before


def predecessor_packet_bytes_v194(
  path: Path, reader: Reader = Path.read_bytes
) -> bytes:
  raw = reader(path)
  if path.resolve().parent != PUBLIC:
    return raw
  row = rows_v194(reader).get(path.name)
  return verify_wire_v194(path, raw, row) if row else raw


def predecessor_manifest_v194(current: dict, reader: Reader = Path.read_bytes) -> dict:
  """Every descriptor and all non-wire fields equal the complete immutable v193."""
  before = original_manifest_v194()
  expected = copy.deepcopy(before)
  rows = rows_v194(reader)
  found = set()
  for index, descriptor in enumerate(expected["chunks"]):
    for mode in ("drawn", "minecraft"):
      asset = descriptor.get(mode, {})
      row = rows.get(asset.get("url"))
      if not row:
        continue
      assert asset["bytes"] == row["gzipBytes"] and asset["sha256"] == row["gzipSha256"]
      live = current["chunks"][index].get(mode)
      after = dict(asset, bytes=row["newGzipBytes"], sha256=row["newGzipSha256"])
      assert live in (asset, after), "Unreceipted v194 descriptor"
      descriptor[mode] = copy.deepcopy(live)
      raw = reader(PUBLIC / row["file"])
      assert len(raw) == live["bytes"] and sha(raw) == live["sha256"]
      verify_wire_v194(PUBLIC / row["file"], raw, row)
      found.add(row["file"])
  assert found == rows.keys() and current == expected, (
    "Changed v194 manifest complement"
  )
  return copy.deepcopy(before)
