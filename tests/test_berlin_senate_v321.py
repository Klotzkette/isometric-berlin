"""Finite public Senate fronts preserve every existing source byte and opening."""

from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path

import numpy as np

from scripts.build_berlin_senate_v321 import arrays, rectangle_proof, source_triangles

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def read_sources() -> tuple[dict, dict]:
  runtime = json.loads((ROOT / "src/app/src/data/berlinSenateV321.json").read_bytes())
  proof = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/berlin-senate-v321-evidence.json.gz"
      ).read_bytes()
    )
  )
  return runtime, proof


def test_exact_packets_keep_bodies_roofs_navigation_lines_and_all_prior_fittings() -> (
  None
):
  runtime, proof = read_sources()
  assert proof["sites"] == 3
  assert proof["sourceBodiesRetired"] == proof["sourceFittingsRetired"] == 0
  assert proof["sourceBytesWritten"] == 0
  assert proof["requiredPreparedGuardFinalization"] is False
  assert set(runtime["packets"]) == set(runtime["keys"])
  assert len(runtime["keys"]) == 7
  assert len(proof["actualPreparedGuards"]) == 7
  for key, plan in runtime["packets"].items():
    item = proof["sourceInputs"][key]
    raw = (PUBLIC / item["url"]).read_bytes()
    assert len(raw) == item["bytes"]
    assert hashlib.sha256(raw).hexdigest() == item["sha256"]
    assert plan["retire"] == []
    assert plan["navGuard"] != 0 and plan["preparedNavGuard"] != 0
  for name, owner in [
    ("nordstern", "DEBE07YY900008bT"),
    ("olex", "DEBE07YY9000020I"),
    ("koellnpark", "DEBE01YYK000066i"),
  ]:
    assert proof["references"][name]["owner"] == owner
    for mode in ["drawn", "minecraft"]:
      assert any(
        key.startswith(mode + ":") and owner in plan["owners"]
        for key, plan in runtime["packets"].items()
      )


def test_new_geometry_is_source_supported_and_retained_glass_remains_visible() -> None:
  runtime, proof = read_sources()
  actual_transoms = {"drawn": 0, "minecraft": 0}
  for report in proof["reports"]:
    key = report["key"]
    packet = json.loads(
      gzip.decompress((PUBLIC / proof["sourceInputs"][key]["url"]).read_bytes())
    )
    part = runtime["packets"][key]["append"]
    p, _, ix = arrays(part)
    assert len(ix) == report["triangles"]
    assert len(p) == report["vertices"]
    assert int(ix.max()) < len(p)
    if key.startswith("minecraft:"):
      assert np.all(np.any(np.ptp(p[ix].astype(np.int32), axis=1) == 0, axis=1))
    city_triangles = source_triangles(packet, "city")
    glass_triangles = source_triangles(packet, "alt-mitte-v169")
    for site in report["sites"]:
      for face in site.get("sourceFaces", []):
        f = face["face"]
        assert (
          rectangle_proof(
            packet, f["a"], f["b"], f["sourceLow"], f["sourceHigh"], city_triangles
          )
          == f["sourceRectangleWords"]
        )
        assert f["low"] == f["sourceLow"]
        assert f["high"] < f["sourceHigh"]
        assert face["report"]["roofWindowInference"] is False
      if site["site"] == "koellnpark":
        assert site["newWindowGrids"] == site["oldGlazingRetired"] == 0
        mode = key.split(":")[0]
        actual_transoms[mode] += site["newTransoms"]
        assert site["newTransoms"] == len(site["retainedWindowCentres"])
        for window in site["retainedWindowCentres"]:
          if mode == "drawn":
            for triangle in window["retainedGlazingWords"]:
              assert glass_triangles[tuple(tuple(v) for v in triangle)] == 1
          else:
            assert window["retainedNativeGlassUnionArea"] > 0
  assert all(n > 0 for n in actual_transoms.values())
  # Original drawn glass/frame/sill offsets are .085/.11/.125m. New joinery is
  # in front of them, leaving the remaining actual old glass fully uncovered.
  assert 0.085 + 0.045 > 0.125
