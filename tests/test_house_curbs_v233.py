"""Independent source-course, obstacle and native-geometry checks for v233."""

import base64

import numpy as np
import shapely
from shapely.affinity import translate
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

from scripts import build_house_curbs_v233 as build


def decode(part: dict, origin: list) -> tuple:
  p = (
    np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3) / 100
    + origin
  )
  i = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
  return p, i


def test_positive_sources_and_retained_input_identity() -> None:
  source = build.base.read_json(build.SOURCE)
  evidence = build.base.read_json(build.EVIDENCE)
  assert evidence["originalGeometryRetained"] and evidence["extraManifestEntries"] == 0
  assert evidence["sourceSha256"] == build.base.digest(build.SOURCE)
  assert evidence["outputSha256"] == build.base.digest(build.OUTPUT)
  southwest = unary_union(
    [
      build.world(shape(f["geometry"]))
      for f in build.base.read_json(build.SCOPE)["features"]
      if str(f["properties"]["sch"]).startswith("11000006")
    ]
  )
  for f in source["features"]:
    if f.get("presentation") == "mapped-flat-edge":
      assert build.eligible_flat(f["tags"], shape(f["geometry"]).length)
      assert f["height"] == 0 and not f["heightEstimated"]
      assert southwest.covers(shape(f["geometry"]))
    else:
      assert build.eligible(f["tags"], shape(f["geometry"]).length)
    assert f["tags"].get("kerb") not in ("flush", "lowered", "rolled")
    if f["heightEstimated"]:
      assert f["height"] == 0.12
  for filename, digest in source["inputs"].items():
    path = build.ROOT / filename
    # Optional original extraction caches are not fresh-clone dependencies.
    if path.exists():
      assert build.base.digest(path) == digest
  for receipt in evidence["packets"].values():
    assert build.base.digest(build.ROOT / receipt["url"]) == receipt["sha256"]


def test_every_new_course_stays_on_its_source_away_from_prior_curbs_and_access() -> (
  None
):
  source = build.base.read_json(build.SOURCE)
  evidence = build.base.read_json(build.EVIDENCE)
  original = {f["key"]: shape(f["geometry"]) for f in source["features"]}
  excluded = unary_union([shape(source[k]) for k in ("previous", "blocked", "access")])
  assert evidence["courses"]
  for c in evidence["courses"]:
    course = shape(c["geometry"])
    assert course.difference(original[c["key"]].buffer(1e-7)).length < 1e-6
    assert not excluded.intersects(course.buffer(0.11))
    assert shape(source["scope"]).covers(course.buffer(0.11))


def test_packed_native_is_orthogonal_and_all_additions_stay_on_flat_delivered_ground() -> (
  None
):
  source = build.base.read_json(build.SOURCE)
  evidence = build.base.read_json(build.EVIDENCE)
  payload = build.base.read_json(build.OUTPUT)
  excluded = unary_union([shape(source[k]) for k in ("previous", "blocked", "access")])
  total = 0
  for key, plan in payload["packets"].items():
    positions, indices = decode(plan["mesh"], plan["origin"])
    old = build.base.read_json(build.ROOT / evidence["packets"][key]["url"])
    assert plan["guard"] == build.ground_guard(old["nav"]["ground"])
    flat = build.flat_ground(old).buffer(0.015)
    top = []
    for tri in positions[indices]:
      normal = np.cross(tri[1] - tri[0], tri[2] - tri[0])
      if key.startswith("minecraft:"):
        assert np.count_nonzero(np.abs(normal) > 1e-8) <= 1
      if np.ptp(tri[:, 1]) < 0.001:
        p = Polygon(tri[:, [0, 2]])
        if p.area > 1e-8:
          assert normal[1] > 0
          top.append(p)
    footprint = unary_union(top)
    assert flat.covers(footprint)
    assert not excluded.intersects(footprint)
    assert shape(source["scope"]).buffer(0.015).covers(footprint)
    assert len(positions) <= 8192
    total += len(positions)
  assert 0 < total < 60_000
  assert len(payload["packets"]) < 90
  assert build.OUTPUT.stat().st_size < 1_600_000


def test_flat_edge_additions_follow_existing_surface_without_invented_step() -> None:
  evidence = build.base.read_json(build.EVIDENCE)
  payload = build.base.read_json(build.OUTPUT)
  entries = {
    r["id"]: r for r in build.base.read_json(build.OUT / "manifest.json")["chunks"]
  }
  checked = 0
  for key, receipt in evidence["packets"].items():
    if "flatFaceStart" not in receipt:
      continue
    assert not entries[key.split(":", 1)[1]].get("detailCompanionOf")
    plan = payload["packets"][key]
    positions, indices = decode(plan["mesh"], plan["origin"])
    old = build.base.read_json(build.ROOT / receipt["url"])
    ox, _, oz = old["origin"]
    ground = unary_union(
      [translate(Polygon(p["ring"], p["holes"]), ox, oz) for p in old["nav"]["ground"]]
    )
    levels = {
      y: level.buffer(0.015) for y, level in build.flat_levels(old, ground).items()
    }
    for level in levels.values():
      shapely.prepare(level)
    for tri in positions[indices[receipt["flatFaceStart"] :]]:
      assert np.ptp(tri[:, 1]) < 0.001
      y = round(float(tri[0, 1]) - 0.01, 2)
      assert y in levels
      assert levels[y].covers(Polygon(tri[:, [0, 2]]))
      checked += 1
  assert checked > 0
