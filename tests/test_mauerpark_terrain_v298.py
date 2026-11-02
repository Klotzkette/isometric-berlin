"""Independent encoded-source, rigid-owner and outside-complement proofs."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import subprocess
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "src/app/src/data/mauerparkTerrainV298.json"
FIELD = ROOT / "src/app/src/data/wallGalleryV298.json"
EVIDENCE = ROOT / "geo_data/regierungsviertel/mauerpark-terrain-v298-evidence.json.gz"


def canonical(value):
  return json.dumps(
    value, ensure_ascii=False, separators=(",", ":"), allow_nan=False
  ).encode()


def decode(mesh, origin):
  points = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(
    -1, 3
  )
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(-1, 3)
  colors = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
  return (
    points.astype(np.int64) + np.rint(np.array(origin) * 100).astype(np.int64),
    indices,
    colors,
  )


@pytest.fixture(scope="module")
def evidence():
  return json.loads(gzip.decompress(EVIDENCE.read_bytes()))


@pytest.fixture(scope="module")
def runtime():
  return json.loads(RUNTIME.read_bytes())


@pytest.fixture(scope="module")
def packets(tmp_path_factory):
  folder = tmp_path_factory.mktemp("mauerpark-v298-source")
  subprocess.run(
    ["bun", "scripts/prepare-mauerpark-terrain-v298.ts", str(folder)],
    cwd=ROOT / "src/app",
    check=True,
    capture_output=True,
  )
  return {p.name[:-5]: json.loads(p.read_bytes()) for p in folder.glob("*.json")}


def sampler():
  hill = json.loads(FIELD.read_bytes())["hill"]
  mask = Polygon(hill["mask"]["coordinates"][0])
  grid = np.asarray(hill["heights"])
  origin = hill["origin"]
  west, north, _, _ = mask.bounds

  def corner(x, z):
    if not mask.contains(Point(x, z)):
      return 0.0
    u, v = (x - origin[0]) / 4, (z - origin[1]) / 4
    i, j = int(u), int(v)
    a, b = u - i, v - j
    raw = (
      np.array([(1 - a) * (1 - b), a * (1 - b), (1 - a) * b, a * b])
      @ grid[j : j + 2, i : i + 2].ravel()
    )
    t = min(1.0, mask.boundary.distance(Point(x, z)) / 160.0)
    return (raw - 3) * t * t * (3 - 2 * t)

  def height(x, z, native=False):
    if native:
      x, z = math.floor(x / 4) * 4 + 2, math.floor(z / 4) * 4 + 2
      return (
        math.ceil((3 + corner(x, z)) / 0.125) * 0.125 - 3
        if mask.contains(Point(x, z))
        else 0.0
      )
    if not mask.contains(Point(x, z)):
      return 0.0
    u, v = (x - west) / 4, (z - north) / 4
    i, j = math.floor(u), math.floor(v)
    a, b = u - i, v - j
    x0, z0 = west + i * 4, north + j * 4
    coordinates = (
      [(x0, z0), (x0 + 4, z0 + 4), (x0 + 4, z0)]
      if a >= b
      else [(x0, z0), (x0 + 4, z0 + 4), (x0, z0 + 4)]
    )
    # Solve the represented plane independently from the TS barycentric form.
    matrix = np.array([[px, pz, 1] for px, pz in coordinates])
    return np.array([x, z, 1]) @ np.linalg.solve(
      matrix, [corner(px, pz) for px, pz in coordinates]
    )

  return mask, height


def test_all_original_prepared_meshes_and_field_have_exact_source_fingerprints(
  evidence, runtime, packets
):
  assert hashlib.sha256(FIELD.read_bytes()).hexdigest() == evidence["fieldSha256"]
  assert set(runtime["packets"]) == {"3_-6", "3_-5", "4_-6", "4_-5"}
  assert sum(len(modes) for modes in runtime["packets"].values()) == 8
  for r in evidence["records"]:
    if "mesh" not in r:
      continue
    mesh = packets[r["id"] + "." + r["mode"]]["meshes"][r["mesh"]]
    assert hashlib.sha256(canonical(mesh)).hexdigest() == r["originalMeshSha256"]
  # Recompression may alter a gzip container; all actual source fields above
  # are checked on their original decoded contents, without accepting a change.


def test_rigid_bodies_retain_every_xyz_difference_triangle_and_colour(
  evidence, runtime, packets
):
  checked = changed = 0
  for r in evidence["records"]:
    if "mesh" not in r:
      continue
    plan = runtime["packets"][r["id"]][r["mode"]]
    packet = packets[r["id"] + "." + r["mode"]]
    part = next(p for p in plan["parts"] if p["mesh"] == r["mesh"])
    old, oi, oc = decode(packet["meshes"][r["mesh"]], packet["origin"])
    new, ni, nc = decode(part["append"], packet["origin"])
    cursor = 0
    expected_remove = []
    for first, count, kind, dy, per_source in r["receipt"]["placementRuns"]:
      for si in range(first, first + count):
        if kind == "rigid" and not dy:
          continue
        expected_remove.append(si)
        tris = ni[cursor : cursor + per_source]
        cursor += per_source
        if kind != "rigid":
          continue
        assert per_source == 1
        assert np.array_equal(new[tris[0]], old[oi[si]] + [0, dy, 0])
        assert np.array_equal(nc[tris[0]], oc[oi[si]])
        checked += 1
        changed += bool(dy)
    assert expected_remove == part["remove"]
    assert cursor == len(ni)
  assert checked > 6000 and changed == checked


def test_draped_source_footprints_keep_complete_outside_area_and_match_field(
  evidence, runtime, packets
):
  mask, height = sampler()
  max_error = 0.0
  checked = outside = 0
  for r in evidence["records"]:
    if "mesh" not in r:
      continue
    native = r["mode"] == "minecraft"
    plan = runtime["packets"][r["id"]][r["mode"]]
    packet = packets[r["id"] + "." + r["mode"]]
    part = next(p for p in plan["parts"] if p["mesh"] == r["mesh"])
    old, oi, _ = decode(packet["meshes"][r["mesh"]], packet["origin"])
    new, ni, _ = decode(part["append"], packet["origin"])
    cursor = 0
    old_ground = []
    new_ground = []
    removed = set(part["remove"])
    for si, ids in enumerate(oi):
      src = old[ids].astype(float) / 100
      if np.ptp(src[:, 1]) < 0.001 and 3 <= src[0, 1] <= 3.35:
        poly = Polygon(src[:, [0, 2]])
        if poly.area > 1e-8:
          old_ground.append(poly)
          if si not in removed:
            new_ground.append(poly)
    for first, count, kind, dy, per_source in r["receipt"]["placementRuns"]:
      for si in range(first, first + count):
        if kind == "rigid" and not dy:
          continue
        tris = new[ni[cursor : cursor + per_source]].astype(float) / 100
        cursor += per_source
        if kind != "terrain":
          src = old[oi[si]].astype(float) / 100
          if np.ptp(src[:, 1]) < 0.001 and 3 <= src[0, 1] <= 3.35:
            new_ground.append(Polygon(src[:, [0, 2]]))
          continue
        source = old[oi[si]].astype(float) / 100
        projected = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])[:, 1]
        if np.ptp(source[:, 1]) < 0.001 and 3 <= source[0, 1] <= 3.35:
          new_ground.extend(
            Polygon(t[:, [0, 2]])
            for t, area in zip(tris, projected, strict=True)
            if abs(area) > 1e-8
          )
        if np.ptp(source[:, 1]) > 0.001:
          continue
        candidates = np.where(np.abs(projected) > 0.02)[0]
        # Bounded independent sample of each real source-ground complement.
        for i in candidates[:: max(1, len(candidates) // 3)]:
          x, y, z = tris[i].mean(axis=0)
          expected = source[0, 1] + height(x, z, native)
          error = abs(y - expected)
          max_error = max(max_error, error)
          assert error < 0.05, (r["id"], r["mode"], si, x, z, error)
          checked += 1
        if not native:
          selected = [
            p for tri in tris for p in tri if not mask.contains(Point(p[0], p[2]))
          ]
          for p in selected:
            assert abs(p[1] - source[0, 1]) < 0.006
            outside += 1
    if old_ground:
      before = unary_union(old_ground)
      after = unary_union(new_ground)
      # Check the complete represented land union: individual slivers can
      # collapse below the existing centimetre encoding, while their shared
      # neighbouring source faces still retain the complete physical floor.
      assert after.buffer(0.0072).covers(before), (
        r["id"],
        r["mode"],
        before.difference(after.buffer(0.0072)).area,
      )
      assert before.buffer(0.0072).covers(after), (r["id"], r["mode"])
  assert checked > 10000 and outside > 100
  print({"independent_ground_checks": checked, "max_error_m": max_error})


def test_complete_parent_placement_is_consistent_across_tile_cuts(runtime, packets):
  owners = {}
  for key, modes in runtime["packets"].items():
    for mode, plan in modes.items():
      for building, offset in zip(
        packets[key + "." + mode]["nav"]["buildings"], plan["navOffsets"], strict=True
      ):
        identity = (mode, building["sourceId"])
        assert identity not in owners or owners[identity] == offset
        owners[identity] = offset
  assert sum(bool(v) for v in owners.values()) > 40
