"""Exact retired tower, measured-shell preservation and independent native geometry."""

from __future__ import annotations

import base64
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_stadthaus_v239 as m  # noqa: E402


def test_only_hollow_tower_rows_retire_and_all_source_detail_survives():
  old, receipt = m.read(m.OLD), m.read(m.RECEIPT)
  assert receipt["sourceSha256"] == m.sha(m.OLD)
  assert receipt["sourceEvidenceSha256"] == m.sha(m.SOURCE)
  assert receipt["requiredPacket"] == "stadthaus239-5_0"
  assert len(receipt["boxes"]) == 34
  assert len(receipt["segments"]) == 410
  for kind, first, count in [
    ("boxes", "firstBox", "boxCount"),
    ("segments", "firstSegment", "segmentCount"),
  ]:
    removed = {r["index"] for r in receipt[kind]}
    assert len(removed) == len(receipt[kind])
    for row in receipt[kind]:
      assert old[kind][row["index"]] == row["row"]
    for feature in old["features"]:
      assert removed.isdisjoint(range(feature[first], feature[first] + feature[count]))
  evidence = m.read(m.EVIDENCE)
  for name, digest in evidence["unchangedFiles"].items():
    assert m.sha(ROOT / name) == digest


def test_source_parent_roof_courts_and_height_remain_explicit():
  source = m.read(m.SOURCE)
  p = source["part"]
  assert source["parent"] == "DEBE01YYK00005yc"
  assert source["osm"]["osmIds"] == ["relation/23745"]
  assert len(p["surfaces"]) == 100
  assert len(p["holes"]) == 5
  assert p["top_y_m"] == 30.534
  assert source["towerHeightM"] == 80
  assert source["towerCenter"] == [2676, 317.5]
  assert len(source["visualReferences"]) == 2
  assert {r["license"] for r in source["visualReferences"]} == {"CC BY 2.0"}


def test_roof_is_only_west_and_cannot_close_measured_courts():
  source = m.read(m.SOURCE)
  p = source["part"]
  detail = m.Detail()
  evidence = m.west_roof(source, detail)
  footprint = Polygon(p["ring"], p["holes"])
  west = shape(evidence["footprint"])
  assert west.difference(footprint).area < 1e-7
  assert west.bounds[2] == 2689
  roofs = [
    tri for tri, _, role in detail.triangles if role == "western-mansard-estimate"
  ]
  assert roofs
  for tri in roofs:
    plan = Polygon([(p[0], p[2]) for p in tri])
    assert plan.difference(west).area < 1e-7
    assert max(q[1] for q in tri) <= p["top_y_m"] + 0.04 + 5.5
    for q in tri:
      assert footprint.buffer(1e-7).covers(Point(q[0], q[2]))


def test_tower_is_single_closed_core_with_two_colonnades_and_80m_top():
  d = m.tower()
  roles = {role for _, _, role in d.triangles}
  assert {
    "cubic-tower-base",
    "drum-1",
    "drum-2",
    "closed-cupola",
    "fortuna-head",
  } <= roles
  for level in [1, 2]:
    assert {f"column-{level}-{i}" for i in range(8)} <= roles
  assert max(p[1] for tri, _, _ in d.triangles for p in tri) == 83
  assert min(p[1] for tri, _, _ in d.triangles for p in tri) >= 30.4


def test_bounded_packets_are_texture_free_full_detail_and_native_orthogonal():
  addition = m.read(m.ADDITION)
  assert len(addition["chunks"]) == 1
  desc = addition["chunks"][0]
  assert desc["id"] == "stadthaus239-5_0"
  assert desc["bounds"] == [2560, 0, 3072, 512]
  for mode in ["drawn", "minecraft"]:
    path = m.OUT / desc[mode]["url"]
    assert m.sha(path) == desc[mode]["sha256"]
    payload = m.read(path)
    assert payload["nav"]["buildings"] == []
    assert len(payload["meshes"]) == 1
    mesh = payload["meshes"][0]
    assert mesh["kind"] == "stadthaus-v239"
    ps = (
      np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
      .reshape(-1, 3)
      .astype(float)
    )
    ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    assert 5000 < len(ps) < 40000
    assert desc[mode]["decodedBytes"] < 1_200_000
    if mode == "minecraft":
      tris = ps[ix]
      normals = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
      assert np.all(np.count_nonzero(np.abs(normals) > 0, axis=1) <= 1)
  assert m.read(m.EVIDENCE)["framedExistingWindows"] == 204
