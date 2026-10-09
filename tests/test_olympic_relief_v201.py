"""Exact source retention and datum contracts for the Olympic relief correction."""

from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

import pytest
from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_olympic_terrain_v201 as terrain  # noqa:E402
from build_olympic_landmarks_v201 import stadium_y  # noqa:E402
from clip_olympic_seating_v201 import (  # noqa:E402
  digest,
  restore_clipped_payload,
)


def read(path: str) -> dict:
  return json.loads((ROOT / path).read_bytes())


def test_measured_field_and_apron_preserve_official_samples_and_old_ground() -> None:
  field = terrain.field()["profiles"][0]
  evidence = read("geo_data/regierungsviertel/olympic-terrain-v201.json")
  assert field["support"] == [-10496, -1152, -8064, 1152]
  assert evidence["license"] == "dl-de/zero-2-0"
  assert (
    hashlib.sha256(terrain.DATA.read_bytes()).hexdigest() == evidence["fieldSha256"]
  )
  assert len(evidence["sources"]) == 4
  for iz, row in enumerate(field["offsets"]):
    for ix, value in enumerate(row):
      x, z = field["support"][0] + ix * 8, field["support"][1] + iz * 8
      edge = min(x + 10496, -8064 - x, z + 1152, 1152 - z)
      if edge >= 192:
        assert value + 33 == pytest.approx(evidence["measuredNHN"][iz][ix], abs=1e-8)
      elif edge == 0:
        assert value == pytest.approx(terrain.old_offset(x, z), abs=0.000051)
      assert math.isfinite(value)
  assert terrain.offset_at(-9651, 245) - terrain.offset_at(-9651, 151) == pytest.approx(
    24.32
  )
  assert terrain.offset_at(-8780, 266) - terrain.offset_at(-8944, 266) == pytest.approx(
    13.005
  )
  assert stadium_y(-12.667) == 23.05
  assert stadium_y(3.55) == 37
  assert stadium_y(25) == 58.45


def test_immutable_old_geometry_and_all_exact_ground_source_vertices_are_retained() -> (
  None
):
  oldpath = ROOT / "src/app/src/data/westLandmarksV187.json"
  audit = read("geo_data/regierungsviertel/olympic-landmarks-v201.json")
  assert hashlib.sha256(oldpath.read_bytes()).hexdigest() == audit["sourceSha256"]
  old = json.loads(oldpath.read_bytes())
  # The exact seating overlap is now supplied by complete measured sheets.
  # Restore only its individually recorded originals before replaying this
  # earlier full terrain proof; do not weaken its XZ/Y/colour/area assertions.
  new = restore_clipped_payload(
    read("src/app/src/data/olympicGroundsV201.json"),
    read("geo_data/regierungsviertel/olympic-seating-v201-audit.json"),
  )
  assert digest(new) == audit["resultSha256"]
  for g in new["groups"]:
    src = next(s for s in old["groups"] if s["name"] == g["name"])
    assert len(g["surfaces"]) == len(src["surfaces"])
    report = next(r for r in audit["groups"] if r["name"] == g["name"])
    assert report["resultTriangles"] == sum(len(s["triangles"]) for s in g["surfaces"])
    assert report["sourceTriangles"] == sum(
      len(s["triangles"]) for s in src["surfaces"]
    )
    for s, r in zip(src["surfaces"], g["surfaces"]):
      assert s["color"] == r["color"]
      source_xz = {(round(p[0], 6), round(p[2], 6)) for t in s["triangles"] for p in t}
      result_xz = {(p[0], p[2]) for t in r["triangles"] for p in t}
      assert source_xz <= result_xz

      def area(tris: list) -> float:
        return sum(
          abs(
            (t[1][0] - t[0][0]) * (t[2][2] - t[0][2])
            - (t[1][2] - t[0][2]) * (t[2][0] - t[0][0])
          )
          / 2
          for t in tris
        )

      assert area(s["triangles"]) == pytest.approx(area(r["triangles"]), abs=0.002)
      for tri in r["triangles"]:
        for x, y, z in tri:
          expected = (
            stadium_y(s["triangles"][0][0][1])
            if s["triangles"][0][0][1] < 0
            else s["triangles"][0][0][1] + terrain.offset_at(x, z)
          )
          assert y == pytest.approx(r.get("waterY", expected), abs=0.00001)
    offset = 0
    for source, count in zip(src["native"], report["nativeRuns"]):
      parts = g["native"][offset : offset + count]
      offset += count
      assert sum(r[3] * r[5] for r in parts) == pytest.approx(
        source[3] * source[5], abs=1e-6
      )
      for r in parts:
        assert r[6] == source[6] and min(r[3:6]) > 0
        assert (
          source[0] - source[3] / 2 - 1e-8
          <= r[0] - r[3] / 2
          <= r[0] + r[3] / 2
          <= source[0] + source[3] / 2 + 1e-8
        )
        assert (
          source[2] - source[5] / 2 - 1e-8
          <= r[2] - r[5] / 2
          <= r[2] + r[5] / 2
          <= source[2] + source[5] / 2 + 1e-8
        )
        if source[1] >= 0:
          water = next(
            (
              v["waterY"]
              for v in audit["flatPools"]
              if Polygon(v["ring"]).buffer(0.2).covers(Point(source[0], source[2]))
            ),
            None,
          )
          expected = (
            source[1] + terrain.offset_at(r[0], r[2], True)
            if water is None
            else water + source[1] - 3.6
          )
          assert r[1] == pytest.approx(expected)
    assert offset == len(g["native"])
  assert (
    ROOT / "src/app/src/data/olympicGroundsV201.json"
  ).stat().st_size < 5 * 1024 * 1024


def test_exact_pylon_owners_and_no_unrelated_landmark_transforms() -> None:
  data = read("src/app/src/data/olympicGroundsV201.json")
  source = read("src/app/src/data/westLandmarksV187.json")
  gateway = next(g for g in source["groups"] if g["name"] == "Olympic gateway pylons")
  assert len(data["gatewayOffsets"]["surfaces"]) == len(gateway["surfaces"])
  assert len(data["gatewayOffsets"]["native"]) == len(gateway["native"])
  assert all(g["name"].startswith("Olympiapark") for g in data["groups"])
  assert set(terrain.OLYMPIC_OFFSETS) == {
    "DEBE04AL5LX00002",
    "DEBE04AL5LX00003",
    "DEBE04AL5LX00004",
    "DEBE04YY500001If",
    "DEBE04YY500008Cu",
    "DEBE04YY500006Fm",
  }


def test_every_retained_pool_stays_horizontal_instead_of_following_its_bottom() -> None:
  data = read("src/app/src/data/olympicGroundsV201.json")
  pools = [s for g in data["groups"] for s in g["surfaces"] if s["color"] == 0x529CA8]
  assert len(pools) == 6
  for s in pools:
    heights = {p[1] for t in s["triangles"] for p in t}
    assert len(heights) == 1
    assert next(iter(heights)) == pytest.approx(s["waterY"], abs=0.0000011)
