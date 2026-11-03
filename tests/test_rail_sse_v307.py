"""Source inventory, genuine model partitions and actual core admission recipes."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def test_complete_ring_inventory_is_the_immutable_original() -> None:
  original_path = DATA / "railStationsV190.json"
  old = read(original_path)
  source = read(GEO / "rail-sse-v307-source.json.gz")
  ring = sorted(
    (q for q in old["stations"] if "ringOrder" in q),
    key=lambda q: q["ringOrder"],
  )
  assert (
    source["ringSourceSha256"] == hashlib.sha256(original_path.read_bytes()).hexdigest()
  )
  assert source["ringInventory"] == ring
  assert len(ring) == 27
  assert [q["ringOrder"] for q in ring] == list(range(27))
  routes = [q for q in old["routes"] if q["family"] == "ring"]
  assert routes
  points = np.asarray(routes[0]["points"])
  assert len(points) >= 1000
  assert np.linalg.norm(points[0] - points[-1]) < 1
  length = np.linalg.norm(np.diff(points, axis=0), axis=1).sum()
  assert 36000 < length < 38000
  assert next(q for q in ring if q["name"] == "Gesundbrunnen")["platformIds"] == [
    "relation/3721105",
    "relation/3721106",
    "relation/3721107",
    "relation/3721108",
    "relation/3721109",
  ]


def test_measured_rail_domain_does_not_raise_the_park_twice() -> None:
  source = read(GEO / "rail-sse-v307-source.json.gz")
  terrain = read(DATA / "railSseTerrainV307.json")
  park = shape(
    next(q["geometry"] for q in source["sites"] if q["id"] == "relation/14524667")
  )
  gesund = next(q for q in terrain["profiles"] if q["key"] == "gesundbrunnen")
  domain = shape(gesund["domain"])
  assert domain.intersection(park).area < 1e-7
  assert domain.area > 50000
  for profile in terrain["profiles"]:
    west, north, east, south = profile["bounds"]
    assert profile["step"] == 4
    assert len(profile["offsets"]) == (south - north) // 4 + 1
    assert all(len(row) == (east - west) // 4 + 1 for row in profile["offsets"])


def test_all_official_leaf_sheets_and_spatial_triangle_partitions_survive() -> None:
  source = read(GEO / "rail-sse-v307-source.json.gz")
  parents = source["parents"]
  assert len(parents) == len({q["id"] for q in parents}) == 38
  assert len([q for q in parents if q["site"] == "gesundbrunnenAccess"]) == 26
  assert all(q["parts"] for q in parents)
  for parent in parents:
    for part in parent["parts"]:
      assert part["surfaces"]
      assert all(
        face["rings"] and len(face["rings"][0]) >= 3 for face in part["surfaces"]
      )
      assert part["top_y_m"] >= part["ground_y_m"]
  model = read(DATA / "railSseArchitectureV307.json")
  evidence = read(GEO / "rail-sse-v307-model-evidence.json.gz")
  for native in (False, True):
    parts = [q for q in model["models"] if q["native"] == native]
    audit = next(q for q in evidence["counts"] if q["native"] == native)
    assert len(parts) == 8
    assert sum(q["triangles"] for q in parts) == audit["triangles"]
    ids = np.concatenate(
      [
        np.frombuffer(base64.b64decode(q["sourceTriangleOrdinals"]), "<u4")
        for q in parts
      ]
    )
    np.testing.assert_array_equal(
      np.sort(ids), np.arange(audit["triangles"], dtype="<u4")
    )
    for part in parts:
      colours = np.frombuffer(base64.b64decode(part["colors"]), "<f4")
      assert part["colorType"] == "f32linear"
      assert len(colours) == part["vertices"] * 3
      assert np.isfinite(colours).all() and np.all((colours >= 0) & (colours <= 1))


def test_actual_core_uses_initial_raster_and_real_post_transfer_families() -> None:
  core = read(DATA / "coreTerrainContactV307.json")
  variants = core["variants"]
  initial = variants["drawn-initial"]["parts"]
  native = variants["minecraft"]["parts"]
  worker = variants["drawn-worker"]["parts"]
  assert len(initial) == len(native) == 1
  assert initial[0]["instances"]["count"] == 203849
  assert native[0]["instances"]["count"] == 185262
  assert len(worker) == 18
  assert all(not q["instances"] and q["batchId"] for q in worker)
  assert "batchId" not in initial[0] and "batchId" not in native[0]
  assert any(q["batchId"] == "restored-asphalt-2--7" for q in worker)
  assert len(core["meshes"]) == len({q["key"] for q in core["meshes"]}) == 20
  for part in worker:
    outside = part["outside"]
    if outside is None:
      continue
    assert outside["materials"] == part["materials"]
    if not part["materials"]["day"]["vertexColors"]:
      # Original uniform material colours must not be applied a second time.
      colours = np.frombuffer(base64.b64decode(outside["colors"]), "<f4")
      assert np.all(colours == 1)
  navigation = read(DATA / "coreTerrainContactV307Navigation.json")
  assert navigation["encoding"] == "exact-triangle-runs"
  assert (DATA / "coreTerrainContactV307Navigation.json").stat().st_size < 350000
  model_keys = {q["key"] for q in core["meshes"]}
  assert all(q["key"] in model_keys for r in navigation["regions"] for q in r["meshes"])


def test_city_architecture_and_ground_owner_transfers_are_disjoint() -> None:
  architecture = read(DATA / "railSseArchitectureV307Packets.json")["packets"]
  terrain = read(DATA / "railTerrainContactV307Packets.json")["packets"]
  assert len(architecture) == 10 and len(terrain) == 22
  for key, plan in architecture.items():
    ground = terrain.get(key, {})
    ground_ids = {
      (row["mesh"], triangle)
      for row in ground.get("retire", [])
      for triangle in row["triangles"]
    }
    own = {
      (row["mesh"], triangle) for row in plan["retire"] for triangle in row["triangles"]
    }
    assert own and own.isdisjoint(ground_ids)
  for plan in terrain.values():
    if plan.get("append"):
      assert plan["append"]["colorType"] == "u16linear"
    assert not plan["retireLines"] and not plan["retireNav"]
