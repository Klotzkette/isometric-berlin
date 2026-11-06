"""Complete measured Senate families, bounded roofs and exact source receipts."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, shape

ROOT = Path(__file__).resolve().parents[1]


def data() -> tuple[dict, dict]:
  runtime = json.loads(
    (ROOT / "src/app/src/data/berlinSenateBuildingsV321.json").read_bytes()
  )
  proof = json.loads(
    gzip.decompress(
      (
        ROOT
        / "geo_data/regierungsviertel/berlin-senate-buildings-v321-evidence.json.gz"
      ).read_bytes()
    )
  )
  return runtime, proof


def triangles(model: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
  p = np.frombuffer(base64.b64decode(model["positions"]), dtype="<f4").reshape((-1, 3))
  ix = np.frombuffer(base64.b64decode(model["indices"]), dtype="<u4").reshape((-1, 3))
  return p, ix, p[ix]


def test_complete_oranien_source_and_actual_owner_datums_are_retained() -> None:
  runtime, proof = data()
  assert len(proof["sourceFamily"]["parts"]) == 8
  assert proof["originalBody"]["id"] == "n-400426"
  assert abs(proof["oranienDatumOffset"] - 2.248) < 1e-9
  assert abs(proof["educationDatum"]["offset"] + 2.775) < 1e-9
  assert abs(proof["urbanDatum"]["offset"] - 0.213) < 1e-9
  assert proof["educationDatum"]["actualTop"] == 6
  assert proof["urbanDatum"]["actualTop"] == 29.25
  assert proof["urbanDatum"]["actualFloor"] == 3.0
  assert proof["urbanDatum"]["sourceGround"] == 2.787
  assert len(runtime["models"]) == 6
  assert all(m["positionType"] == "f32" for m in runtime["models"])
  for m in runtime["models"]:
    p, ix, t = triangles(m)
    assert len(p) == m["vertices"] and len(t) == m["triangles"]
    assert np.isfinite(p).all() and ix.max() < len(p)
    if m["native"]:
      assert np.all(np.any(np.ptp(t, axis=1) < 1e-7, axis=1))
  assert proof["windowEstimateCount"] > 0 and proof["nativeWindowEstimateCount"] > 0


def test_every_low_education_court_stays_clear_in_both_independent_families() -> None:
  runtime, proof = data()
  roof = proof["roofProfile"]["education"]
  assert len(roof["excludedLowCourtLeaves"]) == 2
  excluded = [Polygon(p["ring"], p["holes"]) for p in roof["excludedLowCourtLeaves"]]
  for z in roof["zones"]:
    poly = shape(z["geometry"])
    for p in excluded:
      assert poly.intersection(p).area < 1e-7
  for m in runtime["models"]:
    if not m["key"].startswith("education-"):
      continue
    _, _, tri = triangles(m)
    for t in tri:
      footprint = Polygon(t[:, [0, 2]])
      if footprint.area < 1e-8:
        continue
      for p in excluded:
        assert footprint.intersection(p.buffer(-0.003)).area < 1e-6
  for n in runtime["navigation"]["native"]:
    if n.get("site") != "education":
      continue
    poly = Polygon(n["ring"], n["holes"])
    for p in excluded:
      assert poly.intersection(p).area < 1e-7


def test_native_retirement_requires_every_actual_signature_and_exclusive_contribution() -> (
  None
):
  p = json.loads((ROOT / "src/app/src/data/berlinSenatePreviousV321.json").read_bytes())
  proof = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/berlin-senate-previous-v321-evidence.json.gz"
      ).read_bytes()
    )
  )
  for key in ["nativeFull", "nativeMobile"]:
    plan = p[key]
    assert plan["native"] is True
    assert len(plan["owners"]) == 1 and plan["owners"][0]["id"] == "n-400426"
    assert len(plan["nativeSource"]["columns"]) == 281
    for row in plan["nativeSource"]["columns"]:
      assert (
        len(row["source"]) == 5
        and row["contributors"] == ["n-400426"]
        and row["retireBody"] is True
      )
    assert plan["owners"][0]["retireBody"] is True
  assert len(proof["mixedColumnsPreserved"]) == 8
  assert proof["exclusiveColumns"] == 281
  for path, sha in [
    ("lod2-prisms.json", proof["sourcePrismsSha256"]),
    ("minecraft-voxels.json", proof["voxelSha256"]),
  ]:
    assert (
      hashlib.sha256(
        (ROOT / "src/app/public/mesh/regierungsviertel" / path).read_bytes()
      ).hexdigest()
      == sha
    )
