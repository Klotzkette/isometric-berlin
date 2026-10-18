"""Verify source-positive paint and unchanged retained City West street owners."""

import base64

import numpy as np
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

from scripts import build_citywest_streets_v235 as build


def test_complete_named_roads_and_original_packets_are_retained() -> None:
  source = build.base.read_json(build.SOURCE)
  evidence = build.base.read_json(build.EVIDENCE)
  expected = [
    r
    for r in build.base.read_json(build.GEO / "west-streets-v163.json")["roads"]
    if r["name"] == "Kurfürstendamm"
  ]
  expected += build.base.read_json(build.GEO / "tauentzien-v165.json")["roads"]
  assert source["completeNamedRoads"] == expected
  assert evidence["extraManifestEntries"] == 0 and evidence["originalGeometryRetained"]
  assert evidence["sourceSha256"] == build.base.digest(build.SOURCE)
  assert evidence["outputSha256"] == build.base.digest(build.OUTPUT)
  for filename, digest in source["inputs"].items():
    path = build.ROOT / filename
    if path.exists():
      assert build.base.digest(path) == digest
  for record in evidence["packets"].values():
    assert build.base.digest(build.ROOT / record["url"]) == record["sha256"]


def test_only_explicit_marking_styles_no_inferred_zebras_or_signals() -> None:
  source = build.base.read_json(build.SOURCE)
  evidence = build.base.read_json(build.EVIDENCE)
  features = {f["key"]: f for f in source["features"]}
  assert len(evidence["paintOwners"]) > 0
  for owner in evidence["paintOwners"]:
    tags = features[owner["key"]]["tags"]
    if owner["kind"] == "restriction":
      assert tags["road_marking"] == "restriction" and tags["pattern"] == "stripes"
      assert shape(features[owner["key"]]["geometry"]).is_ring
    else:
      assert owner["kind"] == build.transport.crossing_style(tags)
      assert owner["kind"] in {"dashes", "zebra", "lines"}
    assert owner["count"] > 0
  assert evidence["paintCounts"]["signals"] == 0
  assert evidence["paintCounts"]["supersededFalseLaneAxes"] == 0


def test_all_new_triangles_stay_on_old_asphalt_clear_of_old_paint() -> None:
  data = build.base.read_json(build.OUTPUT)
  evidence = build.base.read_json(build.EVIDENCE)
  drawn, native, previous = build.supports()
  assert set(data["ids"]) == set(data["packets"])
  assert len(data["ids"]) <= 4 and build.OUTPUT.stat().st_size < 30_000
  for key, plan in data["packets"].items():
    packet = build.base.read_json(build.ROOT / evidence["packets"][key]["url"])
    assert plan["guard"] == build.curbs.ground_guard(packet["nav"]["ground"])
    assert plan["groundY"] == packet["nav"]["groundY"]
    mesh = plan["mesh"]
    vertices = (
      np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
      + plan["origin"]
    )
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    is_native = key.startswith("minecraft:")
    assert np.allclose(vertices[:, 1], 5.61 if is_native else 5.55)
    if is_native:
      assert np.allclose(vertices[:, [0, 2]] * 4, np.round(vertices[:, [0, 2]] * 4))
    polygons = []
    for triangle in vertices[indices]:
      normal = np.cross(triangle[1] - triangle[0], triangle[2] - triangle[0])
      assert normal[1] >= -1e-8
      polygon = Polygon(triangle[:, [0, 2]])
      if polygon.area > 1e-8:
        polygons.append(polygon)
    footprint = unary_union(polygons)
    assert (native if is_native else drawn).buffer(0.008).covers(footprint)
    assert footprint.intersection(previous).area < 1e-6
    assert len(vertices) < 1000 and len(packet["meshes"]) + 1 <= 16
    receipt = next(r for r in evidence["coverage"] if r["key"] == key)
    assert footprint.symmetric_difference(shape(receipt["geometry"])).area < 1.0
