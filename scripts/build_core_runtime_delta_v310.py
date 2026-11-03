"""Bind the immutable v307 local contact to the finished actual client sources.

This emits only instance guards and exact reindexed retire ordinals. It refuses
any local source geometry/paint change, and never rewrites the v307 geometry,
variants, controls, bridge delta, or navigation. Captures remain external.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
from build_rail_sse_v307 import DATA, GEO, ROOT, read_v307, sha_v307, write_v307
from shapely.geometry import box, shape
from terrain_fields_v307 import TerrainFieldV307, native_domain_v307

SOURCE_SHA = "62fb732f8d2b2e1fe836266f9de31b6b410a6b84804204cd0bdc33fa83af86b5"
BASE_CONTROLS = {
  "drawn-initial": 691981172,
  "drawn-worker": 2745148416,
  "minecraft": 398998653,
}


def digest(value: bytes) -> str:
  return hashlib.sha256(value).hexdigest()


def row_bytes(part: dict) -> tuple[np.ndarray, list[bytes]]:
  instances = part["instances"]
  matrices = np.frombuffer(base64.b64decode(instances["matrix"]), "<f4").reshape(-1, 16)
  colors = np.frombuffer(base64.b64decode(instances["colors"]), "<f4").reshape(-1, 3)
  if len(matrices) != instances["count"] or len(colors) != instances["count"]:
    raise ValueError("Incomplete actual instance source")
  return matrices, [
    a.tobytes() + b.tobytes() for a, b in zip(matrices, colors, strict=True)
  ]


def candidates(matrices: np.ndarray, domain: object) -> list[int]:
  w, n, e, s = domain.bounds
  result = []
  for i, m in enumerate(matrices):
    # The actual constructor source consists of scaled orthogonal BoxGeometry.
    if any(m[k] != 0 for k in (1, 2, 3, 4, 6, 7, 8, 9, 11)) or m[15] != 1:
      raise ValueError("Foreign nonorthogonal instance source")
    x, z, hx, hz = (
      float(m[12]),
      float(m[14]),
      abs(float(m[0])) / 2,
      abs(float(m[10])) / 2,
    )
    if x + hx <= w or x - hx >= e or z + hz <= n or z - hz >= s:
      continue
    if domain.intersection(box(x - hx, z - hz, x + hx, z + hz)).area > 1e-10:
      result.append(i)
  return result


def match_local_rows_v310(
  old: dict, actual: dict, domain: object, original_retire: list[int]
) -> tuple[list[int], list[bytes], list[bytes], list[bytes]]:
  old_matrices, old_rows = row_bytes(old)
  new_matrices, new_rows = row_bytes(actual)
  old_ids, new_ids = (
    candidates(old_matrices, domain),
    candidates(new_matrices, domain),
  )
  if old_ids != original_retire:
    raise ValueError("Original local clipping candidate proof is incomplete")
  old_local, new_local = (
    [old_rows[i] for i in old_ids],
    [new_rows[i] for i in new_ids],
  )
  if (
    len(set(old_local)) != len(old_local)
    or len(set(new_local)) != len(new_local)
    or set(old_local) != set(new_local)
  ):
    raise ValueError(
      "Actual local source geometry/paint changed; full inside/outside derivative required"
    )
  lookup = defaultdict(list)
  for ordinal, row in enumerate(new_rows):
    lookup[row].append(ordinal)
  if any(len(lookup[row]) != 1 for row in old_local):
    raise ValueError("An exact retired row is ambiguous in the actual source")
  retired = [lookup[row][0] for row in old_local]
  if retired != sorted(retired) or set(retired) != set(new_ids):
    raise ValueError("Actual source ordering changed locally")
  return retired, old_rows, new_rows, old_local


def build_delta(
  predecessor: Path, actual_main: Path, actual_native: Path, out: Path, proof_out: Path
) -> None:
  base_path = DATA / "coreTerrainContactV307.json"
  if sha_v307(base_path) != SOURCE_SHA:
    raise ValueError("Immutable v307 base source changed")
  base = read_v307(base_path)
  if sha_v307(DATA / "northParkTerrainV306.json") != base["profileSha256"]:
    raise ValueError("The immutable Core local profile changed")
  profile = next(
    p
    for p in read_v307(DATA / "northParkTerrainV306.json")["profiles"]
    if p["key"] == "humboldthain"
  )
  domain = shape(profile["domain"])
  field = TerrainFieldV307(
    "humboldthain", domain, tuple(profile["bounds"]), 4, lambda *_: 0, lambda *_: 0
  )
  native_domain = native_domain_v307(field)
  delta = dict(
    schemaVersion=1,
    baseSourceSha256=SOURCE_SHA,
    baseVariantControls=BASE_CONTROLS,
    variants={},
  )
  proofs = []
  for key, path in (("drawn-initial", actual_main), ("minecraft", actual_native)):
    frozen = base["variants"][key]
    old_capture_path = predecessor / f"{key}.json"
    if sha_v307(old_capture_path) != frozen["captureSha256"]:
      raise ValueError("Original external constructor capture changed")
    old_capture, actual_capture = read_v307(old_capture_path), read_v307(path)
    names = {p["name"] for p in frozen["parts"]}
    old_parts = [p for p in old_capture["parts"] if p["name"] in names]
    new_parts = [p for p in actual_capture["parts"] if p["name"] in names]
    if len(old_parts) != 1 or len(new_parts) != 1 or len(frozen["parts"]) != 1:
      raise ValueError("Exactly one original and actual Main source required")
    old, actual, part = old_parts[0], new_parts[0], frozen["parts"][0]
    same_keys = ("name", "parentName", "matrix", "attributes", "index", "materials")
    if any(old[k] != actual[k] for k in same_keys):
      raise ValueError(
        "Actual source attributes/index/material/pose differ; a guard-only delta is invalid"
      )
    retired, old_rows, new_rows, old_local = match_local_rows_v310(
      old, actual, native_domain if key == "minecraft" else domain, part["retire"]
    )
    guards = {
      k: v for k, v in actual["instances"].items() if k not in ("matrix", "colors")
    }
    delta["variants"][key] = dict(
      basePartControl=0, captureSha256=sha_v307(path), instances=guards, retire=retired
    )
    proofs.append(
      dict(
        variant=key,
        originalCaptureSha256=sha_v307(old_capture_path),
        actualCaptureSha256=sha_v307(path),
        oldInstanceCount=len(old_rows),
        actualInstanceCount=len(new_rows),
        localRows=len(old_local),
        omittedOriginalLocalRows=0,
        newUnmatchedLocalRows=0,
        actualLocalRowsExactlyEqual=True,
        oldLocalOrderedWordsSha256=digest(b"".join(old_local)),
        actualLocalInOldOrderWordsSha256=digest(b"".join(new_rows[i] for i in retired)),
        originalOutsideJsonSha256=digest(
          json.dumps(
            part["outside"], ensure_ascii=False, separators=(",", ":")
          ).encode()
        ),
        actualGuards=guards,
        unchanged=list(same_keys),
      )
    )
  write_v307(out, delta)
  write_v307(
    proof_out,
    dict(
      schemaVersion=1,
      baseSourceSha256=SOURCE_SHA,
      originalVariantsControls=BASE_CONTROLS,
      parts=proofs,
      deltaSha256BeforeJsControls=sha_v307(out),
      sceneTunnelSha256=digest(
        json.dumps(
          read_v307(ROOT / "src/app/public/mesh/regierungsviertel/scene.json")[
            "tiergartentunnel"
          ],
          separators=(",", ":"),
        ).encode()
      ),
      reusedStreams=[
        "all 20 original inner meshes and their attributes/indices/materials",
        "both complete original Main outside complements",
        "all original worker/native roof and ground navigation face ordinals",
      ],
      policy="Actual finished client source guards and exact ordinal remapping only. Every local matrix/color Float32 word is equal; all source geometry, outside complements, measured inner contact and navigation stay byte-identical. Original v307 source and controls are immutable. No geometric guard relaxation or inferred source cells.",
    ),
  )
  print(
    json.dumps(
      dict(
        deltaBytes=out.stat().st_size,
        deltaGzipBytes=len(gzip.compress(out.read_bytes(), mtime=0)),
        parts=proofs,
      ),
      indent=2,
    )
  )


def main() -> None:
  p = argparse.ArgumentParser(description=__doc__)
  p.add_argument("--predecessor", type=Path, required=True)
  p.add_argument("--actual-main", type=Path, required=True)
  p.add_argument("--actual-native", type=Path, required=True)
  p.add_argument("--out", type=Path, default=DATA / "coreTerrainActualV310.json")
  p.add_argument(
    "--proof", type=Path, default=GEO / "core-terrain-actual-v310-evidence.json.gz"
  )
  a = p.parse_args()
  build_delta(a.predecessor, a.actual_main, a.actual_native, a.out, a.proof)


if __name__ == "__main__":
  main()
