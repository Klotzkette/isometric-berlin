"""The navigation supplement must follow existing visible source footprints."""

import hashlib
import importlib.util
import json
from pathlib import Path

import shapely
from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
  "east_navigation", ROOT / "scripts/build_schloss_east_navigation.py"
)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_navigation_is_reproducible_and_source_bound():
  stored = json.loads(module.OUTPUT.read_text())
  assert stored == module.build(ROOT)
  assert module.OUTPUT.stat().st_size < 300_000
  assert stored["ground_y_m"] == 5.2
  assert stored["original_grid_east_m"] == 2412
  for name, expected in stored["source_sha256"].items():
    folder = (
      ROOT / "src/app/public/mesh/regierungsviertel"
      if name == "ground-context.json"
      else ROOT / "src/app/src/data"
    )
    assert hashlib.sha256((folder / name).read_bytes()).hexdigest() == expected


def test_navigation_support_has_no_rectangle_outside_the_drawn_lobe():
  data = json.loads(module.OUTPUT.read_text())
  actual = shapely.union_all(
    [Polygon(p["ring"], p["holes"]) for p in data["footprint"]]
  )
  streets = json.loads((ROOT / "src/app/src/data/schlossEastStreets.json").read_text())
  visible = module.footprint(streets["blank_extension"])
  assert actual.difference(visible).area < 1e-7
  assert actual.bounds == (2412, -360, 2805, 230)
  for x, z in [(2531.953, 112.68), (2514.208, 151.7095), (2491.348, 123.1125)]:
    assert actual.covers(Point(x, z))
  for x, z in [(2600, -361), (2600, 231), (2805.1, 0), (2200, 0)]:
    assert not actual.covers(Point(x, z))
  for surface in data["surfaces"]:
    source = next(s for s in streets["surfaces"] if s["kind"] == surface["kind"])
    support = shapely.union_all(
      [Polygon(p["ring"], p["holes"]) for p in surface["polygons"]]
    )
    assert (
      support.symmetric_difference(module.footprint(source).intersection(actual)).area
      < 1e-7
    )
