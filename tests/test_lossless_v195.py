"""Finite v195 full-byte lineage and closed historical source readers."""

from __future__ import annotations

import copy
import gzip
import hashlib
import json

import pytest

from scripts import integrate_lossless_v194 as previous
from scripts import integrate_lossless_v195 as wire
from scripts.historical_asset_reader_v194 import manifest_asset_reader_v194
from scripts.integrate_fidelity_v299 import predecessor_manifest_v299


def manifest(name, size, digest):
  return {
    "chunks": [
      {"id": "finite-owner", "drawn": {"url": name, "bytes": size, "sha256": digest}}
    ]
  }


def test_complete_96_full_decoded_sources_and_original_git_blobs():
  rows = wire.rows_v195()
  assert len(rows) == 96
  assert sum(r["savedBytes"] for r in rows.values()) == 5_203_540
  for name, row in rows.items():
    path = wire.PUBLIC / name
    current = path.read_bytes()
    prior = wire.predecessor_packet_bytes_v195(path)
    assert (
      len(current) == row["newGzipBytes"] and wire.sha(current) == row["newGzipSha256"]
    )
    assert len(prior) == row["gzipBytes"] and wire.sha(prior) == row["gzipSha256"]
    assert prior == wire.git_bytes(path)
    assert gzip.decompress(current) == gzip.decompress(prior)
    old = manifest_asset_reader_v194(
      manifest(name, row["gzipBytes"], row["gzipSha256"])
    )(path)
    assert old == prior


def test_entire_manifest_projects_to_exact_immutable_published_v194():
  current = json.loads((wire.PUBLIC / "manifest.json").read_bytes())
  before = wire.predecessor_manifest_v195(current)
  assert before == wire.original_manifest_v195()
  # Historical callers can provide the already recovered old descriptors.
  assert wire.predecessor_manifest_v195(before) == before
  normalized = previous.predecessor_manifest_v194(current)
  assert normalized == previous.original_manifest_v194()
  projected_reader = previous.predecessor_packet_bytes_v194
  assert previous.predecessor_manifest_v194(normalized, projected_reader) == normalized
  assert predecessor_manifest_v299(current)["chunks"]


def test_prior_lossless_sets_and_new_region_packets_are_disjoint():
  names = set(wire.rows_v195())
  for version in [193, 194]:
    old = json.loads(
      (
        wire.ROOT / f"geo_data/regierungsviertel/lossless-packets-v{version}.json"
      ).read_text()
    )
    assert not names & {r["file"] for r in old["rows"]}
  region_keys = {"ring182-7_8", "ring182-8_8"}
  for region in [
    "friedrichshainV303.json",
    "rixdorfV304.json",
    "neukoellnLandmarksV305.json",
  ]:
    path = wire.ROOT / "src/app/src/data" / region
    if path.exists():
      region_keys |= {
        key.split(":", 1)[1] for key in json.loads(path.read_text()).get("keys", [])
      }
  assert not {name.rsplit(".", 3)[0] for name in names} & region_keys


def test_changed_wire_equal_decoded_unknown_encoding_cannot_bypass_history():
  name, row = next(iter(wire.rows_v195().items()))
  path = wire.PUBLIC / name
  original = path.read_bytes()
  bad = bytearray(original)
  bad[9] ^= 1
  repacked = gzip.compress(gzip.decompress(original), mtime=12345)
  for unknown in [bytes(bad), repacked]:

    def reader(source):
      return unknown if source == path else source.read_bytes()

    with pytest.raises(AssertionError):
      wire.predecessor_packet_bytes_v195(path, reader)
    with pytest.raises(AssertionError):
      manifest_asset_reader_v194(
        manifest(name, row["gzipBytes"], row["gzipSha256"]), reader
      )(path)


def test_new_wire_same_filename_outside_public_has_no_historical_substitution(tmp_path):
  name, row = next(iter(wire.rows_v195().items()))
  outside = tmp_path / name
  outside.write_bytes((wire.PUBLIC / name).read_bytes())
  assert wire.predecessor_packet_bytes_v195(outside) == outside.read_bytes()
  # Exact current bytes are always readable; only a false historical hash fails.
  assert wire.sha(outside.read_bytes()) == row["newGzipSha256"]


def test_wrong_declared_length_digest_and_conflicting_descriptor_fail_closed():
  name, row = next(iter(wire.rows_v195().items()))
  path = wire.PUBLIC / name
  for size, digest in [
    (row["gzipBytes"] + 1, row["gzipSha256"]),
    (row["gzipBytes"], "0" * 64),
  ]:
    with pytest.raises(AssertionError):
      manifest_asset_reader_v194(manifest(name, size, digest))(path)
  bad = manifest(name, row["gzipBytes"], row["gzipSha256"])
  other = copy.deepcopy(bad["chunks"][0])
  other["drawn"]["sha256"] = "1" * 64
  bad["chunks"].append(other)
  with pytest.raises(AssertionError):
    manifest_asset_reader_v194(bad)


def test_any_changed_manifest_complement_or_incorrect_new_descriptor_is_rejected():
  before = json.loads((wire.PUBLIC / "manifest.json").read_text())
  mutations = []
  changed = copy.deepcopy(before)
  changed["bounds"][0] += 0.1
  mutations.append(changed)
  changed = copy.deepcopy(before)
  changed["chunks"][0]["id"] = "wrong-exact-owner"
  mutations.append(changed)
  first = next(iter(wire.rows_v195()))
  changed = copy.deepcopy(before)
  asset = next(
    a
    for c in changed["chunks"]
    for a in [c.get("drawn", {}), c.get("minecraft", {})]
    if a.get("url") == first
  )
  asset["bytes"] += 1
  mutations.append(changed)
  for changed in mutations:
    with pytest.raises(AssertionError):
      wire.predecessor_manifest_v195(changed)


def test_receipt_and_original_source_pins_are_immutable():
  for path in [wire.RECEIPT, wire.SOURCES]:
    bad = path.read_bytes() + b" "

    def reader(source):
      return bad if source == path else source.read_bytes()

    with pytest.raises(AssertionError):
      wire.rows_v195(reader)
  # Old immutable v194 controls were not re-signed to accept the new files.
  assert (
    hashlib.sha256(previous.RECEIPT.read_bytes()).hexdigest()
    == "7a60542fa00ca56be59fb381beb2e65c1379a0eccdc71a5dfb14135e9b9b627a"
  )
  assert (
    hashlib.sha256(previous.SOURCES.read_bytes()).hexdigest()
    == "e6bb489573a962ff7a7f6e1141190bfcb6c5e16ee77748d75a0fb42e3cdf44de"
  )
