"""Verified old openings, unchanged packets and bounded independent front details."""

from __future__ import annotations

import base64
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Point, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_north_mitte_fronts_v239 as m  # noqa: E402


@pytest.fixture(scope="module")
def source():
  return m.read(m.SOURCE)


def test_original_sources_and_packets_unchanged(source):
  assert m.read(m.EVIDENCE)["sourceSha256"] == m.sha(m.SOURCE)
  for path, digest in source["sourceHashes"].items():
    assert m.sha(ROOT / path) == digest
  for path, digest in source["packetReceipts"].items():
    assert m.sha(ROOT / path) == digest
  assert len(source["packetReceipts"]) == 12
  assert not {w["owner"] for w in source["windows"]} & set(source["excludedOwners"])


def test_every_ordinary_opening_has_both_exact_delivered_triangles(source):
  zone = unary_union([shape(r["geometry"]) for r in source["roads"]]).buffer(28)
  keys, _ = m.current_triangles(zone)
  assert len(source["windows"]) == 5647
  centers = set()
  for w in source["windows"]:
    quad = np.asarray(w["quad"]) + [0, w["receiptOffsetY"], 0]
    tris = [[quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]]
    assert [m.tri_key(t).hex() for t in tris] == w["triangles"]
    assert all(m.tri_key(t) in keys for t in tris)
    assert np.allclose(
      np.asarray(w["quad"]).mean(axis=0) + [0, w["terrainOffsetY"], 0], w["center"]
    )
    key = tuple(round(v, 2) for v in w["center"]) + (
      round(w["width"], 2),
      round(w["height"], 2),
    )
    assert key not in centers
    centers.add(key)
    assert zone.covers(Point(w["center"][0], w["center"][2]))


def test_all_requested_frontages_and_distinct_choriner_register(source):
  counts = Counter(w["road"] for w in source["windows"])
  assert set(counts) == m.NAMES
  assert all(n >= 100 for n in counts.values())
  assert len({w["owner"] for w in source["windows"]}) == 265
  assert len(source["choriner"]) == 20
  assert {w["owner"] for w in source["choriner"]} == {"DEBE01YYK00005YZ"}
  assert all(w["nativeAdditionalOffset"] == 1.05 for w in source["choriner"])


def test_limited_reflections_keep_central_mullions_and_most_existing_glass(source):
  # The two new fields occupy 22.2% of a pane and leave a central 16% opening.
  assert 2 * 0.37 * 0.30 < 0.23
  assert 0.265 - 0.37 / 2 > 0.075
  for w in source["windows"][::97] + source["choriner"]:
    subset = {"windows": [w], "choriner": []}
    details = m.models(subset)
    for mode, detail in details.items():
      assert detail.triangles
      assert {r for _, _, r in detail.triangles} <= {
        "split-upper-glazing-reflection",
        "existing-opening-side-reveal",
        "existing-opening-stone-head",
        "existing-opening-sill",
      }
      if mode == "minecraft":
        a = np.asarray([t for t, _, _ in detail.triangles])
        n = np.cross(a[:, 1] - a[:, 0], a[:, 2] - a[:, 0])
        assert np.all(np.count_nonzero(np.abs(n) > 1e-8, axis=1) <= 1)


def test_packets_preserve_navigation_and_fit_existing_delivery_limits():
  addition = m.read(m.ADDITION)
  assert len(addition["chunks"]) == 10
  for d in addition["chunks"]:
    assert d["id"].startswith("northfront239-")
    for mode in ["drawn", "minecraft"]:
      p = m.OUT / d[mode]["url"]
      assert m.sha(p) == d[mode]["sha256"]
      data = m.read(p)
      assert data["nav"] == {"groundY": 3, "ground": [], "water": [], "buildings": []}
      assert len(data["meshes"]) == 1
      mesh = data["meshes"][0]
      assert mesh["kind"] == "north-mitte-fronts-v239"
      assert d[mode]["decodedBytes"] < 4 * 1024 * 1024
      assert d[mode]["bytes"] < 1024 * 1024
      ps = (
        np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
        .reshape(-1, 3)
        .astype(float)
      )
      ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      assert len(ps) < 200000
      if mode == "minecraft":
        ts = ps[ix]
        n = np.cross(ts[:, 1] - ts[:, 0], ts[:, 2] - ts[:, 0])
        assert np.all(np.count_nonzero(np.abs(n) > 0, axis=1) <= 1)
