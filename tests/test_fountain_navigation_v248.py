"""Replay, exact rendered-source binding and granular fountain navigation."""

import hashlib
import importlib.util
import json
from pathlib import Path

from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


def load():
  path = ROOT / "scripts/build_fountain_navigation_v248.py"
  spec = importlib.util.spec_from_file_location("fountain_navigation_v248", path)
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  return module


def test_replay_is_deterministic_and_bound_to_frozen_rendered_recipe():
  module = load()
  data = module.build()
  assert data == module.build()
  assert json.loads(json.dumps(data)) == json.loads(module.OUT.read_text())
  assert data["sourceSha256"] == hashlib.sha256(module.SOURCE.read_bytes()).hexdigest()
  assert data["owner"] == "way/775414456"


def test_solid_cap_keeps_its_hole_and_has_no_invented_downward_extrusion():
  module = load()
  data = module.build()
  source = json.loads(module.SOURCE.read_text())
  caps = [r for r in data["drawn"] if r["lowY"] == r["topY"]]
  assert len(caps) == 1 and len(caps[0]["holes"]) == 1
  assert caps[0]["topY"] == 3.625
  actual = Polygon(caps[0]["ring"], caps[0]["holes"])
  expected = unary_union(
    [
      Polygon([(module.f32(p[0]), module.f32(p[2])) for p in triangle])
      for surface in source["surfaces"]
      if surface["color"] not in module.NON_SOLID_COLORS
      for triangle in surface["triangles"]
    ]
  )
  assert actual.equals(expected)
  assert not actual.covers(Polygon(caps[0]["holes"][0]).representative_point())
  assert max(r["topY"] for r in data["drawn"]) < 3.626


def test_native_matches_only_actual_solid_boxes_with_a_small_finite_index():
  module = load()
  data = module.build()
  source = json.loads(module.SOURCE.read_text())
  solids = [r for r in source["nativeRows"] if r[-1] not in module.NON_SOLID_COLORS]
  assert len(data["native"]) == len(solids) == 190
  assert len(data["drawn"]) == 86
  assert module.OUT.stat().st_size < 40_000
  for actual, (x, y, z, w, h, d, _) in zip(data["native"], solids, strict=True):
    f = module.f32
    assert actual == [
      f(x) - f(w) / 2,
      f(z) - f(d) / 2,
      f(x) + f(w) / 2,
      f(z) + f(d) / 2,
      f(y) - f(h) / 2,
      f(y) + f(h) / 2,
    ]
    assert 3.024 < actual[4] < actual[5] < 3.626
  x0, z0, x1, z1 = data["bounds"]
  assert -3552 < x0 < x1 < -3542 and 6802 < z0 < z1 < 6811
