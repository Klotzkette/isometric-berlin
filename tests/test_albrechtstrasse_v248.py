"""The finite Albrechtstraße 131 overlay must stay on real, exposed source walls."""

import hashlib
import importlib.util
import json
import math
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, box

ROOT = Path(__file__).resolve().parents[1]


def load():
  spec = importlib.util.spec_from_file_location(
    "albrecht_v248", ROOT / "scripts/build_albrechtstrasse_v248.py"
  )
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  return module


def test_exact_replay_and_immutable_source_receipts():
  m = load()
  data, evidence = m.build()
  assert data == json.loads(m.OUT.read_bytes())
  assert evidence == json.loads(m.EVIDENCE.read_bytes())
  assert len(evidence["preservedSha256"]) == 5
  for key in ["preservedSha256", "packetSha256"]:
    for name, sha in evidence[key].items():
      assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == sha
  assert evidence["owner"] == "DEBE06YYB0000PVc"
  assert evidence["heritage"]["id"] == "09065472"


def test_each_fitting_is_supported_by_full_delivered_triangles_and_exposed():
  m = load()
  data, evidence = m.build()
  for family, key in [("drawn", "boxes"), ("minecraft", "nativeRows")]:
    packet, owner, triangles = m.source(family)
    o = packet["origin"]
    neighbours = [
      Polygon([(x + o[0], z + o[2]) for x, z in b["ring"]])
      for b in packet["nav"]["buildings"]
      if b.get("sourceId") != m.OWNER
    ]
    edges = evidence["families"][family]["edges"]
    supports = [m.wall_polygon(e, triangles) for e in edges]
    for row, receipt in zip(data[key], evidence["families"][family]["rows"]):
      e = edges[receipt["edge"]]
      a, b, n = np.array(e["a"]), np.array(e["b"]), np.array(e["normal"])
      t = (b - a) / np.linalg.norm(b - a)
      p = np.array([row[0], row[2]])
      offset = (p - a) @ n
      u = (p - a) @ t
      width = row[3] if family == "drawn" else abs(t[0]) * row[3] + abs(t[1]) * row[5]
      depth = row[5] if family == "drawn" else abs(n[0]) * row[3] + abs(n[1]) * row[5]
      assert offset - depth / 2 >= 0.03999  # always outside, no wall z-fighting
      assert offset + depth / 2 <= 0.21001
      assert (
        supports[receipt["edge"]]
        .buffer(0.00002)
        .covers(
          box(u - width / 2, row[1] - row[4] / 2, u + width / 2, row[1] + row[4] / 2)
        )
      )
      assert row[1] - row[4] / 2 >= 7.4  # leave authored doors/shops untouched
      assert row[1] + row[4] / 2 < 27
      for delta in [-0.49, 0, 0.49]:
        point = Point(p + t * width * delta)
        assert not Polygon(owner["ring"]).buffer(-0.00001).contains(point)
        assert not any(poly.buffer(-0.00001).contains(point) for poly in neighbours)
      if family == "minecraft":
        assert len(row) == 7
        assert abs(t[0]) + abs(t[1]) == 1
        assert abs(n[0]) + abs(n[1]) == 1
      else:
        assert abs(math.cos(row[6]) - t[0]) < 0.00001
        assert abs(-math.sin(row[6]) - t[1]) < 0.00001


def test_native_edges_are_its_own_unmodified_contour_and_budget_is_finite():
  m = load()
  data, evidence = m.build()
  for family in ["drawn", "minecraft"]:
    f = evidence["families"][family]
    ring = f["owner"]["ring"]
    for e in f["edges"]:
      assert e["a"] == ring[e["ids"][0]]
      assert e["b"] == ring[e["ids"][-1] + 1]
      for index in e["ids"]:
        v, w = np.array(ring[index]), np.array(ring[index + 1])
        assert abs((w - v) @ np.array(e["normal"])) < 1e-7
  assert len(data["boxes"]) == 229
  assert len(data["nativeRows"]) == 160
  assert len(data["boxes"]) * 76 <= 18_000
  assert len(data["nativeRows"]) * 76 <= 13_000
  assert set(data) == {"version", "boxes", "nativeRows"}
  assert any(abs(row[6]) > 0.001 for row in data["boxes"])
  for family in ["drawn", "minecraft"]:
    records = evidence["families"][family]["rows"]
    assert {r["kind"] for r in records} == {"frame", "glass", "mullion", "cornice"}


def test_changed_packet_is_rejected_instead_of_reinterpreted(monkeypatch):
  import pytest

  m = load()
  original = m.sha
  monkeypatch.setattr(
    m, "sha", lambda p: "0" * 64 if p.suffix == ".gz" else original(p)
  )
  with pytest.raises(AssertionError, match="immutable source packet changed"):
    m.build()
