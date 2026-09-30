"""Protect the complete avenue and the open station approaches in both readings."""

import base64
import json
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import box
from shapely.ops import unary_union

from scripts.unter_den_linden_streets import entrance_regions_world

ROOT = Path(__file__).resolve().parents[1]


def test_station_refill_owns_every_stair_region_without_a_street_cap():
  streets = json.loads((ROOT / "src/app/src/data/districtStreets.json").read_text())
  regions = entrance_regions_world()
  assert len(regions) == 5
  assert streets["station_paving_patch_rectangles_world_m"] == regions
  interior = unary_union([box(*r) for r in regions]).buffer(-0.02)
  for surface in streets["surfaces"]:
    points = (
      np.frombuffer(base64.b64decode(surface["positions_cm_b64"]), dtype="<i4").reshape(
        -1, 2
      )
      / 100
    )
    indices = np.frombuffer(
      base64.b64decode(surface["indices_b64"]), dtype="<u4"
    ).reshape(-1, 3)
    triangles = shapely.polygons(points[indices])
    candidates = triangles[shapely.intersects(triangles, interior)]
    assert sum(shapely.area(shapely.intersection(candidates, interior))) < 1e-6


def test_native_avenue_retains_surface_classes_and_keeps_mouths_open():
  native = json.loads(
    (ROOT / "src/app/src/data/unterDenLindenBlockStreets.json").read_text()
  )
  assert native["classes"] == ["asphalt", "paving", "gravel", "grass", "kerb"]
  assert native["cell_count"] == sum(r[2] for r in native["runs"])
  assert native["cell_count"] > 50000
  assert {r[3] for r in native["runs"]} == set(range(5))
  patches = unary_union([box(*r) for r in entrance_regions_world()])
  surfaces = [box(x, z, x + length, z + 1) for x, z, length, _ in native["runs"]]
  assert sum(s.intersection(patches).area for s in surfaces) == 0
  assert max(r[0] + r[2] for r in native["runs"]) >= 1799
