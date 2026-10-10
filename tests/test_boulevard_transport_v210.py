"""Source-based paint, exact curb courses and untouched previous street layers."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Polygon, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app/src/data"


def read(path):
  return json.loads(path.read_text())


def test_source_scope_and_positive_marking_evidence():
  source = read(GEO / "boulevard-transport-v210-source.json")
  evidence = read(GEO / "boulevard-transport-v210-evidence.json")
  scope = shape(
    read(GEO / "boulevard-transport-v210-scope.geojson")["features"][0]["geometry"]
  )
  assert set(evidence["namedSourceWays"]) == {
    "Kurfürstendamm",
    "Friedrichstraße",
    "Karl-Marx-Allee",
    "Karl-Marx-Straße",
  }
  assert len(source["namedRoads"]) == 518
  assert scope.area < 350_000
  by_key = {f["key"]: f for f in source["features"]}
  for owner in evidence["paintOwners"]:
    tags = by_key[owner["key"]]["tags"]
    if owner["kind"] == "lane_dividers":
      assert tags["lane_markings"] == "yes"
      assert int(tags["lanes"]) >= 2
    elif owner["kind"] == "restriction":
      assert tags["road_marking"] == "restriction"
      assert tags["pattern"] == "stripes"
    elif owner["kind"] == "zebra":
      assert "zebra" in (
        tags.get("crossing:markings"),
        tags.get("crossing"),
        tags.get("crossing_ref"),
      )
    else:
      assert tags["crossing:markings"] == owner["kind"]
  rows = np.array(evidence["paintStrips"])
  corners = []
  for x, z, length, width, angle, _ in rows:
    c, s = math.cos(angle), math.sin(angle)
    corners.append(
      [
        (x + c * u - s * v, z + s * u + c * v)
        for u, v in (
          (-length / 2, -width / 2),
          (length / 2, -width / 2),
          (length / 2, width / 2),
          (-length / 2, width / 2),
        )
      ]
    )
  # Coordinates are rounded only after exact scope containment; allow that
  # rounding tolerance, not a newly widened presentation region.
  assert shapely.covers(scope.buffer(0.002), shapely.polygons(corners)).all()
  assert (
    read(APP / "boulevardTransportCorrectionsV210.json")["suppressedMarkingIndices"]
    == []
  )


def test_native_full_pixels_and_curbs_are_bounded_and_do_not_replace_sources():
  source = read(APP / "boulevardTransportV210.json")
  scope = shape(
    read(GEO / "boulevard-transport-v210-scope.geojson")["features"][0]["geometry"]
  )
  assert len(source["cells"]) == 20
  rectangles = []
  for cell in source["cells"]:
    for ix, iz, count, _ in cell["nativeRuns"]:
      rectangles.append(shapely.box(ix / 4, iz / 4, (ix + count) / 4, (iz + 1) / 4))
      assert ix // 16 == (ix + count - 1) // 16
  assert shapely.covers(scope.buffer(1e-7), rectangles).all()
  curbs = read(APP / "boulevardCurbsV210.json")
  exact = shape(read(GEO / "boulevard-curbs-v210-evidence.json")["sourceGeometry"])
  assert 16_000 < exact.length < 18_000
  core = read(APP / "surroundingCityScope.json")["core"]
  assert exact.intersection(Polygon(core["ring"], core["holes"])).length < 1e-6
  segments = np.array(curbs["segments"]).reshape(-1, 2, 2)
  assert shapely.covers(exact.buffer(0.0002), shapely.linestrings(segments)).all()
  assert np.max(np.linalg.norm(segments[:, 1] - segments[:, 0], axis=1)) < 2.001
  # Reuse is additive: no existing road packet or source owner is suppressed.
  for path, digest in read(GEO / "boulevard-transport-v210-evidence.json")[
    "inputSha256"
  ].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest


def test_internal_source_junctions_keep_full_lane_ribbons_clear():
  from shapely.geometry import Point

  audit = read(GEO / "boulevard-transport-v210-evidence.json")
  assert audit["interiorJunctionClearanceM"] == 4
  cases = [
    ("way/32880568", Point(-3872.8431887872284, 1902.353633614257)),
    ("way/858527788", Point(4617.878967634169, 5276.312403159216)),
  ]
  for key, junction in cases:
    assert any(
      r["key"] == key and Point(r["position"]).distance(junction) < 1e-7
      for r in audit["interiorJunctions"]
    )
    for owner in audit["paintOwners"]:
      if owner["key"] != key or owner["kind"] != "lane_dividers":
        continue
      for x, z, length, width, angle, _ in audit["paintStrips"][
        owner["first"] : owner["first"] + owner["count"]
      ]:
        c, s = math.cos(angle), math.sin(angle)
        ribbon = Polygon(
          [
            (x + c * u - s * v, z + s * u + c * v)
            for u, v in [
              (-length / 2, -width / 2),
              (length / 2, -width / 2),
              (length / 2, width / 2),
              (-length / 2, width / 2),
            ]
          ]
        )
        assert ribbon.distance(junction) > 3.99


def test_native_curb_quarter_pixels_keep_source_course_and_all_occupied_footprints_clear():
  curbs = read(APP / "boulevardCurbsV210.json")
  audit = read(GEO / "boulevard-curbs-v210-evidence.json")
  exact, occupied = shape(audit["sourceGeometry"]), shape(audit["occupiedGeometry"])
  assert curbs["nativePixelSizeM"] == 0.25
  rectangles, pixels = [], set()
  for ix, iz, width, depth in curbs["nativeRuns"]:
    assert ix // 16 == (ix + width - 1) // 16
    assert iz // 16 == (iz + depth - 1) // 16
    rectangles.append(shapely.box(ix / 4, iz / 4, (ix + width) / 4, (iz + depth) / 4))
    for x in range(ix, ix + width):
      for z in range(iz, iz + depth):
        assert (x, z) not in pixels
        pixels.add((x, z))
  assert len(pixels) == curbs["nativePixelCount"] == 84983
  allowed_band = exact.buffer(math.sqrt(2) * 0.25 + 1e-7)
  shapely.prepare(allowed_band)
  assert shapely.covers(allowed_band, rectangles).all()
  shapely.prepare(occupied)
  assert not shapely.intersects(occupied, rectangles).any()
  # The previous diagonal segment AABB crossed this delivered building.
  old_box = shapely.box(4171.6148, 4246.7111, 4172.8581, 4248.2329)
  assert old_box.intersection(occupied).area > 0.005
  nearby = [r for r in rectangles if r.intersects(old_box)]
  assert nearby
  assert sum(r.intersection(occupied).area for r in nearby) == 0
  core = read(APP / "surroundingCityScope.json")["core"]
  assert not shapely.intersects(Polygon(core["ring"], core["holes"]), rectangles).any()
