"""Reversible EUREF v262 adapter: three exact descriptors, no new coverage."""

from __future__ import annotations

import copy
import gzip
import hashlib
import json
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
ADDITION = GEO / "euref-v262-manifest-addition.json"
BASELINE_SHA256 = "02ac58b5651211d986e90de0a63957b759234dbcfd3a1c4f0bebe7cab9b9e86b"
SOURCE_SHA256 = "e8e993567220274ff0fa0abab3228ac416e68626d95d5c825f1091401d815414"
TRANSFERS_SHA256 = "ff2dd3082dec566550f91e62c6dbfe96cd6d249fd68b21648129f90c82b041aa"
MARKER = "eurefCampusV262"
REPLACED = {"-3_7", "-3_8", "-2_7"}
Reader = Callable[[Path], bytes]


def canonical_sha256(value: dict) -> str:
  """Hash the complete predecessor, with no duplicate multi-MiB manifest."""
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def merged(previous: dict, addition: dict) -> dict:
  """Change only the three receipted old descriptors, preserving their order."""
  assert canonical_sha256(previous) == BASELINE_SHA256, "Unreceipted v261 baseline"
  assert set(addition) == {"replacements", MARKER}
  replacements = {r["old"]["id"]: r for r in addition["replacements"]}
  assert (
    len(replacements) == len(addition["replacements"]) == 3
    and set(replacements) == REPLACED
  )
  result = copy.deepcopy(previous)
  for i, descriptor in enumerate(previous["chunks"]):
    if descriptor["id"] not in replacements:
      continue
    replacement = replacements[descriptor["id"]]
    assert descriptor == replacement["old"]
    new = replacement["new"]
    assert {k: v for k, v in new.items() if k not in ("drawn", "minecraft")} == {
      k: v for k, v in descriptor.items() if k not in ("drawn", "minecraft")
    }
    result["chunks"][i] = copy.deepcopy(new)
  result[MARKER] = copy.deepcopy(addition[MARKER])
  assert len(result["chunks"]) == len(previous["chunks"])
  assert result["footprint"] == previous["footprint"]
  return result


def verify_packets(addition: dict, reader: Reader = Path.read_bytes) -> None:
  """Verify source and all six old/six new assets, plus complete part ownership."""
  meta = addition[MARKER]
  assert meta == {
    "source": "euref-v262-source.json.gz",
    "sourceSha256": SOURCE_SHA256,
    "evidence": "euref-v262-evidence.json",
    "transfers": "src/app/src/data/eurefTransfersV262.json",
    "transfersSha256": TRANSFERS_SHA256,
  }
  transfer_raw = reader(ROOT / meta["transfers"])
  assert hashlib.sha256(transfer_raw).hexdigest() == TRANSFERS_SHA256
  transfers = json.loads(transfer_raw)
  assert transfers["schema"] == 1 and transfers["sourceSha256"] == SOURCE_SHA256
  raw = reader(GEO / meta["source"])
  assert hashlib.sha256(raw).hexdigest() == SOURCE_SHA256
  source = json.loads(gzip.decompress(raw))
  named = [b for b in source["buildings"] if b["replace"]]
  owners = {b["id"] for b in named}
  assert len(source["buildings"]) == 19 and len(named) == 8
  parts = {(b["id"], p["id"]) for b in named for p in b["parts"]}
  assert len(parts) == 15
  observed = {"drawn": set(), "minecraft": set()}
  assert {r["old"]["id"] for r in addition["replacements"]} == REPLACED
  for replacement in addition["replacements"]:
    originals = {}
    for which in ("old", "new"):
      descriptor = replacement[which]
      for family in ("drawn", "minecraft"):
        asset = descriptor[family]
        assert Path(asset["url"]).name == asset["url"]
        packed = reader(PUBLIC / asset["url"])
        assert hashlib.sha256(packed).hexdigest() == asset["sha256"]
        assert len(packed) == asset["bytes"] < 650_000
        raw = gzip.decompress(packed)
        assert len(raw) == asset["decodedBytes"] < 2_600_000
        if which == "old":
          originals[family] = json.loads(raw)
        if which == "new":
          assert asset["url"] == f"euref262-{descriptor['id']}.{family}.json.gz"
          packet = json.loads(raw)
          x, z, _, _ = descriptor["bounds"]
          assert packet["id"] == descriptor["id"] and packet["origin"] == [x, -10, z]
          old = originals[family]
          count = len(old["meshes"])
          assert packet["meshes"][:count] == old["meshes"]
          assert {k: v for k, v in packet.items() if k != "meshes"} == {
            k: v for k, v in old.items() if k != "meshes"
          }
          receipt = transfers["packets"][f"{family}:{descriptor['id']}"]
          assert receipt["origin"] == packet["origin"]
          assert {r["mesh"] for r in receipt["replacements"]} == set(
            range(count, len(packet["meshes"]))
          )
          assert all(
            p["kind"] == "euref-historic-v262" for p in packet["meshes"][count:]
          )
          observed[family].update(
            (r["sourceId"], r.get("partId"))
            for r in receipt["buildings"]
            if r.get("sourceId") in owners
          )
  assert observed["drawn"] == observed["minecraft"] == parts


def predecessor_manifest_v262(current: dict, reader: Reader = Path.read_bytes) -> dict:
  """Reject any unrelated edit while recovering the full verified predecessor."""
  if MARKER not in current:
    assert not any(
      c.get(family, {}).get("url", "").startswith("euref262-")
      for c in current["chunks"]
      for family in ("drawn", "minecraft")
    )
    return current
  addition = json.loads(reader(ADDITION))
  assert current[MARKER] == addition[MARKER]
  previous = copy.deepcopy(current)
  previous.pop(MARKER)
  replacements = {r["new"]["id"]: r for r in addition["replacements"]}
  for i, descriptor in enumerate(previous["chunks"]):
    if descriptor["id"] in replacements:
      assert descriptor == replacements[descriptor["id"]]["new"]
      previous["chunks"][i] = copy.deepcopy(replacements[descriptor["id"]]["old"])
  assert canonical_sha256(previous) == BASELINE_SHA256, (
    "Unreceipted v262 manifest change"
  )
  assert current == merged(previous, addition)
  verify_packets(addition, reader)
  return previous
