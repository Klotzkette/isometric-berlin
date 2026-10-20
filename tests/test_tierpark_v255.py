"""Independent Tierpark scope, source retention, terrain and native checks."""

import base64
from collections import Counter

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Point, Polygon, shape
from shapely.ops import unary_union

from scripts import build_tierpark_v255 as build


def test_exact_sources_packets_and_previous_east_geometry_remain_intact():
  source, evidence, output = (
    build.city.read(p) for p in (build.SOURCE, build.EVIDENCE, build.OUTPUT)
  )
  assert evidence["sourceSha256"] == build.city.curbs.base.digest(build.SOURCE)
  assert len(output["ids"]) == 10
  assert output["ids"] == sorted(output["packets"])
  assert {r["osmId"] for r in source["owners"]} == {
    "way/11269749",
    "way/11269594",
    "way/11643292",
  }
  assert len(source["panes"]) == 160
  assert len(source["gardens"]) == 16
  assert build.OUTPUT.stat().st_size < 700_000
  assert {
    (row["family"], row["id"], tuple(row["conflictingOwners"]))
    for row in evidence["deferredPlayAnchors"]
  } == {
    (family, "node/11804233493", ("DEBE11YYI0002EnN",))
    for family in ("drawn", "minecraft")
  }
  for path, digest in evidence["retained"].items():
    assert build.city.curbs.base.digest(build.ROOT / path) == digest
  for key, plan in output["packets"].items():
    family, ident = key.split(":")
    packet = build.city.read(build.OUT / f"{ident}.{family}.json.gz")
    assert plan["origin"] == packet["origin"]
    assert plan["guard"] == build.city.curbs.ground_guard(packet["nav"]["ground"])
    assert len(packet["meshes"]) + 1 <= 16
    assert (
      sum(
        len(base64.b64decode(m["positions"])) // 6
        for m in [*packet["meshes"], plan["mesh"]]
      )
      < 400_000
    )


def test_gardens_and_play_are_exactly_bounded_clear_of_water_paths_and_enclosures():
  source, evidence = (build.city.read(p) for p in (build.SOURCE, build.EVIDENCE))
  gardens = {r["id"]: shape(r["geometry"]) for r in source["gardens"]}
  plays = {r["id"]: r for r in source["plays"]}
  blocked, zoo = shape(source["forbidden"]), shape(source["zoo"])
  seen = Counter()
  for packet in evidence["records"]:
    family, ident = packet["key"].split(":")
    old = build.city.read(build.OUT / f"{ident}.{family}.json.gz")
    ox, _, oz = old["origin"]
    ground = unary_union(
      [translate(Polygon(r["ring"], r["holes"]), ox, oz) for r in old["nav"]["ground"]]
    )
    buildings = unary_union(
      [
        translate(Polygon(row["ring"], row["holes"]), ox, oz)
        for row in old["nav"]["buildings"]
      ]
    )
    for r in packet["records"]:
      seen[family + ":" + r["kind"]] += 1
      if r["kind"] == "window":
        continue
      g = shape(r["geometry"])
      assert zoo.buffer(0.01).covers(g)
      assert ground.buffer(1e-7).covers(g)
      assert g.intersection(blocked).area < 1e-7
      assert g.intersection(buildings).area < 1e-7
      if r["kind"] == "garden":
        assert gardens[r["id"]].buffer(1e-7).covers(g)
        assert g.buffer(1e-7).covers(shape(r["inner"]))
      else:
        assert r["type"] == plays[r["id"]]["tags"]["playground"]
        assert g.distance(Point(plays[r["id"]]["point"])) < 0.01
  assert seen["drawn:window"] == seen["minecraft:window"] == 160
  assert seen["drawn:play"] == seen["minecraft:play"] == 4
  assert seen["drawn:garden"] >= 16


def test_all_native_triangles_are_orthogonal_and_ground_is_not_lifted():
  output = build.city.read(build.OUTPUT)
  for key, plan in output["packets"].items():
    mesh = plan["mesh"]
    p = (
      np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
      + plan["origin"]
    )
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    assert len(p) and indices.max() < len(p)
    assert np.isfinite(p).all()
    assert p[:, 1].min() >= 3
    assert p[:, 1].max() < 20
    if key.startswith("minecraft:"):
      for tri in p[indices]:
        assert any(np.ptp(tri[:, axis]) < 1e-7 for axis in range(3))
    for solid in plan["solids"]:
      assert 0 <= solid["minHeight"] < solid["height"] <= 3
      assert Polygon(solid["ring"]).area < 0.5
