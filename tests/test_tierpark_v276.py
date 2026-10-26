"""Independent enclosure identity, complete retention and real mesh checks."""

import base64
from collections import Counter

import numpy as np
import pyogrio
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import unary_union

from scripts import build_tierpark_v276 as build


def decoded(plan):
  mesh = plan["mesh"]
  p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  i = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return p / 100 + plan["origin"], i


def test_exact_enclosures_not_sculptures_and_all_previous_sources_retained():
  source, evidence, output = (
    build.city.read(p) for p in (build.SOURCE, build.EVIDENCE, build.OUTPUT)
  )
  features = {r["id"]: r for r in source["features"]}
  assert features["way/336032294"]["tags"]["species"] == "Bison bison athabascae"
  assert features["relation/15095452"]["tags"]["species"] == "Camelus bactrianus"
  assert features["relation/15095451"]["tags"]["species"] == "Camelus dromedarius"
  assert features["way/1500282455"]["tags"]["natural"] == "water"
  assert not {"node/4381117835", "node/6745562880"}.intersection(features)
  assert source["currentAviaryFacts"]["flamingoAreaM2"] == 1800
  assert shape(features["way/1500282455"]["geometry"]).area < 1600
  assert "not the complete" in source["flamingoBoundaryLimit"]
  assert evidence["sourceSha256"] == build.city.curbs.base.digest(build.SOURCE)
  for path, digest in evidence["retained"].items():
    assert build.city.curbs.base.digest(build.ROOT / path) == digest, path
  assert output["ids"] == sorted(output["packets"])
  assert len(output["ids"]) == 6
  assert build.OUTPUT.stat().st_size < 1_100_000


def test_complete_selected_rings_and_tags_replay_the_independent_retained_gpkg():
  source = build.city.read(build.SOURCE)
  raw = build.GEO / "raw/east-v187/candidate.gpkg"
  assert build.city.curbs.base.digest(raw) == source["rawSha256"]
  expected = {r["id"]: r for r in source["features"]}
  found = set()
  for _, row in (
    pyogrio.read_dataframe(raw, layer="multipolygons").to_crs(25833).iterrows()
  ):
    tags = build.tags_for(row)
    ident = (
      "way/" + tags["osm_way_id"]
      if tags.get("osm_way_id")
      else "relation/" + tags["osm_id"]
    )
    if ident in expected:
      found.add(ident)
      assert tags == expected[ident]["tags"]
      assert build.world(row.geometry).equals_exact(
        shape(expected[ident]["geometry"]), 1e-8
      )
  assert found == set(expected)


def test_regeneration_is_deterministic_without_changing_any_global_artifact(
  tmp_path, monkeypatch
):
  runtime, evidence = build.OUTPUT.read_bytes(), build.city.read(build.EVIDENCE)
  monkeypatch.setattr(build, "OUTPUT", tmp_path / "runtime.json")
  monkeypatch.setattr(build, "EVIDENCE", tmp_path / "evidence.json.gz")
  build.build()
  assert build.OUTPUT.read_bytes() == runtime
  assert build.city.read(build.EVIDENCE) == evidence


def test_every_actual_animal_vertex_is_in_its_own_clear_source_enclosure():
  source, evidence, output = (
    build.city.read(p) for p in (build.SOURCE, build.EVIDENCE, build.OUTPUT)
  )
  features = {r["id"]: shape(r["geometry"]) for r in source["features"]}
  paths, buildings, water = (shape(source[k]) for k in ("paths", "buildings", "water"))
  seen = Counter()
  positions = {}
  for row in evidence["records"]:
    family, ident = row["key"].split(":")
    packet = build.city.read(build.OUT / f"{ident}.{family}.json.gz")
    ox, _, oz = packet["origin"]
    old_bodies = unary_union(
      [
        translate(Polygon(b["ring"], b["holes"]), ox, oz)
        for b in packet["nav"]["buildings"]
      ]
    )
    vertices, indices = decoded(output["packets"][row["key"]])
    for r in row["records"]:
      if r["kind"] != "animal":
        continue
      seen[family + ":" + r["species"]] += 1
      g = shape(r["footprint"])
      assert features[r["sourceId"]].covers(g)
      assert g.intersection(paths).area < 1e-8
      assert g.intersection(buildings).area < 1e-8
      assert g.intersection(old_bodies).area < 1e-8
      if r["species"] != "flamingo":
        assert g.intersection(water).area < 1e-8
      else:
        assert water.covers(g)
      start, end = r["triangleRange"]
      actual = vertices[indices[start:end]].reshape(-1, 3)
      assert len(actual) > 100
      assert actual[:, 1].min() >= 2.99
      assert actual[:, 1].max() <= 5.9
      assert all(g.buffer(0.011).covers(Point(p[0], p[2])) for p in actual)
      key = (r["sourceId"], *r["point"])
      positions.setdefault(family, set()).add(key)
  assert positions["drawn"] == positions["minecraft"]
  assert seen == Counter(
    {
      f + ":" + s: n
      for f in ("drawn", "minecraft")
      for s, n in (
        ("wood-bison", 7),
        ("bactrian-camel", 6),
        ("dromedary", 6),
        ("flamingo", 28),
      )
    }
  )


def test_restaurant_details_use_real_exterior_walls_and_source_terrace():
  source, evidence = (build.city.read(p) for p in (build.SOURCE, build.EVIDENCE))
  features = {r["id"]: shape(r["geometry"]) for r in source["features"]}
  seen = Counter()
  for row in evidence["records"]:
    native = row["key"].startswith("minecraft:")
    for r in row["records"]:
      if r["kind"] == "restaurant-facade":
        line = LineString(r["edge"])
        assert line.distance(features[r["sourceId"]].boundary) < (
          2.11 if native else 0.06
        )
        if native:
          a, b = r["edge"]
          assert a[0] == b[0] or a[1] == b[1]
        seen[(native, r["sourceId"])] += 1
      elif r["kind"] == "terrace-table":
        assert features[r["sourceId"]].covers(shape(r["footprint"]))
      elif r["kind"] == "aviary-rail":
        assert (
          features[r["sourceId"]].boundary.buffer(0.01).covers(LineString(r["edge"]))
        )
        assert r["height"] == 9
  assert all(
    seen[(native, ident)] > 3 for native in (False, True) for ident in build.BUILDINGS
  )


def test_finite_native_orthogonal_and_full_combined_packet_budgets():
  output, previous = (build.city.read(p) for p in (build.OUTPUT, build.previous.OUTPUT))
  for key, plan in output["packets"].items():
    family, ident = key.split(":")
    packet = build.city.read(build.OUT / f"{ident}.{family}.json.gz")
    assert plan["meshGuard"] == build.mesh_guard(packet["meshes"])
    assert plan["guard"] == build.city.curbs.ground_guard(packet["nav"]["ground"])
    p, i = decoded(plan)
    assert np.isfinite(p).all() and i.max() < len(p)
    assert p[:, 1].min() >= 2.99 and p[:, 1].max() <= 12.07
    if family == "minecraft":
      tris = p[i]
      assert np.any(np.ptp(tris, axis=1) < 1e-7, axis=1).all()
    meshes = [*packet["meshes"], plan["mesh"]]
    if key in previous["packets"]:
      meshes.append(previous["packets"][key]["mesh"])
    assert len(meshes) <= 16
    assert sum(len(base64.b64decode(m["positions"])) // 6 for m in meshes) < 400_000
    for b in plan["solids"]:
      assert 0 <= b["minHeight"] < b["height"] <= 9
      assert Polygon(b["ring"]).area < 2
