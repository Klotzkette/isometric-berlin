"""Independent support, source-evidence and preservation checks for v249."""

import base64
import math

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

from scripts import build_city_streets_v249 as b


def test_positive_source_identity_and_no_invented_zebras():
  source = b.read(b.SOURCE)
  assert 200 < len(source["features"]) < 400
  assert len({f["key"] for f in source["features"]}) == len(source["features"])
  for f in source["features"]:
    tags, course = f["tags"], shape(f["geometry"])
    assert b.transport.at_grade(tags)
    assert course.is_valid and not course.is_empty
    if f["kind"] == "zebra":
      assert tags.get("crossing:markings") == "zebra" or (
        "crossing:markings" not in tags
        and (tags.get("crossing_ref") == "zebra" or tags.get("crossing") == "zebra")
      )
      assert any(tags.get(k) == "crossing" for k in ("footway", "cycleway", "path"))
      assert f["width"] > 0 and math.isfinite(f["width"])
    else:
      assert tags["barrier"] == "kerb"
      assert tags.get("kerb") not in ("flush", "lowered", "rolled", "no")
      assert 0 < f["height"] <= 0.18
      assert 2 <= course.length <= 120


def test_every_face_is_ground_bound_native_orthogonal_and_original_bytes_unchanged():
  source, evidence, payload = (b.read(p) for p in (b.SOURCE, b.EVIDENCE, b.OUTPUT))
  assert evidence["extraManifestEntries"] == 0
  assert evidence["originalGeometryRetained"] is True
  assert payload["sourceSha256"] == b.curbs.base.digest(b.SOURCE)
  assert evidence["outputSha256"] == b.curbs.base.digest(b.OUTPUT)
  by_packet = {r["packet"]: r["records"] for r in evidence["emitted"]}
  for family in ("drawn", "minecraft"):
    assert any(
      r["key"] == "way/1266275581" and r["kind"] == "zebra"
      for r in by_packet[family + ":8_-1"]
    ), "The same evidenced Friedenstraße crossing must survive in both families"
  features = {r["key"]: r for r in source["features"]}
  for key, plan in payload["packets"].items():
    receipt = evidence["packets"][key]
    path = b.ROOT / receipt["url"]
    assert b.curbs.base.digest(path) == receipt["sha256"]
    original = b.read(path)
    assert b.curbs.ground_guard(original["nav"]["ground"]) == plan["guard"]
    assert original["origin"] == plan["origin"]
    road, floor, paths = b.surface_layers(original)
    protected = b.protected_ground(original)
    ox, _, oz = original["origin"]
    ground = unary_union(
      [
        translate(Polygon(r["ring"], r["holes"]), ox, oz)
        for r in original["nav"]["ground"]
      ]
    )
    records = by_packet[key]
    repaired = unary_union(
      [shape(r["geometry"]) for r in records if r["kind"] == "crossing-asphalt"]
    )
    for record in records:
      poly = shape(record["geometry"])
      assert poly.area > 0
      assert ground.buffer(1e-6).covers(poly)
      if record["kind"] == "zebra":
        assert road.union(repaired).buffer(1e-6).covers(poly)
        assert record["topY"] == 3.18
        assert poly.intersection(shape(source["oldPaint"])).area < 1e-7
        assert record["key"] in source["crossingPackets"][key]
        assert poly.intersection(protected).area < 1e-7
      elif record["kind"] == "crossing-asphalt":
        f = features[record["key"]]
        assert paths.buffer(1e-6).covers(poly)
        assert b.road_crossing(f).buffer(1e-6).covers(poly)
        assert record["topY"] == 3.15
        assert poly.intersection(shape(source["oldPaint"])).area < 1e-7
        assert poly.intersection(protected).area < 1e-7
        for road_source in f["crossedRoads"]:
          assert b.transport.at_grade(road_source["tags"])
          assert road_source["tags"]["highway"] in b.transport.VEHICULAR_HIGHWAYS
          assert road_source["width"] == b.road_width_m(road_source["tags"])
      else:
        assert floor.buffer(1e-6).covers(poly)
        assert poly.intersection(shape(source["oldKerbs"])).area < 1e-7
        assert poly.intersection(shape(features[record["key"]]["access"])).area < 1e-7
      if key.startswith("minecraft:"):
        for line in b.line_parts(poly.boundary):
          for a, c in zip(line.coords, list(line.coords)[1:]):
            assert abs(a[0] - c[0]) < 1e-8 or abs(a[1] - c[1]) < 1e-8
            assert all(abs(v * 4 - round(v * 4)) < 1e-6 for v in a)
    mesh = plan["mesh"]
    points = (
      np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
      + plan["origin"]
    )
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    assert indices.max() < len(points)
    assert len(points) < 12000
    represented = unary_union([shape(r["geometry"]) for r in records]).buffer(0.009)
    for tri in points[indices]:
      assert np.all(np.isfinite(tri))
      poly = Polygon(tri[:, [0, 2]])
      assert represented.covers(poly)
    assert np.min(points[:, 1]) >= 3
    assert np.max(points[:, 1]) <= 3.31


def test_finite_packet_and_encoded_size_budgets():
  payload = b.read(b.OUTPUT)
  evidence = b.read(b.EVIDENCE)
  assert payload["ids"] == sorted(payload["packets"])
  assert 10 < len(payload["ids"]) <= 400
  assert b.SOURCE.stat().st_size < 1024 * 1024
  assert b.OUTPUT.stat().st_size < 3 * 1024 * 1024
  for family in ("drawn", "minecraft"):
    assert evidence["counts"][family + "ZebraWays"] > 20
    assert evidence["counts"][family + "Bytes"] < 1024 * 1024
  assert all(r["meshCount"] < 16 for r in evidence["packets"].values())
