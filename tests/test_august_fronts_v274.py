"""Exact retained panes, original packets and bounded independent wall fittings."""

from collections import Counter

import numpy as np
import pytest
from shapely import wkt
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

from scripts import build_august_fronts_v274 as m


@pytest.fixture(scope="module")
def source():
  return m.old.read(m.SOURCE)


@pytest.fixture(scope="module")
def evidence():
  return m.old.read(m.EVIDENCE)


def test_sources_packets_and_old_v239_inventory_remain_unchanged(source, evidence):
  assert source["previousV239Sha256"] == m.old.sha(m.old.SOURCE)
  assert evidence["sourceSha256"] == m.old.sha(m.SOURCE)
  for receipts in [
    source["sourceHashes"],
    source["packetReceipts"],
    evidence["packetReceipts"],
  ]:
    for path, digest in receipts.items():
      assert m.old.sha(m.ROOT / path) == digest
  assert len(evidence["packetReceipts"]) == 6
  assert {w["road"] for w in source["windows"]} == {
    "Auguststraße",
    "Oranienburger Straße",
  }
  assert len(source["windows"]) == 296
  assert source["choriner"] == []
  protected, _ = m.protections()
  owners = {w["owner"] for w in evidence["accepted"]}
  assert not owners & (protected | m.V270_OWNERS | set(source["excludedOwners"]))
  assert set(source["excludedV270Owners"]) == m.V270_OWNERS


def test_every_candidate_has_two_exact_retained_drawn_triangles(source):
  zone = unary_union([shape(r["geometry"]) for r in source["roads"]]).buffer(28)
  keys, _ = m.old.current_triangles(zone)
  seen = set()
  for window in source["windows"]:
    quad = np.asarray(window["quad"]) + [0, window["receiptOffsetY"], 0]
    triangles = [quad[[0, 1, 2]], quad[[0, 2, 3]]]
    assert [m.old.tri_key(t).hex() for t in triangles] == window["triangles"]
    assert all(m.old.tri_key(t) in keys for t in triangles)
    key = tuple(window["center"])
    assert key not in seen
    seen.add(key)


def test_new_fittings_are_upper_and_inside_original_source_wall(evidence):
  assert Counter(w["road"] for w in evidence["accepted"]) == {
    "Auguststraße": 108,
    "Oranienburger Straße": 1,
  }
  assert max(Counter(w["owner"] for w in evidence["accepted"]).values()) <= 12
  for window in evidence["accepted"]:
    assert window["role"] == "window glazing"
    center, tangent = np.array(window["center"]), np.array(window["tangent"])
    ground = (
      min(p[1] for ring in window["sourceWall"] for p in ring)
      + window["terrainOffsetY"]
    )
    assert center[1] >= ground + 4.5
    rings = [
      [
        (
          float((np.array(p) - center) @ tangent),
          p[1] + window["terrainOffsetY"] - center[1],
        )
        for p in ring
      ]
      for ring in window["sourceWall"]
    ]
    wall = Polygon(rings[0], rings[1:]).buffer(1e-7)
    assert wall.covers(
      box(
        -window["width"] / 2 - 0.2,
        -window["height"] / 2 - 0.04,
        window["width"] / 2 + 0.2,
        window["height"] / 2 + 0.24,
      )
    )


def test_each_native_section_is_on_an_actual_cardinal_wall(evidence):
  manifest = {d["id"]: d for d in m.old.read(m.OUT / "manifest.json")["chunks"]}
  for tile in evidence["counts"]:
    packet = m.old.read(m.OUT / manifest[tile]["minecraft"]["url"])
    planes = m.fittings.native_planes(packet, [])
    for window in (w for w in evidence["accepted"] if w["chunk"] == tile):
      for part in window["native"]:
        assert part["axis"] in [0, 2]
        assert part["center"][part["axis"]] == part["plane"]
        assert sum(abs(n) for n in part["normal"]) == 1
        assert sum(abs(n) for n in part["tangent"]) == 1
        assert np.dot(part["normal"], part["tangent"]) == 0
        assert any(
          p["axis"] == part["axis"]
          and p["plane"] == part["plane"]
          and p["polygon"].buffer(0.01).covers(wkt.loads(part["required"]))
          for p in planes
        )


def test_deterministic_replay_exact_prefix_guards_and_unchanged_limits(
  source, evidence
):
  runtime, actual = m.plans(source)
  assert actual == evidence
  assert runtime == m.old.read(m.RUNTIME)
  manifest = {d["id"]: d for d in m.old.read(m.OUT / "manifest.json")["chunks"]}
  for tile, modes in runtime["chunks"].items():
    for mode, plan in modes.items():
      packet = m.old.read(m.OUT / manifest[tile][mode]["url"])
      assert plan["origin"] == packet["origin"]
      assert plan["guard"] == m.nav_fingerprint(packet["nav"])
      assert len(plan["records"]) == len(packet["meshes"])
      for i, record in enumerate(plan["records"]):
        mesh = packet["meshes"][i]
        assert record == dict(
          mesh=i,
          kind=mesh["kind"],
          fingerprint=m.fingerprint(
            [mesh["positions"], mesh["colors"], mesh["indices"]]
          ),
        )
      assert 0 < len(plan["boxes"]) <= 900
      for x, y, z, tx, tz, nx, nz, width, height, depth, rgb in plan["boxes"]:
        assert all(np.isfinite([x, y, z, tx, tz, nx, nz, width, height, depth, rgb]))
        assert width > 0 and height > 0 and depth > 0
        if mode == "minecraft":
          assert tx == 0 or tz == 0
        for a in [-1, 1]:
          for b in [-1, 1]:
            for c in [-1, 1]:
              assert all(
                0 <= v <= 655.35
                for v in [
                  x + tx * a * width / 2 + nx * c * depth / 2,
                  y + b * height / 2,
                  z + tz * a * width / 2 + nz * c * depth / 2,
                ]
              )
