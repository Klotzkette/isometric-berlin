"""Freeze the two finite unpublished v196 dry-run groups without live writes."""

from __future__ import annotations

import gzip
import json
import os
from pathlib import Path

from scripts.prepare_lossless_v196 import (
  ANCHOR,
  DEFAULT_OUTPUT,
  PIN_FILE,
  PUBLIC,
  git_bytes,
  sha,
)


def combine(output: Path = DEFAULT_OUTPUT) -> dict:
  ordinary = output.with_name("lossless-v196-ordinary")
  parts = [(output, 768), (ordinary, 512)]
  rows, preparations, deltas = [], [], []
  names = set()
  for directory, count in parts:
    preparation = json.loads((directory / "preparation.json").read_bytes())
    receipt = json.loads((directory / "receipt.json").read_bytes())
    delta = json.loads((directory / "manifest-delta.json").read_bytes())
    assert receipt["anchor"] == ANCHOR and receipt["applied"] is False
    assert len(receipt["rows"]) == preparation["files"] == count
    preparations.append(preparation)
    deltas.extend(delta["rows"])
    for row in receipt["rows"]:
      name = row["file"]
      assert name not in names
      names.add(name)
      before = git_bytes(PUBLIC / name)
      after = (directory / name).read_bytes()
      assert (PUBLIC / name).read_bytes() == before
      assert len(before) == row["gzipBytes"] and sha(before) == row["gzipSha256"]
      assert len(after) == row["newGzipBytes"] and sha(after) == row["newGzipSha256"]
      decoded = gzip.decompress(before)
      assert gzip.decompress(after) == decoded
      assert (
        len(decoded) == row["decodedBytes"] and sha(decoded) == row["decodedSha256"]
      )
      if directory != output:
        destination = output / name
        if destination.exists():
          assert destination.read_bytes() == after
        else:
          os.link(directory / name, destination)
      rows.append(row)
  assert len(rows) == 1280
  sources = [
    {
      k: row[k]
      for k in [
        "file",
        "gzipBytes",
        "gzipSha256",
        "decodedBytes",
        "decodedSha256",
        "chunkId",
        "mode",
      ]
    }
    for row in rows
  ]
  PIN_FILE.write_text(json.dumps(sources, separators=(",", ":")) + "\n")
  saved = sum(r["savedBytes"] for r in rows)
  permanent = dict(
    step=10,
    applied=True,
    method="Zopfli one iteration; exact decompressed bytes verified",
    savedBytes=saved,
    rows=rows,
  )
  raw = (json.dumps(permanent, indent=2) + "\n").encode()
  (output / "permanent-receipt.json").write_bytes(raw)
  combined = dict(
    step=10,
    applied=False,
    anchor=ANCHOR,
    method="Zopfli one iteration; every full decompression equals immutable Git original",
    savedBytes=saved,
    rows=rows,
  )
  # Keep exact group evidence before the combined ledger replaces this path.
  for filename in ["receipt.json", "preparation.json", "manifest-delta.json"]:
    (output / ("far-outer-" + filename)).write_bytes((output / filename).read_bytes())
  (output / "receipt.json").write_text(json.dumps(combined, indent=2) + "\n")
  (output / "manifest-delta.json").write_text(
    json.dumps(
      dict(anchor=ANCHOR, applied=False, onlyFields=["bytes", "sha256"], rows=deltas),
      indent=2,
    )
    + "\n"
  )
  assert preparations[0]["previousPins"] == preparations[1]["previousPins"]
  final = dict(
    anchor=ANCHOR,
    applied=False,
    files=1280,
    groups=preparations,
    oldWireBytes=sum(s["gzipBytes"] for s in sources),
    oldDecodedBytes=sum(s["decodedBytes"] for s in sources),
    manifestSha256=preparations[0]["manifestSha256"],
    sourcesSha256=sha(PIN_FILE.read_bytes()),
    receiptSha256=sha(raw),
    savedBytes=saved,
    previousPins=preparations[0]["previousPins"],
    excludedRegionIds=sorted(
      set(preparations[0]["excludedRegionIds"])
      | set(preparations[1]["excludedRegionIds"])
    ),
  )
  (output / "preparation.json").write_text(json.dumps(final, indent=2) + "\n")
  return {
    k: v
    for k, v in final.items()
    if k not in {"groups", "previousPins", "excludedRegionIds"}
  }


if __name__ == "__main__":
  print(json.dumps(combine(), indent=2))
