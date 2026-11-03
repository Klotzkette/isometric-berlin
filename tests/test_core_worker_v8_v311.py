"""Strict finite browser-engine binding keeps all old contact words intact."""

from __future__ import annotations

import copy
import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Polygon, shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_core_worker_v8_v311 import (  # noqa: E402
  ACTUAL_SHA,
  CORE_SHA,
  INDEX_SHA,
  POSITION_SHA,
  triangle_words_equal,
  validate_browser_proof_v311,
)

DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"


def digest(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


@pytest.fixture(scope="module")
def source():
  return json.loads((DATA / "coreTerrainContactV307.json").read_text())


def test_exact_v8_profile_only_remaps_the_proven_later_retirements(source):
  assert digest(DATA / "coreTerrainContactV307.json") == CORE_SHA
  assert digest(DATA / "coreTerrainActualV310.json") == ACTUAL_SHA
  assert (
    digest(DATA / "coreWorkerV8V311.json")
    == "37ab1b919c12658ec32afc0e9c106dbd461aeba02d38acd154a81b000a894337"
  )
  profile = json.loads((DATA / "coreWorkerV8V311.json").read_text())
  part = next(
    p
    for p in source["variants"]["drawn-worker"]["parts"]
    if p.get("batchId") == "surface-parks-1" and p["name"] == "smooth parkland lawns"
  )
  p = profile["part"]
  assert profile["baseVariantControls"] == {
    "drawn-initial": 513866325,
    "drawn-worker": 1893277644,
    "minecraft": 4230670502,
  }
  assert p["oldTriangleInterval"] == [1336986, 1337586]
  assert p["actualTriangleInterval"] == [1336986, 1337584]
  assert p["retireShift"] == {"fromOrdinal": 1337586, "delta": -2, "count": 918}
  assert not any(1336986 <= n < 1337586 for n in part["retire"])
  old = np.array(part["retire"], dtype="<u4")
  actual = old.copy()
  actual[actual >= 1337586] -= 2
  assert len(actual) == len(np.unique(actual)) == p["retiredTriangleCount"] == 184049
  assert int(np.count_nonzero(actual != old)) == 918
  assert hashlib.sha256(old.tobytes()).hexdigest() == p["oldRetireWordsSha256"]
  assert hashlib.sha256(actual.tobytes()).hexdigest() == p["actualRetireWordsSha256"]
  assert list(part["attributes"]) == list(p["attributes"]) == ["position"]
  assert p["attributes"]["position"] == {
    "type": "Float32Array",
    "itemSize": 3,
    "count": 833654,
    "normalized": False,
    "hash": 1261909167,
  }
  assert p["index"] == {"type": "Uint32Array", "count": 4845468, "hash": 2552398405}
  assert p["positionSha256"] == POSITION_SHA and p["indexSha256"] == INDEX_SHA
  assert (DATA / "coreWorkerV8V311.json").stat().st_size < 4096


def test_full_word_evidence_keeps_retriangulation_outside_the_measured_field(source):
  proof = json.loads(
    gzip.decompress((GEO / "core-worker-v8-v311-evidence.json.gz").read_bytes())
  )
  assert proof["exactJscRawEqualsOriginalSource"] is True
  assert proof["completePrefixAndSuffixOrderedXyzWordsEqual"] is True
  assert (
    proof["originalRetiredTrianglesInChangedBlock"]
    == proof["changedSourceTrianglesIntersectingField"]
    == 0
  )
  assert proof["retiredTriangles"] == 184049
  assert (
    proof["originalRetiredXYZWordsSha256"]
    == proof["actualRetiredXYZWordsSha256"]
    == "c8c37bfe007fd7d386f8b70209e68609db41d46cb88de911e840f3b7012a39e9"
  )
  assert proof["sourceAttributes"] == ["position"]
  assert proof["immutableInsideAndOutsideAndNavigation"] is True
  assert (
    digest(DATA / "coreTerrainContactV307Navigation.json")
    == proof["originalCoreNavigationSha256"]
    == "5ab149f953c1648f71b3d0a7bbb710b2a314d3fd1197ef9ef1828464d7250557"
  )
  part = next(
    p
    for p in source["variants"]["drawn-worker"]["parts"]
    if p.get("batchId") == "surface-parks-1" and p["name"] == "smooth parkland lawns"
  )
  assert (
    hashlib.sha256(
      json.dumps(part["outside"], ensure_ascii=False, separators=(",", ":")).encode()
    ).hexdigest()
    == proof["originalOutsideJsonSha256"]
  )
  assert part["materials"] == proof["canonicalMaterials"]
  domain = shape(
    next(
      p
      for p in json.loads((DATA / "northParkTerrainV306.json").read_text())["profiles"]
      if p["key"] == "humboldthain"
    )["domain"]
  )
  assert (
    sum(r["count"] for r in proof["changedTriangles"] if r["engine"] == "jsc") == 28
  )
  assert sum(r["count"] for r in proof["changedTriangles"] if r["engine"] == "v8") == 26
  for row in proof["changedTriangles"]:
    xyz = np.array(row["positions"])
    assert Polygon(xyz[:, [0, 2]]).intersection(domain).area == 0
  validate_browser_proof_v311(proof["independentBrowserProof"])


def browser_proof():
  return {
    "rows": [
      {
        "kind": "positions",
        "bytes": 10003848,
        "sha256": POSITION_SHA,
        "actualBrowserAndNodeV8AllBytesEqual": True,
      },
      {
        "kind": "indices",
        "bytes": 19381872,
        "sha256": INDEX_SHA,
        "actualBrowserAndNodeV8AllBytesEqual": True,
      },
    ]
  }


@pytest.mark.parametrize(
  "damage",
  ["note-only", "missing", "duplicate", "foreign", "bytes", "hash", "equality"],
)
def test_independent_browser_proof_requires_both_complete_actual_word_streams(damage):
  proof = copy.deepcopy(browser_proof())
  if damage == "note-only":
    proof = {"note": POSITION_SHA + INDEX_SHA}
  elif damage == "missing":
    proof["rows"].pop()
  elif damage == "duplicate":
    proof["rows"][1] = proof["rows"][0].copy()
  elif damage == "foreign":
    proof["rows"][1]["kind"] = "foreign"
  elif damage == "bytes":
    proof["rows"][1]["bytes"] -= 4
  elif damage == "hash":
    proof["rows"][1]["sha256"] = "0" * 64
  else:
    proof["rows"][1]["actualBrowserAndNodeV8AllBytesEqual"] = False
  with pytest.raises(ValueError):
    validate_browser_proof_v311(proof)


def test_ordered_source_word_comparison_rejects_float_bit_or_winding_changes():
  points = np.array([[0, 0, 0], [1, 0, 0], [0, 0, 1]], dtype="<f4").view("<u4")
  face = np.array([[0, 1, 2]], dtype="<u4")
  assert triangle_words_equal(points, face, points.copy(), face.copy())
  changed = points.copy()
  changed[0, 0] ^= 1
  assert not triangle_words_equal(points, face, changed, face)
  assert not triangle_words_equal(points, face, points, face[:, [0, 2, 1]])
  assert not triangle_words_equal(points, face, points, np.empty((0, 3), dtype="<u4"))
