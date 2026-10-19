"""Mapped bridge completeness, exact preservation and separate native geometry."""

import base64
import copy
import gzip
import hashlib
import json
from unittest.mock import patch

import numpy as np
import pytest
from shapely.affinity import translate
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

from scripts import build_spree_bridges_v242 as build
from scripts import spree_bridge_lineage_v242 as lineage


def decode(mesh: dict, origin: list) -> tuple:
  vertices = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  assert (
    np.isfinite(vertices).all() and len(indices) > 0 and indices.max() < len(vertices)
  )
  return vertices / 100 + origin, indices


def nav_plan(rows: list, origin: list):
  return unary_union(
    [translate(Polygon(p["ring"], p["holes"]), origin[0], origin[2]) for p in rows]
  )


def test_catalogue_is_source_bound_and_reports_uncovered_owner() -> None:
  source, evidence = build.read(build.SOURCE), build.read(build.EVIDENCE)
  assert evidence["sourceSha256"] == build.digest(build.SOURCE)
  assert evidence["outputSha256"] == build.digest(build.OUTPUT)
  assert {b["id"] for b in source["bridges"]} == build.OWNERS
  assert len(source["bridges"]) == 24
  assert evidence["counts"]["coreOwners"] == 12
  assert evidence["counts"]["streamedOwners"] == 11
  assert evidence["owners"]["659122810"]["coveredArea"] == 0
  assert (
    "outside all existing primary packet" in evidence["owners"]["659122810"]["status"]
  )
  assert evidence["owners"]["339201208"]["uncoveredArea"] < 40
  for bridge in source["bridges"]:
    assert shape(bridge["geometry"]).is_valid
    drawn = build.components(bridge, False)
    if drawn["roadBridge"]:
      assert drawn["walks"].area > 5
    for road_id in drawn["paintedRoadIds"]:
      road = next(r for r in bridge["roads"] if r["id"] == road_id)
      assert build.mapped_lane_count(road["tags"]) >= 2
      assert road["tags"]["highway"] not in ("construction", "proposed")
    if bridge["id"] == "222755815":
      for native in (False, True):
        parts = build.components(bridge, native)
        assert parts["rails"].is_empty and parts["posts"].is_empty


def test_packet_append_preserves_every_previous_geometry_line_and_navigation_value() -> (
  None
):
  evidence = build.read(build.EVIDENCE)
  assert evidence["originalGeometryRetained"] and evidence["extraManifestEntries"] == 0
  for receipt in evidence["packets"].values():
    staged = build.ROOT / receipt["staged"]
    packet_path = staged if staged.exists() else build.ROOT / receipt["url"]
    assert build.digest(packet_path) == receipt["stagedSha256"]
    packet = build.read(packet_path)
    assert len(packet["meshes"]) == receipt["meshes"] + 1 <= 16
    assert packet["meshes"][-1]["kind"] == "spree-bridges-v242"
    assert receipt["decodedBytes"] <= 12 * 1024 * 1024
    restored = dict(packet, meshes=packet["meshes"][:-1], nav=dict(packet["nav"]))
    del restored["nav"]["spreeBridgesV242"]
    retained_hash = hashlib.sha256(
      json.dumps(restored, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    assert retained_hash == receipt["originalContentSha256"]
    assert build.retained_packet(packet, receipt) == restored
    changed = dict(packet, origin=[packet["origin"][0] + 1, *packet["origin"][1:]])
    with pytest.raises(AssertionError):
      build.retained_packet(changed, receipt)
    frozen = build.RAW / "original" / packet_path.name
    if frozen.exists():
      assert build.digest(frozen) == receipt["sha256"]
      assert build.read(frozen) == restored


def test_construction_carriageway_is_not_a_sidewalk_or_completed_traffic_lane() -> None:
  source = build.read(build.SOURCE)
  bridge = next(b for b in source["bridges"] if b["id"] == "339201208")
  works = [r for r in bridge["roads"] if r["tags"].get("highway") == "construction"]
  assert {r["id"] for r in works} >= {"11549897", "1195383158"}
  for native in (False, True):
    parts = build.components(bridge, native)
    assert parts["construction"].area > 1000
    assert parts["construction"].intersection(parts["walks"]).area < 0.001
    assert parts["construction"].intersection(parts["paint"]).area < 0.001
  assert not {r["id"] for r in works}.intersection(parts["paintedRoadIds"])


def test_published_lineage_proves_whole_predecessors_and_rejects_unrelated_edits():
  current = build.read(lineage.PUBLIC / "manifest.json")
  frozen = json.loads(
    lineage.baseline(str((lineage.PUBLIC / "manifest.json").relative_to(build.ROOT)))
  )
  snapshot = copy.deepcopy(current)
  assert lineage.predecessor_manifest_v242(current) == frozen
  assert current == snapshot
  changed = copy.deepcopy(current)
  changed["chunks"][0]["drawn"]["bytes"] += 1
  # An unrelated descriptor must fail either the exact extension audit or
  # the preceding release equality check; it must never be silently restored.
  with pytest.raises(AssertionError):
    assert lineage.predecessor_manifest_v242(changed) == frozen
  key, receipt = next(iter(lineage.receipts().items()))
  path = build.ROOT / receipt["url"]
  family, chunk_id = key.split(":", 1)
  changed = copy.deepcopy(current)
  next(c for c in changed["chunks"] if c["id"] == chunk_id)[family]["bytes"] += 1
  with pytest.raises(AssertionError):
    lineage.predecessor_manifest_v242(changed)
  packet = build.read(path)
  packet["origin"][0] += 1
  raw = json.dumps(packet, separators=(",", ":")).encode()
  packed = gzip.compress(raw, mtime=0)
  forged = {
    **receipt,
    "stagedSha256": hashlib.sha256(packed).hexdigest(),
    "bytes": len(packed),
    "decodedBytes": len(raw),
  }
  with patch.object(lineage, "receipts", return_value={key: forged}):
    with pytest.raises(AssertionError):
      lineage.predecessor_packet_bytes_v242(path, lambda _: packed)


def test_complete_core_plans_and_genuinely_orthogonal_native_faces() -> None:
  data, source, evidence = (
    build.read(build.OUTPUT),
    build.read(build.SOURCE),
    build.read(build.EVIDENCE),
  )
  expected = {r["sourceId"] for r in source["coreReceipts"]}
  by_id = {b["id"]: b for b in source["bridges"]}
  assert len(expected) == 12
  for family in ("drawn", "minecraft"):
    assert {p["owner"] for p in data["core"][family]} == expected
    for packet in data["core"][family]:
      assert len(packet["meshes"]) == 1
      p, ix = decode(packet["meshes"][0], packet["origin"])
      footprint = build.components(by_id[packet["owner"]], family == "minecraft")[
        "outline"
      ]
      floor = nav_plan(packet["nav"]["spreeBridgesV242"]["floors"], packet["origin"])
      assert footprint.difference(floor.buffer(0.015)).area < 0.001
      assert floor.difference(footprint.buffer(0.015)).area < 0.001
      # End supports attach the body to the riverbed rather than leaving a
      # floating rail-and-paint surface after the old generic body retires.
      assert p[:, 1].min() <= -1.24
      if family == "minecraft":
        t = p[ix]
        normals = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
        assert np.all(np.count_nonzero(np.abs(normals) > 1e-7, axis=1) <= 1), packet[
          "name"
        ]
  for key, receipt in evidence["packets"].items():
    staged = build.ROOT / receipt["staged"]
    packet = build.read(staged if staged.exists() else build.ROOT / receipt["url"])
    p, ix = decode(packet["meshes"][-1], packet["origin"])
    support = nav_plan(packet["nav"]["ground"], packet["origin"])
    floor = nav_plan(packet["nav"]["spreeBridgesV242"]["floors"], packet["origin"])
    assert support.buffer(0.015).covers(floor)
    if key.startswith("minecraft:"):
      t = p[ix]
      normals = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
      assert np.all(np.count_nonzero(np.abs(normals) > 1e-7, axis=1) <= 1), key
