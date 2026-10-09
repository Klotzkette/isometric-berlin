"""Bounded source ownership and geographic correctness of the northern parks."""

import hashlib
import json
import sys
from pathlib import Path

from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import Point, shape
from shapely.ops import transform, unary_union

from scripts.build_breitscheid_towers_v161 import triangles_for

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_north_parks_v198 import height  # noqa: E402

GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = json.loads((GEO / "north-parks-v198-source.json").read_text())
EVIDENCE = json.loads((GEO / "north-parks-v198-evidence.json").read_text())
FIELD = json.loads((DATA / "northParksV198Terrain.json").read_text())


def test_exact_named_footprint_preserves_every_old_scope():
  original = shape(SOURCE["scope"])
  added = shape(SOURCE["newScope"])
  old = shape(SOURCE["priorScope"])
  assert abs(added.area - 960129.7517429736) < 0.001
  assert added.intersection(old).area < 1e-5
  assert original.difference(old).symmetric_difference(added).area < 1e-5
  for row in EVIDENCE["priorScopeHashes"]:
    assert hashlib.sha256((GEO / row["path"]).read_bytes()).hexdigest() == row["sha256"]
  geo = json.loads((GEO / "bounds-north-parks-v198.geojson").read_text())
  projected = transform(
    Transformer.from_crs(4326, 25833, always_xy=True).transform,
    shape(geo["features"][0]["geometry"]),
  )
  world = affine_transform(projected, [1, 0, 0, -1, -389500, 5820000])
  assert world.symmetric_difference(original).area < 0.02
  assert len(SOURCE["buildings"]) == 386
  for b in SOURCE["buildings"]:
    assert shape(b["geometry"]).intersection(old).area <= 0.1


def test_complete_palace_and_both_gatehouse_source_triangles():
  assert {o["id"] for o in SOURCE["official"]} == {
    "DEBE03YY70003qcl",
    "DEBE03YY700040j1",
    "DEBE03YY700041ZP",
  }
  assert sum(o["key"] == "gate" for o in SOURCE["official"]) == 2
  expected = set()

  def key(triangle):
    return tuple(sorted(tuple(round(v, 3) for v in p) for p in triangle))

  for owner in SOURCE["official"]:
    for part in owner["parts"]:
      for face in part["surfaces"]:
        expected.update(key(t) for t in triangles_for(face["rings"]))
  for c in [
    c
    for suffix in [0, 1]
    for c in json.loads((DATA / f"northParksV198Drawn{suffix}.json").read_text())[
      "cells"
    ]
  ]:
    p = c["positions"]
    ii = c["indices"]
    for i in range(0, len(ii), 3):
      expected.discard(key([p[j * 3 : j * 3 + 3] for j in ii[i : i + 3]]))
  assert not expected


def test_retained_panke_water_and_land_datums_meet_exactly():
  boundary = shape(SOURCE["newScope"]).boundary.intersection(
    shape(SOURCE["priorScope"]).boundary
  )
  assert not boundary.is_empty
  count = 0
  for part in getattr(boundary, "geoms", [boundary]):
    if part.geom_type != "LineString":
      continue
    for x, z in [
      part.interpolate(part.length * t).coords[0] for t in [0, 0.25, 0.5, 0.75, 1]
    ]:
      for native in [False, True]:
        assert abs(height(FIELD, x, z, native) - 3) < 0.001
        assert abs(height(FIELD, x, z, native, True) + 1.15) < 0.001
      count += 1
  assert count > 20
  assert 4900 < EVIDENCE["panke"]["mappedCourseLengthM"] < 5000
  assert 2400 < EVIDENCE["panke"]["retainedCourseLengthM"] < 2600
  assert len(EVIDENCE["panke"]["retainedBarrierIds"]) == 12


def test_bounded_records_and_native_are_separate():
  for mode, r in EVIDENCE["representations"].items():
    assert r["cells"] == 14
    assert r["finalGeometryBytes"] < 6 * 1024 * 1024
    for f in r["files"]:
      p = DATA / f["name"]
      assert p.stat().st_size < 5 * 1024 * 1024
      assert hashlib.sha256(p.read_bytes()).hexdigest() == f["sha256"]
      for c in json.loads(p.read_text())["cells"]:
        assert len(c["positions"]) == len(c["colors"])
        assert all(0 <= i < len(c["positions"]) // 3 for i in c["indices"])
        assert all(len(row) == (7 if mode == "native" else 8) for row in c["boxes"])
  native = json.loads((DATA / "northParksV198Native0.json").read_text())
  assert native["cells"]
  assert sum(m["tags"].get("natural") == "tree" for m in SOURCE["markers"]) == 408


def test_real_water_rings_not_broad_district_or_invented_river():
  water = unary_union([shape(r["geometry"]) for r in SOURCE["river"]])
  expected = water.intersection(shape(SOURCE["newScope"]))
  from shapely.geometry import Polygon

  actual = unary_union([Polygon(p["ring"], p["holes"]) for p in FIELD["waters"]])
  assert actual.symmetric_difference(expected).area < 1e-5
  assert not actual.covers(Point(2470, -6555))  # palace is not a water rectangle
  assert all(
    s["id"] in {"relation/947050", "relation/946980", "way/28104405"}
    for s in SOURCE["sites"]
  )


def test_raised_path_edges_are_closed_without_moving_the_top():
  from collections import Counter

  from build_north_parks_v198 import Output
  from shapely.geometry import box

  for native in [False, True]:
    out = Output(native, FIELD)
    p = box(2659, -6365, 2663, -6361)
    out.plan(p, 0xA49B80, 0.05)

    def edges():
      result = Counter()
      for c in out.cells.values():
        vertices = [
          tuple(c["positions"][i : i + 3]) for i in range(0, len(c["positions"]), 3)
        ]
        ii = c["indices"]
        for i in range(0, len(ii), 3):
          tri = [vertices[j] for j in ii[i : i + 3]]
          for a, b in zip(tri, tri[1:] + tri[:1], strict=True):
            result[tuple(sorted((a, b)))] += 1
      return result

    open_top = {edge for edge, count in edges().items() if count == 1}
    assert open_top
    old_vertices = {
      tuple(c["positions"][i : i + 3])
      for c in out.cells.values()
      for i in range(0, len(c["positions"]), 3)
    }
    out.risers(p, 0xA49B80, 0.05)
    now = edges()
    assert all(now[edge] == 2 for edge in open_top)
    new_vertices = {
      tuple(c["positions"][i : i + 3])
      for c in out.cells.values()
      for i in range(0, len(c["positions"]), 3)
    }
    assert old_vertices <= new_vertices
    assert max(q[1] for q in old_vertices) == max(q[1] for q in new_vertices)
