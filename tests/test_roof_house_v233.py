"""Measured ordinary roofs replace only independently reconstructed old owners."""

from __future__ import annotations

from collections import Counter

import numpy as np
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

from scripts import build_roof_house_v233 as build


def test_distributed_complete_source_roofs_and_immutable_inputs() -> None:
  source = build.read_json(build.SOURCE)
  evidence = build.read_json(build.EVIDENCE)
  assert evidence["sourceSha256"] == build.digest(build.SOURCE)
  assert evidence["runtimeSha256"] == build.digest(build.RUNTIME)
  assert source["boundarySha256"] == build.digest(build.BOUNDARY)
  assert len(source["owners"]) == 192
  assert Counter(o["region"] for o in source["owners"]) == {
    "Mitte": 32,
    "Friedrichshain-Kreuzberg": 32,
    "Charlottenburg-Wilmersdorf": 32,
    "Schöneberg": 32,
    "Steglitz-Zehlendorf": 64,
  }
  for row in source["owners"]:
    assert row["sourceTopY"] - row["sourceRoofLowY"] > 1.2
    assert all(p["surfaces"] for p in row["parts"])
    assert all(
      {s["kind"] for s in p["surfaces"]} == {"WallSurface", "RoofSurface"}
      for p in row["parts"]
    )
    footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in row["parts"]])
    assert footprint.is_valid and not footprint.is_empty
    assert build.regions()[row["region"]].covers(footprint)
    receipt = source["archives"][row["sourceTile"]]
    assert receipt["url"].startswith("https://gdi.berlin.de/data/a_lod2/atom/")
    assert len(receipt["sha256"]) == 64
  for receipt in evidence["packets"]:
    assert (
      build.digest(build.OUT / receipt["oldAsset"]["url"])
      == receipt["oldAsset"]["sha256"]
    )


def test_every_removed_triangle_is_the_complete_reconstructed_owner_multiset() -> None:
  source = build.read_json(build.SOURCE)
  runtime = build.read_json(build.RUNTIME)
  manifest = {
    d["id"]: d for d in build.read_json(build.OUT / "manifest.json")["chunks"]
  }
  for key, receipt in runtime["packets"].items():
    mode, tile = key.split(":")
    packet = build.read_json(build.OUT / manifest[tile][mode]["url"])
    expected = Counter()
    for owner in source["owners"]:
      if owner["tile"] == tile:
        expected.update(build.triangle_keys(build.old_envelope(packet, owner["owner"])))
    actual = Counter()
    for record in receipt["records"]:
      part = packet["meshes"][record["mesh"]]
      assert record["fingerprint"] == build.fingerprint(
        [part[k] for k in ("positions", "colors", "indices")]
      )
      assert len(set(record["triangles"])) == len(record["triangles"])
      keys = build.triangle_keys(part)
      actual.update(keys[t] for t in record["triangles"])
    assert actual == expected


def test_native_roofs_are_orthogonal_and_packet_growth_is_bounded() -> None:
  runtime = build.read_json(build.RUNTIME)
  manifest = {
    d["id"]: d for d in build.read_json(build.OUT / "manifest.json")["chunks"]
  }
  assert build.RUNTIME.stat().st_size < 3_000_000
  assert build.SOURCE.stat().st_size < 1_000_000
  source = build.read_json(build.SOURCE)
  evidence = build.read_json(build.EVIDENCE)
  cells = {
    c["owner"]: c["nativeCells"]
    for p in evidence["packets"]
    if p["mode"] == "minecraft"
    for c in p["counts"]
  }
  for owner in source["owners"]:
    footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in owner["parts"]])
    assert cells[owner["owner"]] == build.native_polygon(footprint).area / 4
  for key, receipt in runtime["packets"].items():
    mode, tile = key.split(":")
    packet = build.read_json(build.OUT / manifest[tile][mode]["url"])
    # Leave room for the other two independently audited house fittings.
    assert len(packet["meshes"]) + 3 <= 16
    assert (
      sum(len(build.decode(p)[0]) for p in packet["meshes"])
      + len(build.decode(receipt["replacement"])[0])
      < 390_000
    )
    positions, _, indices = build.decode(receipt["replacement"])
    assert len(positions) < 12_000
    if mode == "minecraft":
      for triangle in positions[indices].astype(int):
        assert np.any(np.ptp(triangle, axis=0) == 0), (
          "Native face must lie on an orthogonal plane"
        )


def test_gutters_follow_lower_horizontal_measured_roof_boundaries() -> None:
  source = build.read_json(build.SOURCE)
  count = 0
  for owner in source["owners"]:
    footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in owner["parts"]])
    for a, b, n in build.gutter_segments(owner["parts"]):
      assert abs(a[1] - b[1]) <= 0.015
      assert footprint.boundary.buffer(0.025).covers(
        LineString([(a[0], a[2]), (b[0], b[2])])
      )
      assert abs(np.linalg.norm(n) - 1) < 1e-6
      count += 1
  assert count >= 128


def test_extension_preserves_every_released_owner_and_packet_recipe() -> None:
  source = build.read_json(build.SOURCE)
  runtime = build.read_json(build.RUNTIME)
  extension = source["additiveExtension"]
  assert extension["previousOwnerCount"] == 128
  assert extension["owners"] == 64
  assert len(extension["previousPackets"]) == 206
  assert (
    build.canonical_digest(source["owners"][:128]) == extension["previousOwnersSha256"]
  )
  old_tiles = {o["tile"] for o in source["owners"][:128]}
  assert all(o["tile"] not in old_tiles for o in source["owners"][128:])
  for key, expected in extension["previousPackets"].items():
    assert build.canonical_digest(runtime["packets"][key]) == expected
