"""No invented surfaces, no crossings, exact old-floor containment in both modes."""

import base64
import gzip
import hashlib
import importlib
import json
import math
import sys
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import LineString, box, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))
M = importlib.import_module("scripts.build_facility_paths_v350")
EVIDENCE = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def test_final_binary_assets_match_retained_storage_proof_and_index():
  storage = json.loads((EVIDENCE / "education-v350-paths-storage.json").read_bytes())
  modules = storage["modules"]
  assert len(modules) == 37
  assert {item["file"] for item in modules} == {
    item.name for item in DATA.glob("facilityPathsV350Packets*.json.gz")
  }
  expected_index = {
    "sources": [
      {key: item[key] for key in ("file", "keys", "decodedBytes")} for item in modules
    ]
  }
  index_bytes = (DATA / "facilityPathsV350Index.json").read_bytes()
  assert (
    index_bytes
    == json.dumps(expected_index, separators=(",", ":"), ensure_ascii=False).encode()
  )
  assert len(index_bytes) == storage["indexBytes"] == 27575
  if "indexSha256" in storage:
    assert hashlib.sha256(index_bytes).hexdigest() == storage["indexSha256"]

  all_keys = []
  binary_bytes = decoded_bytes = 0
  for item in modules:
    binary = (DATA / item["file"]).read_bytes()
    assert len(binary) == item["bytes"]
    assert hashlib.sha256(binary).hexdigest() == item["sha256"], item["file"]
    decoded = gzip.decompress(binary)
    assert len(decoded) == item["decodedBytes"] < 2 * 1024 * 1024
    packets = json.loads(decoded)["packets"]
    assert list(packets) == item["keys"]
    assert 0 < len(packets) <= 32
    assert all(plan["retire"] == [] and plan["sheets"] for plan in packets.values())
    all_keys.extend(item["keys"])
    binary_bytes += len(binary)
    decoded_bytes += len(decoded)
  assert len(all_keys) == len(set(all_keys)) == storage["coverage"]["recipes"] == 1168
  assert len({key.split(":", 1)[1] for key in all_keys}) == 587
  assert binary_bytes == storage["binaryGzipBytes"] == 1174817
  assert decoded_bytes == storage["decodedCompactBytes"] == 5669343
  assert storage["losslessRebuildIdentical"] is True


def test_final_asset_keys_are_all_covered_by_successful_production_and_surface_proofs():
  index = json.loads((DATA / "facilityPathsV350Index.json").read_bytes())
  keys = {key for item in index["sources"] for key in item["keys"]}
  production = json.loads(
    gzip.decompress((EVIDENCE / "education-v350-paths-production.json.gz").read_bytes())
  )
  assert production["checked"] == len(keys) == 1168
  assert production["failures"] == []
  reports = production["reports"]
  assert len(reports) == len(keys)
  assert {report["key"] for report in reports} == keys
  assert all(report["valid"] is True and report["vertices"] > 0 for report in reports)

  surface = json.loads(
    (EVIDENCE / "education-v350-paths-surface-proof.json").read_bytes()
  )
  assert surface["plans"] == len(keys)
  assert surface["materialHeightRegions"] == 2531
  difference = surface["maxSymmetricDifferenceSquareCentimetres"]
  assert math.isfinite(difference) and 0 <= difference < 1e-5
  assert surface.get("failures", []) == []

  missing_native = {
    key.split(":", 1)[1]
    for key in keys
    if key.startswith("drawn:") and key.replace("drawn:", "minecraft:", 1) not in keys
  }
  coverage = json.loads(
    (EVIDENCE / "education-v350-paths-mode-coverage.json").read_bytes()
  )
  assert len(coverage) == len(missing_native) == 6
  assert {item["host"] for item in coverage} == missing_native
  assert all(
    item["missingMode"] == "minecraft" and item["reason"] == "noLiteralSupportedPatch"
    for item in coverage
  )


def substrate(kind="ground"):
  mesh = M.PackedMesh(0, 0)
  mesh.surface(box(0, 0, 20, 20), 0.12 if kind == "path" else 0, M.COLORS[kind])
  return {
    "origin": [0, -10, 0],
    "nav": {
      "groundY": 0,
      "ground": [{"ring": [[0, 0], [20, 0], [20, 20], [0, 20]], "holes": []}],
      "roads": [],
      "water": [],
      "bridges": [],
      "buildings": [],
    },
    "meshes": [mesh.payload("city")],
  }


def path(tags):
  return {
    "id": "way/1",
    "facilities": ["school:01G01"],
    "tags": {"highway": "footway", **tags},
    "geometry": mapping(LineString([(2, 10), (18, 10)])),
  }


def receipt():
  return {
    "priorAdditions": [],
    "navGuard": 1,
    "lineGuard": None,
    "preparedNavGuard": 1,
    "preparedLineGuard": None,
  }


def geometry(plan):
  mesh = plan["append"]
  points = (
    np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) * 0.01
    + plan["origin"]
  )
  triangles = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return unary_union([M.Polygon(points[t][:, [0, 2]]) for t in triangles]), points


@pytest.mark.parametrize(
  "bad",
  [
    {"bridge": "yes"},
    {"tunnel": "yes"},
    {"layer": "1"},
    {"footway": "crossing"},
    {"crossing": "marked"},
    {"indoor": "yes"},
    {"highway": "steps"},
  ],
)
def test_grade_crossings_indoor_and_steps_excluded(bad):
  assert not M.eligible({"highway": "footway", "surface": "asphalt", **bad})


def test_missing_route_requires_literal_mapped_width_or_area():
  raw = substrate()
  result, reason = M.compile_tile(
    raw, "drawn", box(0, 0, 20, 20), [path({"surface": "asphalt"})], receipt()
  )
  assert result is None
  assert reason == "noLiteralSupportedPatch"
  result, _ = M.compile_tile(
    raw,
    "drawn",
    box(0, 0, 20, 20),
    [path({"width": "2", "surface": "asphalt"})],
    receipt(),
  )
  assert result is not None
  assert result[1]["patches"][0]["widthSource"] == "width"


def test_material_requires_explicit_surface_on_existing_path():
  raw = substrate("path")
  result, _ = M.compile_tile(
    raw, "drawn", box(0, 0, 20, 20), [path({"width": "2"})], receipt()
  )
  assert result is None
  result, _ = M.compile_tile(
    raw, "drawn", box(0, 0, 20, 20), [path({"surface": "asphalt"})], receipt()
  )
  assert result is not None
  assert result[1]["patches"][0]["purpose"] == "material"


@pytest.mark.parametrize("mode", ["drawn", "minecraft"])
def test_every_new_face_excludes_existing_obstacles_and_prior_overlays(mode):
  raw = substrate()
  raw["nav"]["roads"] = [{"ring": [[9, 0], [11, 0], [11, 20], [9, 20]], "holes": []}]
  earlier = M.PackedMesh(0, 0)
  earlier.surface(box(3, 9, 6, 11), 0.02, M.COLORS["path"])
  r = receipt()
  r["priorAdditions"] = [earlier.payload("park-paths-v329")]
  result, _ = M.compile_tile(
    raw, mode, box(0, 0, 20, 20), [path({"width": "2", "surface": "asphalt"})], r
  )
  assert result is not None
  plan, _ = result
  area, points = geometry(plan)
  assert area.intersection(box(9, 0, 11, 20)).area == 0
  assert area.intersection(box(3, 9, 6, 11)).area == 0
  assert box(0, 0, 20, 20).covers(area)
  assert max(abs(points[:, 1] - 0.02)) < 0.000001
  assert plan["retire"] == []
  if mode == "minecraft":
    assert np.allclose(points[:, [0, 2]] * 2, np.round(points[:, [0, 2]] * 2))
