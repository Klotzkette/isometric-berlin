"""Exact plaza contour, both holes and independent native-cell preservation."""

import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path

from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


def load():
  path = ROOT / "scripts/build_hermann_ehlers_v247.py"
  sys.path.insert(0, str(path.parent))
  spec = importlib.util.spec_from_file_location("hermann_ehlers_v247", path)
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  return module


def test_replay_and_every_earlier_source_and_packet_remains_identical():
  module = load()
  data, evidence = module.build()
  assert data == json.loads(module.OUT.read_text())
  assert json.loads(json.dumps(evidence)) == json.loads(module.EVIDENCE.read_text())
  for category in ["sourceSha256", "preservedSha256", "packetSha256"]:
    for name, digest in evidence[category].items():
      assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest
  assert len(evidence["preservedSha256"]) == 4
  assert len(evidence["packetSha256"]) == 4


def test_complete_paving_contour_and_both_source_holes_survive_triangulation():
  module = load()
  data = json.loads(module.OUT.read_text())
  evidence = json.loads(module.EVIDENCE.read_text())
  polygon = shape(evidence["worldGeometry"]).geoms[0]
  triangles = data["surfaces"][0]["triangles"]
  rendered = unary_union([Polygon([(p[0], p[2]) for p in t]) for t in triangles])
  assert len(triangles) == 81
  assert rendered.symmetric_difference(polygon).area < 1e-8
  assert abs(rendered.area - 5270.871187554224) < 1e-6
  coordinates = {(p[0], p[2]) for t in triangles for p in t}
  for ring in [polygon.exterior, *polygon.interiors]:
    assert set(ring.coords) <= coordinates
  for ring in polygon.interiors:
    assert rendered.intersection(Polygon(ring)).area < 1e-8
  assert {p[1] for t in triangles for p in t} == {3.025}
  assert abs(evidence["finishTopY"] - evidence["groundY"]) <= 0.02501
  assert data["boxes"] == []


def test_native_is_complete_independent_interior_cells_with_no_hole_fill():
  module = load()
  data = json.loads(module.OUT.read_text())
  evidence = json.loads(module.EVIDENCE.read_text())
  polygon = shape(evidence["worldGeometry"]).geoms[0]
  expected = {
    (x, z)
    for x in range(math.floor(polygon.bounds[0]), math.ceil(polygon.bounds[2]))
    for z in range(math.floor(polygon.bounds[1]), math.ceil(polygon.bounds[3]))
    if polygon.covers(box(x, z, x + 1, z + 1))
  }
  actual = set()
  assert len(data["nativeRows"]) == 143
  for x, y, z, w, h, d, color in data["nativeRows"]:
    assert abs(y + h / 2 - 3.025) < 1e-12 and color == module.STONE
    corners = [x - w / 2, x + w / 2, z - d / 2, z + d / 2]
    assert all(v == int(v) for v in corners)
    x0, x1, z0, z1 = map(int, corners)
    footprint = box(x0, z0, x1, z1)
    assert polygon.covers(footprint)
    for ix in range(x0, x1):
      for iz in range(z0, z1):
        assert (ix, iz) not in actual
        actual.add((ix, iz))
  assert actual == expected
  assert len(actual) == evidence["nativeCompleteCells"] == 4975
