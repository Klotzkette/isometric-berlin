"""Independent source footprint/axis checks for the bounded gate correction."""

from __future__ import annotations

import json
import math
from pathlib import Path

import pytest
from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "geo_data/regierungsviertel/charlottenburger-tor-v201-evidence.json"


def test_both_unclipped_source_rings_independently_determine_axes() -> None:
  data = json.loads(EVIDENCE.read_text())
  geometry = transform(
    Transformer.from_crs(4326, 25833, always_xy=True).transform,
    shape(data["sourceGeoJsonGeometry"]),
  )
  polygons = sorted(geometry.geoms, key=lambda p: -p.centroid.y)
  assert len(polygons) == len(data["wings"]) == 2
  for polygon, wing in zip(polygons, data["wings"], strict=True):
    ring = [[x - 389500, 5820000 - y] for x, y in polygon.exterior.coords]
    assert wing["ringWorldM"] == ring
    assert len(ring) > 30  # Whole curved source outline, not its bounding rectangle.
    assert wing["centerWorldM"] == [
      polygon.centroid.x - 389500,
      5820000 - polygon.centroid.y,
    ]
    r = list(polygon.minimum_rotated_rectangle.exterior.coords)
    dx, dy = max(
      ((b[0] - a[0], b[1] - a[1]) for a, b in zip(r, r[1:])),
      key=lambda p: math.hypot(*p),
    )
    assert wing["yawDegrees"] == pytest.approx(math.degrees(math.atan2(dy, dx)) % 180)
  assert polygons[0].distance(polygons[1]) == pytest.approx(
    35.072110879196174, abs=1e-7
  )
  # Published opening and present OSM stone outlines are distinct evidence.
  projected_gap = polygons[0].bounds[1] - polygons[1].bounds[3]
  assert 34 < projected_gap < 35
  assert data["publishedOpeningM"] == 34


def test_native_boxes_are_exact_lossless_surface_cell_coalescing() -> None:
  data = json.loads(
    (ROOT / "src/app/src/data/charlottenburgerTorV201.json").read_text()
  )
  nav = json.loads(
    (ROOT / "src/app/src/data/charlottenburgerTorV201Navigation.json").read_text()
  )
  assert data["partCounts"] == [29, 29]
  assert len(nav["primitives"]) == 58
  cells = {}
  for x, y, z, w, h, d, color in data["boxes"]:
    assert w == d == data["step"] == 0.5
    assert h > 0 and h / 0.5 == round(h / 0.5)
    assert 0 <= color <= 0xFFFFFF
    ix, iz = math.floor(x / 0.5), math.floor(z / 0.5)
    for iy in range(round((y - h / 2) / 0.5), round((y + h / 2) / 0.5)):
      assert (ix, iy, iz) not in cells
      cells[ix, iy, iz] = color
  assert len(cells) == data["nativeSurfaceCells"]
  nav_cells = set()
  for x, z, *ys in nav["nativeColumns"]:
    for low, high in zip(ys[::2], ys[1::2], strict=True):
      nav_cells.update((x, iy, z) for iy in range(round(low / 0.5), round(high / 0.5)))
  assert nav_cells == set(cells)
  assert len(data["boxes"]) * 76 < 550_000
