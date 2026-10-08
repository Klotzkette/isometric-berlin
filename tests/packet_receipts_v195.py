"""Strict, bounded v194→fine terrain→measured station transition checkpoints."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
sys.path.insert(0, str(ROOT / "scripts"))


def digest(raw: bytes) -> str:
  return hashlib.sha256(raw).hexdigest()


def load(path: Path) -> dict:
  return json.loads(path.read_bytes())


def verified_asset(path: Path, asset: dict) -> bytes:
  raw = path.read_bytes()
  assert digest(raw) == asset["sha256"], path
  assert len(raw) == asset["bytes"] < 650_000
  assert len(gzip.decompress(raw)) == asset["decodedBytes"] < 2_600_000
  return raw


def baseline(path: Path, release: str = "v1.0.94") -> bytes:
  return subprocess.check_output(
    ["git", "show", f"{release}:{path.relative_to(ROOT)}"], cwd=ROOT
  )


@lru_cache(maxsize=1)
def terrain_receipt() -> dict:
  receipt = load(GEO / "teufelsberg-v195-packet-audit.json")
  asset = receipt["details"]
  raw = (GEO / asset["url"]).read_bytes()
  assert digest(raw) == asset["sha256"] and len(raw) == asset["bytes"] < 5 * 1024**2
  decoded = gzip.decompress(raw)
  assert len(decoded) == asset["decodedBytes"]
  return {**receipt, **json.loads(decoded)}


@lru_cache(maxsize=1)
def station_checkpoints() -> dict:
  receipt = load(GEO / "teufelsberg-station-v195-packet-audit.json")
  asset = receipt["terrainCheckpoint"]
  raw = (GEO / asset["url"]).read_bytes()
  assert digest(raw) == asset["sha256"] and len(raw) == asset["bytes"] < 2_000_000
  decoded = gzip.decompress(raw)
  assert len(decoded) == asset["decodedBytes"]
  rows = json.loads(decoded)
  result = {}
  for row in rows:
    blob = base64.b64decode(row["gzipBase64"])
    assert digest(blob) == row["descriptor"]["sha256"]
    result[row["id"], row["mode"]] = blob
  assert len(result) == 4
  return result


def terrain_packet(descriptor: dict, mode: str) -> dict:
  """Public bytes except the independently hashed pre-station checkpoint."""
  key = descriptor["id"], mode
  if key in station_checkpoints():
    raw = station_checkpoints()[key]
    assert digest(raw) == descriptor[mode]["sha256"]
  else:
    raw = verified_asset(PUBLIC / descriptor[mode]["url"], descriptor[mode])
  return json.loads(gzip.decompress(raw))


@lru_cache(maxsize=1)
def audited_v195_changes() -> tuple[dict, list]:
  from collections import Counter

  from build_karl_marx_allee_v161 import mesh_signature
  from integrate_city_refinements_v166 import line_signature
  from integrate_teufelsberg_station_v195 import expected_subtraction

  receipt = terrain_receipt()
  assert (
    receipt["baseRelease"] == "v1.0.94"
    and receipt["inheritedSourceRelease"] == "v1.0.89"
  )
  assert digest(baseline(PUBLIC / "manifest.json")) == receipt["baseManifestSha256"]
  assert (
    digest((ROOT / "src/app/src/data/teufelsbergTerrainV195.json").read_bytes())
    == receipt["terrainSha256"]
  )
  old = {d["id"]: d for d in json.loads(baseline(PUBLIC / "manifest.json"))["chunks"]}
  before = {d["id"]: d for d in receipt["baselineDescriptors"]}
  final = {
    d["id"]: d for d in receipt["replacementDescriptors"] + receipt["extraDescriptors"]
  }
  assert (
    len(receipt["replacementDescriptors"]) == 16
    and len(receipt["extraDescriptors"]) == 8
  )
  assert set(before) == set(final)
  assert {d["id"] for d in receipt["replacementDescriptors"]} == {
    f"outer187--{x}_{z}" for x in range(16, 20) for z in range(2, 6)
  }
  inherited = load(GEO / "grunewald-v190-packet-audit.json")
  inherited = {
    d["id"]: d
    for d in inherited["replacementDescriptors"] + inherited["extraDescriptors"]
  }
  for identity, row in before.items():
    assert row == old[identity]
    assert row == inherited[identity]
    for mode in ("drawn", "minecraft"):
      assert digest(baseline(PUBLIC / row[mode]["url"])) == row[mode]["sha256"]
    assert {k: v for k, v in row.items() if k not in ("drawn", "minecraft")} == {
      k: v for k, v in final[identity].items() if k not in ("drawn", "minecraft")
    }
  station = load(GEO / "teufelsberg-station-v195-packet-audit.json")
  assert station["family"] == "outer187--18_4" and len(station["ownerIds"]) == 23
  assert station["terrainAuditSha256"] == digest(
    (GEO / "teufelsberg-v195-packet-audit.json").read_bytes()
  )
  assert station["sourceSha256"] == digest(
    (GEO / "teufelsberg-station-v195-source.json.gz").read_bytes()
  )
  source = json.loads(
    gzip.decompress((GEO / "teufelsberg-station-v195-source.json.gz").read_bytes())
  )
  assert station["replacedSourceRecords"] == source["replacedOwners"]
  assert set(station["ownerIds"]) == {r["id"] for r in source["replacedOwners"]}
  owners = set(station["ownerIds"])
  primary = final[station["family"]]
  for report in station["modes"]:
    mode = report["mode"]
    expected_faces, expected_ink = expected_subtraction(
      mode, primary, receipt["parentOffsets"]
    )
    removed, removed_ink = Counter(), Counter()
    for file in report["files"]:
      identity = file["id"]
      assert final[identity][mode] == file["oldDescriptor"]
      a = terrain_packet(final[identity], mode)
      b = json.loads(
        gzip.decompress(
          verified_asset(PUBLIC / file["newDescriptor"]["url"], file["newDescriptor"])
        )
      )
      left, right = mesh_signature(a), mesh_signature(b)
      assert not right - left
      removed.update(left - right)
      assert sum((left - right).values()) == file["removedTriangles"]
      assert {k: v for k, v in a.items() if k not in ("meshes", "lines", "nav")} == {
        k: v for k, v in b.items() if k not in ("meshes", "lines", "nav")
      }
      assert {k: v for k, v in a["nav"].items() if k != "buildings"} == {
        k: v for k, v in b["nav"].items() if k != "buildings"
      }
      assert [r for r in a["nav"]["buildings"] if r["sourceId"] not in owners] == b[
        "nav"
      ]["buildings"]
      if a.get("lines", {}).get("positions"):
        left_ink, right_ink = line_signature(a["lines"]), line_signature(b["lines"])
        assert not right_ink - left_ink
        removed_ink.update(left_ink - right_ink)
        assert sum((left_ink - right_ink).values()) == file["removedInk"]
      final[identity] = {**final[identity], mode: file["newDescriptor"]}
    assert removed == expected_faces and removed_ink == expected_ink
    assert sum(removed.values()) == report["removedTriangles"] > 0
  assert [final[d["id"]] for d in station["descriptors"]] == station["descriptors"]
  changes = {}
  for identity, d in final.items():
    for mode in ("drawn", "minecraft"):
      verified_asset(PUBLIC / d[mode]["url"], d[mode])
      if before[identity][mode] != d[mode]:
        changes[identity, mode] = (before[identity][mode]["sha256"], d[mode]["sha256"])
  return changes, [d for d in final.values() if d.get("detailCompanionOf")]


def historical_v190_asset(descriptor: dict, mode: str) -> bytes:
  """Keep original v190 tests exact even after explicitly audited v195 refinements."""
  asset = descriptor[mode]
  raw = (PUBLIC / asset["url"]).read_bytes()
  if digest(raw) == asset["sha256"]:
    return raw
  changes, _ = audited_v195_changes()
  assert changes[descriptor["id"], mode] == (asset["sha256"], digest(raw))
  old = baseline(PUBLIC / asset["url"])
  assert digest(old) == asset["sha256"]
  return old
