"""Lossless initial regional outlines, complete motorway topology and finite scope."""

import base64
import gzip
import hashlib
import json
import struct
from collections import Counter
from pathlib import Path

import pytest
from pyproj import Transformer
from shapely import make_valid
from shapely.geometry import Point, Polygon, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform


def world(x, y):
  e, n = PROJECT(x, y)
  return e - 389500, 5820000 - n


@pytest.fixture(scope="module")
def source():
  return json.loads(
    gzip.decompress((GEO / "region-outlines-v200-source.json.gz").read_bytes())
  )


def read(name):
  return json.loads((DATA / name).read_bytes())


def poly(row):
  return make_valid(Polygon(row["ring"], row["holes"]))


def coordinates(g):
  if g.geom_type == "Polygon":
    return [p for ring in [g.exterior, *g.interiors] for p in ring.coords]
  if hasattr(g, "geoms"):
    return [p for part in g.geoms for p in coordinates(part)]
  return list(g.coords)


def test_a10_is_two_complete_source_connected_directed_rings(source):
  ways = [f for f in source["features"] if f["site"] == "A10"]
  assert len(ways) == 1001
  assert all(f["tags"]["ref"] == "A 10" and f["tags"]["oneway"] == "yes" for f in ways)
  assert set(Counter(f["nodes"][0] for f in ways).values()) == {1}
  assert set(Counter(f["nodes"][-1] for f in ways).values()) == {1}
  onward = {f["nodes"][0]: f["nodes"][-1] for f in ways}
  assert set(onward) == set(onward.values())
  remaining = set(onward)
  sizes = []
  while remaining:
    start = node = next(iter(remaining))
    count = 0
    while node in remaining:
      remaining.remove(node)
      count += 1
      node = onward[node]
    assert node == start
    sizes.append(count)
  assert sorted(sizes) == [497, 504]
  ids = {int(f["id"].split("/")[1]) for f in ways}
  members = {
    m["ref"] for r in source["a10Relations"] for m in r["members"] if m["type"] == "way"
  }
  assert ids == members | set(source["a10EndpointRecoveredWays"])
  assert source["a10EndpointRecoveredWays"] == [
    259531987,
    1010526736,
    1010910778,
    1010910780,
    1152641131,
    1505010875,
    1505010876,
    1505010877,
  ]
  length = sum(transform(world, shape(f["geometry"])).length for f in ways)
  assert 389000 < length < 391000


@pytest.mark.parametrize("native", [False, True])
def test_every_source_vertex_survives_in_small_independent_outline_buffers(
  source, native
):
  file = DATA / (
    "regionOutlinesV200Native.json" if native else "regionOutlinesV200.json"
  )
  payload = json.loads(file.read_bytes())
  originals = {f["id"]: f for f in source["features"]}
  seen = set()
  buffer_bytes = 0
  assert len(payload["groups"]) == 14
  assert file.stat().st_size < 5 * 1024 * 1024
  for group in payload["groups"]:
    raw = base64.b64decode(group["positionsCm"])
    packed = struct.unpack("<" + "i" * (len(raw) // 4), raw)
    colors = base64.b64decode(group["colorsU8"])
    assert len(colors) == len(packed) and len(packed) % 6 == 0
    buffer_bytes += len(raw) + len(colors)
    covered = 0
    for feature in group["features"]:
      assert feature["firstVertex"] == covered
      covered += feature["vertexCount"]
      assert feature["id"] not in seen
      seen.add(feature["id"])
      row = originals[feature["id"]]
      first = feature["firstVertex"] * 3
      values = packed[first : first + feature["vertexCount"] * 3]
      actual = {(values[i], values[i + 2]) for i in range(0, len(values), 3)}
      original = transform(world, shape(row["geometry"]))
      expected = {(round(x * 100), round(z * 100)) for x, z in coordinates(original)}
      assert expected <= actual, feature["id"]
      if native and row["kind"] == "building":
        assert all(
          values[i] == values[i + 3] or values[i + 2] == values[i + 5]
          for i in range(0, len(values), 6)
        )
      if row["kind"] == "building" and "height" in row["tags"]:
        assert feature["height"] == float(row["tags"]["height"])
        assert feature["heightSource"] == "OSM height"
    assert covered * 3 == len(packed)
  assert seen == set(originals)
  assert buffer_bytes < 2_600_000


def test_airport_identity_current_runways_village_lake_holes_and_collision_heights(
  source,
):
  features = {f["id"]: f for f in source["features"]}
  assert features["way/4645618"]["tags"]["name"] == "RWY 06L / 24R"
  assert features["way/95201688"]["tags"]["name"] == "RWY 06R / 24L"
  assert {"way/859790021", "way/700218390", "way/1132137322"} <= set(
    source["sites"]["BER"]["ids"]
  )
  assert shape(source["sites"]["Grünheide"]["geometry"]).area < 0.001
  nav = read("regionOutlinesV200Navigation.json")["tiles"]
  buildings = [b for t in nav for b in t["nav"]["buildings"]]
  for owner, height in [
    ("way/1132137322", 32),
    ("way/700218390", 15),
    ("way/69121319", 70),
  ]:
    rows = [b for b in buildings if b["sourceId"] == owner]
    assert rows and all(b["height"] == height and b["minHeight"] == 0 for b in rows)
  werl = transform(world, shape(features["relation/79250"]["geometry"]))
  assert len(werl.interiors) > 0
  water = unary_union([poly(w) for t in nav for w in t["nav"]["water"]])
  assert water.covers(werl.representative_point())
  for ring in werl.interiors:
    assert not water.covers(Polygon(ring).representative_point())


def test_scope_is_finite_corridor_and_sites_not_ring_interior_and_receipt_matches():
  data = read("regionalScopeV200.json")
  scope = unary_union([poly(p) for p in data["footprint"]])
  assert data["groundY"] == 3 and len(data["footprint"]) < 150
  assert 26e6 < scope.area < 28e6
  assert not scope.covers(Point(0, 0))
  assert not scope.covers(Point(-15000, 10000))
  assert scope.covers(Point(8938.88, 17436.53))
  assert scope.covers(Point(29904.92, 11485.49))
  for x, z in [
    (-38392.96, 19385.71),
    (29048.15, 8831.16),
    (-23126.62, -22051.58),
    (-31414.79, 24619.24),
  ]:
    assert scope.covers(Point(x, z))
  evidence = json.loads((GEO / "region-outlines-v200-evidence.json").read_bytes())
  assert (
    evidence["sourceSha256"]
    == hashlib.sha256(
      (GEO / "region-outlines-v200-source.json.gz").read_bytes()
    ).hexdigest()
  )
  assert evidence["scopeAreaM2"] == pytest.approx(scope.area, abs=scope.length * 0.0071)
