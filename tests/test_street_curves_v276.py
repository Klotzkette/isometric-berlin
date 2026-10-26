"""Independent exact-source, neighbour, navigation and native occupancy proofs."""

import base64
import math

import numpy as np
from shapely.affinity import translate
from shapely.geometry import LineString, Polygon, shape
from shapely.ops import unary_union

from scripts import build_street_curves_v276 as build


def payloads():
  return [build.city.read(p) for p in (build.SOURCE, build.EVIDENCE, build.OUTPUT)]


def test_source_and_original_asset_bytes_remain_exact():
  source, evidence, output = payloads()
  assert source["scannedRoads"] == 64510
  assert source["scannedPrimaryPackets"] == 1804
  assert evidence["sourceSha256"] == build.city.curbs.base.digest(build.SOURCE)
  assert evidence["outputSha256"] == build.city.curbs.base.digest(build.OUTPUT)
  assert (
    source["manifestSha256"]
    == evidence["manifestSha256"]
    == build.city.curbs.base.digest(build.OUT / "manifest.json")
  )
  for name, digest in evidence["inputs"].items():
    assert build.city.curbs.base.digest(build.ROOT / name) == digest
  for tile, modes in evidence["assets"].items():
    for receipt in modes.values():
      assert (
        build.city.curbs.base.digest(build.OUT / receipt["url"]) == receipt["sha256"]
      )
    packet = build.city.read(build.OUT / modes["drawn"]["url"])
    plan = output["chunks"][tile]
    assert plan["origin"] == packet["origin"]
    assert plan["guard"] == build.navigation_guard(packet["nav"])
    for r in plan["records"]:
      m = packet["meshes"][r["mesh"]]
      assert r["kind"] == m["kind"]
      assert r["fingerprint"] == build.fingerprint(
        [m["positions"], m["colors"], m["indices"]]
      )
    assert plan["lineFingerprint"] == build.fingerprint(
      [packet["lines"]["positions"], packet["lines"]["colors"]]
    )
  assert output["keys"] == sorted(output["chunks"])
  assert set(output["keys"]) == set(evidence["assets"])


def test_all_candidates_follow_exact_old_buffer_edges_and_retained_source_nodes():
  source, _, _ = payloads()
  ways = {f["key"]: f for f in source["features"]}
  boundaries = {
    k: shape(f["geometry"]).buffer(f["radius"], quad_segs=3).boundary
    for k, f in ways.items()
  }
  count = 0
  for packet in source["candidates"]:
    for row in packet["rows"]:
      feature = ways[row["source"]]
      g = shape(feature["geometry"])
      assert row["radius"] * 2 == build.road_width_m(feature["tags"])
      assert row["sagitta"] >= 0.20
      assert any(math.dist(row["centre"], p) < 1e-8 for p in g.coords)
      assert (
        LineString([row["a"], row["b"]])
        .difference(boundaries[row["source"]].buffer(0.0072))
        .length
        < 1e-8
      )
      arc = build.arc_points(row)
      assert arc[0] == row["a"] and arc[-1] == row["b"]
      assert all(abs(math.dist(p, row["centre"]) - row["radius"]) < 0.0072 for p in arc)
      assert (
        max(math.dist(a, b) for a, b in zip(arc, arc[1:]))
        < math.dist(row["a"], row["b"]) / 2
      )
      count += 1
  assert count == 1546


def test_every_emitted_arc_has_free_mapped_support_and_no_protected_neighbour():
  _, evidence, _ = payloads()
  protected, _ = build.protected_sources()
  for entry in evidence["emitted"]:
    packet = build.city.read(
      build.OUT / evidence["assets"][entry["id"]]["drawn"]["url"]
    )
    bare, road, forbidden = build.actual_support(packet)
    original = (
      np.frombuffer(base64.b64decode(packet["lines"]["positions"]), "<u2").reshape(
        -1, 2, 3
      )
      / 100
      + packet["origin"]
    )
    for row in entry["rows"]:
      crescent = Polygon(row["points"])
      assert crescent.is_valid and crescent.area > 0.01
      assert bare.buffer(0.012).covers(crescent)
      assert road.intersection(crescent).area <= 0.02
      assert not forbidden.intersects(crescent.buffer(0.02))
      assert not protected.intersects(crescent.buffer(0.02))
      chord = LineString([row["a"], row["b"]])
      assert chord.difference(road.buffer(0.012)).length <= 0.001
      assert np.allclose(original[row["index"]][:, 1], 3.13, atol=1e-8)
      assert all(
        math.dist(original[row["index"]][i, [0, 2]], row[k]) < 1e-8
        for i, k in enumerate(("a", "b"))
      )


def test_navigation_rendered_crescents_and_replacement_ink_have_identical_edges():
  _, evidence, output = payloads()
  count = 0
  for entry in evidence["emitted"]:
    plan = output["chunks"][entry["id"]]
    ox, oy, oz = plan["origin"]
    points = (
      np.frombuffer(base64.b64decode(plan["mesh"]["positions"]), "<u2").reshape(-1, 3)
      / 100
      + plan["origin"]
    )
    faces = np.frombuffer(base64.b64decode(plan["mesh"]["indices"]), "<u4").reshape(
      -1, 3
    )
    polygons = [Polygon(points[ids][:, [0, 2]]) for ids in faces]
    actual = unary_union(polygons)
    expected = unary_union([Polygon(r["points"]) for r in entry["rows"]])
    navigation = unary_union(
      [translate(Polygon(p["ring"], p["holes"]), ox, oz) for p in plan["roads"]]
    )
    assert actual.symmetric_difference(expected).area < 1e-7
    assert navigation.symmetric_difference(expected).area < 1e-7
    assert np.allclose(points[:, 1], 3.09, atol=1e-8)
    ink = (
      np.frombuffer(base64.b64decode(plan["lines"]["positions"]), "<u2").reshape(
        -1, 2, 3
      )
      / 100
      + plan["origin"]
    )
    assert np.allclose(ink[:, :, 1], 3.13, atol=1e-8)
    wanted = [
      (a, b) for row in entry["rows"] for a, b in zip(row["points"], row["points"][1:])
    ]
    assert np.allclose(ink[:, :, [0, 2]], wanted, atol=1e-8)
    assert plan["segments"] == [r["index"] for r in entry["rows"]]
    count += len(entry["rows"])
  assert count == 764


def test_native_has_no_new_occupied_cells_and_limits_are_unchanged():
  _, evidence, output = payloads()
  assert evidence["counts"]["nativeCellTransition"] == 145
  assert evidence["counts"]["protectedNeighbour"] == 636
  for entry in evidence["emitted"]:
    plan = output["chunks"][entry["id"]]
    for row in entry["rows"]:
      assert build.native_polygon(Polygon(row["points"])).is_empty
    packet = build.city.read(
      build.OUT / evidence["assets"][entry["id"]]["drawn"]["url"]
    )
    all_meshes = packet["meshes"] + [plan["mesh"]]
    assert len(all_meshes) <= 16
    assert sum(len(base64.b64decode(m["positions"])) // 6 for m in all_meshes) <= 400000
    assert sum(len(base64.b64decode(m["indices"])) // 4 for m in all_meshes) <= 2400000
    assert len(plan["segments"]) <= 96
  assert evidence["counts"]["packets"] == 210
  assert evidence["districts"]["11000001"] == 72
  assert evidence["districts"]["11000002"] == 162
  assert evidence["districts"]["11000004"] == 174
  assert evidence["districts"]["11000006"] == 25
