"""Exact v198→v199 owner transfers; no generic hash or metadata exceptions."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

from shapely.geometry import Polygon, box, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
sys.path.insert(0, str(ROOT / "scripts"))


def load(path: Path) -> dict:
  return json.loads(path.read_bytes())


def digest(raw: bytes) -> str:
  return hashlib.sha256(raw).hexdigest()


def baseline(path: Path) -> bytes:
  return subprocess.check_output(
    ["git", "show", f"v1.0.98:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def checked(raw: bytes, descriptor: dict) -> dict:
  assert digest(raw) == descriptor["sha256"]
  assert len(raw) == descriptor["bytes"] < 650_000
  plain = gzip.decompress(raw)
  assert len(plain) == descriptor["decodedBytes"] < 2_600_000
  return json.loads(plain)


@lru_cache(maxsize=1)
def audited_v199_changes() -> tuple[dict, dict]:
  """Replay committed exact source owners against immutable released packets.

  The returned metadata transitions permit only the measured ICC owner count
  decrement. Bounds, URLs, IDs and every other descriptor field stay exact.
  """
  from build_karl_marx_allee_v161 import mesh_signature
  from build_surrounding_outlines import chunk_payload, load_projected_polygon, world
  from integrate_airports_v194 import signature_sha
  from integrate_city_refinements_v166 import (
    line_signature,
    subtract_lines,
    subtract_meshes,
  )
  from integrate_icc_v199 import verify_replacement
  from repair_funkturm_packets_v199 import OWNERS, repair_payload

  old = {d["id"]: d for d in json.loads(baseline(PUBLIC / "manifest.json"))["chunks"]}
  current = {d["id"]: d for d in load(PUBLIC / "manifest.json")["chunks"]}
  receipt = load(GEO / "icc-v199-packet-audit.json")
  source = verify_replacement()
  assert receipt["sourceSha256"] == digest(
    (GEO / "icc-v199-source.json.gz").read_bytes()
  )
  assert receipt["completeReplacementOwners"] == [o["id"] for o in source["owners"]]
  targets = {"ring182--13_2": "DEBE04YY500001II", "outer187--13_3": "DEBE04YY500004dG"}
  assert {c["id"]: c["owner"] for c in receipt["chunks"]} == targets
  assert set(receipt["ownerIds"]) == set(targets.values())
  asset = receipt["checkpoint"]
  packed = (GEO / asset["url"]).read_bytes()
  assert len(packed) == asset["bytes"] and digest(packed) == asset["sha256"]
  plain = gzip.decompress(packed)
  assert len(plain) == asset["decodedBytes"]
  checkpoints = {(r["id"], r["mode"]): r for r in json.loads(plain)}
  assert set(checkpoints) == {
    (identity, mode) for identity in targets for mode in ("drawn", "minecraft")
  }
  records = {
    r["sourceId"]: {**r, "geometry": shape(r["geometry"])}
    for r in receipt["sourceRecords"]
  }
  assert set(records) == set(targets.values())
  scopes = {
    "ring182--13_2": world(
      load_projected_polygon(GEO / "bounds-ring-v182.geojson").difference(
        load_projected_polygon(GEO / "bounds.geojson")
      )
    ),
    "outer187--13_3": world(
      load_projected_polygon(GEO / "bounds-outskirts-v187.geojson").difference(
        load_projected_polygon(GEO / "bounds-retained-v186.geojson")
      )
    ),
  }
  changes, metadata = {}, {}
  for row in receipt["chunks"]:
    identity, owner = row["id"], row["owner"]
    descriptor = next(d for d in receipt["descriptors"] if d["id"] == identity)
    assert descriptor == current[identity]
    for mode, report in row["modes"].items():
      assert report["oldDescriptor"] == old[identity][mode]
      assert report["newDescriptor"] == descriptor[mode]
      checkpoint = checkpoints[identity, mode]
      assert checkpoint["descriptor"] == old[identity][mode]
      raw = base64.b64decode(checkpoint["gzipBase64"])
      assert raw == baseline(PUBLIC / old[identity][mode]["url"])
      before = checked(raw, old[identity][mode])
      after = checked((PUBLIC / descriptor[mode]["url"]).read_bytes(), descriptor[mode])
      tile = box(*descriptor["bounds"])
      args = (identity, tile, scopes[identity].intersection(tile))
      selected = chunk_payload(
        *args, [records[owner]], {}, minecraft=mode == "minecraft"
      )
      empty = chunk_payload(*args, [], {}, minecraft=mode == "minecraft")
      removed = mesh_signature(selected) - mesh_signature(empty)
      assert removed and not removed - mesh_signature(before)
      expected = copy.deepcopy(before)
      expected["meshes"] = subtract_meshes(before["meshes"], removed.copy())
      assert sum(removed.values()) == report["removedTriangles"]
      assert signature_sha(removed) == report["removedTriangleSha256"]
      assert signature_sha(mesh_signature(after)) == report["preservedTriangleSha256"]
      if mode == "drawn":
        ink = line_signature(selected["lines"]) - line_signature(empty["lines"])
        expected["lines"] = subtract_lines(before["lines"], ink.copy())
        assert sum(ink.values()) == report["removedInkSegments"]
      owner_nav = [r for r in before["nav"]["buildings"] if r["sourceId"] == owner]
      assert owner_nav == report["removedNav"]
      for original, replay in zip(owner_nav, selected["nav"]["buildings"], strict=True):
        assert {k: v for k, v in original.items() if k not in ("ring", "holes")} == {
          k: v for k, v in replay.items() if k not in ("ring", "holes")
        }
        # GEOS may choose a different start vertex of the identical closed ring.
        assert (
          Polygon(original["ring"], original["holes"])
          .normalize()
          .equals_exact(Polygon(replay["ring"], replay["holes"]).normalize(), 0)
        )
      expected["nav"]["buildings"] = [
        r for r in before["nav"]["buildings"] if r["sourceId"] != owner
      ]
      assert after == expected
      if mode == "drawn":
        before_count = len({r["sourceId"] for r in before["nav"]["buildings"]})
        after_count = len({r["sourceId"] for r in after["nav"]["buildings"]})
        assert before_count == old[identity]["buildingCount"]
        assert after_count == descriptor["buildingCount"] == before_count - 1
        metadata[identity] = (before_count, after_count)
      changes[identity, mode] = (
        old[identity][mode]["sha256"],
        descriptor[mode]["sha256"],
      )

  # The two Funkturm IDs already have complete v187 sheets; only independently
  # replayed degenerate remnants may disappear. The native packet stays exact.
  tower = load(GEO / "funkturm-v199-packet-repair.json")
  assert tower["chunk"] == "outer187--13_2"
  assert (
    set(tower["ownerIds"]) == set(OWNERS) == {"DEBE04YY500006Zr", "DEBE04YY50002bpq"}
  )
  assert (GEO / tower["sourceProfiles"]).read_bytes() == baseline(
    GEO / tower["sourceProfiles"]
  )
  identity = tower["chunk"]
  for mode, report in tower["modes"].items():
    raw = (GEO / report["archive"]).read_bytes()
    assert digest(raw) == report["archiveSha256"]
    assert raw == baseline(PUBLIC / old[identity][mode]["url"])
    before = checked(raw, old[identity][mode])
    after = checked(
      (PUBLIC / report["descriptor"]["url"]).read_bytes(), report["descriptor"]
    )
    expected, proof = repair_payload(copy.deepcopy(before))
    assert after == expected
    for key, value in proof.items():
      assert report[key] == value
    assert len(proof["removedTriangles"]) == (8 if mode == "drawn" else 0)
    assert len(proof["removedLines"]) == (6 if mode == "drawn" else 0)
    assert len(proof["removedNavigation"]) == (2 if mode == "drawn" else 0)
    assert report["descriptor"] == current[identity][mode]
    if mode == "drawn":
      changes[identity, mode] = (
        old[identity][mode]["sha256"],
        report["descriptor"]["sha256"],
      )
    else:
      assert (PUBLIC / report["descriptor"]["url"]).read_bytes() == raw
  assert set(changes) == {
    (identity, mode) for identity in targets for mode in ("drawn", "minecraft")
  } | {("outer187--13_2", "drawn")}
  for identity in [*targets, tower["chunk"]]:
    prior = copy.deepcopy(old[identity])
    if identity in metadata:
      prior["buildingCount"] = metadata[identity][1]
    assert {k: v for k, v in prior.items() if k not in ("drawn", "minecraft")} == {
      k: v for k, v in current[identity].items() if k not in ("drawn", "minecraft")
    }
  return changes, metadata
