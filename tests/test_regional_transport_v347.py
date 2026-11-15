"""Actual A10 topology/source courses and bounded BER light companions."""

from __future__ import annotations

import base64
import gzip
import json
import os
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_regional_transport_v347 as b  # noqa: E402


def decode_group(row):
  encoded = row["gzipBase85"]
  alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#"
  raw = b"".join(
    sum(
      alphabet.index(c) * 85 ** (4 - i) for i, c in enumerate(encoded[p : p + 5])
    ).to_bytes(4, "big")
    for p in range(1, len(encoded), 5)
  )
  if int(encoded[0]):
    raw = raw[: -int(encoded[0])]
  decoded = gzip.decompress(raw)
  assert len(decoded) == row["decodedBytes"] < 2 * 1024**2
  return json.loads(decoded)


def test_complete_ring_keeps_all_previous_courses_and_actual_ramp_connections():
  source = b.read(b.A10_SOURCE)
  previous = b.read(b.GEO / "region-outlines-v200-source.json.gz")
  old = {r["id"] for r in previous["features"] if r["site"] == "A10"}
  main = {r["id"] for r in source["records"] if r["main"]}
  assert main == old == set(source["previousMainGeometryUnchanged"])
  assert len(main) == 1001 and b.cycles(source["records"]) == [497, 504]
  assert len(source["relations"]) == 15
  selected = {r["id"] for r in source["records"]}
  for identity in previous["a10EndpointRecoveredWays"]:
    assert f"way/{identity}" in main
  endpoints = {(r["id"], r["node"]): r for r in source["rampEndpoints"]}
  for record in source["records"]:
    if record["tags"]["highway"].endswith("_link"):
      for node in (record["nodes"][0], record["nodes"][-1]):
        evidence = endpoints[record["id"], node]
        assert evidence["connections"]
        assert all(c["id"] != record["id"] for c in evidence["connections"])
        # Any motorway ramp continuing beyond the original box was fetched.
        assert all(
          c["id"] in selected
          for c in evidence["connections"]
          if c["highway"] in {"motorway", "motorway_link", "trunk_link"}
        )
  ring = unary_union([shape(r["geometry"]) for r in source["records"] if r["main"]])
  corridor = ring.buffer(2000.01)
  assert all(corridor.covers(shape(r["renderGeometry"])) for r in source["records"])


def test_all_compiled_a10_segments_equal_source_offsets_without_invented_connections():
  source = {r["id"]: r for r in b.read(b.A10_SOURCE)["records"]}
  ranges = {
    r["key"]: r["features"]
    for r in b.read(b.GEO / "a10-transport-v347-feature-ranges.json")["groups"]
  }
  compiled = b.read(b.DATA / "a10TransportV347.json")
  observed, vertices = set(), 0
  for batch in compiled["groups"]:
    body = decode_group(batch)
    positions = np.frombuffer(base64.b64decode(body["positionsCm"]), "<i4").reshape(
      -1, 3
    )
    assert np.all(positions[:, 1] == 309)
    colours = np.frombuffer(base64.b64decode(body["colorsU8"]), "u1").reshape(-1, 3)
    assert positions.shape == colours.shape
    for row in ranges[batch["key"]]:
      record = source[row["id"]]
      observed.add(row["id"])
      g = shape(record["renderGeometry"])
      paths = [] if record["main"] else list(b.line_parts(g))
      for line in b.line_parts(g):
        for sign in (-1, 1):
          paths.extend(
            b.line_parts(
              line.offset_curve(sign * row["widthM"] / 2, join_style="round")
            )
          )
      expected = []
      for path in paths:
        pts = list(path.coords)
        for a, c in zip(pts, pts[1:]):
          if a != c:
            expected.extend(
              [
                [round(a[0] * 100), 309, round(a[1] * 100)],
                [round(c[0] * 100), 309, round(c[1] * 100)],
              ]
            )
      first, count = row["firstVertex"], row["vertexCount"]
      assert np.array_equal(positions[first : first + count], expected)
      assert row["bridge"] == record["tags"].get("bridge")
      assert row["layer"] == record["tags"].get("layer")
    vertices += len(positions)
  assert observed == set(source)
  assert vertices == b.read(b.GEO / "a10-transport-v347-evidence.json")["vertices"]


def test_ber_all_real_light_anchors_and_explicit_colours_fit_retained_ground():
  source = b.read(b.BER_SOURCE)
  evidence = b.read(b.GEO / "ber-fittings-v347-evidence.json")
  prior = b.read(b.GEO / "ber-v236-manifest-addition.json")
  footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in prior["footprint"]])
  assert not source["outsideRetainedGround"]
  lights = [r for r in source["records"] if r["tags"]["aeroway"] == "navigationaid"]
  assert len(lights) == 5417
  assert {r["id"] for r in lights} == set(evidence["renderedSourceIds"])
  assert len(evidence["archivedNonFixtureSourceIds"]) == 378
  for record in lights:
    assert footprint.covers(Point(record["point"]))
    colour, height, radius = b.light_style(record["tags"])
    assert (
      colour in b.LIGHT_COLOURS and height in (0.07, 0.45) and radius in (0.13, 0.18)
    )
    if "light:colour" in record["tags"]:
      assert colour == record["tags"]["light:colour"]
  assert Counter(b.light_style(r["tags"])[0] for r in lights) == evidence["lensColours"]
  for path, digest in evidence["retainedFiles"].items():
    assert b.digest(ROOT / path) == digest


def test_ber_packets_are_bounded_host_companions_with_cardinal_native_faces():
  manifest = b.read(b.GEO / "ber-fittings-v347-manifest.json")
  old = {
    c["id"]: c for c in b.read(b.GEO / "ber-v236-manifest-addition.json")["chunks"]
  }
  stage = Path(
    os.environ.get(
      "BER_V347_PACKETS", ROOT / "src/app/public/mesh/surrounding-berlin-v159"
    )
  )
  assert manifest["footprint"] == [] and len(manifest["chunks"]) == 47
  total = 0
  for row in manifest["chunks"]:
    assert row["bounds"] == old[row["detailCompanionOf"]]["bounds"]
    for family in ("drawn", "minecraft"):
      asset = row[family]
      path = stage / asset["url"]
      assert path.exists(), (
        f"Set BER_V347_PACKETS to the isolated staging folder: {path}"
      )
      assert path.stat().st_size == asset["bytes"] and b.digest(path) == asset["sha256"]
      raw = gzip.decompress(path.read_bytes())
      assert len(raw) == asset["decodedBytes"] < 1024**2
      packet = json.loads(raw)
      assert packet["nav"] == dict(ground=[], water=[], buildings=[], groundY=3)
      assert packet["id"] == row["id"] and len(packet["meshes"]) == 1
      mesh = packet["meshes"][0]
      points = (
        np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
        + packet["origin"]
      )
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      x0, z0, x1, z1 = row["bounds"]
      assert points[:, 0].min() >= x0 - 0.01 and points[:, 0].max() <= x1 + 0.01
      assert points[:, 2].min() >= z0 - 0.01 and points[:, 2].max() <= z1 + 0.01
      assert points[:, 1].min() >= 3.04 - 1e-9 and points[:, 1].max() <= 3.55 + 1e-9
      if family == "minecraft":
        triangles = points[indices]
        normals = np.cross(
          triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
        )
        assert np.all(np.count_nonzero(abs(normals) > 1e-7, axis=1) <= 1)
      total += asset["bytes"]
  assert total == b.read(b.GEO / "ber-fittings-v347-evidence.json")["compressedBytes"]
  assert total < 3 * 1024**2
