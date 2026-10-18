"""Regression of bounded, source-mapped Moabit details without a second terrain."""

import base64
import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_small_tiergarten_v237 as build  # noqa: E402


def test_source_owners_and_prior_geometry_are_retained():
  source = build.read(build.SOURCE)
  evidence = build.read(build.EVIDENCE)
  assert build.digest(build.SOURCE) == evidence["sourceSha256"]
  for relative, expected in evidence["unchangedInputs"].items():
    assert build.digest(ROOT / relative) == expected
  assert source["parkIds"] == ["relation/8676818", "way/4592869"]
  park = shape(source["park"])
  assert 66000 < park.area < 68000
  assert len(source["oldPaths"]) >= 97
  assert source["town"]["existingOwnership"]["ids"] == ["DEBE01YYK0002O8g"]
  assert len(source["town"]["parts"]) == 4
  rows = {r["id"]: r for r in source["features"]}
  benches = [r for r in evidence["records"] if r["kind"] == "bench"]
  assert len(benches) == 123
  for bench in benches:
    mapped = shape(rows[bench["id"]]["geometry"])
    assert bench["count"] == len(bench["anchors"])
    for anchor in bench["anchors"]:
      from shapely.geometry import Point

      assert mapped.distance(Point(anchor)) < 1e-7
  main = next(r for r in evidence["records"] if r["kind"] == "rathaus-portico")
  assert main["id"] == "node/1776326062"
  assert main["wallOwner"] == "DEBE3DxQUEt451DE"
  assert (
    LineString([main["wall"]["a"], main["wall"]["b"]]).distance(
      shape(rows[main["id"]]["geometry"])
    )
    < 0.08
  )


def test_only_missing_at_grade_paths_are_added():
  source = build.read(build.SOURCE)
  evidence = build.read(build.EVIDENCE)
  existing = unary_union(
    [
      LineString([(x, z) for x, y, z in p["points"]]).buffer(
        p["w"] / 200 + 0.08, cap_style=2, join_style=2
      )
      for p in source["oldPaths"]
    ]
  )
  park = shape(source["park"])
  rows = {r["id"]: r for r in source["features"]}
  paths = [r for r in evidence["records"] if r["kind"] == "missing-path"]
  assert {r["id"] for r in paths} == {"way/447048755", "way/1567879132"}
  for row in paths:
    g = shape(row["geometry"])
    assert g.difference(park).area < 1e-7
    assert g.intersection(existing).area < 1e-7
    assert not rows[row["id"]]["tags"].get("tunnel")
    assert rows[row["id"]]["tags"].get("layer", "0") == "0"
    source_strip = shape(rows[row["id"]]["geometry"]).buffer(
      row["widthM"] / 2, cap_style=2, join_style=2
    )
    assert g.difference(source_strip).area < 1e-7
  assert "no requested pedestrian underpass identity" in evidence["underpass"]


def test_packets_are_small_separate_native_and_have_no_new_navigation_or_coverage():
  addition = build.read(build.ADDITION)
  evidence = build.read(build.EVIDENCE)
  assert set(addition) == {"chunks"}
  assert len(addition["chunks"]) == 2
  totals = {"drawn": 0, "minecraft": 0}
  for descriptor in addition["chunks"]:
    assert descriptor["id"].startswith("moabit237-")
    for mode in totals:
      resource = descriptor[mode]
      raw = (build.OUT / resource["url"]).read_bytes()
      assert hashlib.sha256(raw).hexdigest() == resource["sha256"]
      assert len(raw) == resource["bytes"]
      decoded = gzip.decompress(raw)
      assert len(decoded) == resource["decodedBytes"]
      packet = json.loads(decoded)
      assert packet["nav"] == dict(groundY=5.2, ground=[], water=[], buildings=[])
      assert packet["schemaVersion"] == 1
      assert packet["id"] == descriptor["id"]
      assert len(packet["meshes"]) == 1
      mesh = packet["meshes"][0]
      positions = (
        np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(-1, 3)
        / 100
        + packet["origin"]
      )
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
        -1, 3
      )
      assert np.isfinite(positions).all()
      assert indices.max() < len(positions) < 400000
      assert len(indices) * 3 < 2400000
      assert np.min(positions[:, 1]) >= 5.19
      assert np.max(positions[:, 1]) < 11.0
      x0, z0, x1, z1 = descriptor["bounds"]
      assert positions[:, 0].min() >= x0 and positions[:, 0].max() <= x1
      assert positions[:, 2].min() >= z0 and positions[:, 2].max() <= z1
      normals = np.cross(
        positions[indices[:, 1]] - positions[indices[:, 0]],
        positions[indices[:, 2]] - positions[indices[:, 0]],
      )
      if mode == "minecraft":
        assert (np.count_nonzero(abs(normals) > 1e-7, axis=1) <= 1).all()
      gpu = len(positions) * 12 + indices.size * (2 if len(positions) <= 65535 else 4)
      assert gpu == evidence["packets"][f"{mode}:{descriptor['id']}"]["geometryBytes"]
      totals[mode] += gpu
  assert totals["drawn"] < 200000
  assert totals["minecraft"] < 900000


def test_replay_counts_and_original_ground_datum():
  source = build.read(build.SOURCE)
  details, records = build.models(source)
  assert json.loads(json.dumps(records)) == build.read(build.EVIDENCE)["records"]
  ground = build.ground_sampler()
  for row in source["features"]:
    p = shape(row["geometry"]).representative_point()
    assert ground(p.x, p.y) == 5.2
  assert all(d.triangles for d in details.values())
  assert len(details["drawn"].triangles) != len(details["minecraft"].triangles)
