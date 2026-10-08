"""Full metric source and strict exact-owner/water-only preservation checks."""

import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from scripts.build_park_relief_v182 import sample  # noqa: E402
from scripts.build_viktoriapark_v194 import DEST, make_payload  # noqa: E402
from scripts.integrate_viktoriapark_v194 import (  # noqa: E402
  BASE,
  BASINS,
  DEFAULT_OUTPUT,
  PROFILE,
  RECEIPT,
  SOURCE,
  coarse_owner_signatures,
  decoded,
  mesh_signature,
  original,
  patch_water,
  signature_digest,
  water_level,
  water_signature,
)


def test_complete_source_base_ponds_and_tagged_stair_courses():
  source = json.loads(DEST.read_bytes())
  assert source == json.loads(json.dumps(make_payload()))
  assert len(source["surfaces"]) == 18
  assert source["baseGroundY"] == 36.359 and source["baseTopY"] == 46.073
  assert source["ironHeightM"] == 18
  assert source["existingGroundY"] == pytest.approx(36.467625, abs=0.000001)
  stairs = [
    f
    for f in source["features"]
    if f["geometry"]["type"] == "LineString" and f["tags"].get("highway") == "steps"
  ]
  assert len(stairs) == 10 and sum(int(f["tags"]["step_count"]) for f in stairs) == 135
  assert len(BASINS) == 3
  assert max(map(max, PROFILE["offsets"])) + 3 == 36.58


def test_water_descends_without_single_floating_pond_datum():
  assert water_level(625, 3415) > water_level(632, 3350) > water_level(642, 3280)
  assert water_level(642, 3280) < 8
  assert water_level(625, 3415) > 29
  for poly, y, _ in BASINS:
    point = poly.representative_point()
    assert water_level(point.x, point.y) == y
    assert abs(y - (3 + sample(PROFILE, point.x, point.y))) < 0.1


def test_exact_packet_substitution_preserves_all_other_triangles_and_water_xz():
  receipt = json.loads(RECEIPT.read_bytes())
  manifest = json.loads((DEFAULT_OUTPUT / "manifest.json").read_bytes())
  descriptor = next(d for d in manifest["chunks"] if d["id"] == "1_6")
  assert receipt["baseRelease"] == BASE == "v1.0.93"
  assert receipt["sourceSha256"] == hashlib.sha256(SOURCE.read_bytes()).hexdigest()
  for mode in ("drawn", "minecraft"):
    r = receipt["modes"][mode]
    path = DEFAULT_OUTPUT / descriptor[mode]["url"]
    blob = path.read_bytes()
    assert (
      hashlib.sha256(blob).hexdigest() == r["newSha256"] == descriptor[mode]["sha256"]
    )
    assert hashlib.sha256(original(path)).hexdigest() == r["oldSha256"]
    before = json.loads(gzip.decompress(original(path)))
    after = json.loads(gzip.decompress(blob))
    remove, _ = coarse_owner_signatures(descriptor, mode == "minecraft")
    kept = mesh_signature(before) - remove - water_signature(before)
    assert mesh_signature(after) - water_signature(after) == kept
    assert signature_digest(kept) == r["preservedTrianglesSha256"]
    assert water_signature(before, True) == water_signature(after, True)
    assert before["nav"] == after["nav"]
    assert (
      sum(remove.values())
      == r["removedOwnerTriangles"]
      == (22 if mode == "drawn" else 181)
    )
    # Every water Y is deterministic, and every untouched source colour stays.
    replay = json.loads(gzip.decompress(blob))
    patch_water(replay, mode == "minecraft")
    assert mesh_signature(replay) == mesh_signature(after)
    for mesh in after["meshes"]:
      pos, col, ix = decoded(mesh)
      assert np.isfinite(pos).all() and ix.max() < len(pos)
