"""Finite, hashed v190 transitions; unrelated old bytes remain immutable."""

from __future__ import annotations

import gzip
import hashlib
import json
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
sys.path.insert(0, str(ROOT / "scripts"))


def load(path: Path) -> dict:
  return json.loads(path.read_bytes())


@lru_cache(maxsize=None)
def baseline_v189(path: Path) -> bytes:
  return subprocess.check_output(
    ["git", "show", f"v1.0.89:{path.relative_to(ROOT)}"], cwd=ROOT
  )


@lru_cache(maxsize=1)
def audited_v190_changes() -> tuple[dict, list]:
  """Only three explicit ownership/terrain receipts may alter old asset hashes."""
  changes = {}
  north = load(DATA / "north-sites-v190-ownership-audit.json")
  expected_north = {
    b["id"]
    for b in load(DATA / "north-sites-v190-source.json")["buildings"]
    if b["replaceOwner"] and b["kind"] != "weissensee-hall"
  }
  assert len(expected_north) == 27 and set(north["sourceIds"]) == expected_north
  assert north["allNavigationUnchanged"] and north["unrelatedGeometryPreserved"]
  assert {c["id"] for c in north["chunks"]} == {"5_-5", "5_-4", "5_-3"}
  for chunk in north["chunks"]:
    for mode, receipt in chunk["modes"].items():
      assert receipt["allNavigationUnchanged"] and receipt["unrelatedGeometryPreserved"]
      assert receipt["removedOwnerTriangles"] > 0
      changes[(chunk["id"], mode)] = (receipt["oldSha256"], receipt["newSha256"])
  rail_path = DATA / "ostkreuz-v190-packet-patch.json"
  assert rail_path.is_file()
  if rail_path.exists():
    rail = load(rail_path)
    assert rail["unrelatedGeometryPreserved"]
    assert set(rail["ownerIds"]) == {
      "OSM-way-110639235",
      "OSM-way-1228253162",
      "OSM-way-1228253163",
      "OSM-way-463652072",
    }
    assert {c["id"] for c in rail["chunks"]} == {"ring182-12_3", "ring182-13_3"}
    for chunk in rail["chunks"]:
      for mode, receipt in chunk["modes"].items():
        assert receipt["preservedTriangles"] > receipt["removedTriangles"] > 0
        key = (chunk["id"], mode)
        assert key not in changes
        changes[key] = (receipt["oldSha256"], receipt["newSha256"])
  terrain_path = DATA / "grunewald-v190-packet-audit.json"
  companions = []
  assert terrain_path.is_file()
  if terrain_path.exists():
    terrain = load(terrain_path)
    if "details" in terrain:
      asset = terrain["details"]
      packed = (DATA / asset["url"]).read_bytes()
      assert len(packed) == asset["bytes"]
      assert hashlib.sha256(packed).hexdigest() == asset["sha256"]
      unpacked = gzip.decompress(packed)
      assert len(unpacked) == asset["decodedBytes"]
      details = json.loads(unpacked)
      terrain = {
        **terrain,
        "packets": details["packets"],
        "parentOffsets": details["parentOffsets"],
      }
    assert terrain["baseRelease"] == "v1.0.89"
    baseline = subprocess.check_output(
      [
        "git",
        "show",
        "v1.0.89:src/app/public/mesh/surrounding-berlin-v159/manifest.json",
      ],
      cwd=ROOT,
    )
    assert hashlib.sha256(baseline).hexdigest() == terrain["baseManifestSha256"]
    descriptors = {c["id"]: c for c in terrain["replacementDescriptors"]}
    splits = {c["id"]: c for c in terrain.get("splitPackets", [])}
    for chunk in terrain["packets"]:
      for receipt in chunk["representations"]:
        mode = receipt["mode"]
        key = (chunk["id"], mode)
        assert key not in changes, (
          "Overlapping transformations require an explicit receipt chain"
        )
        final_hash = descriptors[chunk["id"]][mode]["sha256"]
        if final_hash != receipt["sha256"]:
          split = next(
            r for r in splits[chunk["id"]]["representations"] if r["mode"] == mode
          )
          assert split["unsplitSha256"] == receipt["sha256"]
          assert len(split["packetMeshes"]) > 1 or (
            key in {("outer187--15_8", "minecraft"), ("outer187--23_4", "minecraft")}
            and split["packetMeshes"] == [7]
            and split["meshPieceCounts"] == [6, 1]
          )
          assert sum(split["meshPieceCounts"]) == sum(split["packetMeshes"])
        changes[key] = (receipt["baseSha256"], final_hash)
    companions = terrain.get("extraDescriptors", [])
  # Each exception must start at the immutable previously released bytes.
  previous = {
    d["id"]: d for d in json.loads(baseline_v189(PUBLIC / "manifest.json"))["chunks"]
  }
  for (identity, mode), (before, after) in changes.items():
    assert before == previous[identity][mode]["sha256"]
    assert before != after
  verify_subtractions_v190(north["chunks"], set(north["sourceIds"]), north=True)
  verify_subtractions_v190(rail["chunks"], set(rail["ownerIds"]), north=False)
  # Chain only independently verified v194 owner/water transitions through
  # the unchanged v189 checkpoint; never rewrite earlier baseline hashes.
  from packet_receipts_v194 import audited_v194_changes

  for key, (before, after) in audited_v194_changes().items():
    if key in changes:
      original, intermediate = changes[key]
      assert intermediate == before
      changes[key] = (original, after)
    else:
      assert previous[key[0]][key[1]]["sha256"] == before
      changes[key] = (before, after)
  # Local v195 refinement starts at the exact immutable v194 output of these
  # same families. Companions retain their identity and strict geometry budget.
  from packet_receipts_v195 import audited_v195_changes

  next_changes, next_companions = audited_v195_changes()
  companion_by_id = {d["id"]: d for d in companions}
  for key, (before, after) in next_changes.items():
    if key[0] in companion_by_id:
      assert companion_by_id[key[0]][key[1]]["sha256"] == before
    else:
      original, intermediate = changes[key]
      assert intermediate == before
      changes[key] = (original, after)
  replacements = {d["id"]: d for d in next_companions}
  assert set(replacements) <= set(companion_by_id)
  companions = [replacements.get(d["id"], d) for d in companions]
  # Exact v199 transfers start at their immutable v198 checkpoint; verify full
  # source-owner replay before extending any earlier preservation exception.
  from packet_receipts_v199 import audited_v199_changes

  next_changes, _ = audited_v199_changes()
  for key, (before, after) in next_changes.items():
    if key in changes:
      original, intermediate = changes[key]
      assert intermediate == before
      changes[key] = (original, after)
    else:
      assert previous[key[0]][key[1]]["sha256"] == before
      changes[key] = (before, after)
  return changes, companions


def assert_retained_descriptor(old: dict, current: dict, changes: dict) -> None:
  """Metadata, URLs and geometry placement survive; only receipted bytes change."""
  from packet_receipts_v199 import audited_v199_changes

  _, counts = audited_v199_changes()
  if old["id"] in counts:
    before, after = counts[old["id"]]
    assert old["buildingCount"] in (before, after)
    assert current["buildingCount"] == after
    old = {**old, "buildingCount": after}
  assert {k: v for k, v in old.items() if k not in {"drawn", "minecraft"}} == {
    k: v for k, v in current.items() if k not in {"drawn", "minecraft"}
  }
  for mode in ("drawn", "minecraft"):
    before, after = old[mode], current[mode]
    if (old["id"], mode) in changes:
      assert changes[(old["id"], mode)] == (before["sha256"], after["sha256"])
    if before != after:
      assert (old["id"], mode) in changes, (old["id"], mode)
      assert changes[(old["id"], mode)] == (before["sha256"], after["sha256"])
      assert {
        k: v for k, v in before.items() if k not in {"sha256", "bytes", "decodedBytes"}
      } == {
        k: v for k, v in after.items() if k not in {"sha256", "bytes", "decodedBytes"}
      }
    raw = (PUBLIC / after["url"]).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == after["sha256"]
    assert len(raw) == after["bytes"]
    if (old["id"], mode) in changes:
      decoded_bytes = len(gzip.decompress(raw))
      assert decoded_bytes == after["decodedBytes"]
      if (old["id"], mode) == ("5_-3", "minecraft"):
        # This retained v159 packet was already 659,567 / 2,620,565 bytes;
        # the named owner subtraction must shrink both existing representations.
        assert len(raw) < before["bytes"] == 659_567
        assert decoded_bytes < before["decodedBytes"] == 2_620_565
      elif (old["id"], mode) == ("1_6", "minecraft"):
        # Already oversized in v193; exact owner subtraction and water-only
        # datum correction shrink both representations, verified independently.
        assert len(raw) <= before["bytes"] == 1_233_594
        assert decoded_bytes <= before["decodedBytes"] == 4_236_573
      elif (old["id"], mode) == ("1_7", "minecraft"):
        # The unchanged v159 predecessor already exceeded the transfer target;
        # v194 removes only the independently verified Tempelhof owner faces.
        assert len(raw) < before["bytes"] == 684_576
        assert decoded_bytes < before["decodedBytes"] == 2_471_379
      else:
        assert len(raw) < 650_000 and decoded_bytes < 2_600_000


def predecessor_v190(path: Path) -> bytes:
  """Chain an earlier preservation proof through the immutable v189 checkpoint."""
  changes, _ = audited_v190_changes()
  pieces = path.name.split(".")
  key = (pieces[0], pieces[1]) if len(pieces) >= 3 else None
  if path.parent != PUBLIC or key not in changes:
    return path.read_bytes()
  before, after = changes[key]
  assert hashlib.sha256(path.read_bytes()).hexdigest() == after, str(path)
  raw = baseline_v189(path)
  assert hashlib.sha256(raw).hexdigest() == before, str(path)
  return raw


def v190_additions() -> dict:
  _, companions = audited_v190_changes()
  north = load(DATA / "north-city-v190-manifest.json")["chunks"]
  assert len(north) == 84
  assert all(d["id"].startswith("north190-") for d in north)
  added = {d["id"]: d for d in north + companions}
  assert len(added) == len(north) + len(companions)
  return added


def verify_subtractions_v190(chunks: list, owners: set, *, north: bool) -> None:
  """Independently prove the exact old→new multisets and deletion ownership.

  Read only committed baseline packets, current bytes and named old navigation.
  Every removed coloured triangle/ink point must belong to a named former prism;
  all non-city meshes and every unrelated navigation field remain exact.
  """
  import numpy as np
  from build_karl_marx_allee_v161 import mesh_signature
  from integrate_city_refinements_v166 import line_signature
  from shapely.geometry import Point, Polygon

  for chunk in chunks:
    for mode, receipt in chunk["modes"].items():
      path = PUBLIC / f"{chunk['id']}.{mode}.json.gz"
      before_bytes, after_bytes = baseline_v189(path), path.read_bytes()
      assert hashlib.sha256(before_bytes).hexdigest() == receipt["oldSha256"]
      assert hashlib.sha256(after_bytes).hexdigest() == receipt["newSha256"]
      before, after = (
        json.loads(gzip.decompress(before_bytes)),
        json.loads(gzip.decompress(after_bytes)),
      )
      assert {
        k: v for k, v in before.items() if k not in {"meshes", "lines", "nav"}
      } == {k: v for k, v in after.items() if k not in {"meshes", "lines", "nav"}}
      assert [m for m in before["meshes"] if m["kind"] != "city"] == [
        m for m in after["meshes"] if m["kind"] != "city"
      ]
      source, result = mesh_signature(before), mesh_signature(after)
      assert not result - source
      removed = source - result
      assert (
        sum(removed.values())
        == receipt["removedOwnerTriangles" if north else "removedTriangles"]
      )
      assert sum(result.values()) == receipt["preservedTriangles"]
      owner_rows = [b for b in before["nav"]["buildings"] if b["sourceId"] in owners]
      regions = [
        (
          Polygon(b["ring"], b["holes"]).buffer(0.011),
          before["nav"]["groundY"] + b.get("groundOffset", 0) + b["minHeight"],
          before["nav"]["groundY"] + b.get("groundOffset", 0) + b["height"],
        )
        for b in owner_rows
      ]
      # Packed signatures contain three UInt16 xyz/rgb rows, sorted per face.
      for key in removed:
        pts = np.frombuffer(key, dtype="<u2").reshape(-1, 6)[:, :3].astype(float) / 100
        pts[:, 1] += before["origin"][1]
        assert any(
          all(
            low - 0.011 <= y <= high + 0.031 and poly.covers(Point(x, z))
            for x, y, z in pts
          )
          for poly, low, high in regions
        ), (chunk["id"], mode, pts.tolist())
      if before.get("lines", {}).get("positions"):
        source_lines, result_lines = (
          line_signature(before["lines"]),
          line_signature(after["lines"]),
        )
        assert not result_lines - source_lines
        removed_lines = source_lines - result_lines
        assert (
          sum(removed_lines.values())
          == receipt["removedOwnerInkSegments" if north else "removedSourceInkSegments"]
        )
        for key in removed_lines:
          pts = (
            np.frombuffer(key, dtype="<u2").reshape(-1, 6)[:, :3].astype(float) / 100
          )
          pts[:, 1] += before["origin"][1]
          assert any(
            all(
              abs(y - high - 0.02) < 0.012 and poly.covers(Point(x, z))
              for x, y, z in pts
            )
            for poly, _, high in regions
          )
      else:
        assert before.get("lines") == after.get("lines")
      if north:
        assert before["nav"] == after["nav"]
      else:
        assert {k: v for k, v in before["nav"].items() if k != "buildings"} == {
          k: v for k, v in after["nav"].items() if k != "buildings"
        }
        assert [
          b for b in before["nav"]["buildings"] if b["sourceId"] not in owners
        ] == [
          b
          for b in after["nav"]["buildings"]
          if not b["sourceId"].startswith("OSTKREUZ-V190-")
        ]
        assert (
          sum(
            b["sourceId"].startswith("OSTKREUZ-V190-")
            for b in after["nav"]["buildings"]
          )
          == receipt["replacementNavigationCount"]
        )
