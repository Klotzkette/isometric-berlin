"""Exact-source colour gap correction, with truly shared corners protected."""

import base64
import hashlib

from shapely.geometry import Polygon

from scripts import build_grey_cluster_colours_v263 as build
from scripts.build_surrounding_outlines import PackedMesh, navigation_polygons


def fixture(same_height: bool = False) -> dict:
  """Two touching sources share lower XYZ but have separately evidenced tops."""
  mesh = PackedMesh(0, 0)
  buildings = []
  for name, ring, high in [
    ("left", [(0, 0), (10, 0), (10, 10), (0, 10)], 13),
    ("right", [(10, 0), (20, 0), (20, 10), (10, 10)], 13 if same_height else 23),
  ]:
    polygon = Polygon(ring)
    mesh.building(polygon, 3, high)
    buildings.extend(
      {**p, "sourceId": name, "minHeight": 0, "height": high - 3}
      for p in navigation_polygons(polygon, 0, 0)
    )
  return {
    "origin": [0, -10, 0],
    "nav": {"groundY": 3, "buildings": buildings},
    "meshes": [mesh.payload("city")],
  }


def test_distinct_source_tops_resolve_but_truly_shared_corners_and_equal_tops_do_not():
  p = fixture()
  rows, proof = build.analyse(p, p["meshes"][0])
  points, colours, _ = build.decoded(p["meshes"][0])
  assert rows
  for vertex, owner, role, low, high in rows:
    assert points[vertex, 1] in (2300, 3300)
    assert (owner, high) in (("left", 2300), ("right", 3300))
    assert low == 1300
    assert role in (0, 1)
    assert tuple(colours[vertex]) in (build.WALL, build.ROOF)
  assert proof["resolvedVertices"] < proof["ambiguousGenericVertices"]
  equal = fixture(same_height=True)
  equal_rows, _ = build.analyse(equal, equal["meshes"][0])
  assert equal_rows == []


def test_incomplete_wall_quads_fail_closed():
  p = fixture()
  part = p["meshes"][0]
  points, colours, triangles = build.decoded(part)
  # Remove all second wall triangles. Roof faces can still resolve, wall faces cannot.
  keep, found = [], 0
  for ti, ids in enumerate(triangles):
    if tuple(colours[ids[0]]) == build.WALL:
      found += 1
      if found % 2 == 0:
        continue
    keep.append(ti)
  changed = {
    **part,
    "indices": base64.b64encode(triangles[keep].astype("<u4").tobytes()).decode(),
  }
  rows, _ = build.analyse(p, changed)
  assert rows and all(row[2] == 1 for row in rows)
  assert points.shape[0] > 0


def test_nine_independent_packet_pairs_reproduce_receipts_and_original_bytes():
  runtime, evidence = (
    build.base.read_json(build.OUTPUT),
    build.base.read_json(build.EVIDENCE),
  )
  assert tuple(evidence["tiles"]) == build.TILES
  assert len(evidence["inputs"]) == 18
  assert len(runtime["packets"]) == 18
  assert runtime["keys"] == list(runtime["packets"])
  assert (
    hashlib.sha256(build.OUTPUT.read_bytes()).hexdigest() == evidence["runtimeSha256"]
  )
  total = {"drawn": 0, "minecraft": 0}
  for key, plan in runtime["packets"].items():
    mode, tile = key.split(":")
    assert tile in build.TILES
    path = build.OUT / f"{tile}.{mode}.json.gz"
    assert (
      hashlib.sha256(path.read_bytes()).hexdigest() == evidence["inputs"][path.name]
    )
    packet = build.base.read_json(path)
    assert build.nav_fingerprint(packet["nav"]) == plan["guard"]
    for record in plan["records"]:
      part = packet["meshes"][record["mesh"]]
      assert (
        build.fingerprint([part["positions"], part["colors"], part["indices"]])
        == record["fingerprint"]
      )
      rows, proof = build.analyse(packet, part)
      reconstructed = [
        [row[0], record["owners"][row[1]], *row[2:]] for row in record["rows"]
      ]
      assert rows == reconstructed
      saved = next(d for d in evidence["packets"][key] if d["mesh"] == record["mesh"])
      assert proof == {k: v for k, v in saved.items() if k != "mesh"}
      total[mode] += len(rows)
  assert total == {"drawn": 6924, "minecraft": 11504}
