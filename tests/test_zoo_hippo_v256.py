"""Independent retained-source, placement and navigation checks for Hippo Bay."""

import hashlib
import json
import math
from pathlib import Path

import pytest
from shapely.geometry import LineString, Point, Polygon
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
SOURCE = json.loads((DATA / "zooGroundsV165Source.json").read_text())
HIPPO = json.loads((DATA / "zooHippoV256Source.json").read_text())
RECEIPT = json.loads(
  (ROOT / "geo_data/regierungsviertel/zoo-hippo-v256-evidence.json").read_text()
)


def test_all_prior_sources_and_authored_v255_details_are_unchanged() -> None:
  for name, digest in RECEIPT["preservedInputs"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest
  assert RECEIPT["retainedOwners"] == ["DEBE01YYK0002NM4", "DEBE01YYK0003VAC"]
  assert RECEIPT["replacementOwners"] == []
  assert RECEIPT["newDrawCalls"] == RECEIPT["newStreamingDescriptors"] == 0
  assert RECEIPT["sourceWallAndRoofSurfaces"] == 480
  assert "1997" in RECEIPT["temporalQualification"]
  assert "2023" in RECEIPT["temporalQualification"]
  assert "three broad" in RECEIPT["geometryLimitation"]


def test_grid_follows_retained_source_roof_and_concave_perimeter() -> None:
  part = next(p for p in SOURCE["parts"] if p["id"] == HIPPO["part"])
  footprint = Polygon(part["ring"])
  triangles = [
    tri
    for surface in SOURCE["surfaces"]
    if surface["partId"] == HIPPO["part"] and surface["kind"] == "RoofSurface"
    for tri in surface["triangles"]
  ]
  planes = []
  polygons = []
  for a, b, c in triangles:
    ux, uy, uz = [b[i] - a[i] for i in range(3)]
    vx, vy, vz = [c[i] - a[i] for i in range(3)]
    normal = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
    if abs(normal[1]) > 1e-8:
      planes.append((a, normal))
      polygons.append(Polygon([(v[0], v[2]) for v in [a, b, c]]).buffer(1e-5))
  index = STRtree(polygons)
  assert HIPPO["gridWidthM"] == 1.2
  assert 2000 < len(HIPPO["ribs"]) < 2800
  for segment in HIPPO["ribs"]:
    assert footprint.buffer(0.001).covers(LineString([(p[0], p[2]) for p in segment]))
    # Independent 3D plane equation at both endpoints and the segment midpoint.
    for x, y, z in [*segment, [(a + b) / 2 for a, b in zip(*segment)]]:
      heights = []
      for triangle_index in index.query(Point(x, z), predicate="intersects"):
        a, (nx, ny, nz) = planes[triangle_index]
        heights.append(a[1] - (nx * (x - a[0]) + nz * (z - a[2])) / ny)
      assert heights
      assert y == pytest.approx(max(heights) + 0.018, abs=0.00005)
  assert len(HIPPO["edges"]) == len(part["ring"])
  for i, (a, b) in enumerate(HIPPO["edges"]):
    assert [a[0], a[2]] == part["ring"][i]
    assert [b[0], b[2]] == part["ring"][(i + 1) % len(part["ring"])]


def test_native_trim_is_orthogonal_and_within_existing_roof_support() -> None:
  nav = json.loads((DATA / "zooGroundsV165Navigation.json").read_text())
  ceilings = {
    (x, z): y for start, end, z, y in nav["nativeRoofRuns"] for x in range(start, end)
  }
  part = next(p for p in SOURCE["parts"] if p["id"] == HIPPO["part"])
  footprint = Polygon(part["ring"])
  for x, y, z, width, height, depth in HIPPO["nativeRoofBars"]:
    assert width in (0.14, 1)
    assert depth in (0.14, 1)
    assert footprint.covers(
      Polygon(
        [
          (x - width / 2, z - depth / 2),
          (x + width / 2, z - depth / 2),
          (x + width / 2, z + depth / 2),
          (x - width / 2, z + depth / 2),
        ]
      )
    )
    assert y + height / 2 == pytest.approx(ceilings[math.floor(x), math.floor(z)])
  assert 1000 < len(HIPPO["nativeRoofBars"]) + len(HIPPO["nativePosts"]) < 1400
