"""Independent street support, source preservation and family-height checks."""

import base64
import hashlib
import json
import math

import numpy as np
from shapely import make_valid
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import unary_union

from scripts import build_main_streets_v254 as build
from scripts.integrate_playgrounds_v255 import (
  baseline_bytes,
  predecessor_manifest_v255,
)


def test_source_scope_ids_and_original_packet_bytes_are_retained():
  source, evidence, output = (
    build.city.read(path) for path in (build.SOURCE, build.EVIDENCE, build.OUTPUT)
  )
  digest = build.curbs.base.digest
  assert evidence["sourceSha256"] == output["sourceSha256"] == digest(build.SOURCE)
  previous = baseline_bytes()
  assert evidence["preservedManifestSha256"] == hashlib.sha256(previous).hexdigest()
  assert predecessor_manifest_v255(
    build.city.read(build.OUT / "manifest.json")
  ) == json.loads(previous)
  for raw, key in (
    (build.GEO / "raw/outer-v159/candidate.gpkg", "rawSha256"),
    (build.transport.PBF, "pbfSha256"),
  ):
    assert len(source[key]) == 64
    if raw.exists():
      assert digest(raw) == source[key]
  assert {row["tags"]["name"] for row in source["named"]} == set(build.NAMES)
  assert len({row["key"] for row in source["named"]}) == len(source["named"])
  assert all(
    build.transport.at_grade(row["tags"])
    and row["tags"]["highway"] in build.transport.VEHICULAR_HIGHWAYS
    and not shape(row["geometry"]).is_empty
    for row in source["named"]
  )
  assert output["ids"] == sorted(output["packets"])
  assert set(output["packets"]) == set(evidence["packets"])
  assert 0 < len(output["packets"]) <= 200
  assert build.OUTPUT.stat().st_size < 3 * 1024 * 1024
  for key, receipt in evidence["packets"].items():
    path = build.ROOT / receipt["url"]
    assert digest(path) == receipt["sha256"]
    original = build.city.read(path)
    plan = output["packets"][key]
    assert plan["origin"] == original["origin"]
    assert plan["guard"] == build.curbs.ground_guard(original["nav"]["ground"])
    assert len(original["meshes"]) + 1 <= 16
    meshes = [*original["meshes"], plan["mesh"]]
    assert (
      sum(len(base64.b64decode(mesh["positions"])) // 6 for mesh in meshes) <= 400_000
    )
    assert (
      sum(len(base64.b64decode(mesh["indices"])) // 4 for mesh in meshes) <= 2_400_000
    )


def test_curbs_remain_supported_and_keep_crossings_courts_and_old_details_open():
  source, evidence, output = (
    build.city.read(path) for path in (build.SOURCE, build.EVIDENCE, build.OUTPUT)
  )
  scope, access = shape(source["scope"]), shape(source["access"])
  terrain = box(*build.city.read(build.DATA / "weinbergTerrainV176.json")["support"])
  _, old_kerbs, _, _ = build.city.earlier()
  old_kerbs = old_kerbs.union(
    unary_union(
      [
        shape(row["geometry"]).buffer(0.2)
        for entry in build.city.read(build.city.EVIDENCE)["emitted"]
        for row in entry["records"]
        if row["kind"] == "kerb"
      ]
    )
  )
  records = {row["packet"]: row for row in evidence["emitted"]}
  assert set(records) == set(output["packets"])
  for key, plan in output["packets"].items():
    original = build.city.read(build.ROOT / evidence["packets"][key]["url"])
    ox, _, oz = original["origin"]
    ground = unary_union(
      [
        translate(Polygon(row["ring"], row["holes"]), ox, oz)
        for row in original["nav"]["ground"]
      ]
    )
    buildings = unary_union(
      [
        make_valid(translate(Polygon(row["ring"], row.get("holes", [])), ox, oz))
        for row in original["nav"]["buildings"]
      ]
    )
    road, floor, _ = build.city.surface_layers(original)
    protected = build.city.protected_ground(original)
    footprint = shape(records[key]["geometry"])
    assert footprint.area > 0 and footprint.is_valid
    assert shape(records[key]["support"]).buffer(1e-7).covers(footprint)
    assert floor.buffer(1e-7).covers(footprint)
    assert ground.buffer(1e-7).covers(footprint)
    assert scope.buffer(1e-7).covers(footprint)
    assert road.boundary.buffer(0.271).covers(footprint)
    for forbidden in (access, terrain, old_kerbs, buildings, protected):
      assert footprint.intersection(forbidden).area < 1e-6
    if key.startswith("minecraft:"):
      for line in build.city.line_parts(footprint.boundary):
        for a, b in zip(line.coords, list(line.coords)[1:]):
          assert abs(a[0] - b[0]) < 1e-8 or abs(a[1] - b[1]) < 1e-8
          assert all(abs(v * 4 - round(v * 4)) < 1e-6 for v in a)


def test_meshes_represent_the_receipted_curbs_with_native_grid_and_finite_heights():
  evidence, output = (build.city.read(path) for path in (build.EVIDENCE, build.OUTPUT))
  records = {row["packet"]: shape(row["geometry"]) for row in evidence["emitted"]}
  for key, plan in output["packets"].items():
    mesh = plan["mesh"]
    assert mesh["kind"] == build.KIND
    positions = (
      np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
      + plan["origin"]
    )
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    assert len(positions) > 0 and indices.max() < len(positions)
    assert np.all(np.isfinite(positions))
    assert np.all(np.isclose(positions[:, 1], 3.09) | np.isclose(positions[:, 1], 3.24))
    if key.startswith("minecraft:"):
      assert np.allclose(positions[:, [0, 2]] * 4, np.round(positions[:, [0, 2]] * 4))
    top = []
    for triangle in positions[indices]:
      footprint = Polygon(triangle[:, [0, 2]])
      if footprint.area > 1e-8:
        assert np.allclose(triangle[:, 1], 3.24)
        top.append(footprint)
    actual = unary_union(top)
    expected = records[key]
    # Source encoding rounds to centimetres; bound that displacement in both
    # directions instead of allowing a large area discrepancy on a long street.
    assert actual.buffer(0.008).covers(expected)
    assert expected.buffer(0.008).covers(actual)


def test_longitudinal_edges_keep_crossing_gaps_and_never_close_street_ends():
  road = box(0, -3, 20, 3)
  floor = box(-2, -8, 22, 8)
  crossing = box(8, -8, 12, 8)
  allowed = floor.difference(crossing)
  axes = [{"g": LineString([(0, 0), (20, 0)])}]
  edge = build.usable_edge(road, floor, allowed, axes)
  assert math.isclose(edge.length, 32)
  assert edge.intersection(crossing).length == 0
  assert edge.distance(Point(0, 0)) == 3
  assert edge.distance(Point(20, 0)) == 3
  assert edge.covers(Point(4, 3)) and edge.covers(Point(16, -3))


def test_signals_keep_mapped_identity_both_road_clearances_and_actual_family_heights():
  source, evidence, output = (
    build.city.read(path) for path in (build.SOURCE, build.EVIDENCE, build.SIGNALS)
  )
  records = output["signals"]
  assert records == evidence["signals"]
  assert 0 < len(records) <= len(source["signals"])
  assert len(records) == len({row["osm_key"] for row in records})
  mapped = {row["key"]: row for row in source["signals"]}
  roads = {row["key"]: row for row in source["roads"]}
  support = {key: shape(value) for key, value in evidence["signalSupport"].items()}
  heights = {
    (row["osmKey"], row["family"]): row for row in evidence["signalHeightReceipts"]
  }
  assert len(heights) == len(evidence["signalHeightReceipts"]) == 2 * len(records)
  packets = {}
  terrain = box(*build.city.read(build.DATA / "weinbergTerrainV176.json")["support"])
  for row in records:
    observed = mapped[row["osm_key"]]
    assert observed["tags"]["highway"] == "traffic_signals"
    point = shape(observed["geometry"])
    target = Point(*(value / 10 for value in row["position_dm"]))
    assert row["source_dm"] == [round(point.x * 10), round(point.y * 10)]
    assert row["offset_dm"] == round(point.distance(target) * 10)
    assert point.distance(target) <= 18.08
    assert row["placement"] == (
      "surveyed_verge" if point.distance(target) < 0.08 else "relocated_verge"
    )
    assert support["drawn"].covers(target) and support["native"].covers(target)
    assert not terrain.covers(target)
    for family in ("drawn", "native"):
      road = support[family + "Roads"]
      assert road.is_empty or road.distance(target) >= 0.4 - 1e-7
    for family, field, west_key, west_height in (
      ("drawn", "ground_y_m", "westDrawn", 5.52),
      ("minecraft", "native_ground_y_m", "westNative", 5.58),
    ):
      receipt = heights[row["osm_key"], family]
      path = build.ROOT / receipt["url"]
      assert build.curbs.base.digest(path) == receipt["sha256"]
      if receipt["url"] not in packets:
        packets[receipt["url"]] = build.city.read(path)
      packet = packets[receipt["url"]]
      mesh = packet["meshes"][receipt["mesh"]]
      assert mesh["kind"] == receipt["kind"]
      positions = (
        np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
        + packet["origin"]
      )
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      triangle = positions[indices[receipt["triangle"]]]
      assert np.allclose(triangle, receipt["points"], atol=1e-7, rtol=0)
      assert np.allclose(triangle[:, 1], receipt["height"], atol=1e-7, rtol=0)
      assert Polygon(triangle[:, [0, 2]]).covers(target)
      datum = west_height if support[west_key].covers(target) else 3.12
      assert datum <= receipt["height"] <= datum + 0.5
      assert row[field] == receipt["height"]
    assert math.isfinite(row["heading_rad"])
    road = roads[row["road_key"]]
    if row["direction_evidence"] == "mapped_direction":
      assert observed["tags"]["traffic_signals:direction"] in ("forward", "backward")
      assert shape(road["geometry"]).distance(point) < 0.35
    elif row["direction_evidence"] == "mapped_oneway":
      assert road["tags"]["oneway"] in ("yes", "-1")
      assert shape(road["geometry"]).distance(point) < 0.35
    else:
      assert row["direction_evidence"] == "right_hand_approach_estimate"
