"""Source completeness, finite masks and independent northern native geometry."""

import base64
import xml.etree.ElementTree as ET
import zipfile

import numpy as np
import pytest
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts
from scripts.build_bebelplatz_building_source import part_profile
from scripts.build_north_park_terrain_v306 import (
  baseline_height_v306,
  sample_offset_v306,
)
from scripts.build_north_sites_v306 import DATA, GEO, SOURCE, read, sha


def unpack_mesh(record):
  p = np.frombuffer(base64.b64decode(record["position"]), "<f4").reshape(-1, 3)
  ix = np.frombuffer(base64.b64decode(record["index"]), "<u4").reshape(-1, 3)
  assert len(p) == record["vertices"]
  assert len(ix) == record["triangles"]
  assert np.isfinite(p).all() and ix.max() < len(p)
  return p, ix


def test_current_lessing_complete_families_and_exact_new_scope():
  s = read(SOURCE)
  school = s["school"]
  assert school["parcel"]["id"] == "way/111657919"
  assert {p["id"]: len(p["parts"]) for p in school["parents"]} == {
    "DEBE01YYK0003v0c": 8,
    "DEBE01YYK0003uxc": 1,
  }
  for parent in school["parents"]:
    assert parent["schoolCoverage"] > 0.65
    for p in parent["parts"]:
      assert {f["kind"] for f in p["surfaces"]} >= {"WallSurface", "RoofSurface"}
      assert p["top_y_m"] > p["ground_y_m"]
  assert school["priorOverlapM2"] == 0
  requested = shape(school["requestedFootprint"])
  complete = unary_union(
    [Polygon(p["ring"], p["holes"]) for f in school["parents"] for p in f["parts"]]
  )
  assert complete.difference(requested).area < 1e-6
  assert requested.symmetric_difference(shape(school["newFootprint"])).area < 1e-6
  assert 5800 < requested.area < 5830
  # This is Schöningstraße, over a kilometre from the historical Pankstraße school.
  assert requested.bounds[0] < -1750 and requested.bounds[1] < -4290
  named = read(GEO / "bounds-named-v306.geojson")["features"]
  assert len(named) == 1 and named[0]["properties"]["oldOverlapM2"] == 0
  for p, h in s["sourceFiles"].items():
    assert sha(GEO.parents[1] / p) == h


def test_every_school_leaf_and_full_sheet_matches_original_official_archive():
  source = read(SOURCE)
  expected = {p["id"]: p for p in source["school"]["parents"]}
  seen = set()
  with zipfile.ZipFile(GEO / "raw/north-v306/LoD2_387_5824.zip") as archive:
    member = next(n for n in archive.namelist() if n.lower().endswith(("gml", "xml")))
    with archive.open(member) as stream:
      for _, element in ET.iterparse(stream, events=("end",)):
        if element.tag != f"{{{NS['bldg']}}}Building":
          continue
        identity = element.get(GML_ID)
        if identity in expected:
          parts = [part_profile(p) for p in leaf_building_parts(element) or [element]]
          assert parts == expected[identity]["parts"]
          seen.add(identity)
        element.clear()
  assert seen == expected.keys()


def test_native_surfaces_are_independent_cardinal_and_school_courts_open():
  data = read(DATA / "northSitesV306.json")
  nav = read(DATA / "northSitesV306Navigation.json")
  for site in data["sites"]:
    drawn, _ = unpack_mesh(site["drawn"])
    p, ix = unpack_mesh(site["native"])
    cross = np.cross(p[ix[:, 1]] - p[ix[:, 0]], p[ix[:, 2]] - p[ix[:, 0]])
    assert (np.count_nonzero(abs(cross) > 1e-6, axis=1) <= 1).all()
    assert site["drawn"]["position"] != site["native"]["position"]
    if site["key"] == "thaelmann":
      assert drawn[:, 1].max() == pytest.approx(17, abs=1e-5)
      assert drawn[:, 1].min() == pytest.approx(3, abs=1e-5)
      n = next(s for s in nav["sites"] if s["key"] == "thaelmann")
      assert len(n["native"]) > 50
      assert max(p["high"] - p["low"] for p in n["native"]) <= 1
  school = next(s for s in nav["sites"] if s["key"] == "lessing")
  assert len(school["drawn"]) == 9
  original = read(SOURCE)
  footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in school["drawn"]])
  # Actual large open court remains floor, rather than an opaque campus box.
  parcel = shape(original["school"]["parcel"]["geometry"])
  court = parcel.difference(footprint).buffer(-2)
  assert court.area > 600
  for p in school["native"]:
    ring = p["ring"]
    assert all(
      abs(a[0] - b[0]) < 1e-6 or abs(a[1] - b[1]) < 1e-6
      for a, b in zip(ring, ring[1:] + ring[:1])
    )
  ground = read(DATA / "northSchoolGroundV306.json")
  for r in ground["nativeCells"]:
    assert shape(ground["geometry"]).covers(box(*r[:4]))
  assert ground["groundY"] == 3.015


def test_four_metre_terrain_is_exact_measured_delta_and_zero_off_source():
  runtime = read(DATA / "northParkTerrainV306.json")
  evidence = read(GEO / "north-park-terrain-v306-source.json.gz")
  assert evidence["runtimeSha256"] == sha(DATA / "northParkTerrainV306.json")
  for a in evidence["archives"]:
    assert sha(GEO.parents[1] / a["path"]) == a["sha256"]
  for p, e in zip(runtime["profiles"], evidence["profiles"]):
    domain = shape(p["domain"])
    assert domain.difference(shape(e["park"])).area < 1e-6
    assert domain.intersection(shape(e["buildingExclusion"])).area < 1e-6
    assert p["step"] == p["nativeStep"] == 4
    for x, z, measured, base, weight in e["sourceSamples"][::31]:
      assert baseline_height_v306(x, z) == pytest.approx(base, abs=1e-5)
      assert sample_offset_v306(p, x, z) == pytest.approx(
        round((measured - 30 - base) * weight, 5), abs=2e-5
      )
    for x, z in [(0, 0), (p["bounds"][0] - 1, p["bounds"][1] - 1)]:
      assert sample_offset_v306(p, x, z) == 0
    pt = domain.representative_point()
    assert sample_offset_v306(p, pt.x + 0.01, pt.y + 0.01, True) == sample_offset_v306(
      p, pt.x + 0.02, pt.y + 0.02, True
    )


def test_estate_and_pool_retains_all_previous_bodies_and_caps():
  data = read(DATA / "northQuarterV306.json")
  evidence = read(GEO / "north-quarter-v306-evidence.json.gz")
  assert len(data["keys"]) == 6
  assert len({r["owner"] for r in evidence["fronts"]}) == 11
  assert {r["floors"] for r in evidence["fronts"]} == {2, 8, 17, 21}
  assert not evidence["retiredGenericPanes"]
  for key, p in data["packets"].items():
    assert (
      not p["retire"]
      and not p["retireNav"]
      and not p["retireLines"]
      and not p["appendNav"]
    )
    assert p["preparedRecords"][: len(p["records"])] == p["records"]
    a = p["append"]
    ps = np.frombuffer(base64.b64decode(a["positions"]), "<u2").reshape(-1, 3)
    ix = np.frombuffer(base64.b64decode(a["indices"]), "<u4").reshape(-1, 3)
    assert len(ps) > 1000 and ix.max() < len(ps)
    if key.startswith("minecraft:"):
      cross = np.cross(
        ps[ix[:, 1]].astype(float) - ps[ix[:, 0]],
        ps[ix[:, 2]].astype(float) - ps[ix[:, 0]],
      )
      assert (np.count_nonzero(abs(cross) > 1e-6, axis=1) <= 1).all()
  for f in evidence["fronts"]:
    assert (
      f["sourceBodyRetained"] and f["sourceRoofRetained"] and f["sourcePaintRetained"]
    )
    assert all(q["vertices"] > 0 for q in f["faces"])
