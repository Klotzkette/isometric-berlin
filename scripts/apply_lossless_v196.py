"""Authorised finite v196 wire-only commit with complete preflight and rollback.

All1280 original Git blobs, live bytes, complete decoded alternatives, source
pins and manifest declarations validate before the first live mutation. Source
packets are staged, then the sole manifest update publishes their new byte/hash
descriptors. Any exception restores the full original set and manifest.
"""

from __future__ import annotations

import copy
import gzip
import json
import os
from pathlib import Path

from scripts.integrate_lossless_v196 import (
  ANCHOR,
  MANIFEST_SHA256,
  PUBLIC,
  RECEIPT,
  ROOT,
  SOURCES,
  git_bytes,
  sha,
)
from scripts.prepare_lossless_v196 import DEFAULT_OUTPUT


def apply(output: Path = DEFAULT_OUTPUT) -> dict:
  sources = json.loads(SOURCES.read_bytes())
  assert (
    sha(SOURCES.read_bytes())
    == "509b0d1325c5b827663a332a0fab4e78bfb59698b0a3f2c0d3e11eb027bcb318"
  )
  preparation = json.loads((output / "preparation.json").read_bytes())
  for name, digest in preparation["previousPins"].items():
    assert sha((ROOT / name).read_bytes()) == digest, "Changed immutable earlier pins"
  dry = json.loads((output / "receipt.json").read_bytes())
  permanent = (output / "permanent-receipt.json").read_bytes()
  assert (
    sha(permanent) == "a86ac4b5949c066e18c23b80e96836cfb1138fa6c08ca6abde51d06532e9fef8"
  )
  receipt = json.loads(permanent)
  assert receipt["rows"] == dry["rows"] and receipt["applied"] is True
  assert dry["applied"] is False and dry["anchor"] == ANCHOR
  assert len(dry["rows"]) == len(sources) == 1280 and dry["savedBytes"] == 27748130
  before_bytes = git_bytes(PUBLIC / "manifest.json")
  assert sha(before_bytes) == MANIFEST_SHA256
  assert (PUBLIC / "manifest.json").read_bytes() == before_bytes, (
    "Current manifest changed before finite application"
  )
  before = json.loads(before_bytes)
  after = copy.deepcopy(before)
  originals, newbytes = {}, {}
  deltas = []
  for source, row in zip(sources, dry["rows"], strict=True):
    assert {k: row[k] for k in source} == source
    name = row["file"]
    assert Path(name).name == name and name not in originals
    path = PUBLIC / name
    old = git_bytes(path)
    packed = (output / name).read_bytes()
    decoded = gzip.decompress(old)
    assert (
      path.read_bytes() == old
      and len(old) == row["gzipBytes"]
      and sha(old) == row["gzipSha256"]
    )
    assert len(decoded) == row["decodedBytes"] and sha(decoded) == row["decodedSha256"]
    assert len(packed) == row["newGzipBytes"] and sha(packed) == row["newGzipSha256"]
    assert gzip.decompress(packed) == decoded, "Complete decoded byte drift"
    assert row["savedBytes"] == len(old) - len(packed) > 0
    descriptor = next(c for c in after["chunks"] if c["id"] == row["chunkId"])
    asset = descriptor[row["mode"]]
    assert (
      asset["url"] == name
      and asset["bytes"] == len(old)
      and asset["sha256"] == sha(old)
      and asset["decodedBytes"] == len(decoded)
      and asset["encoding"] == "gzip"
    )
    prior = copy.deepcopy(asset)
    asset.update(bytes=len(packed), sha256=sha(packed))
    deltas.append(
      dict(
        id=row["chunkId"], mode=row["mode"], before=prior, after=copy.deepcopy(asset)
      )
    )
    originals[name], newbytes[name] = old, packed
  assert sum(r["savedBytes"] for r in dry["rows"]) == 27748130
  assert json.loads((output / "manifest-delta.json").read_bytes())["rows"] == deltas
  stage = output / "atomic-staging"
  stage.mkdir(exist_ok=True)
  for name, packed in newbytes.items():
    (stage / name).write_bytes(packed)
  (stage / "manifest.json").write_text(
    json.dumps(after, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  # Validate complete originals once more after all staging, before mutation.
  assert (PUBLIC / "manifest.json").read_bytes() == before_bytes
  assert all((PUBLIC / name).read_bytes() == old for name, old in originals.items())
  try:
    for name in newbytes:
      os.replace(stage / name, PUBLIC / name)
    os.replace(stage / "manifest.json", PUBLIC / "manifest.json")
    assert json.loads((PUBLIC / "manifest.json").read_bytes()) == after
    assert all(
      (PUBLIC / name).read_bytes() == packed for name, packed in newbytes.items()
    )
    RECEIPT.write_bytes(permanent)
  except BaseException:
    for name, old in originals.items():
      (stage / name).write_bytes(old)
      os.replace(stage / name, PUBLIC / name)
    (stage / "manifest.json").write_bytes(before_bytes)
    os.replace(stage / "manifest.json", PUBLIC / "manifest.json")
    raise
  finally:
    for path in stage.iterdir():
      path.unlink()
    stage.rmdir()
  result = dict(
    applied=True,
    anchor=ANCHOR,
    files=1280,
    savedBytes=27748130,
    decodedBytesUnchanged=sum(r["decodedBytes"] for r in sources),
    beforeManifestSha256=sha(before_bytes),
    afterManifestSha256=sha((PUBLIC / "manifest.json").read_bytes()),
    receiptSha256=sha(permanent),
    onlyDescriptorChanges=["bytes", "sha256"],
  )
  (output / "application.json").write_text(json.dumps(result, indent=2) + "\n")
  return result


if __name__ == "__main__":
  print(json.dumps(apply(), indent=2))
