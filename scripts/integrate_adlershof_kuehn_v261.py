"""Pure, reversible v261 manifest adapter with finite owner/asset verification."""

from __future__ import annotations

import copy
import gzip
import hashlib
import json
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
GEO = ROOT / "geo_data/regierungsviertel"
ADDITION = GEO / "adlershof-kuehn-v261-manifest-addition.json"
Reader = Callable[[Path], bytes]
BASELINE_SHA256 = "c6b5192719a5816b3bbb47b0b188ad6af461f26f9a1ac13388116fa865c5d17b"
SOURCE_SHA256 = "1fb10c3378e911432425e930c6608a65d7f5d62f2f3c6529d1d22047e4611f00"
MARKER = "adlershofKuehnV261"
REPLACED = {"east200-20_19", "east200-21_19"}
ADDED = "kuehn261-26_24"


def canonical_sha256(value: dict) -> str:
  """Fingerprint the whole predecessor without a duplicate 2 MiB manifest."""
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def merged(previous: dict, addition: dict) -> dict:
  """Replace two exact descriptors and append one explicitly requested site."""
  assert canonical_sha256(previous) == BASELINE_SHA256, "Unreceipted v260 baseline"
  replacements = {r["old"]["id"]: r for r in addition["replacements"]}
  assert len(addition["replacements"]) == 2 and set(replacements) == REPLACED
  assert len(addition["chunks"]) == 1 and addition["chunks"][0]["id"] == ADDED
  assert len(addition["footprint"]) == 1
  result = copy.deepcopy(previous)
  for i, desc in enumerate(previous["chunks"]):
    if desc["id"] in replacements:
      replacement = replacements[desc["id"]]
      assert desc == replacement["old"]
      new = replacement["new"]
      assert {k: v for k, v in new.items() if k not in ("drawn", "minecraft")} == {
        k: v for k, v in desc.items() if k not in ("drawn", "minecraft")
      }
      result["chunks"][i] = copy.deepcopy(new)
  result["chunks"].extend(copy.deepcopy(addition["chunks"]))
  result["footprint"].extend(copy.deepcopy(addition["footprint"]))
  result[MARKER] = copy.deepcopy(addition[MARKER])
  assert len(result["chunks"]) == 2194 <= 2208
  assert len(json.dumps(result, separators=(",", ":")).encode()) < 2176 * 1024
  return result


def verify_packets(addition: dict, reader: Reader = Path.read_bytes) -> None:
  """Verify full source, old retained bytes and all six bounded new payloads."""
  meta = addition[MARKER]
  assert meta["source"] == "adlershof-kuehn-v261-source.json.gz"
  assert meta["sourceSha256"] == SOURCE_SHA256
  source_raw = reader(GEO / meta["source"])
  assert hashlib.sha256(source_raw).hexdigest() == SOURCE_SHA256
  source = json.loads(gzip.decompress(source_raw))
  buildings = source["buildings"]
  assert len(buildings) == 8 and sum(len(b["parts"]) for b in buildings) == 27
  expected = {
    "east200-20_19": {"DEBE09YYO00007rF", "DEBE09YYO0000Gid", "DEBE09YYO00003li"},
    "east200-21_19": {"DEBE09YYO0000HEx"},
    ADDED: {b["id"] for b in buildings if b["site"] == "kuehn"},
  }
  for replacement in addition["replacements"]:
    for mode in ("drawn", "minecraft"):
      asset = replacement["old"][mode]
      assert Path(asset["url"]).name == asset["url"]
      packed = reader(PUBLIC / asset["url"])
      assert len(packed) == asset["bytes"]
      assert hashlib.sha256(packed).hexdigest() == asset["sha256"]
  for desc in [*(r["new"] for r in addition["replacements"]), *addition["chunks"]]:
    x0, z0, x1, z1 = desc["bounds"]
    assert x1 - x0 == z1 - z0 == 512
    selected = [b for b in buildings if b["id"] in expected[desc["id"]]]
    parts = {(b["id"], p["id"]) for b in selected for p in b["parts"]}
    for mode in ("drawn", "minecraft"):
      asset = desc[mode]
      assert Path(asset["url"]).name == asset["url"]
      assert asset["url"].startswith("adlershof261-")
      packed = reader(PUBLIC / asset["url"])
      assert len(packed) == asset["bytes"] < 650000
      assert hashlib.sha256(packed).hexdigest() == asset["sha256"]
      raw = gzip.decompress(packed)
      assert len(raw) == asset["decodedBytes"] < 2600000
      packet = json.loads(raw)
      assert packet["schemaVersion"] == 1 and packet["id"] == desc["id"]
      assert packet["origin"] == [x0, -10, z0]
      assert 1 <= len(packet["meshes"]) <= 16
      actual = {
        (p["sourceId"], p.get("partId"))
        for p in packet["nav"]["buildings"]
        if p.get("sourceId") in expected[desc["id"]]
      }
      assert actual == parts, "Missing complete measured part navigation"
      if desc["id"] == ADDED:
        assert not packet["nav"]["water"] and not packet["nav"]["roads"]
        assert not packet["nav"]["bridges"] and len(packet["nav"]["ground"]) == 1
        # Native strips may comprise several rings per retained source part.
        assert {p["sourceId"] for p in packet["nav"]["buildings"]} == expected[ADDED]


def predecessor_manifest_v261(current: dict, reader: Reader = Path.read_bytes) -> dict:
  """Remove only the exact proven change; reject every unknown manifest edit."""
  from scripts.integrate_euref_v262 import predecessor_manifest_v262

  current = predecessor_manifest_v262(current, reader)
  if MARKER not in current:
    assert not any(
      c["id"] == ADDED
      or any(
        c.get(mode, {}).get("url", "").startswith("adlershof261-")
        for mode in ("drawn", "minecraft")
      )
      for c in current["chunks"]
    )
    return current
  addition = json.loads(reader(ADDITION))
  assert current[MARKER] == addition[MARKER]
  assert current["chunks"][-1:] == addition["chunks"]
  assert current["footprint"][-1:] == addition["footprint"]
  previous = copy.deepcopy(current)
  previous.pop(MARKER)
  previous["chunks"] = previous["chunks"][:-1]
  previous["footprint"] = previous["footprint"][:-1]
  replacements = {r["new"]["id"]: r for r in addition["replacements"]}
  for i, desc in enumerate(previous["chunks"]):
    if desc["id"] in replacements:
      assert desc == replacements[desc["id"]]["new"]
      previous["chunks"][i] = copy.deepcopy(replacements[desc["id"]]["old"])
  assert canonical_sha256(previous) == BASELINE_SHA256, (
    "Unreceipted v261 manifest change"
  )
  assert current == merged(previous, addition)
  verify_packets(addition, reader)
  return previous
