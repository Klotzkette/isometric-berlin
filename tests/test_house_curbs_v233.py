"""Independent source-course, obstacle and native-geometry checks for v233."""

import base64

import numpy as np
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
  for f in source["features"]:
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
    total += len(positions)
  assert 0 < total < 30_000
  assert len(payload["packets"]) < 90
  assert build.OUTPUT.stat().st_size < 600_000
