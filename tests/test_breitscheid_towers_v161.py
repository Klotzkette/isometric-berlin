"""Source-preservation and local facade boundary checks for the City West towers."""

import importlib.util
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
  "tower_builder", ROOT / "scripts/build_breitscheid_towers_v161.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_wall_clipping_keeps_upper_west_detail_inside_polygon() -> None:
  ring = [[0, 5.2, 0], [0, 36, 0], [16, 36, 0], [16, 5.2, 0]]
  rows = MODULE.facade([ring], True)
  assert rows
  for x, y, _z, width, height, _depth, _yaw, _color, role in rows:
    if role == 1:
      assert x - width / 2 >= 0 and x + width / 2 <= 16
      assert y - height / 2 >= 5.2 and y + height / 2 <= 36


def test_concave_surface_triangulation_preserves_area() -> None:
  ring = [[0, 0, 0], [0, 8, 0], [3, 8, 0], [3, 4, 0], [7, 4, 0], [7, 0, 0]]
  triangles = MODULE.triangles_for([ring])
  expected = Polygon([(p[0], p[1]) for p in ring]).area
  actual = sum(
    np.linalg.norm(np.cross(np.subtract(t[1], t[0]), np.subtract(t[2], t[0]))) / 2
    for t in triangles
  )
  assert abs(actual - expected) < 1e-8


def test_export_retains_complete_source_parts_and_no_hidden_fill() -> None:
  payload = json.loads(
    (ROOT / "src/app/src/data/breitscheidTowersSource.json").read_text()
  )
  assert len(payload["parts"]) == 30
  assert {p["id"] for p in payload["legacyPrisms"]} == {"74901812", "15777905"}
  assert {p["parentId"] for p in payload["parts"]} == set(MODULE.PARENTS)
  assert len(payload["surfaces"]) == 455
  assert all(p["footprintAreaM2"] > 0 for p in payload["parts"])
  assert all(p["topY"] > p["groundY"] for p in payload["parts"])
  assert len({tuple(b[:3]) for b in payload["nativeBlocks"]}) == len(
    payload["nativeBlocks"]
  )
  assert all(np.isfinite(b).all() for b in payload["facadeBoxes"])
