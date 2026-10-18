"""Focused integrity checks for two exact venue owners and seven U entrances."""

from __future__ import annotations

import base64
import gzip
import importlib.util
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from shapely.geometry import box, shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
  "venues238", ROOT / "scripts/build_venues_hermann_v238.py"
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def vertices(mesh):
  return np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)


def triangles(mesh):
  return vertices(mesh)[
    np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  ]


def signatures(mesh):
  v = np.column_stack(
    [
      vertices(mesh),
      np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3),
    ]
  )
  ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return [b"".join(sorted(row.tobytes() for row in t)) for t in v[ix]]


def test_complete_measured_owners_and_height_offsets():
  source = m.read(m.SOURCE)
  receipt = m.read(m.REPLACEMENT)
  assert {b["parent"]: len(b["parts"]) for b in source["buildings"]} == {
    "DEBE08YYF00009PW": 15,
    "DEBE07YY900008dL": 4,
  }
  assert set(receipt["packets"]) == {
    "drawn:ring182-6_7",
    "minecraft:ring182-6_7",
    "drawn:2_7",
    "minecraft:2_7",
  }
  assert receipt["sourceSha256"] == m.sha(m.SOURCE)
  for b in source["buildings"]:
    r = receipt["packets"]["drawn:" + b["packet"]]
    origin = np.array(r["origin"])
    got = {tuple(q) for q in vertices(r["replacement"])}
    # Every original boundary vertex survives the source triangulation and cm packing.
    for p in b["parts"]:
      for s in p["surfaces"]:
        for ring in s["rings"]:
          for x, y, z in ring:
            q = tuple(
              np.round(
                (np.array([x, y - b["sourceGroundY"] + 3, z]) - origin) * 100
              ).astype(int)
            )
            assert q in got, (b["parent"], p["id"], s["kind"], q)
    for mode in ("drawn", "minecraft"):
      rr = receipt["packets"][mode + ":" + b["packet"]]
      assert len(rr["navigationSolids"]) == len(b["parts"])
      for p, nav in zip(b["parts"], rr["navigationSolids"], strict=True):
        assert np.allclose(np.array(nav["ring"]) + origin[[0, 2]], p["ring"])
        assert nav["minY"] == 3 + p["ground_y_m"] - b["sourceGroundY"]
        assert nav["maxY"] == 3 + p["top_y_m"] - b["sourceGroundY"]
        assert len(nav["holes"]) == len(p["holes"])


def test_exact_old_owner_receipts_keep_other_meshes_and_navigation():
  source = m.read(m.SOURCE)
  receipt = m.read(m.REPLACEMENT)
  for b in source["buildings"]:
    for mode in ("drawn", "minecraft"):
      r = receipt["packets"][mode + ":" + b["packet"]]
      path = m.OUT / f"{b['packet']}.{mode}.json.gz"
      assert m.sha(path) == r["sourcePacketSha256"]
      old = m.read(path)
      tile = box(
        old["origin"][0],
        old["origin"][2],
        old["origin"][0] + 512,
        old["origin"][2] + 512,
      )
      owner = {**b["oldOwner"], "geometry": shape(b["oldOwner"]["geometry"])}
      # Source owner lies completely inside the ground, independent of ground triangles.
      full = m.chunk_payload(
        b["packet"], tile, tile, [owner], {}, minecraft=mode == "minecraft"
      )
      empty = m.chunk_payload(
        b["packet"], tile, tile, [], {}, minecraft=mode == "minecraft"
      )
      expected = m.mesh_signature(full) - m.mesh_signature(empty)
      actual = Counter()
      for record in r["records"]:
        mesh = old["meshes"][record["mesh"]]
        assert record["fingerprint"] == m.fingerprint(
          [mesh[k] for k in ("positions", "colors", "indices")]
        )
        assert mesh["kind"] == "city"
        keys = signatures(mesh)
        assert len(record["triangles"]) == len(set(record["triangles"]))
        actual.update(keys[i] for i in record["triangles"])
      assert actual == expected
      nav = [n for n in old["nav"]["buildings"] if n["sourceId"] == b["owner"]]
      assert [n["original"] for n in r["navigationRecords"]] == nav
      assert all(n["owner"] == b["owner"] for n in r["navigationRecords"])
      if mode == "drawn":
        assert r["lineFingerprint"] == m.fingerprint(
          [old["lines"][k] for k in ("positions", "colors")]
        )
        # Remove only exact owner roof outlines; no road/curb/source line is selected.
        expected_lines = m.line_signature(full["lines"]) - m.line_signature(
          empty["lines"]
        )
        mesh = old["lines"]
        v = np.column_stack(
          [
            vertices(mesh),
            np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3),
          ]
        ).reshape(-1, 2, 6)
        selected = Counter(
          b"".join(sorted(p.tobytes() for p in v[i])) for i in r["segments"]
        )
        assert selected == expected_lines
      else:
        assert not r["segments"]


def test_native_orthogonal_and_bounded_companions_with_valid_empty_nav():
  receipt = m.read(m.REPLACEMENT)
  addition = m.read(m.ADDITION)
  assert len(addition["chunks"]) == 2
  meshes = []
  for key, r in receipt["packets"].items():
    meshes.append((key, r["replacement"]))
  for desc in addition["chunks"]:
    assert desc["id"].startswith("venues238-")
    for mode in ("drawn", "minecraft"):
      path = m.OUT / desc[mode]["url"]
      raw = gzip.decompress(path.read_bytes())
      p = m.read(path)
      assert m.sha(path) == desc[mode]["sha256"]
      assert path.stat().st_size == desc[mode]["bytes"]
      assert len(raw) == desc[mode]["decodedBytes"] < 12 * 1024 * 1024
      assert p["nav"] == {"groundY": 3, "ground": [], "water": [], "buildings": []}
      assert len(p["meshes"]) == 1
      meshes.extend((mode, mesh) for mesh in p["meshes"])
  for key, mesh in meshes:
    v = vertices(mesh)
    t = triangles(mesh).astype(float)
    assert len(v) <= 400000
    assert len(t) * 3 <= 2400000
    assert np.max(v[:, [0, 2]]) <= 51200
    assert len(v) * 12 + len(t) * 3 * (2 if len(v) <= 65535 else 4) < 12 * 1024 * 1024
    if "minecraft" in key:
      normals = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
      assert np.all(np.count_nonzero(np.abs(normals) > 1e-6, axis=1) <= 1)


def test_access_sources_and_no_hall_window_invention():
  source = m.read(m.SOURCE)
  ev = m.read(m.EVIDENCE)
  assert {a["id"] for a in source["accesses"]} == {
    "node/" + str(i)
    for i in [
      331344886,
      331344887,
      331344888,
      331344889,
      3464040871,
      3785188551,
      4618496815,
    ]
  }
  assert sum(bool(a["stairs"]) for a in source["accesses"]) == 6
  for a in source["accesses"]:
    assert a["tags"]["entrance_marker:subway"] == "yes"
    for s in a["stairs"]:
      assert (
        min(
          np.linalg.norm(np.array(p) - a["position"])
          for p in shape(s["geometry"]).coords
        )
        < 0.001
      )
  col = next(b for b in ev["sites"] if b["key"] == "columbia")
  assert not any("window" in d["role"] for d in col["details"])
  doors = [d for d in col["details"] if d["role"] == "mapped-entrance-door"]
  assert {d["id"] for d in doors} == {
    "node/2572205635",
    "node/2572205637",
    "node/2572205649",
  }
  assert all(
    np.linalg.norm(np.array(d["sourcePosition"]) - d["wallPosition"]) < 0.5
    for d in doors
  )
  assert not any(
    d["role"] == "mapped-entrance-door"
    for s in ev["sites"]
    if s["key"] == "huxleys"
    for d in s["details"]
  )
