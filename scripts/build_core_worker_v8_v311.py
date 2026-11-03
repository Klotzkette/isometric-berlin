"""Finite V8 Worker binding; immutable JSC/actual/bridge sources stay intact."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
from collections import Counter
from pathlib import Path

import numpy as np
from build_rail_sse_v307 import DATA, GEO, ROOT, read_v307, sha_v307, write_v307
from shapely.geometry import Polygon, shape

CORE_SHA = "62fb732f8d2b2e1fe836266f9de31b6b410a6b84804204cd0bdc33fa83af86b5"
ACTUAL_SHA = "fc64c21cbccbd17ae0d10748a07c06ac992d6b34c08dc080c8b9c158bda58a76"
POSITION_SHA = "7056089a094b5950de4b2c1a902c0d88d946a683dc4b7cb1599eaccbc7f95d57"
INDEX_SHA = "3b4a96cff5743dfae03c92a8de4290be4e0d00011e81edc39e1a1ef9c5444aca"
OLD_INTERVAL = (1336986, 1337586)
ACTUAL_INTERVAL = (1336986, 1337584)


def sha(b: bytes) -> str:
  return hashlib.sha256(b).hexdigest()


def triangle_words_equal(
  a: np.ndarray, ix: np.ndarray, b: np.ndarray, iy: np.ndarray
) -> bool:
  if len(ix) != len(iy):
    return False
  return all(
    np.array_equal(a[ix[i : i + 32768]], b[iy[i : i + 32768]])
    for i in range(0, len(ix), 32768)
  )


def validate_browser_proof_v311(proof: dict) -> None:
  expected = {"positions": (10003848, POSITION_SHA), "indices": (19381872, INDEX_SHA)}
  rows = proof.get("rows")
  if not isinstance(rows, list) or len(rows) != 2:
    raise ValueError("Independent actual browser full-word proof missing")
  seen = set()
  for row in rows:
    if not isinstance(row, dict):
      raise ValueError("Foreign browser proof row")
    kind = row.get("kind")
    if kind not in expected or kind in seen:
      raise ValueError("Duplicate or foreign browser proof kind")
    seen.add(kind)
    count, fingerprint = expected[kind]
    if (
      row.get("bytes") != count
      or row.get("sha256") != fingerprint
      or row.get("actualBrowserAndNodeV8AllBytesEqual") is not True
    ):
      raise ValueError("Actual browser byte count/hash/equality differs")
  if seen != set(expected):
    raise ValueError("Incomplete actual browser proof")


def compile_v311(
  captures: Path, predecessor: Path, browser_proof: Path, out: Path, evidence: Path
) -> None:
  if (
    sha_v307(DATA / "coreTerrainContactV307.json") != CORE_SHA
    or sha_v307(DATA / "coreTerrainActualV310.json") != ACTUAL_SHA
  ):
    raise ValueError("Original source changed")
  base = read_v307(DATA / "coreTerrainContactV307.json")
  part = next(
    p
    for p in base["variants"]["drawn-worker"]["parts"]
    if p.get("batchId") == "surface-parks-1" and p["name"] == "smooth parkland lawns"
  )
  if list(part["attributes"]) != ["position"] or part["instances"] is not None:
    raise ValueError("Foreign attribute/normal/paint source")
  if sha_v307(predecessor) != base["variants"]["drawn-worker"]["captureSha256"]:
    raise ValueError("Immutable full original capture changed")
  original = next(
    p
    for p in read_v307(predecessor)["parts"]
    if p.get("batchId") == "surface-parks-1" and p["name"] == part["name"]
  )
  old_pos = (captures / "bun-jsc-park1.positions.bin").read_bytes()
  old_ix = (captures / "bun-jsc-park1.indices.bin").read_bytes()
  new_pos = (captures / "node-v8-park1.positions.bin").read_bytes()
  new_ix = (captures / "node-v8-park1.indices.bin").read_bytes()
  if old_pos != base64.b64decode(
    original["attributes"]["position"]["array"]
  ) or old_ix != base64.b64decode(original["index"]["array"]):
    raise ValueError("JSC capture differs from full immutable constructor source")
  if sha(new_pos) != POSITION_SHA or sha(new_ix) != INDEX_SHA:
    raise ValueError("Unknown V8 source profile")
  browser = read_v307(browser_proof)
  validate_browser_proof_v311(browser)
  a, b = (
    np.frombuffer(old_pos, "<u4").reshape(-1, 3),
    np.frombuffer(new_pos, "<u4").reshape(-1, 3),
  )
  ix, iy = (
    np.frombuffer(old_ix, "<u4").reshape(-1, 3),
    np.frombuffer(new_ix, "<u4").reshape(-1, 3),
  )
  lo, hi = OLD_INTERVAL
  nlo, nhi = ACTUAL_INTERVAL
  if (len(a), len(b), len(ix), len(iy)) != (833655, 833654, 1615158, 1615156):
    raise ValueError("Unknown source cardinality")
  if not triangle_words_equal(a, ix[:lo], b, iy[:nlo]) or not triangle_words_equal(
    a, ix[hi:], b, iy[nhi:]
  ):
    raise ValueError("Difference is not restricted to the exact source block")
  old_counts = Counter(row.tobytes() for row in a[ix[lo:hi]].reshape(-1, 9))
  new_counts = Counter(row.tobytes() for row in b[iy[nlo:nhi]].reshape(-1, 9))
  old_only, new_only = old_counts - new_counts, new_counts - old_counts
  if sum(old_only.values()) != 28 or sum(new_only.values()) != 26:
    raise ValueError("Unrecognized local retriangulation")
  domain = shape(
    next(
      p
      for p in read_v307(DATA / "northParkTerrainV306.json")["profiles"]
      if p["key"] == "humboldthain"
    )["domain"]
  )
  changed = []
  for engine, changed_counts in (("jsc", old_only), ("v8", new_only)):
    for words, copies in changed_counts.items():
      xyz = np.frombuffer(words, "<f4").reshape(3, 3)
      if Polygon(xyz[:, [0, 2]]).intersection(domain).area > 1e-10:
        raise ValueError("Retriangulation touches the measured field")
      changed.append(dict(engine=engine, count=copies, positions=xyz.tolist()))
  retired = np.asarray(part["retire"], dtype="<u4")
  if len(retired) != 184049 or np.any((retired >= lo) & (retired < hi)):
    raise ValueError("The original source block contains a retirement")
  remapped = retired.astype("<i8")
  remapped[remapped >= hi] -= 2
  if np.count_nonzero(remapped != retired) != 918 or not triangle_words_equal(
    a, ix[retired], b, iy[remapped]
  ):
    raise ValueError("A retired source XYZ word or winding differs")
  old_local, actual_local = a[ix[retired]].tobytes(), b[iy[remapped]].tobytes()
  if old_local != actual_local:
    raise ValueError("Retired full ordered source word streams differ")
  profile = dict(
    schemaVersion=1,
    baseSourceSha256=CORE_SHA,
    actualDeltaSha256=ACTUAL_SHA,
    actualDeltaControl=4273494300,
    bridgeDeltaSha256=sha_v307(DATA / "gesundbrunnenBridgeCoreV309Delta.json"),
    bridgeDeltaControl=1522445275,
    baseVariantControls={
      "drawn-initial": 513866325,
      "drawn-worker": 1893277644,
      "minecraft": 4230670502,
    },
    variant="drawn-worker",
    part=dict(
      name=part["name"],
      parentName=part["parentName"],
      batchId=part["batchId"],
      basePartControl=0,
      attributes={
        "position": dict(
          type="Float32Array",
          itemSize=3,
          count=833654,
          normalized=False,
          hash=1261909167,
        )
      },
      index=dict(type="Uint32Array", count=4845468, hash=2552398405),
      positionSha256=POSITION_SHA,
      indexSha256=INDEX_SHA,
      oldTriangleInterval=list(OLD_INTERVAL),
      actualTriangleInterval=list(ACTUAL_INTERVAL),
      retireShift=dict(fromOrdinal=hi, delta=-2, count=918),
      retiredTriangleCount=184049,
      retiredXYZWordsSha256=sha(old_local),
      oldRetireWordsSha256=sha(retired.tobytes()),
      actualRetireWordsSha256=sha(remapped.astype("<u4").tobytes()),
    ),
  )
  write_v307(out, profile)
  write_v307(
    evidence,
    dict(
      schemaVersion=1,
      originalCoreSha256=CORE_SHA,
      originalActualDeltaSha256=ACTUAL_SHA,
      originalFullCaptureSha256=sha_v307(predecessor),
      exactJscRawEqualsOriginalSource=True,
      originalRawPositionSha256=sha(old_pos),
      originalRawIndexSha256=sha(old_ix),
      actualRawPositionSha256=sha(new_pos),
      actualRawIndexSha256=sha(new_ix),
      actualWorkerModuleSha256=sha_v307(
        ROOT / "src/app/src/progressiveWorld.worker.ts"
      ),
      engineCaptures={
        prefix: read_v307(captures / (prefix + ".json"))
        for prefix in ("bun-jsc-park1", "node-v8-park1")
      },
      independentBrowserProofSha256=sha_v307(browser_proof),
      independentBrowserProof=browser,
      exactOldTriangleInterval=list(OLD_INTERVAL),
      exactActualTriangleInterval=list(ACTUAL_INTERVAL),
      completePrefixAndSuffixOrderedXyzWordsEqual=True,
      changedTriangles=changed,
      changedSourceTrianglesIntersectingField=0,
      originalRetiredTrianglesInChangedBlock=0,
      retiredTriangles=len(retired),
      exactRetireShift=profile["part"]["retireShift"],
      originalRetiredXYZWordsSha256=sha(old_local),
      actualRetiredXYZWordsSha256=sha(actual_local),
      sourceAttributes=["position"],
      canonicalMaterials=part["materials"],
      immutableInsideAndOutsideAndNavigation=True,
      originalCoreNavigationSha256=sha_v307(
        DATA / "coreTerrainContactV307Navigation.json"
      ),
      originalOutsideJsonSha256=sha(
        json.dumps(part["outside"], ensure_ascii=False, separators=(",", ":")).encode()
      ),
      profileSha256BeforeJsControls=sha_v307(out),
      policy="Finite exact browser V8 source profile over immutable JSC, actual-client and bridge sources. A bounded nonretired 600-to-598 triangle retriangulation lies outside the measured field. Exactly918 later retirement ordinals shift byminus2. Every retired full ordered Float32 XYZ word and winding is identical; source materials, full original outside complements, all original measured inner meshes and navigation remain byte-identical. No source buffer is duplicated in application metadata.",
    ),
  )
  print(
    json.dumps(
      dict(
        profile=out.as_posix(),
        bytes=out.stat().st_size,
        retiredTriangles=len(retired),
        shiftedRetires=918,
        retiredXyzSha256=sha(old_local),
      ),
      indent=2,
    )
  )


def main() -> None:
  p = argparse.ArgumentParser(description=__doc__)
  p.add_argument("--captures", type=Path, required=True)
  p.add_argument("--predecessor", type=Path, required=True)
  p.add_argument("--browser-proof", type=Path, required=True)
  p.add_argument("--out", type=Path, default=DATA / "coreWorkerV8V311.json")
  p.add_argument(
    "--evidence", type=Path, default=GEO / "core-worker-v8-v311-evidence.json.gz"
  )
  a = p.parse_args()
  compile_v311(a.captures, a.predecessor, a.browser_proof, a.out, a.evidence)


if __name__ == "__main__":
  main()
