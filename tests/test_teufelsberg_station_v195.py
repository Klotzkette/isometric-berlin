"""Measured station blocks, exactly five corrections and complete proxy receipts."""

import base64
import gzip
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_karl_marx_allee_v161 import mesh_signature  # noqa: E402
from build_teufelsberg_station_v195 import (  # noqa: E402
  DATA,
  GEO,
  PARENTS,
  RADOMES,
  SOURCE,
  clip_y,
  triangles_for,
)
from integrate_airports_v194 import signature_sha  # noqa: E402
from integrate_city_refinements_v166 import line_signature  # noqa: E402
from integrate_teufelsberg_station_v195 import expected_subtraction  # noqa: E402

SRC = json.loads(gzip.decompress(SOURCE.read_bytes()))
MODEL = json.loads((DATA / "teufelsbergStationV195.json").read_bytes())
EVIDENCE = json.loads((GEO / "teufelsberg-station-v195-evidence.json").read_bytes())


def key(triangle: list) -> bytes:
  return np.asarray(sorted(triangle), dtype="<f8").tobytes()


def test_complete_official_inventory_and_exact_26_uncorrected_parts() -> None:
  assert {p["id"] for p in SRC["parents"]} == set(PARENTS)
  parts = [p for b in SRC["parents"] for p in b["parts"]]
  assert len(parts) == 31 and sum(len(p["surfaces"]) for p in parts) == 528
  assert EVIDENCE["sourceSha256"] == hashlib.sha256(SOURCE.read_bytes()).hexdigest()
  expected = Counter(
    key(t)
    for p in parts
    if p["id"] not in RADOMES
    for s in p["surfaces"]
    if s["kind"] != "GroundSurface"
    for t in triangles_for(s["rings"])
  )
  actual = Counter(
    key(t)
    for s in MODEL["surfaces"]
    if s["role"] == "measured-source"
    for t in s["triangles"]
  )
  assert actual == expected and len(actual) == 665 and sum(actual.values()) == 713
  assert {s["part"] for s in MODEL["surfaces"] if s["role"] == "measured-source"} == {
    p["id"] for p in parts if p["id"] not in RADOMES
  }
  assert all(
    s["sourcePolygon"] for s in MODEL["surfaces"] if s["role"] == "measured-source"
  )


def test_five_caps_keep_their_measured_centres_radii_and_upper_heights() -> None:
  parts = {p["id"]: p for b in SRC["parents"] for p in b["parts"]}
  assert {r["part"] for r in MODEL["radomes"]} == set(RADOMES)
  assert len(MODEL["radomes"]) == 5
  for dome in MODEL["radomes"]:
    part = parts[dome["part"]]
    triangles = [
      t
      for s in MODEL["surfaces"]
      if s["role"] == "radome-cap" and s["part"] == part["id"]
      for t in s["triangles"]
    ]
    points = np.asarray([p for t in triangles for p in t])
    assert len(triangles) > 300
    assert np.max(points[:, 1]) == part["top_y_m"] == dome["topY"]
    assert np.min(points[:, 1]) >= dome["baseY"] - 1e-8
    distances = np.linalg.norm(points - np.array(dome["centre"]), axis=1)
    assert np.max(distances) <= dome["radius"] + 0.01
    assert np.min(distances) > dome["radius"] * 0.975
  central = next(d for d in MODEL["radomes"] if d["name"] == "central")
  assert central["topY"] == 141.73
  assert central["topY"] > max(d["topY"] for d in MODEL["radomes"] if d != central) + 25
  # No old solid full-height cylinder may survive behind the open upper frame.
  assert not any(p["id"] == central["part"] for p in MODEL["navigation"])
  assert any(p["id"] == central["part"] + "/stair-core" for p in MODEL["navigation"])


def test_clipped_cap_faces_and_independent_native_blocks_are_finite() -> None:
  clipped = clip_y([[0, 0, 0], [2, 2, 0], [0, 2, 2]], 1)
  assert len(clipped) == 4 and min(p[1] for p in clipped) == 1
  assert EVIDENCE["counts"] == {
    "triangles": 5866,
    "lines": 4264,
    "boxes": 800,
    "nativeBlocks": 3029,
  }
  assert all(
    len(b) == 7 and min(b[3:6]) > 0 and np.isfinite(b).all() for b in MODEL["blocks"]
  )
  # Each source cap has its own native representation reaching its exact top.
  for dome in MODEL["radomes"]:
    cx, _, cz = dome["centre"]
    blocks = [
      b
      for b in MODEL["blocks"]
      if abs(b[0] - cx) < dome["radius"]
      and abs(b[2] - cz) < dome["radius"]
      and b[6] == 0xD8DAD0
    ]
    assert blocks and abs(max(b[1] + b[4] / 2 for b in blocks) - dome["topY"]) < 1e-8


def test_checkpoint_proves_only_exact_station_owners_disappear_after_terrain() -> None:
  receipt = json.loads(
    (GEO / "teufelsberg-station-v195-packet-audit.json").read_bytes()
  )
  owners = {r["id"] for r in SRC["replacedOwners"]}
  assert len(owners) == 23 and set(receipt["ownerIds"]) == owners
  assert all(r["officialOverlapFraction"] > 0.75 for r in SRC["replacedOwners"])
  assert not owners.intersection(SRC["retainedNearOwners"])
  ck = receipt["terrainCheckpoint"]
  blob = (GEO / ck["url"]).read_bytes()
  assert len(blob) == ck["bytes"] < 2_000_000
  assert hashlib.sha256(blob).hexdigest() == ck["sha256"]
  checkpoints = {(r["id"], r["mode"]): r for r in json.loads(gzip.decompress(blob))}
  assert len(checkpoints) == 4
  terrain = json.loads((GEO / "teufelsberg-v195-packet-audit.json").read_bytes())
  detail = json.loads(gzip.decompress((GEO / terrain["details"]["url"]).read_bytes()))
  primary = next(
    d for d in terrain["replacementDescriptors"] if d["id"] == receipt["family"]
  )
  assert (
    receipt["terrainAuditSha256"]
    == hashlib.sha256(
      (GEO / "teufelsberg-v195-packet-audit.json").read_bytes()
    ).hexdigest()
  )
  for mode in receipt["modes"]:
    expected_faces, expected_ink = expected_subtraction(
      mode["mode"], primary, detail["parentOffsets"]
    )
    removed_faces, removed_ink = Counter(), Counter()
    kept = Counter()
    removed_count = 0
    for record in mode["files"]:
      ck = checkpoints[record["id"], mode["mode"]]
      raw = base64.b64decode(ck["gzipBase64"])
      assert ck["descriptor"] == record["oldDescriptor"]
      assert hashlib.sha256(raw).hexdigest() == record["oldDescriptor"]["sha256"]
      current = (
        ROOT
        / "src/app/public/mesh/surrounding-berlin-v159"
        / record["newDescriptor"]["url"]
      )
      new_raw = current.read_bytes()
      assert hashlib.sha256(new_raw).hexdigest() == record["newDescriptor"]["sha256"]
      old, new = map(lambda b: json.loads(gzip.decompress(b)), [raw, new_raw])
      before, after = mesh_signature(old), mesh_signature(new)
      removed = before - after
      assert not after - before and sum(removed.values()) == record["removedTriangles"]
      removed_faces.update(removed)
      assert {k: v for k, v in old.items() if k not in ["meshes", "lines", "nav"]} == {
        k: v for k, v in new.items() if k not in ["meshes", "lines", "nav"]
      }
      assert {k: v for k, v in old["nav"].items() if k != "buildings"} == {
        k: v for k, v in new["nav"].items() if k != "buildings"
      }
      assert [b for b in old["nav"]["buildings"] if b["sourceId"] not in owners] == new[
        "nav"
      ]["buildings"]
      if mode["mode"] == "drawn" and old.get("lines", {}).get("positions"):
        a, b = line_signature(old["lines"]), line_signature(new["lines"])
        assert not b - a and sum((a - b).values()) == record["removedInk"]
        removed_ink.update(a - b)
      else:
        assert old.get("lines") == new.get("lines") and record["removedInk"] == 0
      kept.update(after)
      removed_count += sum(removed.values())
    assert removed_faces == expected_faces and removed_ink == expected_ink
    assert signature_sha(removed_faces) == mode["removedSha256"]
    assert removed_count == mode["removedTriangles"]
    assert (
      sum(kept.values()) == mode["preservedTriangles"]
      and signature_sha(kept) == mode["preservedSha256"]
    )


def test_external_free_reference_metadata_is_complete() -> None:
  refs = json.loads((GEO / "teufelsberg-station-v195-credits.json").read_bytes())
  assert len(refs) == 3 and {r["license"] for r in refs} == {"CC BY-SA 4.0", "CC0"}
  assert all(
    r["artist"]
    and r["license_url"]
    and r["page_url"].startswith("https://commons.wikimedia.org/wiki/File:")
    for r in refs
  )
