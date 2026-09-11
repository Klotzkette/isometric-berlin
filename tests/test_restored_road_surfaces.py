"""Every retained road is restored or explicitly owned by a newer exact surface."""

from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path

import numpy as np
import pytest
import shapely
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union

from scripts import build_restored_road_surfaces as roads

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data/restoredRoadSurfaces.ndjson.txt"
SOURCE = ROOT / "src/app/public/mesh/regierungsviertel/surface-polygons.json"


def triangles(batch: dict) -> np.ndarray:
  """Decode the exact typed triangles sent to the runtime, not manifest counts."""
  points = np.frombuffer(base64.b64decode(batch["xz"]), dtype="<f4").reshape(-1, 2)
  indices = np.frombuffer(base64.b64decode(batch["indices"]), dtype="<u4")
  assert len(indices) % 3 == 0
  assert len(indices) and int(indices.max()) < len(points)
  return points[indices].reshape(-1, 3, 2).astype(np.float64)


def triangle_area(values: np.ndarray) -> float:
  edges = values[:, 1:] - values[:, :1]
  return float(
    np.abs(edges[:, 0, 0] * edges[:, 1, 1] - edges[:, 0, 1] * edges[:, 1, 0]).sum() / 2
  )


@pytest.fixture(scope="module")
def payload() -> dict:
  with DATA.open() as source:
    manifest = json.loads(next(source))
    manifest["batches"] = [json.loads(line) for line in source]
  assert manifest["batch_count"] == len(manifest["batches"])
  return manifest


def test_cache_binds_all_retained_source_roads_and_exact_replacements(
  payload: dict,
) -> None:
  assert payload["format"] == "bounded-source-road-surfaces"
  assert payload["version"] == 1
  assert payload["source_sha256"] == hashlib.sha256(SOURCE.read_bytes()).hexdigest()
  assert (
    payload["district_sha256"]
    == hashlib.sha256(
      (ROOT / "src/app/src/data/districtStreets.json").read_bytes()
    ).hexdigest()
  )
  source = json.loads(SOURCE.read_text())
  for kind, expected in (("asphalt", 948), ("paving", 1483)):
    item = payload["inventory"][kind]
    assert (
      item["records"] == expected == sum(p.get("kind") == kind for p in source["roads"])
    )
    assert item["source_area_m2"] == pytest.approx(
      item["restored_area_m2"] + item["owned_area_m2"], abs=0.01
    )
    assert item["restored_area_m2"] == pytest.approx(item["clipped_area_m2"], abs=0.02)
    assert item["clipped_area_m2"] == pytest.approx(
      item["union_area_m2"] + item["overlap_area_m2"], abs=0.02
    )
    assert item["union_area_m2"] == pytest.approx(
      item["triangulated_area_m2"], abs=0.02
    )
  assert set(payload["ownership"]) == {
    "DistrictStreets exact triangles",
    "Brandenburg approach",
    "Bebelplatz glass/library",
    "Hansaplatz courts/U9/buildings",
    "Hand mit Uhr paving",
    "T4 memorial field",
  }


def test_typed_triangles_represent_inventory_with_bounded_terrain_edges(
  payload: dict,
) -> None:
  measured = {"asphalt": 0.0, "paving": 0.0}
  ids = set()
  for batch in payload["batches"]:
    assert batch["id"] not in ids
    ids.add(batch["id"])
    points = np.frombuffer(base64.b64decode(batch["xz"]), dtype="<f4")
    assert np.isfinite(points).all()
    if batch["kind"] == "kerbs":
      assert points.size % 4 == 0
      # Four vertices, six indices and one ink segment per original curb segment.
      runtime_bytes = points.size // 4 * (12 * 4 + 6 * 4 + 6 * 4)
    else:
      values = triangles(batch)
      lengths = np.linalg.norm(values - np.roll(values, 1, axis=1), axis=2)
      assert lengths.max() <= 64.002
      assert np.ptp(values[:, :, 0]) <= 512.002
      assert np.ptp(values[:, :, 1]) <= 512.002
      measured[batch["kind"]] += triangle_area(values)
      runtime_bytes = points.size // 2 * 3 * 4 + values.shape[0] * 3 * 4
    # No giant whole-city temporary mesh can return in a single Worker transfer.
    assert runtime_bytes < 8 * 1024 * 1024, batch["id"]
  for kind, area in measured.items():
    # Float32 world metres displace source edges by at most sub-millimetres.
    assert area == pytest.approx(
      payload["inventory"][kind]["triangulated_area_m2"], rel=2e-6, abs=0.02
    )


def test_new_road_fill_never_closes_bebel_glass_or_hansaplatz_courts(
  payload: dict,
) -> None:
  grips = json.loads((ROOT / "src/app/src/gripsHansaplatzSource.json").read_text())
  protected = [
    box(1512, 296, 1524, 304),
    *(Polygon(c["ring"]) for c in grips["courts"]),
  ]
  for region in protected:
    # Rounding the source boundary to Float32 can move an edge less than 1 mm.
    interior = region.buffer(-0.002)
    min_x, min_z, max_x, max_z = region.bounds
    overlap = 0.0
    for batch in payload["batches"]:
      if batch["kind"] == "kerbs":
        continue
      values = triangles(batch)
      low, high = values.min(axis=1), values.max(axis=1)
      local = values[
        (high[:, 0] > min_x)
        & (low[:, 0] < max_x)
        & (high[:, 1] > min_z)
        & (low[:, 1] < max_z)
      ]
      if local.size:
        overlap += float(
          shapely.area(shapely.intersection(shapely.polygons(local), interior)).sum()
        )
    assert overlap < 0.001, region.bounds


def test_tiling_keeps_real_holes_and_never_invents_curbs_on_tile_seams(
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  source_polygon = box(-80, -30, 190, 110).difference(box(10, 10, 30, 40))
  owner = box(100, -50, 120, 130)
  monkeypatch.setattr(roads, "owned_surfaces", lambda _source, _root: owner)
  source = {
    "source_sha256": "fixture",
    "roads": [
      {
        "kind": "asphalt",
        "ring": list(source_polygon.exterior.coords)[:-1],
        "holes": [list(r.coords)[:-1] for r in source_polygon.interiors],
      }
    ],
  }
  result = roads.build(source)
  plates = [
    Polygon(t) for b in result["batches"] if b["kind"] != "kerbs" for t in triangles(b)
  ]
  expected = source_polygon.difference(owner)
  assert unary_union(plates).symmetric_difference(expected).area < 0.001
  original_edges = source_polygon.boundary
  actual_segments = []
  for batch in result["batches"]:
    if batch["kind"] != "kerbs":
      continue
    values = np.frombuffer(base64.b64decode(batch["xz"]), dtype="<f4").reshape(-1, 2, 2)
    for points in values:
      segment = LineString(points)
      assert segment.difference(original_edges.buffer(0.0001)).length < 0.0001
      assert segment.intersection(owner.buffer(0.149)).length == 0
      actual_segments.append(segment)
  # Outer/inner source boundaries survive; no vertical curb is invented at x=64.
  expected_edges = original_edges.difference(owner.buffer(0.15))
  assert unary_union(actual_segments).length == pytest.approx(
    expected_edges.length, abs=0.0001
  )
  assert not unary_union(actual_segments).intersects(LineString([(64, -20), (64, 100)]))


def test_ndjson_retains_one_bounded_batch_per_line_without_an_array_header(
  payload: dict,
) -> None:
  with DATA.open() as source:
    header = json.loads(next(source))
    assert "batches" not in header
    assert header["encoding"] == "ndjson-base64-float32"
    for index, line in enumerate(source):
      assert len(line) < 2 * 1024 * 1024
      assert json.loads(line) == payload["batches"][index]


def test_ledger_distinguishes_duplicate_source_coverage_from_missing_triangles(
  monkeypatch: pytest.MonkeyPatch,
  tmp_path: Path,
) -> None:
  monkeypatch.setattr(
    roads, "owned_surfaces", lambda _source, _root: box(50, 0, 60, 10)
  )
  source = {
    "source_sha256": "fixture",
    "roads": [
      {
        "kind": "paving",
        "ring": list(box(x, 0, x + 80, 10).exterior.coords)[:-1],
        "holes": [],
      }
      for x in (0, 40)
    ],
  }
  result = roads.build(source)
  area = result["inventory"]["paving"]
  assert area["source_area_m2"] == 1600
  assert area["owned_area_m2"] == 200
  assert area["restored_area_m2"] == area["clipped_area_m2"] == 1400
  assert area["overlap_area_m2"] == 300
  assert area["union_area_m2"] == area["triangulated_area_m2"] == 1100
  path = tmp_path / "roads.ndjson.txt"
  roads.write_cache(path, result)
  records = [json.loads(line) for line in path.read_text().splitlines()]
  assert records[0]["batch_count"] == len(result["batches"])
  assert records[1:] == result["batches"]
