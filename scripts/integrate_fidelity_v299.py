"""Strict historical replay of the finite v299 scope and v193 gzip changes.

This module never publishes, writes files, deletes coverage or rebuilds gzip.
It first proves the entire current extension against the immutable 0f Git
anchor and bounded receipts, then returns that exact historical predecessor.
"""

from __future__ import annotations

import copy
import gzip
import hashlib
import json
import math
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Callable

from scripts.integrate_lossless_v194 import (
  predecessor_manifest_v194,
  predecessor_packet_bytes_v194,
)

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
GEO = ROOT / "geo_data/regierungsviertel"
ANCHOR = "0f6174362de87d785f6e6f5b864d05e5efa973fc"
MANIFEST_SHA256 = "db15e3b722bf64d223eed121aac4986dc48e91207e086e8b8d8f9a43dd074115"
MANIFEST_CANONICAL_SHA256 = (
  "687d79e895f958dc2132ffd0be3502e2ae6dffd75f9a2146b65148c5fc92e0e8"
)
SUPPLEMENT = GEO / "stralau-sisyphos-v299-manifest.json"
SUPPLEMENT_CANONICAL_SHA256 = (
  "6a3db72acc1fe6e707ae7da3e1febea9c2f84c5c726af2f9ba5fd8ed51c9d7be"
)
INTEGRATION = GEO / "stralau-sisyphos-v299-integration.json"
INTEGRATION_SHA256 = "559ee97d42cd8d77dd1987fb85b82984f756eaa6712744ab0c57dba3307ed13d"
SOURCE_SHA256 = "36f2601b9f3a97bd4dc9847d0c7ff212461b1e63a55bd97267bc4d103263b784"
GZIP_SOURCES = ROOT / "src/app/losslessSurroundingV193Sources.json"
GZIP_SOURCE_SHA256 = "a65d5ea92fd7e8005c6a4a77b078ea1ed1cbaf5f84f4205eb5547523197ed323"
GZIP_RECEIPT = GEO / "lossless-packets-v193.json"
GZIP_ROWS_SHA256 = "5aaee3e3993c53f7598389af82464370e0ae5c4fc8f8cde7cc88c26b3765ee42"
MARKER = "stralauSisyphosV299"
EXTRA_IDS = (
  "stralau299-12_4",
  "stralau299-12_5",
  "stralau299-13_4",
  "stralau299-13_5",
  "stralau299-13_6",
  "stralau299-14_5",
  "stralau299-14_6",
  "stralau299-15_5",
  "stralau299-15_6",
)
EXPECTED_MARKER = {
  "source": "Exact requested Stralau peninsula and Hauptstrasse 15 parcel; original LoD2/OSM source geometry, no district fill",
  "chunkIds": list(EXTRA_IDS),
  "evidence": "stralau299-source-inventory.json.gz",
}
Reader = Callable[[Path], bytes]


def sha(raw: bytes) -> str:
  """Hash complete bytes rather than trusting a publication flag."""
  return hashlib.sha256(raw).hexdigest()


def canonical_sha(value: object) -> str:
  """Hash all dictionary fields, preserving ordered descriptor/coverage lists."""
  return sha(json.dumps(value, sort_keys=True, separators=(",", ":")).encode())


def original_git_bytes(path: Path) -> bytes:
  """Read only this exact repo-relative path from the immutable Git anchor."""
  relative = path.resolve().relative_to(ROOT).as_posix()
  return subprocess.check_output(["git", "show", f"{ANCHOR}:{relative}"], cwd=ROOT)


@lru_cache(maxsize=1)
def original_manifest_bytes() -> bytes:
  """Retain one lightweight immutable manifest anchor, not a second file copy."""
  raw = original_git_bytes(PUBLIC / "manifest.json")
  assert sha(raw) == MANIFEST_SHA256, "Corrupt v299 Git manifest anchor"
  assert canonical_sha(json.loads(raw)) == MANIFEST_CANONICAL_SHA256
  return raw


def lossless_rows(reader: Reader = Path.read_bytes) -> dict[str, dict]:
  """Admit exactly 24 pinned source rows and the reviewed new gzip results."""
  raw = reader(GZIP_SOURCES)
  assert sha(raw) == GZIP_SOURCE_SHA256, "Unreceipted v193 gzip source pins"
  sources = json.loads(raw)
  receipt = json.loads(reader(GZIP_RECEIPT))
  assert set(receipt) == {"step", "applied", "method", "savedBytes", "rows"}
  assert receipt["step"] == 10 and type(receipt["applied"]) is bool
  assert receipt["method"] == "Zopfli one iteration; exact decompressed bytes verified"
  assert canonical_sha(receipt["rows"]) == GZIP_ROWS_SHA256
  assert len(sources) == len(receipt["rows"]) == 24
  assert (
    receipt["savedBytes"] == sum(r["savedBytes"] for r in receipt["rows"]) == 4_940_271
  )
  rows = {}
  for source, row in zip(sources, receipt["rows"], strict=True):
    assert {k: row[k] for k in source} == source
    name = row["file"]
    assert Path(name).name == name and name.endswith(
      (".drawn.json.gz", ".minecraft.json.gz")
    )
    assert name not in rows and not name.startswith("stralau299-")
    assert 0 < row["newGzipBytes"] < row["gzipBytes"] <= 4 * 1024**2
    assert 0 < row["decodedBytes"] <= 12 * 1024**2
    assert row["savedBytes"] == row["gzipBytes"] - row["newGzipBytes"]
    rows[name] = row
  return rows


def verified_lossless_bytes(path: Path, raw: bytes, row: dict) -> bytes:
  """Return the exact old gzip blob only after whole new/old decoded proof.

  Recompressing equal JSON would not recover the original gzip bytes. The
  immutable Git blob is separately checked against the pinned old gzip hash,
  length and full decoded byte stream before it can be returned.
  """
  digest = sha(raw)
  assert digest in (row["gzipSha256"], row["newGzipSha256"]), (
    f"Unreceipted v193 gzip: {path.name}"
  )
  old_form = digest == row["gzipSha256"]
  assert len(raw) == row["gzipBytes" if old_form else "newGzipBytes"]
  decoded = gzip.decompress(raw)
  assert len(decoded) == row["decodedBytes"] and sha(decoded) == row["decodedSha256"]
  if old_form:
    return raw
  original = original_git_bytes(path)
  assert len(original) == row["gzipBytes"] and sha(original) == row["gzipSha256"], (
    "Corrupt v193 original gzip Git blob"
  )
  original_decoded = gzip.decompress(original)
  assert len(original_decoded) == row["decodedBytes"]
  assert sha(original_decoded) == row["decodedSha256"] and original_decoded == decoded
  return original


def predecessor_packet_bytes_v299(
  path: Path, reader: Reader = Path.read_bytes
) -> bytes:
  """Normalize only registered Public gzip files; every other input is exact."""
  from scripts.surface_packet_lineage_v337 import predecessor_packet_bytes_v337

  supplied = predecessor_packet_bytes_v337(path, reader(path))
  if path.resolve().parent == PUBLIC and path.name.endswith(".json.gz"):
    receipt = lossless_rows(reader).get(path.name)
    if receipt is not None and sha(supplied) == receipt["gzipSha256"]:
      return verified_lossless_bytes(path, supplied, receipt)

  def retained(source: Path) -> bytes:
    return supplied if source.resolve() == path.resolve() else reader(source)

  raw = predecessor_packet_bytes_v194(path, retained)
  if path.resolve().parent != PUBLIC or not path.name.endswith(".json.gz"):
    return raw
  rows = lossless_rows(reader)
  row = rows.get(path.name)
  return raw if row is None else verified_lossless_bytes(path, raw, row)


def verify_supplement(reader: Reader) -> dict:
  """Verify the finite nine source tiles, exact scope, sources and both modes."""
  supplement = json.loads(reader(SUPPLEMENT))
  assert canonical_sha(supplement) == SUPPLEMENT_CANONICAL_SHA256, (
    "Unreceipted v299 supplement"
  )
  integration_raw = reader(INTEGRATION)
  assert sha(integration_raw) == INTEGRATION_SHA256, (
    "Unreceipted v299 integration proof"
  )
  integration = json.loads(integration_raw)
  assert integration["schemaVersion"] == 1
  assert integration["previousManifestSha256"] == MANIFEST_SHA256
  assert integration["newSupplement"] == supplement
  assert integration["sourceScope"] == {
    "groundY": 3,
    "footprint": supplement["footprint"],
  }
  assert supplement["source"]["preservedManifestSha256"] == MANIFEST_SHA256
  assert supplement["bounds"] == [6368.0, 2358.0, 8182.713941280032, 3482.0]
  assert (
    supplement["schemaVersion"] == 1
    and supplement["version"] == "v299"
    and supplement["chunkSize"] == 512
  )
  assert supplement["groundY"] == 3 and supplement["waterY"] == -1.15
  assert len(supplement["footprint"]) == len(supplement["boundary"]) == 4
  for field in ("footprint", "boundary"):
    for polygon in supplement[field]:
      assert set(polygon) == {"ring", "holes"} and len(polygon["ring"]) >= 4
      for ring in [polygon["ring"], *polygon["holes"]]:
        assert all(len(p) == 2 and all(math.isfinite(v) for v in p) for p in ring)
        assert all(
          6367.99 <= p[0] <= 8182.724 and 2357.99 <= p[1] <= 3482.01 for p in ring
        )
  meta = supplement["source"]
  assert meta["sourceEvidenceSha256"] == SOURCE_SHA256
  assert sha(reader(GEO / meta["sourceEvidence"])) == SOURCE_SHA256, (
    "Corrupt v299 retained source"
  )
  inventory = meta["inventory"]
  assert Path(inventory["url"]).name == inventory["url"] == EXPECTED_MARKER["evidence"]
  raw = reader(PUBLIC / inventory["url"])
  assert len(raw) == inventory["bytes"] and sha(raw) == inventory["sha256"]
  assert tuple(c["id"] for c in supplement["chunks"]) == EXTRA_IDS
  for descriptor in supplement["chunks"]:
    assert set(descriptor) == {"id", "bounds", "buildingCount", "drawn", "minecraft"}
    x, z = (int(v) for v in descriptor["id"].removeprefix("stralau299-").split("_"))
    assert descriptor["bounds"] == [x * 512, z * 512, (x + 1) * 512, (z + 1) * 512]
    assert type(descriptor["buildingCount"]) is int and descriptor["buildingCount"] >= 0
    for family in ("drawn", "minecraft"):
      asset = descriptor[family]
      assert (
        asset["url"] == f"{descriptor['id']}.{family}.json.gz"
        and asset["encoding"] == "gzip"
      )
      packed = reader(PUBLIC / asset["url"])
      assert len(packed) == asset["bytes"] < 1024**2 and sha(packed) == asset["sha256"]
      decoded = gzip.decompress(packed)
      assert len(decoded) == asset["decodedBytes"] <= 12 * 1024**2
      packet = json.loads(decoded)
      assert packet["schemaVersion"] == 1 and packet["id"] == descriptor["id"]
      assert packet["origin"] == [x * 512, -10, z * 512]
      assert 1 <= len(packet["meshes"]) <= 16
  return supplement


def predecessor_manifest_v299(current: dict, reader: Reader = Path.read_bytes) -> dict:
  """Recover all of 0f only after an exact whole-manifest reconstruction proof."""
  from scripts.surface_packet_lineage_v337 import predecessor_manifest_v337

  current = predecessor_manifest_v337(current, reader)
  if MARKER not in current:
    assert not any(c["id"].startswith("stralau299-") for c in current["chunks"]), (
      "Unreceipted v299 descriptor without marker"
    )
    return current
  current = predecessor_manifest_v194(current, reader)
  supplement = verify_supplement(reader)
  previous = json.loads(original_manifest_bytes())
  expected = copy.deepcopy(previous)
  rows = lossless_rows(reader)
  observed = set()
  assert len(current["chunks"]) == len(previous["chunks"]) + 9
  checked_assets = []
  for index, descriptor in enumerate(expected["chunks"]):
    for family in ("drawn", "minecraft"):
      asset = descriptor.get(family, {})
      row = rows.get(asset.get("url"))
      if row is None:
        continue
      assert asset["sha256"] == row["gzipSha256"] and asset["bytes"] == row["gzipBytes"]
      assert (
        asset["decodedBytes"] == row["decodedBytes"] and asset["encoding"] == "gzip"
      )
      new_asset = dict(asset, bytes=row["newGzipBytes"], sha256=row["newGzipSha256"])
      current_asset = current["chunks"][index].get(family)
      assert current_asset in (asset, new_asset), "Unreceipted v193 descriptor metadata"
      descriptor[family] = copy.deepcopy(current_asset)
      checked_assets.append((row, current_asset))
      observed.add(row["file"])
  assert observed == rows.keys()
  assert not {c["id"] for c in previous["chunks"]}.intersection(EXTRA_IDS)
  expected["chunks"].extend(copy.deepcopy(supplement["chunks"]))
  expected["footprint"].extend(copy.deepcopy(supplement["footprint"]))
  expected["boundary"].extend(copy.deepcopy(supplement["boundary"]))
  expected["version"] = "v299"
  expected[MARKER] = copy.deepcopy(EXPECTED_MARKER)
  assert current == expected, "Unreceipted v299 manifest or extra coverage"
  for row, asset in checked_assets:
    path = PUBLIC / row["file"]
    packed = reader(path)
    assert len(packed) == asset["bytes"] and sha(packed) == asset["sha256"], (
      "v193 descriptor does not match its exact payload"
    )
    verified_lossless_bytes(path, packed, row)
  return previous


def historical_source_bytes_v299(path: Path, reader: Reader = Path.read_bytes) -> bytes:
  """Bounded byte reader for existing historical digest entry points only."""
  if path.resolve() == PUBLIC / "manifest.json":
    raw = reader(path)
    current = json.loads(raw)
    previous = predecessor_manifest_v299(current, reader)
    return raw if previous is current else original_manifest_bytes()
  return predecessor_packet_bytes_v299(path, reader)
