"""Complete finite official families, independent native bodies and old ownership."""

import base64
import gzip
import subprocess
from collections import Counter, defaultdict

import numpy as np
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

from scripts.build_civic_places_v352 import (
  ALLOWED,
  EVIDENCE,
  PREDECESSORS,
  PUBLIC,
  ROOT,
  SOURCE,
  Detail,
  facade,
  footprint,
  navpoly,
  read,
  sha,
  triangles_for,
)


def decoded(packet):
  mesh = packet["meshes"][0]
  positions = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  colors = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
  return positions, indices, colors


def cyclic(triangle):
  points = tuple(tuple(map(int, p)) for p in triangle)
  return min(points, points[1:] + points[:1], points[2:] + points[:2])


def test_finite_current_sources_and_whole_factory_site_identity():
  source, evidence = read(SOURCE), read(EVIDENCE)
  assert (
    sha(SOURCE.read_bytes())
    == "07648886ff74c2da4a3037cb9764646c17d1b1abea490dbfe4fa0194d78403ce"
  )
  assert evidence["sourceSha256"] == sha(SOURCE.read_bytes())
  assert evidence["predecessorSha256"] == sha(PREDECESSORS.read_bytes())
  assert {p["parent"] for p in source["parents"]} == set(ALLOWED)
  assert sum(len(p["parts"]) for p in source["parents"]) == 56
  site = shape(source["mappedSiteOwnership"]["geometry"])
  for parent in source["parents"]:
    assert parent["sourceUrl"].startswith("https://gdi.berlin.de/data/a_lod2/atom/")
    assert len(parent["sourceSha256"]) == 64
    assert all(p["surfaces"] and p["ring"] for p in parent["parts"])
    if parent["parent"].startswith("DEBE07"):
      assert footprint(parent).difference(site).area < 1e-7
    else:
      assert parent["coveredFraction"] > 0.99 and parent["parentCovered"] > 0.98
  assert len(evidence["descriptors"]) == 2
  assert {d["id"] for d in evidence["descriptors"]} == {
    "civic352-gillette-factory",
    "civic352-siemens-schaltwerk",
  }
  assert evidence["oldSourceFilesChanged"] == 0 and not evidence["runtimeBudgetChanged"]


def test_every_original_drawn_surface_survives_with_original_winding():
  evidence, source = read(EVIDENCE), read(SOURCE)
  for parent in source["parents"]:
    site = next(s for s in evidence["sites"] if parent["parent"] in s["parents"])
    descriptor = next(
      d for d in evidence["descriptors"] if d["id"] == "civic352-" + site["id"]
    )
    packet = read(PUBLIC / descriptor["drawn"]["url"])
    positions, indices, _ = decoded(packet)
    actual = Counter(cyclic(positions[t]) for t in indices)
    expected = Counter()
    delta = site["sourceVerticalTranslations"][parent["parent"]]
    assert abs(min(p["ground_y_m"] for p in parent["parts"]) + delta - 3) < 1e-9
    for part in parent["parts"]:
      for surface in part["surfaces"]:
        rings = [[[x, y + delta, z] for x, y, z in ring] for ring in surface["rings"]]
        for triangle in triangles_for(rings):
          q = np.rint((np.asarray(triangle) - packet["origin"]) * 100).astype(int)
          if len({tuple(p) for p in q}) == 3:
            expected[cyclic(q)] += 1
    assert not expected - actual
    assert sum(expected.values()) > 0
    # The retained source remains unquantized. Eleven sub-centimetre slivers
    # become degenerate in the existing public centimetre codec (0.165 m² total).
    assert site["centimetreDegeneracy"]["maxTriangleArea"] < 0.07
    assert site["centimetreDegeneracy"]["areaSquareMetres"] < 0.17


def test_actual_production_ground_subtraction_and_all_old_bodies_remain():
  evidence, receipts = read(EVIDENCE), read(PREDECESSORS)["records"]
  for site in evidence["sites"]:
    descriptor = next(
      d for d in evidence["descriptors"] if d["id"] == "civic352-" + site["id"]
    )
    for mode, details in site["modes"].items():
      audit = details["groundAudit"]
      domain = shape(audit["sourceDomain"])
      ids = {r["id"] for r in audit["inputs"]}
      records = [r for r in receipts if r["mode"] == mode and r["id"] in ids]
      assert len(records) == len(ids)
      for entry in audit["inputs"]:
        previous = next(r for r in records if r["id"] == entry["id"])
        assert (
          sha((ROOT / entry["path"]).read_bytes())
          == entry["sha256"]
          == previous["rawSha256"]
        )
        assert entry["productionWordSha256"] == previous["productionWordSha256"]
      for r in records:
        for body in r["navigation"]["buildings"]:
          assert navpoly(body, r["origin"]).intersection(domain).area <= 0.05
      old = unary_union(
        [navpoly(g, r["origin"]) for r in records for g in r["navigation"]["ground"]]
      )
      siblings = []
      for earlier in audit["earlierNewGroundInputs"]:
        path = PUBLIC / earlier["url"]
        assert sha(path.read_bytes()) == earlier["sha256"]
        packet = read(path)
        siblings.extend(navpoly(g, packet["origin"]) for g in packet["nav"]["ground"])
      complement = domain.difference(old.union(unary_union(siblings)))
      assert complement.symmetric_difference(shape(audit["newGround"])).area < 1e-7
      assert complement.intersection(old).area < 1e-7
      packet = read(PUBLIC / descriptor[mode]["url"])
      emitted = unary_union(
        [navpoly(g, packet["origin"]) for g in packet["nav"]["ground"]]
      )
      # The actual emitted outline is quantized to centimetres, never broadened
      # into an approach square or a district ground plate.
      assert emitted.difference(complement.buffer(0.015)).area < 1e-7
      assert complement.difference(emitted.buffer(0.015)).area < 1e-7
      positions, indices, _ = decoded(packet)
      world = positions / 100 + packet["origin"]
      ground_triangles = [
        Polygon(world[t][:, [0, 2]])
        for t in indices
        if np.all(np.abs(world[t][:, 1] - 3) < 1e-8)
      ]
      mesh_ground = unary_union(ground_triangles)
      assert emitted.difference(mesh_ground.buffer(0.015)).area < 1e-7


def test_adjacent_new_ground_owners_are_disjoint_in_both_modes():
  evidence = read(EVIDENCE)
  for mode in ["drawn", "minecraft"]:
    previous = []
    for descriptor in evidence["descriptors"]:
      packet = read(PUBLIC / descriptor[mode]["url"])
      ground = unary_union(
        [navpoly(g, packet["origin"]) for g in packet["nav"]["ground"]]
      )
      assert all(ground.intersection(other).area < 1e-7 for other in previous)
      previous.append(ground)


def test_joined_gillette_native_has_no_duplicate_coplanar_exterior_faces():
  packet = read(PUBLIC / "civic352-gillette-factory.minecraft.json.gz")
  vertices, indices, _ = decoded(packet)
  world = vertices / 100 + packet["origin"]
  planes = defaultdict(list)
  for triangle in world[indices]:
    normal = np.cross(triangle[1] - triangle[0], triangle[2] - triangle[0])
    axes = np.flatnonzero(np.abs(normal) > 1e-6)
    if len(axes) != 1:
      continue
    axis = int(axes[0])
    # The support floor underneath the closed body is not an exposed facade.
    if axis == 1 and abs(triangle[0, axis] - 3) < 1e-8:
      continue
    polygon = Polygon(triangle[:, [i for i in range(3) if i != axis]])
    if polygon.area > 1e-8:
      planes[(axis, round(triangle[0, axis], 2))].append(polygon)
  assert planes
  for polygons in planes.values():
    assert abs(sum(p.area for p in polygons) - unary_union(polygons).area) < 1e-7


def test_native_is_cardinal_and_uses_independent_nav_and_bounded_packets():
  evidence = read(EVIDENCE)
  total = 0
  for descriptor in evidence["descriptors"]:
    for mode in ["drawn", "minecraft"]:
      asset = descriptor[mode]
      raw = (PUBLIC / asset["url"]).read_bytes()
      packet = read(PUBLIC / asset["url"])
      assert sha(raw) == asset["sha256"] and len(raw) == asset["bytes"]
      assert len(gzip.decompress(raw)) == asset["decodedBytes"]
      total += len(raw)
      vertices, indices, colors = decoded(packet)
      assert len(vertices) == len(colors) and len(vertices) < 400_000
      assert indices.max() < len(vertices) and indices.size < 2_400_000
      world = vertices / 100 + packet["origin"]
      assert np.isfinite(world).all()
      lo_x, lo_z, hi_x, hi_z = descriptor["bounds"]
      assert world[:, 0].min() >= lo_x and world[:, 0].max() <= hi_x
      assert world[:, 2].min() >= lo_z and world[:, 2].max() <= hi_z
      if mode == "minecraft":
        t = world[indices]
        normals = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
        # The separate ground complement may have an arbitrary outline; all of
        # its triangles are horizontal. Every native wall/roof is also cardinal.
        assert ((np.abs(normals) > 1e-6).sum(axis=1) <= 1).all()
        assert all(
          b.get("nativeRoofCaps") and not b.get("roofTriangles")
          for b in packet["nav"]["buildings"]
        )
      else:
        assert any(b.get("roofTriangles") for b in packet["nav"]["buildings"])
  # Finite four-packet receipt after disjoint Drawn window tessellation; the
  # runtime decoder/live/Worker and release-wide public caps are unchanged.
  assert total == evidence["bytes"] < 1_500_000


def test_photo_fittings_stay_on_full_wall_and_face_outward_in_either_winding():
  family = box(0, 0, 20, 10)
  for points in (
    [[0, 3, 0], [20, 3, 0], [20, 20, 0], [0, 20, 0]],
    [[0, 3, 0], [0, 20, 0], [20, 20, 0], [20, 3, 0]],
  ):
    detail = Detail()
    surface = {"kind": "WallSurface", "rings": [points]}
    assert facade(detail, surface, "gillette", family, 3) > 0
    for tri, _, _ in detail.triangles:
      q = np.asarray(tri)
      normal = np.cross(q[1] - q[0], q[2] - q[0])
      assert normal[2] < 0
      assert (q[:, 2] < 0).all()
      assert q[:, 0].min() > 0 and q[:, 0].max() < 20
      assert q[:, 1].min() > 3 and q[:, 1].max() < 20


def test_drawn_window_colours_partition_one_plane_without_losing_the_pattern():
  family = box(0, 0, 20, 10)
  surface = {
    "kind": "WallSurface",
    "rings": [[[0, 3, 0], [20, 3, 0], [20, 20, 0], [0, 20, 0]]],
  }
  for kind in ["siemens", "gillette"]:
    old, current = Detail(), Detail()
    assert facade(old, surface, kind, family, 3, disjoint=False) == facade(
      current, surface, kind, family, 3
    )
    polygons = []
    for triangle, _, _ in current.triangles:
      t = np.asarray(triangle)
      assert np.allclose(t[:, 2], -0.18)
      polygons.append(Polygon(t[:, [0, 1]]))
    complete = unary_union(polygons)
    previous = unary_union(
      [Polygon(np.asarray(t)[:, [0, 1]]) for t, _, _ in old.triangles]
    )
    assert complete.symmetric_difference(previous).area < 1e-7
    assert abs(sum(p.area for p in polygons) - complete.area) < 1e-7
    assert {tuple(color) for _, color, _ in current.triangles} == {
      tuple(color) for _, color, _ in old.triangles
    }


def test_drawn_facade_depth_fix_keeps_both_native_packets_byte_identical():
  for host in ["gillette-factory", "siemens-schaltwerk"]:
    path = (
      f"src/app/public/mesh/surrounding-berlin-v159/civic352-{host}.minecraft.json.gz"
    )
    previous = subprocess.check_output(["git", "show", f"058ffd69:{path}"], cwd=ROOT)
    assert previous == (ROOT / path).read_bytes()
