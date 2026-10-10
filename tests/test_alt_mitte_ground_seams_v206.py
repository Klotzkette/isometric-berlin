"""Exact source ownership for the bounded drawn grass/road seam correction."""

import base64
import hashlib
import json
from pathlib import Path

import numpy as np
import pytest
import shapely
from shapely.affinity import affine_transform
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
DATA = json.loads((APP / "altMitteGroundSeamsV206.json").read_text())
AUDIT = json.loads((GEO / "alt-mitte-ground-seams-v206-evidence.json").read_text())


def decode(key: str, dtype: str) -> np.ndarray:
  """Read the existing exact-land-complement wire format."""
  return np.frombuffer(base64.b64decode(DATA[key]), dtype=dtype)


def test_scope_grass_ownership_and_unchanged_all_source_geometry():
  ground = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json").read_text()
  )
  for name, sha in AUDIT["inputSha256"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == sha
  cells = decode("cells_u32", "<u4").reshape(-1, 6)
  spans = decode("spans_u32", "<u4")
  tops = decode("tops_f32", "<f4")
  assert len(cells) == 2294 and int(spans.sum()) == 5401
  assert len(AUDIT["records"]) == 1914
  for entry in AUDIT["records"]:
    iz, start, run, cls = entry["sourceRun"]
    assert [start, run, cls] in ground["ground_rows"][iz]
    assert ground["classes"][cls] == "grass"
    for record in range(entry["firstCell"], entry["firstCell"] + entry["cellCount"]):
      col, row, *_ = cells[record]
      assert row == iz and start <= col < col + spans[record] <= start + run
      assert float(tops[record]) == pytest.approx(entry["originalTop"], abs=0.000001)


def test_only_exact_source_road_overlap_is_removed_from_coarse_grass():
  triangles = decode("triangles_f32", "<f4").reshape(-1, 2)
  records = decode("cells_u32", "<u4").reshape(-1, 6)
  spans = decode("spans_u32", "<u4")
  scope = affine_transform(
    shape(
      json.loads((GEO / "alt-mitte-v169-boundary.geojson").read_text())["features"][0][
        "geometry"
      ]
    ),
    [1, 0, 0, -1, -389500, 5820000],
  )
  # Independently decode the actual shipped road/pavement triangle footprints.
  road_polygons = []
  for line in (APP / "restoredRoadSurfaces.ndjson.txt").read_text().splitlines()[1:]:
    item = json.loads(line)
    if item["kind"] not in {"asphalt", "paving"}:
      continue
    pos = np.frombuffer(base64.b64decode(item["xz"]), dtype="<f4").reshape(-1, 2)
    ids = np.frombuffer(base64.b64decode(item["indices"]), dtype="<u4").reshape(-1, 3)
    polys = shapely.polygons(pos[ids])
    road_polygons.extend(polys[shapely.intersects(polys, scope)])
  for filename in ("districtStreets.json", "schlossEastStreets.json"):
    for item in json.loads((APP / filename).read_text())["surfaces"]:
      if item["kind"] not in {"asphalt", "paving", "sidewalk", "gravel"}:
        continue
      pos = (
        np.frombuffer(base64.b64decode(item["positions_cm_b64"]), dtype="<i4").reshape(
          -1, 2
        )
        / 100
      )
      ids = np.frombuffer(base64.b64decode(item["indices_b64"]), dtype="<u4").reshape(
        -1, 3
      )
      polys = shapely.polygons(pos[ids])
      road_polygons.extend(polys[shapely.intersects(polys, scope)])
  roads = unary_union(road_polygons).buffer(0.002)
  scope = scope.buffer(0.002)
  shapely.prepare(roads)
  shapely.prepare(scope)
  removed_area = 0.0
  for i, (col, row, first, count, *_) in enumerate(records):
    x = (DATA["grid"]["min_x_idx"] + int(col)) * 4
    z = (DATA["grid"]["min_z_idx"] + int(row)) * 4
    rectangle = box(x, z, x + int(spans[i]) * 4, z + 4)
    points = triangles[first : first + count]
    retained = (
      unary_union(shapely.polygons(points.reshape(-1, 3, 2))) if count else Polygon()
    )
    assert rectangle.buffer(0.002).covers(retained)
    removed = rectangle.difference(retained)
    assert scope.covers(removed)
    # GEOS can leave collinear union/difference fragments (~1e-13 m²); these
    # have no surface area. Reject any geometrically meaningful off-road cut.
    if not roads.covers(removed):
      assert removed.difference(roads).area < 1e-9
    removed_area += removed.area
  assert removed_area == pytest.approx(AUDIT["counts"]["correctedAreaM2"], abs=1)
  assert (APP / "altMitteGroundSeamsV206.json").stat().st_size < 2_500_000
