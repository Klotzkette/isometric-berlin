"""Named source ownership and measured-sheet guards for Rosenthaler Platz."""

import importlib.util
import json
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def exporter():
  with pytest.MonkeyPatch.context() as patch:
    patch.syspath_prepend(str(ROOT / "scripts"))
    spec = importlib.util.spec_from_file_location(
      "rosenthal", ROOT / "scripts/build_rosenthaler_platz_v163.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    yield module


@pytest.fixture(scope="module")
def source():
  return json.loads(
    (ROOT / "geo_data/regierungsviertel/rosenthaler-platz-v163.json").read_text()
  )


def test_fixed_source_parents_and_free_reference(source) -> None:
  assert len(source["buildings"]) == 11
  assert sum(len(b["parts"]) for b in source["buildings"]) == 40
  assert len({b["id"] for b in source["buildings"]}) == 11
  assert source["photo"]["license"] == "CC BY-SA 4.0"
  assert source["sourceArchives"][0]["license"] == "dl-de/zero-2-0"
  assert all(all(m.isnumeric() for m in b["matches"]) for b in source["buildings"])


def test_complete_source_walls_and_roofs_survive_translation(exporter, source) -> None:
  for building in source["buildings"]:
    detail, _ = exporter.building_detail(building)
    delta = 3 - min(p["ground_y_m"] for p in building["parts"])
    expected = []
    for p in building["parts"]:
      for s in p["surfaces"]:
        if s["kind"] not in {"RoofSurface", "WallSurface"}:
          continue
        rings = [[[x, y + delta, z] for x, y, z in r] for r in s["rings"]]
        expected.extend(exporter.triangulate(rings))
    actual = [t for t, c, r in detail.triangles if r.startswith("source ")]
    assert actual == expected


def test_all_measured_navigation_parts_and_open_courts_retained(
  exporter, source
) -> None:
  for b in source["buildings"]:
    _, nav = exporter.building_detail(b)
    assert len(nav) == len(b["parts"])
    actual = unary_union([r["geometry"] for r in nav])
    expected = unary_union([Polygon(p["ring"], p["holes"]) for p in b["parts"]])
    assert actual.symmetric_difference(expected).area < 1e-6
    assert {r["partId"] for r in nav} == {p["id"] for p in b["parts"]}
    assert all(r["height"] > r["minHeight"] for r in nav)


def test_circus_hostel_identified_separately_from_hotel(exporter, source) -> None:
  b = next(b for b in source["buildings"] if b["id"] == exporter.HOSTEL_ID)
  assert b["matches"] == ["51166236"]
  assert b["osmTags"]["building:colour"] == "white"
  assert b["osmTags"]["building:levels"] == "5"
  detail, _ = exporter.building_detail(b)
  assert any(r == "hostel sign band" for t, c, r in detail.triangles)
  assert all(
    c == (232, 231, 217) for t, c, r in detail.triangles if r == "source WallSurface"
  )


def test_native_geometry_is_surface_only_and_orthogonal(exporter, source) -> None:
  b = next(b for b in source["buildings"] if b["id"] == exporter.HOSTEL_ID)
  detail, _ = exporter.building_detail(b)
  native = exporter.native_detail(detail)
  assert 1000 < len(native.triangles) < 40000
  for triangle, color, role in native.triangles:
    a, b, c = np.array(triangle)
    assert np.count_nonzero(np.abs(np.cross(b - a, c - a)) > 0.001) == 1


def test_packet_audit_owns_only_known_buildings_and_clock(source) -> None:
  path = ROOT / "geo_data/regierungsviertel/rosenthaler-platz-v163-audit.json"
  report = json.loads(path.read_text())
  assert report["suppressedClockCanopy"] == "OSM-way-417529567"
  assert report["replacementClockModule"] == "EastSquaresV163.ts"
  allowed = {b["id"] for b in source["buildings"]} | {"OSM-way-417529567"}
  assert {c["chunk"] for c in report["chunks"]} == {"3_-3", "4_-3", "5_-1"}
  for c in report["chunks"]:
    assert set(c["ownedIds"]) <= allowed
    for mode in ["drawn", "minecraft"]:
      assert c[mode]["navigationOutsideNamedIdsUnchanged"]
      assert c[mode]["retainedUnownedTriangles"] > 0
      assert c[mode]["decodedBytes"] < 12 * 1024 * 1024
