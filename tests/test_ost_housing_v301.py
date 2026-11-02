"""Independent bounded geometry/source receipts for eastern-house fittings."""

from __future__ import annotations

import base64
import gzip
import hashlib

import numpy as np

from scripts import build_ost_housing_v301 as b


def test_individual_reference_scope_and_source_integrity():
  evidence = b.read(b.EVIDENCE)
  data = b.read(b.RUNTIME)
  refs = b.read(b.GEO / "ost-housing-v301-references.json")
  ids = {r["id"] for r in refs["references"]}
  assert len(evidence["profiles"]) == 34
  assert len({p["owner"] for p in evidence["profiles"]}) == 34
  assert len(data["packets"]) == 32
  assert len({k.split(":", 1)[1] for k in data["keys"]}) == 16
  assert {p["reference"] for p in evidence["profiles"]} <= ids
  assert all(p["owner"].startswith("DEBE") for p in evidence["profiles"])
  assert (
    hashlib.sha256(b.PROFILE_SOURCE.read_bytes()).hexdigest()
    == evidence["profileSourceSha256"]
  )
  for relative, receipt in evidence["inputs"].items():
    raw = (b.ROOT / relative).read_bytes()
    # The decoded immutable payload is independent of permitted lossless gzip changes.
    assert hashlib.sha256(gzip.decompress(raw)).hexdigest() == receipt["decodedSha256"]


def test_exact_old_window_retirement_keeps_complete_other_triangle_complement():
  data = b.read(b.RUNTIME)
  evidence = b.read(b.EVIDENCE)
  assert len(evidence["retirements"]) == 262
  records = {}
  for p in evidence["retirements"]:
    records.setdefault(p["key"], []).append(p)
  for key, plan in data["packets"].items():
    mode, tile = key.split(":")
    raw = b.read(b.OUT / f"{tile}.{mode}.json.gz")
    for r in plan["retire"]:
      assert tile.startswith("district188-")
      assert raw["meshes"][r["mesh"]]["kind"] == "district-facades-v188"
      m = raw["meshes"][r["mesh"]]
      indices = np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3)
      output = indices.copy()
      selected = set(r["triangles"])
      assert len(selected) == len(r["triangles"])
      for tri in selected:
        output[tri, 1:] = output[tri, 0]
      complement = [i for i in range(len(indices)) if i not in selected]
      assert np.array_equal(indices[complement], output[complement])
      p = np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3)
      c = np.frombuffer(base64.b64decode(m["colors"]), "u1").reshape(-1, 3)
      for proof in records[key]:
        if proof["mesh"] != r["mesh"]:
          continue
        at = proof["triangles"][0]
        v = indices[at, 0]
        assert proof["triangles"] == [at, at + 1]
        assert (
          proof["quadSha256"]
          == hashlib.sha256(b.quad_key(p[v : v + 4], c[v : v + 4])).hexdigest()
        )
        assert proof["owner"] in plan["owners"]


def test_native_is_independent_cardinal_and_all_fixed_packet_limits_hold():
  data = b.read(b.RUNTIME)
  for key, plan in data["packets"].items():
    mode, tile = key.split(":")
    raw = b.read(b.OUT / f"{tile}.{mode}.json.gz")
    m = plan["append"]
    assert plan["appendFingerprint"] == b.mesh_fingerprint(m)
    assert m["kind"] == "ost-housing-v301"
    for i, r in enumerate(plan["records"]):
      assert r["mesh"] == i and r["kind"] == raw["meshes"][i]["kind"]
      assert r["fingerprint"] == b.mesh_fingerprint(raw["meshes"][i])
    p = np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3)
    ix = np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3)
    assert ix.max() < len(p)
    assert (
      len(p) + sum(len(base64.b64decode(x["positions"])) // 6 for x in raw["meshes"])
      <= 400000
    )
    assert (
      ix.size + sum(len(base64.b64decode(x["indices"])) // 4 for x in raw["meshes"])
      <= 2400000
    )
    assert len(raw["meshes"]) + 1 <= 16
    if mode == "minecraft":
      # Every face is on a true x/y/z plane; no diagonal drawn pediments leak in.
      assert np.all(np.any(np.ptp(p[ix].astype(np.int32), axis=1) == 0, axis=1))
      other = data["packets"]["drawn:" + tile]["append"]
      assert m["positions"] != other["positions"]


def test_every_face_remains_on_its_actual_delivered_source_backing():
  from shapely.geometry import Point

  evidence = b.read(b.EVIDENCE)
  data = b.read(b.RUNTIME)
  packets = {}
  point_count = 0
  b.TRIANGLES.clear()
  b.NATIVE_PLANES.clear()
  for f in evidence["faces"]:
    mode = "minecraft" if f["native"] else "drawn"
    key = mode + ":" + f["packet"]
    m = data["packets"][key]["append"]
    origin = data["packets"][key]["origin"]
    points = (
      np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3) / 100
      + origin
    )
    points = points[f["vertexStart"] : f["vertexStart"] + f["vertices"]]
    path = b.OUT / f"{f['supportPacket']}.{mode}.json.gz"
    if path not in packets:
      packets[path] = b.read(path)
    raw = packets[path]
    if f["native"]:
      b.native_fronts(
        raw,
        next(q for q in evidence["profiles"] if q["id"] == f["profileId"]),
        [f["face"]],
      )
      assert min(abs(f["face"]["d"][0]), abs(f["face"]["d"][1])) < 1e-8
    plane = b.source_plane(raw, f["face"])
    a, d = np.array(f["face"]["a"]), np.array(f["face"]["d"])
    uv = np.column_stack([(points[:, [0, 2]] - a) @ d, points[:, 1]])
    # Geometry is u16 centimetres. Thin wall-parallel members project back to
    # their actual supporting plane; only centimetre rounding is tolerated.
    assert all(plane.distance(Point(v)) <= 0.01001 for v in uv), f["profileId"]
    assert points[:, 1].min() >= f["face"]["low"] - 0.01
    assert points[:, 1].max() <= f["face"]["high"] + 0.01
    point_count += len(points)
  assert point_count == sum(
    len(base64.b64decode(p["append"]["positions"])) // 6
    for p in data["packets"].values()
  )
