"""Independent scope, terrain, source retention and native-geometry contracts."""

import base64
from collections import Counter

import numpy as np
import shapely
from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import transform, unary_union

from scripts import build_playgrounds_v255 as build
from scripts.integrate_height_reconstruction_v259 import predecessor_manifest_v259


def inputs():
  return build.read_json(build.SOURCE), build.read_json(build.EVIDENCE)


def test_playgrounds_are_exact_ranked_twenty_and_named_exceptions():
  source, evidence = inputs()
  sites = source["sites"]
  assert len(sites) == len({s["id"] for s in sites}) == 27
  assert sorted(s["rank"] for s in sites if s["rank"] is not None) == list(range(1, 21))
  assert sum(s["rank"] is None for s in sites) == 7
  assert sum("Bellevue:" in s["name"] for s in sites) == 2
  assert evidence["officialSha256"] == build.digest(build.OFFICIAL)
  assert source["namedSha256"] == build.digest(build.NAMED_SOURCE)
  assert evidence["sourceSha256"] == build.digest(build.SOURCE)
  for receipt in evidence["preserved"]:
    assert build.digest(build.ROOT / receipt["path"]) == receipt["sha256"]
  if build.PBF.exists():
    assert build.digest(build.PBF) == source["osmSha256"]
  # Later v259/v261/v262 changes have exact reversible receipts. Verify their
  # full manifests, source/asset hashes and replacements before comparing the
  # complete v255 predecessor descriptors; never exempt a changed parent ID.
  predecessor = predecessor_manifest_v259(build.read_json(build.OUT / "manifest.json"))
  current = {d["id"]: d for d in predecessor["chunks"]}
  for desc in evidence["oldDescriptors"]:
    assert current[desc["id"]] == desc


def test_addition_scope_is_exact_selected_sites_minus_previous_coverage():
  source, evidence = inputs()
  scope = unary_union([shape(s["geometry"]) for s in source["sites"]])
  old_scope = shape(evidence["previousScope"])
  water = unary_union(
    [
      shape(r["geometry"])
      for r in source["features"]
      if r["tags"].get("natural") == "water"
    ]
  )
  buildings = unary_union(
    [
      shapely.make_valid(shape(r["geometry"]))
      for r in source["features"]
      if r["tags"].get("building")
    ]
  )
  expected = scope.difference(old_scope)
  actual = unary_union(
    [
      build.world(
        transform(
          Transformer.from_crs(4326, 25833, always_xy=True).transform,
          shape(f["geometry"]),
        )
      )
      for f in build.read_json(build.GEO / "bounds-playgrounds-v255.geojson")[
        "features"
      ]
    ]
  )
  assert expected.symmetric_difference(actual).area < 0.001
  assert actual.intersection(old_scope).area < 0.001
  for packet in evidence["packets"]:
    allowed = shape(packet["footprint"])
    for family in packet["families"].values():
      ground = shape(family["ground"])
      assert ground.is_empty or allowed.buffer(1e-7).covers(ground)
      assert ground.is_empty or ground.intersection(old_scope).area < 0.001
      assert ground.intersection(water).area < 0.001
      assert ground.intersection(buildings).area < 0.001
      assert shape(family["water"]).difference(water).area < 0.001
      for solid in family["solids"]:
        assert allowed.buffer(1e-7).covers(shape(solid["geometry"]))
        assert shape(solid["geometry"]).intersection(water).area < 1e-8
        assert shape(solid["geometry"]).intersection(buildings).area < 1e-8


def test_real_mapped_anchors_and_gate_gaps_have_precedence():
  source, evidence = inputs()
  features = {r["key"]: r for r in source["features"]}
  known, _, _ = build.previous_features()
  counts = Counter()
  for packet in evidence["packets"]:
    allowed = shape(packet["footprint"])
    for family in packet["families"].values():
      for r in family["emitted"]:
        assert r["key"] in features
        counts[r["kind"]] += 1
        if "anchor" in r:
          assert r["key"] not in known
          assert (
            Point(r["anchor"]).distance(shape(features[r["key"]]["geometry"])) < 1e-6
          )
          assert allowed.covers(Point(r["anchor"]))
        if r["kind"] == "mapped-fence":
          course = LineString(r["endpoints"])
          assert course.difference(allowed.buffer(1e-7)).length < 1e-6
          for gate in source["features"]:
            if gate["tags"].get("barrier") in {"gate", "entrance"}:
              # The source-gap circle is polygonal; allow its sub-centimetre
              # chord error while preserving more than two metres clearance.
              assert course.distance(shape(gate["geometry"])) >= 1.095
  assert counts["bench"] > 100
  assert counts["mapped-surface-seam"] > 100
  assert counts["mapped-fence"] > 100
  assert counts["mapped-climbingframe"] > 0


def test_terrain_is_actual_viewer_field_for_both_independent_families():
  _, evidence = inputs()
  points, expected = [], []
  core = build.read_json(build.DATA / "surroundingCityScope.json")["core"]
  core_g = Polygon(core["ring"], core["holes"])
  for packet in evidence["packets"]:
    if "Weinbergspark" not in packet["name"]:
      continue
    for family_index, family in enumerate(["drawn", "minecraft"]):
      for record in packet["families"][family]["emitted"]:
        if "endpoints" not in record:
          continue
        for (x, z), y in zip(record["endpoints"], record["groundY"]):
          points.append([x, z, 5.2 if core_g.covers(Point(x, z)) else 3])
          expected.append((family_index, y))
  assert len(points) > 20
  actual = build.ground_samples(points)
  assert all(abs(row[i] - y) < 1e-8 for row, (i, y) in zip(actual, expected))
  assert max(y for _, y in expected) - min(y for _, y in expected) > 0.1


def test_packed_geometry_is_finite_bounded_and_native_is_orthogonal():
  _, evidence = inputs()
  audits = {p["id"]: p for p in evidence["packets"]}
  for desc in evidence["companions"]:
    allowed = shape(audits[desc["id"]]["footprint"]).buffer(0.015)
    for family in ["drawn", "minecraft"]:
      receipt = desc[family]
      path = build.OUT / receipt["url"]
      assert build.digest(path) == receipt["sha256"]
      assert path.stat().st_size == receipt["bytes"]
      assert receipt["decodedBytes"] < 4 * 1024 * 1024
      payload = build.read_json(path)
      for mesh in payload["meshes"]:
        vertices = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(
          -1, 3
        )
        vertices = vertices / 100 + payload["origin"]
        indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
        assert 0 < len(vertices) < 400_000
        assert indices.max() < len(vertices)
        assert np.all(np.isfinite(vertices))
        assert np.all(
          shapely.covers(allowed, shapely.points(vertices[:, 0], vertices[:, 2]))
        )
        if family == "minecraft":
          triangles = vertices[indices]
          normals = np.cross(
            triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
          )
          assert np.all(np.count_nonzero(np.abs(normals) > 1e-8, axis=1) <= 1)
  assert len(evidence["companions"]) <= 50


def test_native_new_paths_keep_their_continuous_source_core_inside_the_site():
  source, evidence = inputs()
  audits = {p["id"]: p for p in evidence["packets"]}
  path_color = [
    round(((c / 255 + 0.055) / 1.055) ** 2.4 * 255) for c in [191, 185, 165]
  ]
  checked = 0
  for desc in evidence["companions"]:
    audit = audits[desc["id"]]
    ground = shape(audit["families"]["minecraft"]["ground"])
    paths = unary_union(
      [
        shape(f["geometry"]).buffer(1.1)
        for f in source["features"]
        if audit["site"] in f["sites"]
        and f["tags"].get("highway") in {"footway", "path", "steps", "pedestrian"}
      ]
    ).intersection(ground)
    payload = build.read_json(build.OUT / desc["minecraft"]["url"])
    triangles = []
    for mesh in payload["meshes"]:
      p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
      p = p / 100 + payload["origin"]
      c = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
      ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      for t in p[ix[np.all(c[ix] == path_color, axis=(1, 2))]]:
        triangles.append(Polygon(t[:, [0, 2]]))
    rendered = unary_union(triangles)
    assert rendered.difference(paths.buffer(0.015)).area < 1e-6
    # A 0.75 m inner core cannot be lost to the 0.5 m cell diagonal.
    core = paths.buffer(-0.75)
    assert core.difference(rendered.buffer(0.015)).area < 1e-6
    if paths.area > 100:
      checked += 1
      assert rendered.area > paths.area * 0.4
    if audit["site"] == "00008100:000e388c":
      assert rendered.area > 500
      components = [rendered] if isinstance(rendered, Polygon) else list(rendered.geoms)
      assert max(p.area for p in components) > 400
  assert checked >= 10
