"""Retain complete survey evidence and open pavilion clearance."""

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon

from scripts.build_verkehrskanzel_ownership_v276 import build as owners
from scripts.build_verkehrskanzel_v276 import OUT, SHIFT, SOURCE, build


def test_complete_source_and_reproducibility():
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  data = json.loads(OUT.read_bytes())
  assert data == json.loads(json.dumps(build()))
  assert data["sourceSha256"] == hashlib.sha256(SOURCE.read_bytes()).hexdigest()
  assert {p["id"] for p in source["parents"]} == {
    "DEBE04YY5000041M",
    "DEBE04YY50002cND",
  }
  assert sum(len(p["parts"][0]["surfaces"]) for p in source["parents"]) == 27
  assert {r["tags"]["osm_way_id"] for r in source["osm"]} == {"709164073", "588847139"}
  positions = np.frombuffer(
    base64.b64decode(data["drawnPositions"]), dtype="<f4"
  ).reshape(-1, 3)
  for parent in source["parents"]:
    part = parent["parts"][0]
    for surface in part["surfaces"]:
      if parent["id"].endswith("2cND") and surface["kind"] != "RoofSurface":
        continue
      for ring in surface["rings"]:
        for x, y, z in ring:
          assert (
            np.linalg.norm(positions - np.array([x, y + SHIFT, z]), axis=1).min()
            < 0.001
          )
  canopy = Polygon(data["parts"][1]["ring"])
  assert all(canopy.covers(Point(row[0], row[2])) for row in data["posts"][1:])


def test_two_original_prisms_and_complete_native_receipts():
  path = Path("src/app/src/data/verkehrskanzelV276Ownership.json")
  assert json.loads(path.read_text()) == owners()
  data = json.loads(path.read_text())
  assert {p["id"] for p in data["previousPrisms"]} == {"09164073", "88847139"}
  assert len(data["columns"]) == 9
  assert not data["retainedSharedColumns"]


def test_native_kiosk_windows_clear_actual_opaque_cells():
  from shapely.geometry import box
  from shapely.ops import unary_union

  data = json.loads(OUT.read_text())
  occupied = unary_union(
    [box(x, z, x + 1, z + 1) for x, z, _ in data["parts"][0]["nativeCells"]]
  )
  assert data["nativeFittingReceipts"]
  for receipt in data["nativeFittingReceipts"]:
    x, _, z, w, _, d, _, _ = receipt["rendered"]
    assert (
      occupied.intersection(box(x - w / 2, z - d / 2, x + w / 2, z + d / 2)).area < 1e-8
    )
    assert 0 <= receipt["offset"] <= 1.75
  assert any(r["offset"] > 0 for r in data["nativeFittingReceipts"])


def test_native_cabin_posts_are_visible_outside_actual_glass_wall_cells():
  """Check submitted white posts, not the distinct horizontal cabin head plate."""
  from collections import defaultdict

  from shapely.geometry import box
  from shapely.ops import unary_union

  data = json.loads(OUT.read_bytes())
  rows = np.frombuffer(base64.b64decode(data["nativeDetails"]), dtype="<f4").reshape(
    -1, 8
  )
  glass = rows[rows[:, 7] == 0x749A9D]
  frames = rows[rows[:, 7] == 0xDEDCCD]
  assert len(glass) == 33 and len(frames) == 200
  occupied = unary_union(
    [
      box(x - w / 2, z - d / 2, x + w / 2, z + d / 2)
      for x, _, z, w, _, d, _, _ in glass
    ]
  )
  posts = defaultdict(list)
  for x, y, z, w, h, d, yaw, _ in frames:
    assert yaw == 0 and h > 0.2 and w < 0.1 and d < 0.1
    footprint = box(x - w / 2, z - d / 2, x + w / 2, z + d / 2)
    assert occupied.intersection(footprint).area < 1e-9, (
      "Native white post is hidden in glass"
    )
    posts[(float(x), float(z))].append((float(y - h / 2), float(y + h / 2)))
  assert len(posts) == 20
  for intervals in posts.values():
    intervals.sort()
    assert len(intervals) == 10
    assert abs(intervals[0][0] - 9.30) < 1e-5
    assert abs(intervals[-1][1] - 11.75) < 1e-5
    assert all(abs(a[1] - b[0]) < 1e-5 for a, b in zip(intervals, intervals[1:]))
  receipts = data["nativeCabinFrameReceipts"]
  assert len(receipts) == 20
  assert sorted(i for r in receipts for i in r["nativeIndices"]) == list(
    np.flatnonzero(rows[:, 7] == 0xDEDCCD)
  )
  ring = data["cabin"]["ring"]
  for receipt in receipts:
    a, b = ring[receipt["face"]], ring[(receipt["face"] + 1) % 4]
    t = receipt["fraction"]
    origin = [a[j] + (b[j] - a[j]) * t for j in range(2)]
    assert origin == receipt["upperRingPoint"]
    assert 0.03125 <= receipt["offset"] <= 0.5
    assert len(receipt["nativeIndices"]) == 10
    expected = [
      origin[j] + receipt["outwardNormal"][j] * receipt["offset"] for j in range(2)
    ]
    for index in receipt["nativeIndices"]:
      assert np.allclose(rows[index, [0, 2]], expected, rtol=0, atol=0.00025)
