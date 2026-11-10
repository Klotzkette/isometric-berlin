from shapely import box
from shapely.geometry import Polygon

from scripts.build_public_amenities_v332 import compile_amenities, local, native_runs


def test_cardinal_basin_covers_only_complete_cells_outside_holes():
  area = Polygon(
    [(0, 0), (5, 0), (5, 4), (0, 4)],
    [[(1.1, 1.1), (3.2, 1.1), (3.2, 2.8), (1.1, 2.8)]],
  )
  runs = native_runs(area)
  assert runs == [
    [0, 0, 5, 1],
    [0, 1, 1, 2],
    [4, 1, 5, 2],
    [0, 2, 1, 3],
    [4, 2, 5, 3],
    [0, 3, 5, 4],
  ]
  assert all(area.covers(box(*run)) for run in runs)


def test_compiler_preserves_locations_models_and_excludes_unverified_access():
  common = {"kind": "toilet", "name": "Test", "x": 389500.23, "y": 5819998.02}
  inputs = [
    {**common, "id": "wc", "model": "berliner-toilette"},
    {**common, "id": "event", "status": "event"},
    {**common, "id": "indoor", "status": "indoor", "model": "berliner-toilette"},
    {**common, "id": "out", "x": 389480},
  ]
  output, receipt = compile_amenities(
    inputs, [box(-5, -5, 5, 5)], {"wc": "actual variant"}, {}, set()
  )
  assert local(common["x"], common["y"]) == (0.23, 1.98)
  assert output["cells"] == {
    "0_0": [
      ["indoor", "toilet", "Test", 0.23, 1.98, "", "", ""],
      ["wc", "toilet", "Test", 0.23, 1.98, "berliner-toilette", "actual variant", ""],
    ]
  }
  assert receipt["excluded"] == {"toilet": 2}
