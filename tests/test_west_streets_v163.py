"""Preservation, source planes and bounded packet checks for City West streets."""

import base64
import gzip
import importlib.util
import json
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import LineString, Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def exporter():
  with pytest.MonkeyPatch.context() as patch:
    patch.syspath_prepend(str(ROOT / "scripts"))
    spec = importlib.util.spec_from_file_location(
      "west_streets", ROOT / "scripts/build_west_streets_v163.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    yield module


@pytest.fixture(scope="module")
def source():
  return json.loads(
    (ROOT / "geo_data/regierungsviertel/west-streets-v163.json").read_text()
  )


def test_all_four_complete_named_corridors_have_source_ways(exporter, source):
  assert {r["name"] for r in source["roads"]} == set(exporter.NAMES)
  bounds, _ = exporter.read_bounds()
  for road in source["roads"]:
    assert road["id"].startswith("OSM-way-")
    assert bounds.buffer(0.001).covers(shape(road["geometry"]))
  lengths = {
    name: unary_union(
      [shape(r["geometry"]) for r in source["roads"] if r["name"] == name]
    ).length
    for name in exporter.NAMES
  }
  assert lengths["Kurfürstendamm"] > 6000  # Both mapped carriageways.
  assert lengths["Uhlandstraße"] > 3000
  assert lengths["Fasanenstraße"] > 1900
  assert lengths["Meinekestraße"] > 430


def test_source_shells_preserve_parts_courts_and_bounds(exporter, source):
  assert len(source["buildings"]) > 300
  assert len(source["corePrisms"]) > 250
  assert len(source["sourceArchives"]) >= 8
  bounds, core = exporter.read_bounds()
  seen = set()
  for building in source["buildings"]:
    assert building["id"] not in seen
    seen.add(building["id"])
    for part in building["parts"]:
      for surface in part["surfaces"]:
        if surface["kind"] != "GroundSurface":
          continue
        p = Polygon([(v[0], v[2]) for v in surface["rings"][0]])
        assert bounds.buffer(0.01).covers(p)
        assert p.intersection(core).area < 0.01
  assert not seen.intersection(source["retainedBoundaryParents"])


def test_core_prisms_are_unmodified_delivered_planes(source):
  current = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )
  by_id = {p["id"]: p for p in current["buildings"]}
  for prism in source["corePrisms"]:
    assert prism == by_id[prism["id"]]


def test_facade_stays_thin_bounded_and_street_facing(exporter):
  detail = exporter.Detail()
  wall = [[[0, 3, 0], [12, 3, 0], [12, 24, 0], [0, 24, 0]]]
  # This source winding faces +Z. The street must be on that side.
  exporter.facade(detail, wall, LineString([(0, 12), (12, 12)]), 3, 24)
  assert len(detail.triangles) > 50
  roles = {role for _, _, role in detail.triangles}
  assert roles >= {"window glazing", "shopfront glazing", "continuous cornice"}
  for triangle, _color, _role in detail.triangles:
    for x, y, z in triangle:
      assert 0.03 < x < 11.97
      assert 3.03 < y < 23.97
      assert 0 < z <= 0.13
  back = exporter.Detail()
  exporter.facade(back, wall, LineString([(0, -12), (12, -12)]), 3, 24)
  assert not back.triangles


def test_source_part_navigation_keeps_all_ground_rings(exporter, source):
  roads = unary_union([shape(r["geometry"]) for r in source["roads"]])
  for building in source["buildings"][:8]:
    _detail, nav = exporter.outer_detail(building, roads)
    expected = unary_union(
      [
        Polygon(
          [(v[0], v[2]) for v in s["rings"][0]],
          [[(v[0], v[2]) for v in r] for r in s["rings"][1:]],
        )
        for p in building["parts"]
        for s in p["surfaces"]
        if s["kind"] == "GroundSurface"
      ]
    )
    actual = unary_union([p["geometry"] for p in nav])
    assert expected.symmetric_difference(actual).area < 1e-7
    assert {p["sourceId"] for p in nav} == {building["id"]}


def test_native_facades_are_independent_axis_aligned_blocks(exporter, source):
  roads = unary_union([shape(r["geometry"]) for r in source["roads"]])
  detailed = [exporter.core_detail(p, roads) for p in source["corePrisms"][:12]]
  native = exporter.native_detail(next(d for d in detailed if d.triangles))
  assert native.triangles
  for triangle, _, _ in native.triangles:
    a, b, c = np.array(triangle)
    normal = np.cross(b - a, c - a)
    assert np.count_nonzero(np.abs(normal) > 1e-8) == 1


def test_replacement_keeps_every_unowned_source_triangle(exporter):
  retained = {
    "sourceId": "retained",
    "geometry": box(30, 30, 60, 60),
    "height": 20,
    "minHeight": 0,
    "heightSource": "test",
  }
  owned = {**retained, "sourceId": "owned", "geometry": box(100, 20, 130, 80)}
  tile = box(0, 0, 512, 512)
  surface = {"road": box(0, 90, 512, 102), "park": box(0, 105, 200, 140)}
  for native in (False, True):
    expected = exporter.chunk_payload(
      "0_0", tile, tile, [retained], surface, minecraft=native
    )
    actual = exporter.chunk_payload(
      "0_0",
      tile,
      tile,
      [retained, owned],
      surface,
      minecraft=native,
      replaced_source_ids=frozenset({"owned"}),
    )
    assert actual == expected


def test_offline_partition_preserves_exact_packed_faces(exporter):
  detail = exporter.Detail()
  detail.polygon([[500, 10, 40], [524, 22, 40], [500, 10, 64]], (125, 145, 165), "roof")
  detail.polygon(
    [[512, 3, 50], [512, 3, 70], [512, 24, 70], [512, 24, 50]], (200, 190, 180), "wall"
  )
  cells = exporter.partition_detail(detail)
  assert set(cells) == {(0, 0), (1, 0)}
  for (ix, iz), subset in cells.items():
    tile = box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
    assert exporter.packed_detail(subset, tile) == exporter.packed_detail(detail, tile)


def test_published_packets_are_bounded_and_registered(exporter):
  audit = json.loads(exporter.AUDIT.read_text())
  manifest = json.loads((exporter.DEFAULT_OUTPUT / "manifest.json").read_text())
  descriptors = {d["id"]: d for d in manifest["chunks"]}
  assert manifest["source"]["westStreetsV163"]["version"] == "1.0.63"
  for record in audit["chunks"]:
    descriptor = descriptors[record["id"]]
    for mode in ("drawn", "minecraft"):
      a = descriptor[mode]
      packed = (exporter.DEFAULT_OUTPUT / a["url"]).read_bytes()
      assert len(packed) == a["bytes"]
      decoded = gzip.decompress(packed)
      assert len(decoded) == a["decodedBytes"] < 12 * 1024 * 1024
      p = json.loads(decoded)
      assert any(m["kind"] == "city-west-street-fronts-v163" for m in p["meshes"])
      for mesh in p["meshes"]:
        positions = np.frombuffer(
          base64.b64decode(mesh["positions"]), dtype="<u2"
        ).reshape(-1, 3)
        assert len(positions) <= 400000
        assert max(positions[:, 0].max(), positions[:, 2].max()) <= 51200


def test_source_road_packet_accounting_does_not_reduce_detail(exporter):
  audit = json.loads(exporter.AUDIT.read_text())
  assert audit["streetMetrics"]["drawn"]["sidewalkAreaM2"] > 30000
  assert audit["streetMetrics"]["drawn"]["curbLengthM"] > 5000
  assert audit["roles"]["source RoofSurface"] > 1000
  assert audit["roles"]["window glazing"] > 20000
  assert audit["roles"]["shopfront glazing"] > 5000
