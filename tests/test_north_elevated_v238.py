"""Source continuity, exact station retirement and free elevated undercroft."""

import base64
import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from scripts import build_north_elevated_v238 as subject  # noqa:E402
from scripts.build_roof_house_v233 import fingerprint, match_owner  # noqa:E402


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def sha(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(mesh, origin):
  xyz = (
    np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
    + origin
  )
  triangles = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return xyz, triangles


def test_original_courses_dgm_and_northward_ramp_are_preserved():
  source = read(subject.SOURCE)
  assert sha(subject.SOURCE) == read(subject.EVIDENCE)["sourceSha256"]
  assert sha(ROOT / source["sourceCache"]) == source["sourceCacheSha256"]
  assert sha(ROOT / source["dgm"]["path"]) == source["dgm"]["sha256"]
  features = {int(f["id"].split("/")[1]): f for f in source["features"]}
  assert set(features) == set(
    subject.RAIL_IDS + subject.STAIR_IDS + [380981354, 499263882]
  )
  for ids in (
    [388432539, 438860773, 380981358, 380981362, 375386236],
    [388432543, 438860774, 380981360, 380981363, 24180220],
  ):
    for a, b in zip(ids, ids[1:]):
      assert (
        shape(features[a]["geometry"]).distance(shape(features[b]["geometry"])) < 1e-7
      )
    portal = shape(features[ids[1]]["geometry"])
    assert -2165 < portal.bounds[1] < -2163
    assert -2075 < portal.bounds[3] < -2073
  assert features[388432539]["tags"]["tunnel"] == "yes"
  assert "bridge" not in features[438860773]["tags"]
  assert features[380981358]["tags"]["bridge"] == "viaduct"
  assert features[380981354]["tags"]["railway"] == "platform"
  assert (
    shape(features[375386236]["geometry"]).bounds[1] < -3200
  )  # Complete uncut source.
  assert (
    source["terrainSamples"][0]["streetNHN"] - source["terrainSamples"][-1]["streetNHN"]
    > 2.5
  )
  assert (
    "display estimate" in source["policy"]
    and "not surveyed railway height" in source["policy"]
  )
  assert any("Mehr6.pdf" in p["url"] for p in source["primarySources"])


def test_exact_atomic_owner_triangle_line_and_navigation_receipts():
  source = read(subject.SOURCE)
  runtime = read(subject.RUNTIME)
  assert runtime["keys"] == ["drawn:5_-5", "minecraft:5_-5"]
  assert sha(subject.RUNTIME) == read(subject.EVIDENCE)["runtimeSha256"]
  for family in ("drawn", "minecraft"):
    old = source["originalPackets"][family]
    path = ROOT / old["path"]
    assert sha(path) == old["sha256"]
    packet = read(path)
    r = runtime["packets"][family + ":5_-5"]
    assert r["origin"] == packet["origin"]
    assert {
      record["mesh"]: record["triangles"] for record in r["records"]
    } == match_owner(packet, subject.OWNER)
    for record in r["records"]:
      p = packet["meshes"][record["mesh"]]
      assert record["fingerprint"] == fingerprint(
        [p[k] for k in ("positions", "colors", "indices")]
      )
    assert [n["original"] for n in r["navigationRecords"]] == old["owners"]
    assert all(
      n["owner"] == subject.OWNER and n["groundY"] == 3 for n in r["navigationRecords"]
    )
    assert r["replacement"]["kind"] == "elevated-station-v238"
    assert len(r["segments"]) == (12 if family == "drawn" else 0)
    # Under the mapped platform is genuinely open; a ground walker is not blocked.
    for x, z in [(2819, -2470), (2822, -2500), (2824, -2540)]:
      assert not any(
        s["minY"] <= 4.6 <= s["maxY"]
        and Polygon(s["ring"], s["holes"]).covers(Point(x - 2560, z + 2560))
        for s in r["navigationSolids"]
      )
    assert any(s["minY"] > 12 and s["maxY"] > 14 for s in r["navigationSolids"])
    ground_piers = [s for s in r["navigationSolids"] if s["minY"] == 3]
    assert sum(Polygon(s["ring"]).area for s in ground_piers) < 15


def test_packets_native_axes_bounds_budgets_and_north_platform_walk_surface():
  addition = read(subject.ADDITION)
  runtime = read(subject.RUNTIME)
  evidence = read(subject.EVIDENCE)
  assert [p["id"] for p in addition["chunks"]] == [
    "northrail238-5_-6",
    "northrail238-5_-5",
  ]
  assert addition["footprint"] == []
  packets = []
  for tile in addition["chunks"]:
    for family in ("drawn", "minecraft"):
      descriptor = tile[family]
      path = subject.OUT / descriptor["url"]
      payload = read(path)
      assert (
        sha(path) == descriptor["sha256"] and path.stat().st_size == descriptor["bytes"]
      )
      assert (
        len(gzip.decompress(path.read_bytes()))
        == descriptor["decodedBytes"]
        < 12 * 1024**2
      )
      assert all(
        payload["nav"][k] == [] for k in ("ground", "water", "roads", "bridges")
      )
      if tile["id"].endswith("-6"):
        floors = payload["nav"]["buildings"]
        assert len(floors) == 1
        assert floors[0]["minHeight"] == 6.12 and floors[0]["height"] == 6.55
        assert Polygon(floors[0]["ring"]).covers(Point(2826 - 2560, -2566 + 3072))
      else:
        assert payload["nav"]["buildings"] == []
      packets.append(
        (
          family,
          payload["meshes"][0],
          payload["origin"],
          tile["bounds"],
          family + ":" + tile["id"],
        )
      )
  for key, r in runtime["packets"].items():
    packets.append(
      (
        key.split(":")[0],
        r["replacement"],
        r["origin"],
        list(subject.TILE.bounds),
        key.split(":")[0] + ":station",
      )
    )
  for family, mesh, origin, bounds, key in packets:
    xyz, tris = decode(mesh, origin)
    assert (
      np.isfinite(xyz).all() and tris.max() < len(xyz) < 400000 and tris.size < 2400000
    )
    assert xyz[:, 0].min() >= bounds[0] - 0.01 and xyz[:, 0].max() <= bounds[2] + 0.01
    assert xyz[:, 2].min() >= bounds[1] - 0.01 and xyz[:, 2].max() <= bounds[3] + 0.01
    if family == "minecraft":
      t = xyz[tris]
      normals = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
      assert ((np.abs(normals) > 1e-7).sum(axis=1) <= 1).all()
    assert evidence["packets"][key]["geometryBytes"] == len(xyz) * 12 + tris.size * (
      2 if len(xyz) < 65536 else 4
    )


def test_replay_is_byte_identical_and_all_authored_roles_remain():
  paths = [
    subject.RUNTIME,
    subject.EVIDENCE,
    subject.ADDITION,
    *subject.OUT.glob("northrail238-*json.gz"),
  ]
  before = {p: sha(p) for p in paths}
  result = subject.build()
  assert {p: sha(p) for p in paths} == before
  for family in ("drawn", "minecraft"):
    roles = result["audit"][family]["stationRoles"]
    assert {
      "mapped platform",
      "source-bound hall roof",
      "arched hall frame",
      "sandstone hall pier",
      "hall glazing",
      "station cross bearing",
      "rooflight edge frame",
    } <= roles.keys()
    assert all("mapped staircase " + str(i) in roles for i in subject.STAIR_IDS)
