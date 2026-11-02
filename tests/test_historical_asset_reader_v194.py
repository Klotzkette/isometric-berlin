"""Finite expected-path/whole-wire proof for historical manifest readers."""

from __future__ import annotations

import copy
import gzip
import hashlib

import pytest

from scripts import integrate_lossless_v194 as wire
from scripts.historical_asset_reader_v194 import manifest_asset_reader_v194


def manifest(name: str, size: int, digest: str) -> dict:
  asset = {"url": name, "bytes": size, "sha256": digest}
  return {"chunks": [{"id": "finite-owner", "drawn": asset}]}


def test_every_registered_new_gzip_reaches_only_its_exact_old_declared_bytes():
  for name, receipt in wire.rows_v194(wire.Path.read_bytes).items():
    path = wire.PUBLIC / name
    declared = manifest(name, receipt["gzipBytes"], receipt["gzipSha256"])
    old = manifest_asset_reader_v194(declared)(path)
    assert len(old) == receipt["gzipBytes"]
    assert hashlib.sha256(old).hexdigest() == receipt["gzipSha256"]
    assert old == wire.git_bytes(path)
    assert gzip.decompress(old) == gzip.decompress(path.read_bytes())


def test_unknown_wire_same_decoded_bytes_or_wrong_declared_digest_fail_closed():
  name, receipt = next(iter(wire.rows_v194(wire.Path.read_bytes).items()))
  path = wire.PUBLIC / name
  declared = manifest(name, receipt["gzipBytes"], receipt["gzipSha256"])
  unknown = gzip.compress(gzip.decompress(path.read_bytes()), mtime=12345)

  def reader(source):
    return unknown if source == path else source.read_bytes()

  with pytest.raises(AssertionError):
    manifest_asset_reader_v194(declared, reader)(path)
  for field, value in [("bytes", receipt["gzipBytes"] + 1), ("sha256", "0" * 64)]:
    bad = copy.deepcopy(declared)
    bad["chunks"][0]["drawn"][field] = value
    with pytest.raises(AssertionError):
      manifest_asset_reader_v194(bad)(path)


def test_ordinary_nonasset_inputs_remain_exact_and_unknown_sources_cannot_substitute(
  tmp_path,
):
  source = tmp_path / "retained-source.json.gz"
  raw = b"immutable unrelated original bytes"
  source.write_bytes(raw)
  read = manifest_asset_reader_v194({"chunks": []})
  assert read(source) == raw
  name = "unregistered-v194-fixture.drawn.json.gz"
  path = wire.PUBLIC / name

  def reader(_):
    return raw

  assert (
    manifest_asset_reader_v194(
      manifest(name, len(raw), hashlib.sha256(raw).hexdigest()), reader
    )(path)
    == raw
  )
  with pytest.raises(AssertionError):
    manifest_asset_reader_v194(manifest(name, len(raw), "0" * 64), reader)(path)


def test_unsafe_or_conflicting_descriptor_admission_fails_before_any_read():
  for name in ["../outside.drawn.json.gz", "/outside.drawn.json.gz", "plain.json"]:
    with pytest.raises(AssertionError):
      manifest_asset_reader_v194(manifest(name, 1, "0" * 64))
  data = manifest("finite.drawn.json.gz", 1, "0" * 64)
  other = copy.deepcopy(data["chunks"][0])
  other["drawn"]["sha256"] = "1" * 64
  data["chunks"].append(other)
  with pytest.raises(AssertionError):
    manifest_asset_reader_v194(data)
