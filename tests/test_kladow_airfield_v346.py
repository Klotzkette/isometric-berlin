"""Source-preserving coverage, pitched roofs, Native courts and apron repairs."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

from scripts.build_kladow_airfield_v346 import (
  GEO,
  SOURCE,
  clip_scope,
  drawn_model,
  json_bytes,
  native_columns,
  read,
  read_source_parts,
)

ROOT = Path(__file__).resolve().parents[1]


def test_audit_source_is_losslessly_split_and_hash_checked():
  index = json.loads(SOURCE.read_bytes())
  assert SOURCE.stat().st_size < 10_000
  assert index["format"] == "split-kladow-source-v346"
  assert index["decodedBytes"] == 32_334_078
  for part in index["parts"]:
    assert part["bytes"] < 5 * 1024**2
    assert part["decodedBytes"] <= 2 * 1024**2
  source = read(SOURCE)
  raw = json_bytes(source)
  assert len(raw) == index["decodedBytes"]
  assert hashlib.sha256(raw).hexdigest() == index["decodedSha256"]
  manifest = read(GEO / "kladow-airfield-v346-manifest.json")
  assert manifest["source"]["sourceFile"] == SOURCE.name
  assert (
    manifest["source"]["sourceSha256"]
    == hashlib.sha256(SOURCE.read_bytes()).hexdigest()
  )
  assert manifest["source"]["decodedSourceSha256"] == index["decodedSha256"]
  wrong = copy.deepcopy(index)
  wrong["parts"][1]["sha256"] = "0" * 64
  with pytest.raises(ValueError, match="Changed Kladow source part"):
    read_source_parts(SOURCE, wrong)
  wrong = copy.deepcopy(index)
  wrong["parts"][1]["start"] += 1
  with pytest.raises(ValueError, match="Missing, repeated or reordered"):
    read_source_parts(SOURCE, wrong)


def test_roof_plane_and_scope_cut_preserve_height():
  roof = [[0, 3, 0], [10, 8, 0], [10, 8, 10]]
  clipped = clip_scope(roof, box(4, 0, 9, 10))
  assert clipped
  for triangle in clipped:
    for x, y, _z in triangle:
      assert 4 - 1e-9 <= x <= 9 + 1e-9
      assert abs(y - (3 + x / 2)) < 1e-9
  actual = unary_union([Polygon([(x, z) for x, _, z in t]) for t in clipped])
  expected = Polygon([(x, z) for x, _, z in roof]).intersection(box(4, 0, 9, 10))
  assert actual.symmetric_difference(expected).area < 1e-8


def test_native_measured_roof_preserves_courtyard():
  ring = [[0, 0], [12, 0], [12, 12], [0, 12]]
  hole = [[4, 4], [8, 4], [8, 8], [4, 8]]
  parent = dict(
    id="test-court",
    parts=[
      dict(
        id="court",
        ring=ring,
        holes=[hole],
        ground_y_m=0,
        top_y_m=8,
        surfaces=[
          dict(
            kind="RoofSurface",
            rings=[[[x, 6 + x / 6, z] for x, z in r] for r in [ring, hole]],
          )
        ],
      )
    ],
  )
  detail, caps = native_columns(parent, box(-10, -10, 20, 20))
  assert detail.triangles and caps
  assert {c[4] for c in caps} == {8}
  footprint = unary_union([box(*c[:4]) for c in caps])
  assert footprint.intersection(box(4, 4, 8, 8)).area == 0
  for triangle, _color, _role in detail.triangles:
    q = np.array(triangle)
    normal = np.cross(q[1] - q[0], q[2] - q[0])
    assert np.count_nonzero(abs(normal) > 1e-8) == 1


def test_measured_gatow_roofs_and_current_runway_remnants():
  source = read(SOURCE)
  assert source["relation"] == 409216
  assert len(source["parents"]) == 12399
  assert source["failures"] == []
  scope = shape(source["scope"])
  assert scope.is_valid
  assert 9_700_000 < scope.area < 9_800_000
  evidence = read(GEO / "kladow-airfield-v346-evidence.json.gz")
  runways = [r for r in evidence["airfield"] if r["kind"] == "runway"]
  assert {r["id"] for r in runways} == {"OSM-way-907507946", "OSM-way-907515718"}
  assert all(r["width"] == 46 for r in runways)
  assert all(30_000 < shape(r["geometry"]).area < 45_000 for r in runways)
  assert len([r for r in evidence["airfield"] if r["kind"] == "apron"]) == 8
  pitched = next(
    p
    for p in source["parents"]
    if any(
      s["kind"] == "RoofSurface"
      and max(q[1] for q in s["rings"][0]) - min(q[1] for q in s["rings"][0]) > 2
      for part in p["parts"]
      for s in part["surfaces"]
    )
  )
  model, roofs = drawn_model(pitched, scope)
  assert model.triangles and roofs
  assert any(max(p[1] for p in t) - min(p[1] for p in t) > 2 for t in roofs)


def test_all_staged_packets_bounded_and_drawn_native_complete():
  for name, raw_dir in [
    ("kladow-airfield-v346-manifest.json", "kladow-v346"),
    ("tegel-airfield-v346-manifest.json", "airfields-v346"),
  ]:
    manifest = read(GEO / name)
    assert manifest["chunks"]
    for d in manifest["chunks"]:
      for mode in ("drawn", "minecraft"):
        a = d[mode]
        p = GEO / "raw" / raw_dir / "packets" / a["url"]
        packed = p.read_bytes()
        assert len(packed) == a["bytes"] <= 650_000
        assert hashlib.sha256(packed).hexdigest() == a["sha256"]
        assert len(gzip.decompress(packed)) == a["decodedBytes"] <= 2_600_000
        packet = read(p)
        assert packet["nav"]["groundY"] == 3
        assert packet["nav"]["ground"]
        for m in packet["meshes"]:
          positions = np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(
            -1, 3
          )
          indices = np.frombuffer(base64.b64decode(m["indices"]), "<u4")
          assert len(base64.b64decode(m["colors"])) == len(positions) * 3
          assert len(indices) % 3 == 0 and indices.max() < len(positions)
        for b in packet["nav"]["buildings"]:
          assert b["height"] >= b["minHeight"]
          if "nativeRoofCaps" in b:
            assert b["nativeRoofCaps"]
            assert all(c[2] > c[0] and c[3] > c[1] for c in b["nativeRoofCaps"])


def test_apron_complements_preserve_area_and_navigation():
  evidence = read(GEO / "airfield-surfaces-v346-evidence.json")
  recipe = read(ROOT / "src/app/src/data/airfieldSurfacesV346.json")
  assert len(evidence["proof"]) == len(recipe["keys"]) == 16
  assert evidence["tegelPacketBytes"] < 400_000
  for proof in evidence["proof"]:
    assert proof["retiredTriangles"] > 0
    assert proof["areaDifferenceM2"] < 1e-5
    assert proof["apronAreaM2"] > 0
    p = recipe["packets"][proof["key"]]
    assert p["retireNav"] == p["appendNav"] == p["retireLines"] == []
    assert p["owners"] == ["OSM-way-181407909:current-concrete-apron"]
