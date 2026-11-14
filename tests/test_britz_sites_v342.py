"""Complete Britz source coverage, real packet geometry and navigation checks."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import os
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

from scripts.build_britz_sites_v342 import EVIDENCE, KIRCHE, PUBLIC, SCHLOSS
from scripts.capture_britz_sites_v342 import OUT, ROOT, read

STAGE = Path(os.environ.get("BRITZ_V342_STAGE", str(PUBLIC)))


def packets() -> list[tuple[str, dict]]:
  """Inspect the actual gzip files used by the release, never mocked receipts."""
  result = []
  for path in sorted(STAGE.glob("britz342-*.json.gz")):
    if "manifest" not in path.name:
      result.append((path.name, json.loads(gzip.decompress(path.read_bytes()))))
  assert len(result) == 8
  return result


def mesh_arrays(packet: dict, mesh: dict) -> tuple[np.ndarray, np.ndarray]:
  """Decode real centimetre packets in their declared world frame."""
  points = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(
    -1, 3
  )
  points = points.astype(float) / 100 + np.asarray(packet["origin"])
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(-1, 3)
  return points, indices


def test_complete_families_and_distinct_named_architecture() -> None:
  source, evidence = read(OUT), read(EVIDENCE)
  families = {f["id"]: f for f in source["lod2"]["families"]}
  assert len(families) == 63
  assert SCHLOSS in evidence["owners"] and KIRCHE in evidence["owners"]
  assert "DEBE08YYF0001cxC" in evidence["retainedExistingFamilies"]
  assert "DEBE08YYF0001cxC" not in evidence["owners"]  # Existing Museum Neukölln.
  for key, family in families.items():
    if key not in evidence["retainedExistingFamilies"]:
      assert evidence["owners"][key]["parts"] == [p["id"] for p in family["parts"]]
  for mode in ("drawn", "minecraft"):
    assert evidence["modes"][mode]["leaves"] == 78
    assert evidence["modes"][mode]["windows"] > 1000
  assert evidence["modes"]["drawn"]["balconies"] == 50
  assert all(
    r["tags"].get("natural") == "tree"
    for r in source["osm"]["records"]
    if r["layer"] == "points"
  )


def test_original_packets_unchanged() -> None:
  for pin in read(EVIDENCE)["priorPackets"]:
    assert (
      hashlib.sha256((ROOT / pin["path"]).read_bytes()).hexdigest() == pin["sha256"]
    )


def test_actual_packet_bounds_buffers_and_fixed_budgets() -> None:
  for filename, packet in packets():
    data = (STAGE / filename).read_bytes()
    assert len(data) <= 650_000 and len(gzip.decompress(data)) <= 2_600_000
    for mesh in packet["meshes"]:
      points, indices = mesh_arrays(packet, mesh)
      assert np.isfinite(points).all()
      assert indices.max() < len(points)
      assert len(base64.b64decode(mesh["colors"])) == len(points) * 3
      x, _, z = packet["origin"]
      assert np.all(points[:, 0] >= x) and np.all(points[:, 0] <= x + 512)
      assert np.all(points[:, 2] >= z) and np.all(points[:, 2] <= z + 512)
      normals = np.cross(
        points[indices[:, 1]] - points[indices[:, 0]],
        points[indices[:, 2]] - points[indices[:, 0]],
      )
      assert np.all(np.linalg.norm(normals, axis=1) > 0)


def test_terrain_navigation_is_real_contained_and_cardinal() -> None:
  scope = shape(read(OUT)["scope"])
  collected = {"drawn": [], "minecraft": []}
  for filename, packet in packets():
    native = "minecraft" in filename
    grid = np.frombuffer(base64.b64decode(packet["gardenTerrainV330"]), dtype="<i2")
    assert len(grid) == (16384 if native else 16641)
    assert np.all(grid == 300)
    x, _, z = packet["origin"]
    for row in [*packet["nav"]["ground"], *packet["nav"]["water"]]:
      ring = [(a + x, b + z) for a, b in row["ring"]]
      holes = [[(a + x, b + z) for a, b in h] for h in row["holes"]]
      area = Polygon(ring, holes)
      assert area.difference(scope.buffer(0.0072)).area < 0.00001
      collected["minecraft" if native else "drawn"].append(area)
      if native:
        for loop in (ring, *holes):
          for a, b in zip(loop, loop[1:] + loop[:1]):
            assert abs(a[0] - b[0]) < 1e-6 or abs(a[1] - b[1]) < 1e-6
  for mode, polys in collected.items():
    full = unary_union(polys)
    assert sum(p.area for p in polys) - full.area < 0.01
    expected = read(EVIDENCE)["nativeAreaM2" if mode == "minecraft" else "areaM2"]
    assert abs(full.area - expected) < full.length * 0.0072


def test_native_actual_geometry_is_independently_orthogonal() -> None:
  for filename, packet in packets():
    if "minecraft" not in filename:
      continue
    for mesh in packet["meshes"]:
      points, indices = mesh_arrays(packet, mesh)
      spreads = np.ptp(points[indices], axis=1)
      assert np.all(np.any(spreads < 0.0001, axis=1))
    for row in packet["nav"]["buildings"]:
      if row.get("heightSource") == "complete-official-family-britz-v342":
        assert row["nativeRoofCaps"]
        assert all(
          c[2] > c[0] and c[3] > c[1] and c[4] > 0 for c in row["nativeRoofCaps"]
        )


def test_balconies_keep_walkable_floor_and_open_air_below() -> None:
  floors = []
  for filename, payload in packets():
    if "minecraft" in filename:
      continue
    access = payload["nav"]["spreeBridgesV242"]
    floors.extend(access["floors"])
    assert all(s["low"] >= 5 for s in access["solids"])
  assert len(floors) >= 50
  assert all(f["y"] >= 5 for f in floors)
