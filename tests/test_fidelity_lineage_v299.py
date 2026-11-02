"""Whole-manifest and exact gzip predecessor proofs, including hostile edits."""

from __future__ import annotations

import copy
import gzip
import hashlib
import json
from pathlib import Path

import pytest

from scripts import integrate_fidelity_v299 as lineage


def read(path: Path) -> dict:
  """Read one finite current audit input."""
  return json.loads(path.read_bytes())


@pytest.fixture(scope="module")
def current() -> dict:
  return read(lineage.PUBLIC / "manifest.json")


def overlay(changes: dict[Path, bytes]):
  """Substitute only requested hostile inputs; keep the rest byte-identical."""
  return lambda path: changes[path] if path in changes else path.read_bytes()


def test_exact_whole_predecessor_is_recovered_without_mutating_current(current):
  snapshot = copy.deepcopy(current)
  before = json.loads(lineage.original_manifest_bytes())
  after = lineage.predecessor_manifest_v299(current)
  assert after == before and current == snapshot
  assert lineage.canonical_sha(after) == lineage.MANIFEST_CANONICAL_SHA256
  assert len(current["chunks"]) - len(after["chunks"]) == 9
  assert current["footprint"][: len(before["footprint"])] == before["footprint"]
  assert current["boundary"][: len(before["boundary"])] == before["boundary"]
  assert lineage.predecessor_manifest_v299(before) is before
  historical = lineage.historical_source_bytes_v299(lineage.PUBLIC / "manifest.json")
  assert historical == lineage.original_manifest_bytes()
  assert hashlib.sha256(historical).hexdigest() == lineage.MANIFEST_SHA256


@pytest.mark.parametrize(
  "mutation",
  [
    "old-metadata",
    "old-content-url",
    "new-metadata",
    "missing",
    "extra",
    "footprint",
    "boundary",
    "old-footprint",
    "bounds",
    "version",
    "marker",
    "marker-removed",
    "descriptor-order",
    "unknown-field",
  ],
)
def test_unknown_manifest_scope_or_descriptor_edits_fail_closed(current, mutation):
  value = copy.deepcopy(current)
  if mutation == "old-metadata":
    value["chunks"][0]["drawn"]["bytes"] += 1
  elif mutation == "old-content-url":
    value["chunks"][0]["drawn"]["url"] = "foreign.drawn.json.gz"
  elif mutation == "new-metadata":
    value["chunks"][-1]["minecraft"]["sha256"] = "0" * 64
  elif mutation == "missing":
    value["chunks"].pop()
  elif mutation == "extra":
    extra = copy.deepcopy(value["chunks"][-1])
    extra["id"] = "stralau299-16_6"
    value["chunks"].append(extra)
  elif mutation == "footprint":
    value["footprint"].append(copy.deepcopy(value["footprint"][-1]))
  elif mutation == "boundary":
    value["boundary"][-1]["ring"][0][0] += 1
  elif mutation == "old-footprint":
    value["footprint"][0]["ring"][0][0] += 0.01
  elif mutation == "bounds":
    value["bounds"][0] -= 1
  elif mutation == "version":
    value["version"] = "foreign"
  elif mutation == "marker":
    value[lineage.MARKER]["chunkIds"].append("stralau299-16_6")
  elif mutation == "marker-removed":
    del value[lineage.MARKER]
  elif mutation == "descriptor-order":
    value["chunks"][0], value["chunks"][1] = value["chunks"][1], value["chunks"][0]
  else:
    value["unreceipted"] = {"coverage": "ignore this change"}
  with pytest.raises(AssertionError):
    lineage.predecessor_manifest_v299(value)


@pytest.mark.parametrize(
  "kind", ["source", "supplement", "integration", "inventory", "new-packet"]
)
def test_corrupt_source_receipt_or_new_payload_cannot_be_hidden(current, kind):
  supplement = read(lineage.SUPPLEMENT)
  path = {
    "source": lineage.GEO / supplement["source"]["sourceEvidence"],
    "supplement": lineage.SUPPLEMENT,
    "integration": lineage.INTEGRATION,
    "inventory": lineage.PUBLIC / supplement["source"]["inventory"]["url"],
    "new-packet": lineage.PUBLIC / supplement["chunks"][0]["minecraft"]["url"],
  }[kind]
  raw = path.read_bytes()
  if path.suffix == ".json":
    value = json.loads(raw)
    value["unreceipted"] = True
    changed = json.dumps(value).encode()
  else:
    changed = raw[:-1] + bytes([raw[-1] ^ 1])
  with pytest.raises(AssertionError):
    lineage.predecessor_manifest_v299(current, overlay({path: changed}))


def test_every_lossless_gzip_recovers_the_exact_old_git_blob_and_decoded_bytes():
  rows = lineage.lossless_rows()
  assert len(rows) == 24
  for name, receipt in rows.items():
    path = lineage.PUBLIC / name
    packed = path.read_bytes()
    old = lineage.predecessor_packet_bytes_v299(path)
    assert (
      len(packed) == receipt["newGzipBytes"]
      and lineage.sha(packed) == receipt["newGzipSha256"]
    )
    assert old == lineage.original_git_bytes(path)
    assert (
      len(old) == receipt["gzipBytes"] and lineage.sha(old) == receipt["gzipSha256"]
    )
    assert gzip.decompress(old) == gzip.decompress(packed)
    assert lineage.sha(gzip.decompress(old)) == receipt["decodedSha256"]
    # A historical caller is also allowed to supply the genuine old gzip.
    assert lineage.predecessor_packet_bytes_v299(path, overlay({path: old})) == old


@pytest.mark.parametrize(
  "kind", ["corrupt", "same-decoded-unknown-gzip", "forged-receipt", "source-pins"]
)
def test_lossless_exception_rejects_unknown_gzip_even_with_equal_decoded_json(kind):
  name, receipt = next(iter(lineage.lossless_rows().items()))
  path = lineage.PUBLIC / name
  packed = path.read_bytes()
  if kind == "corrupt":
    changes = {path: packed[:-1] + bytes([packed[-1] ^ 1])}
  elif kind == "same-decoded-unknown-gzip":
    changes = {path: gzip.compress(gzip.decompress(packed), mtime=123)}
  elif kind == "forged-receipt":
    forged = read(lineage.GZIP_RECEIPT)
    forged["rows"][0]["newGzipSha256"] = "0" * 64
    changes = {lineage.GZIP_RECEIPT: json.dumps(forged).encode()}
  else:
    forged = read(lineage.GZIP_SOURCES)
    forged[0]["decodedSha256"] = receipt["gzipSha256"]
    changes = {lineage.GZIP_SOURCES: json.dumps(forged).encode()}
  with pytest.raises(AssertionError):
    lineage.predecessor_packet_bytes_v299(path, overlay(changes))


def test_changed_original_git_blob_fails_before_historical_bytes_return(monkeypatch):
  name = next(iter(lineage.lossless_rows()))
  monkeypatch.setattr(lineage, "original_git_bytes", lambda _: b"corrupt old gzip")
  with pytest.raises(AssertionError, match="original gzip Git blob"):
    lineage.predecessor_packet_bytes_v299(lineage.PUBLIC / name)


def test_unregistered_and_nonpublic_sources_remain_byte_exact(tmp_path):
  path = tmp_path / "unrelated.json.gz"
  raw = b"unrelated original bytes"
  path.write_bytes(raw)
  assert lineage.predecessor_packet_bytes_v299(path) == raw
  assert lineage.historical_source_bytes_v299(path) == raw
  source = lineage.GEO / "street-curves-v276-source.json.gz"
  assert lineage.historical_source_bytes_v299(source) == source.read_bytes()
  unregistered = lineage.PUBLIC / "stralau299-12_4.drawn.json.gz"
  assert (
    lineage.predecessor_packet_bytes_v299(unregistered) == unregistered.read_bytes()
  )
